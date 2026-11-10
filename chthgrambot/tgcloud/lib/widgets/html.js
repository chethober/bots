// The message widget templates, by kind. Each lives in ./templates/<kind>.js and
// is built with page() from ./base.js. Add a kind: create its file, import it here.
//
// Limits (checked by scripts/check-widgets.js): at most 32 KB raw and 4 KB
// zlib-compressed at the maximum level, per template.
import status from './templates/status.js';

export const TEMPLATES = {
  status,
};

// Small stable hash of a template: a changed template gets new shared widgets,
// since a shared widget's HTML is fixed when it is created.
export function templateVersion(kind) {
  const s = TEMPLATES[kind];
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
