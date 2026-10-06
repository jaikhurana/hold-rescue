// Pure text functions for the statement. No DOM, so the unit tests can import them directly.
import { AGENT_SCRIPTED, SCRIPTED, isExchangeDispute } from './case-data.js';

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

/** Word count, ignoring evidence tags and stray punctuation (works for Devanagari too). */
export function wordCount(text) {
  return String(text ?? '')
    .replace(/\[E\d\]/g, ' ')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

// ───────────── Follow-up agent drafts ─────────────

/** The scripted fallback for an agent message ('officer_reply' | 'escalation' | 'release_request' | 'call_brief'). */
export function scriptedAgentDraft(kind, lang, e5) {
  const copy = AGENT_SCRIPTED[kind]?.[lang] ?? AGENT_SCRIPTED[kind]?.en;
  if (!copy) return '';
  const chat = e5?.kind === 'chat';
  const attach = e5?.kind === 'tag';
  const messages = isExchangeDispute(e5);
  const variant = messages ? 'exchange' : 'other';
  if (kind === 'call_brief') {
    return briefText({ a1: copy.a1, a2: copy.a2, a3: copy.a3[messages ? 'messages' : 'nomessages'], tip: copy.tip });
  }
  const when = { all: true, chat, nochat: !chat, attach, messages, nomessages: !messages };
  return copy
    .filter(([condition]) => when[condition])
    .map(([, sentence]) => (typeof sentence === 'string' ? sentence : sentence[variant]))
    .join(' ');
}

const briefText = ({ a1, a2, a3, tip }) => `A1: ${a1}\nA2: ${a2}\nA3: ${a3}\nTIP: ${tip}`;

/**
 * Parses a call brief in the "A1: … / A2: … / A3: … / TIP: …" shape, cleaning each line like a statement.
 * Returns { a1, a2, a3, tip } or null if the shape is wrong or an answer cites no proof.
 */
export function parseCallBrief(raw, validIds) {
  const parts = {};
  for (const line of String(raw ?? '').replace(/\*\*/g, '').split(/\n+/)) {
    const m = line.match(/^\s*(A[123]|TIP)\s*[:：.-]\s*(.+)$/i);
    if (m) parts[m[1].toLowerCase()] = cleanDraft(m[2], validIds);
  }
  const answers = [parts.a1, parts.a2, parts.a3];
  if (answers.some((a) => !a || !/\[E\d\]/.test(a)) || !parts.tip) return null;
  return { a1: parts.a1, a2: parts.a2, a3: parts.a3, tip: parts.tip };
}

/** A cleaned call brief back in its four-line form, or null if it doesn't hold together. */
export function cleanCallBrief(raw, validIds) {
  const parts = parseCallBrief(raw, validIds);
  return parts ? briefText(parts) : null;
}
