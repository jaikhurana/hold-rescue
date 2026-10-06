// The app uses precise, neutral words: a payment is "reported as fraud" and police "ask for a hold".
// It never judges the customer, so these words never appear in anything the app shows.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const UI_FILES = ['index.html', 'screens.js', 'case-data.js', 'statement.js', 'app.js', 'agent.js'];
const BANNED = /\b(fake\w*|frozen|freez\w*|FIR|accus\w*)\b|police complaint/gi;

test('no banned words in anything the app shows', () => {
  for (const file of UI_FILES) {
    let source;
    try {
      source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    } catch {
      continue; // a file that doesn't exist yet
    }
    const hits = [...source.matchAll(BANNED)].map((m) => m[0]);
    assert.deepEqual(hits, [], `${file} uses: ${hits.join(', ')}`);
  }
});
