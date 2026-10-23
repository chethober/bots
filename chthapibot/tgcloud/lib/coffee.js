// Pour-over and AeroPress brew calculators: /brew <method> [amount] [ratio].
//   amount: "300" or "300ml" = water, "18g" = coffee dose. ratio: "1:15".

const METHODS = {
  v60: {
    name: 'Hario V60',
    ratio: 16.67,            // 15 g : 250 g
    defaultWater: 250,
    temp: '93–96 °C',
    grind: 'medium-fine (table salt)',
    steps(c, w) {
      const bloom = round(c * 2);
      return [
        `0:00 — Bloom: pour <b>${bloom} g</b>, swirl gently`,
        `0:45 — Pour to <b>${round(w * 0.6)} g</b> by 1:15`,
        `1:15 — Pour to <b>${w} g</b> by 1:45`,
        '1:45 — Stir once, give a gentle swirl',
        '3:00–3:30 — Drawdown finished',
      ];
    },
  },
  aeropress: {
    name: 'AeroPress',
    ratio: 15,
    defaultWater: 225,
    temp: '85–95 °C (lighter roast → hotter)',
    grind: 'medium-fine',
    steps(c, w) {
      return [
        `0:00 — Add ${c} g coffee, pour <b>${round(c * 2)} g</b>, stir to wet`,
        `0:30 — Pour to <b>${w} g</b>, insert plunger to stop drips`,
        '2:00 — Swirl, remove plunger cap',
        '2:30 — Press gently for ~30 s',
      ];
    },
  },
  coldbrew: {
    name: 'Cold brew (concentrate)',
    ratio: 8,
    defaultWater: 800,
    temp: 'cold or room-temperature water',
    grind: 'coarse (sea salt)',
    steps(c, w) {
      return [
        `Stir ${c} g coffee into <b>${w} g</b> water until fully wet`,
        'Cover and steep 12–18 h (fridge or room temp)',
        'Filter through paper or a fine mesh',
        `Dilute about 1:1 with water or milk — makes ~${Math.round(w * 0.85 * 2 / 100) * 100} ml to drink`,
      ];
    },
  },
  inverted: {
    name: 'AeroPress (inverted)',
    ratio: 12,
    defaultWater: 200,
    temp: '90–95 °C',
    grind: 'medium',
    steps(c, w) {
      return [
        `0:00 — Inverted: add ${c} g coffee, pour <b>${w} g</b>, stir 3×`,
        '1:30 — Cap with rinsed filter, flip onto the cup',
        '1:45 — Press slowly, stop at the hiss (~30 s)',
      ];
    },
  },
};

const round = (n) => Math.round(n);

export const BREW_METHODS = Object.keys(METHODS);

/**
 * @returns {{ ok: true, html, method, key, coffee, water, ratio } | { ok: false, error: string }}
 */
export function brew(method = 'v60', amount, ratioArg) {
  const key = String(method).toLowerCase().replace(/[^a-z0-9]/g, '');
  const m = METHODS[{ aero: 'aeropress', cold: 'coldbrew' }[key] ?? key];
  if (!m) return { ok: false, error: `Unknown method. Try: ${BREW_METHODS.join(', ')}` };

  let ratio = m.ratio;
  if (ratioArg) {
    const r = /^1[:/](\d+(?:\.\d+)?)$/.exec(String(ratioArg).trim());
    if (!r || +r[1] < 4 || +r[1] > 20) return { ok: false, error: 'Ratio must look like 1:15 (between 1:4 and 1:20).' };
    ratio = +r[1];
  }

  let coffee, water;
  if (amount == null || amount === '') {
    water = m.defaultWater;
    coffee = water / ratio;
  } else {
    const a = /^(\d+(?:\.\d+)?)\s*(g|ml)?$/i.exec(String(amount).trim());
    if (!a) return { ok: false, error: 'Amount must be water like 300 / 300ml, or a dose like 18g.' };
    const n = +a[1];
    if ((a[2] ?? '').toLowerCase() === 'g') {
      if (n < 5 || n > 250) return { ok: false, error: 'Coffee dose must be between 5 g and 250 g.' };
      coffee = n;
      water = n * ratio;
    } else {
      if (n < 80 || n > 2000) return { ok: false, error: 'Water must be between 80 and 2000 ml.' };
      water = n;
      coffee = n / ratio;
    }
  }
  coffee = Math.round(coffee * 10) / 10;
  water = round(water);

  const lines = [
    `☕️ <b>${m.name}</b> — 1:${+ratio.toFixed(2)}`,
    '',
    `Coffee: <b>${coffee} g</b>`,
    `Water: <b>${water} g</b> (ml)`,
    `Temp: ${m.temp}`,
    `Grind: ${m.grind}`,
    '',
    ...m.steps(coffee, water),
  ];
  return { ok: true, html: lines.join('\n'), method: m.name, key: Object.keys(METHODS).find((k) => METHODS[k] === m), coffee, water, ratio: +ratio.toFixed(2) };
}
