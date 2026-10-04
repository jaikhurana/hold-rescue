// Which open models draft the statement, in the order they are tried.
// GROQ_MODEL (optional env var) goes first if set; then gpt-oss-120b; then gpt-oss-20b.
const DEFAULTS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

/** [{ id: 'openai/gpt-oss-120b', label: 'gpt-oss-120b' }, …] */
export function models() {
  const override = process.env.GROQ_MODEL?.trim();
  const ids = override ? [override, ...DEFAULTS.filter((id) => id !== override)] : DEFAULTS;
  return ids.map((id) => ({ id, label: id.split('/').pop() }));
}
