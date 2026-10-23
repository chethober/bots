#!/usr/bin/env python3
"""One-time backfill: read the forum's history with a Telegram *user* session
(the bot can't read history) and feed every music post that doesn't carry the
bot's reaction to the `backfill` endpoint, oldest first.

    python3 scripts/backfill.py --session PATH [--scan] [--emoji 👌]

PATH is a Telethon .session file; it's copied first, so a running userbot
using the same file isn't disturbed. Duplicates are reported, never deleted.
"""
import argparse, asyncio, json, os, re, shutil, subprocess, sys, tempfile, time

import socks
from telethon import TelegramClient, functions, types

FORUM_ID = -1002906907652
API_ID, API_HASH = 922193, "960425a274ed76ed4102bb2a8114a504"  # same app as tlg-music-sorter
PROXY = (socks.SOCKS5, "127.0.0.1", 1080)
BATCH = 10
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUSIC_LINK = re.compile(r"spotify\.com/(?:intl-[a-z-]+/)?track/|spotify:track:|youtube\.com|youtu\.be|music\.apple\.com"
                        r"|deezer\.(?:com|page\.link)|soundcloud\.com|tidal\.com|song\.link|odesli\.co|music\.amazon\.", re.I)


def to_bot_message(msg, topic):
    """Telethon Message → the subset of a Bot API Message the handler reads."""
    text = msg.message or ""
    entities = []
    for e in msg.entities or []:
        if isinstance(e, types.MessageEntityUrl):
            entities.append({"type": "url", "offset": e.offset, "length": e.length})
        elif isinstance(e, types.MessageEntityTextUrl):
            entities.append({"type": "text_link", "offset": e.offset, "length": e.length, "url": e.url})
    out = {
        "message_id": msg.id,
        "message_thread_id": topic.id,
        "is_topic_message": True,
        "chat": {"id": FORUM_ID, "type": "supergroup"},
        "date": int(msg.date.timestamp()),
        "text": text,
        "entities": entities,
        "reply_to_message": {"forum_topic_created": {"name": topic.title}},
    }
    if msg.sender_id:
        out["from"] = {"id": msg.sender_id, "first_name": getattr(msg.sender, "first_name", None) or "someone", "is_bot": False}
    doc = msg.audio  # audio file, not a voice note
    if doc:
        a = next((x for x in doc.attributes if isinstance(x, types.DocumentAttributeAudio)), None)
        fn = next((x.file_name for x in doc.attributes if isinstance(x, types.DocumentAttributeFilename)), None)
        out["audio"] = {"title": a and a.title, "performer": a and a.performer, "file_name": fn}
    return out


def has_reaction(msg, emoji):
    r = msg.reactions
    return bool(r) and any(getattr(c.reaction, "emoticon", None) == emoji for c in r.results)


def is_music(msg):
    return bool(msg.audio) or bool(MUSIC_LINK.search(msg.message or "")) or any(
        isinstance(e, types.MessageEntityTextUrl) and MUSIC_LINK.search(e.url) for e in msg.entities or [])


async def collect(client, emoji):
    topics = []
    offset_date, offset_id, offset_topic = None, 0, 0
    while True:
        res = await client(functions.messages.GetForumTopicsRequest(
            peer=FORUM_ID, offset_date=offset_date, offset_id=offset_id, offset_topic=offset_topic, limit=100))
        page = [t for t in res.topics if isinstance(t, types.ForumTopic)]
        topics += page
        if len(res.topics) < 100:
            break
        last = res.topics[-1]
        offset_topic, offset_id = last.id, last.top_message
        offset_date = next((m.date for m in res.messages if m.id == last.top_message), None)

    todo, stats = [], {}
    for topic in topics:
        if topic.id == 1:  # General
            continue
        s = stats[topic.title] = {"music": 0, "reacted": 0}
        async for msg in client.iter_messages(FORUM_ID, reply_to=topic.id, reverse=True):
            if msg.action or not is_music(msg) or getattr(msg.sender, "bot", False):
                continue
            s["music"] += 1
            if has_reaction(msg, emoji):
                s["reacted"] += 1
            else:
                todo.append(to_bot_message(msg, topic))
    todo.sort(key=lambda m: m["message_id"])
    return todo, stats


def run_batch(messages):
    env = dict(os.environ, NODE_USE_ENV_PROXY="1")
    args = json.dumps({"messages": messages}, ensure_ascii=False)
    p = subprocess.run(["npx", "tgcloud", "run", "endpoints/backfill", args, "--ctx", "{ initData: { user: { id: 6330862227 } } }"],
                       cwd=ROOT, env=env, capture_output=True, text=True, timeout=600)
    # The CLI prints the result as JSON5: "< {results:[...]}  123ms".
    m = re.search(r"^< (.*?)\s+\d+(?:\.\d+)?m?s\s*$", p.stdout, re.M | re.S)
    if p.returncode or not m:
        raise RuntimeError(p.stdout + p.stderr)
    js = subprocess.run(["node", "-e", "process.stdout.write(JSON.stringify(eval('(' + require('fs').readFileSync(0, 'utf8') + ')')))"],
                        input=m.group(1), capture_output=True, text=True, check=True)
    return json.loads(js.stdout)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--session", required=True)
    ap.add_argument("--scan", action="store_true", help="only count, change nothing")
    ap.add_argument("--emoji", default="👌")
    ap.add_argument("--limit", type=int, help="process only the first N posts")
    ap.add_argument("--only", help="file with message ids (one per line) to process")
    ap.add_argument("--batch", type=int, default=BATCH)
    ap.add_argument("--delay", type=float, default=0, help="seconds to wait between batches")
    a = ap.parse_args()

    tmp = tempfile.mkdtemp()
    shutil.copy(a.session, os.path.join(tmp, "s.session"))
    client = TelegramClient(os.path.join(tmp, "s"), API_ID, API_HASH, proxy=PROXY)
    await client.connect()
    if not await client.is_user_authorized():
        sys.exit("session is not logged in")
    try:
        todo, stats = await collect(client, a.emoji)
    finally:
        await client.disconnect()
        shutil.rmtree(tmp, ignore_errors=True)

    for name, s in stats.items():
        print(f"{name}: {s['music']} music posts, {s['reacted']} already reacted")
    print(f"→ {len(todo)} to process")
    if a.scan:
        return
    if a.only:
        only = {int(x) for x in open(a.only).read().split()}
        todo = [m for m in todo if m["message_id"] in only]
    todo = todo[:a.limit] if a.limit else todo

    totals = {}
    for i in range(0, len(todo), a.batch):
        if i and a.delay:
            time.sleep(a.delay)
        res = run_batch(todo[i:i + a.batch])
        for r in res["results"]:
            totals[r["status"]] = totals.get(r["status"], 0) + 1
            if r["status"] not in ("added",):
                print(f"  #{r['message_id']}: {r['status']} {r.get('error', '')}")
        print(f"{min(i + a.batch, len(todo))}/{len(todo)} {totals}", flush=True)


asyncio.run(main())
