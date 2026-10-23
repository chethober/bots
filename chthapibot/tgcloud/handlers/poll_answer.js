// Answers to the bot's non-anonymous quiz polls (🧠 Trivia). Payload is the PollAnswer.
import { recordAnswer } from '../lib/hubs/index.js';

export default async function (answer) {
  try {
    await recordAnswer(answer);
  } catch (e) {
    console.error('poll_answer failed', e);
  }
}
