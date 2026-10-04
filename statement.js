// Pure text functions for the statement. No DOM, so the unit tests can import them directly.
import { SCRIPTED, isExchangeDispute } from './case-data.js';

/**
 * Tidies model output into one plain paragraph with clean [E1]…[E5] tags.
 * `validIds` is the set of evidence IDs in the case file; tags for anything else are dropped,
 * so the model can never point the officer at proof that doesn't exist.
 */
export function cleanDraft(raw, validIds) {
  let text = String(raw ?? '');
  text = text.replace(/[‐‑]/g, '-'); // models often write KK‑2417 with a non-breaking hyphen
  text = text.replace(/–(?=\s*E\d)/g, '-'); // en dash in a tag range like E1–E3
  text = text.replace(/[  ]/g, ' ');
  text = text.replace(/\*\*|__|`/g, '');
  text = text.replace(/^\s*#+\s*/gm, '');
  // A preamble such as "Here is the statement:" or "Sure, here's a draft:".
  text = text.replace(/^\s*(?:sure[,!.]?\s*)?here(?:'s|’s| is| are)\b[^:\n]{0,80}:\s*/i, '');
  text = text.replace(/\s*\n+\s*/g, ' ').trim();
  text = text.replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
  // Tag groups in any common shape become one tag each: [E1, E2] · [E1 and E2] · [E1–E3] · 【E1】 · (E1)
  const group = String.raw`E\d(?:\s*(?:[,;/&]|and|[–-])\s*E\d|\s+E\d)*`;
  text = text.replace(new RegExp(String.raw`[\[【(]\s*(${group})\s*[\]】)]`, 'gi'), (_, inner) => expandTags(inner).map((id) => `[${id}]`).join(''));
  text = text.replace(/\[(E\d)\]/g, (tag, id) => (validIds.has(id) ? tag : ''));
  text = text.replace(/([.।])((?:\s*\[E\d\])+)/g, (_, stop, tags) => ` ${tags.replace(/\s+/g, '')}${stop}`); // "OTP. [E3]" → "OTP [E3]."
  text = text.replace(/\s+([.,;:!?।])/g, '$1');
  text = text.replace(/\s{2,}/g, ' ');
  return text.trim();
}

function expandTags(inner) {
  const ranged = inner.replace(/E(\d)\s*[–-]\s*E(\d)/gi, (_, a, b) => {
    const ids = [];
    for (let n = Number(a); n <= Number(b); n++) ids.push(`E${n}`);
    return ids.join(',');
  });
  return ranged
    .split(/[^E\d]+/i)
    .filter((part) => /^E\d$/i.test(part))
    .map((part) => part.toUpperCase());
}

/** The scripted statement for a language, length and E5 choice. */
export function scriptedStatement(lang, variant, e5) {
  const copy = SCRIPTED[lang] ?? SCRIPTED.en;
  const chat = e5?.kind === 'chat';
  const attach = e5?.kind === 'tag';
  const kind = isExchangeDispute(e5) ? 'exchange' : 'other';
  if (variant === 'shorter') {
    return (chat ? copy.shorter.chat : copy.shorter.nochat) + (attach ? copy.shorter.attach[kind] : '');
  }
  return copy.full
    .filter(([when]) => when === 'all' || (when === 'chat' && chat) || (when === 'attach' && attach) || (when === 'nochat' && !chat))
    .map(([, sentence]) => (typeof sentence === 'string' ? sentence : sentence[kind]))
    .join(' ');
}

/** The first `n` characters of `text`, never cutting a tag like [E3] in half (for the typewriter). */
export function typedSlice(text, n) {
  const open = text.lastIndexOf('[', n - 1);
  const close = open >= 0 ? text.indexOf(']', open) : -1;
  return close >= n ? text.slice(0, close + 1) : text.slice(0, n);
}

/** Word count, ignoring evidence tags. */
export function wordCount(text) {
  return String(text ?? '').replace(/\[E\d\]/g, ' ').split(/\s+/).filter(Boolean).length;
}
