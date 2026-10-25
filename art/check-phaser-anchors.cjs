// Regression check uses the installed Phaser3.90 parser, not a replacement parser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const parse = require('../node_modules/phaser/src/textures/parsers/JSONHash.js');
let total = 0;
for (const name of ['characters', 'town', 'objects']) {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/assets', `${name}.json`), 'utf8'));
  const parsed = {};
  const texture = { source: [{ width: data.meta.size.w, height: data.meta.size.h }], customData: {}, add(key, source, x, y, width, height) { return parsed[key] = { x, y, width, height }; } };
  parse(texture, 0, data);
  for (const [key, source] of Object.entries(data.frames)) {
    const frame = parsed[key];
    assert(frame.customPivot, `Missing pivot: ${key}`);
    assert(frame.pivotX >= 0 && frame.pivotX <= 1 && frame.pivotY >= 0 && frame.pivotY <= 1, `Off-canvas normalized pivot: ${key}`);
    assert(Math.abs(frame.pivotX * frame.width - source.pixelAnchor.x) < 1e-9, `X anchor mismatch: ${key}`);
    assert(Math.abs(frame.pivotY * frame.height - source.pixelAnchor.y) < 1e-9, `Y anchor mismatch: ${key}`);
    total++;
  }
}
console.log(`PASS: actual Phaser JSONHash parser resolves ${total} frame pivots to their native pixel anchors. Iona pivot(0.5,23/24) gives offset(8,23); former pivot(8,23) incorrectly gave offset(128,552).`);
