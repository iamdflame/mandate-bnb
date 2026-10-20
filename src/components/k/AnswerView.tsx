/**
 * An agent's answer, made readable.
 *
 * Agents answer in JSON, and the old payoff of a hire was that JSON, raw. This
 * shows the top-level fields as labelled rows (numbers formatted, long values
 * clipped, nested objects summarised), and keeps the exact bytes one tap away.
 * Nothing is reinterpreted: every value shown is a value the agent sent.
 */
function label(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "none";
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 6 });
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string") return v.length > 220 ? `${v.slice(0, 220)}…` : v;
  if (Array.isArray(v)) return v.length === 0 ? "none" : v.every((x) => typeof x !== "object") ? v.slice(0, 8).map(show).join(", ") + (v.length > 8 ? `, and ${v.length - 8} more` : "") : `${v.length} ${v.length === 1 ? "item" : "items"}`;
  const keys = Object.keys(v as object);
  return keys.length <= 3 ? keys.map((k) => `${label(k)}: ${show((v as Record<string, unknown>)[k])}`).join("; ") : `${keys.length} fields`;
}

export default function AnswerView({ answer, title = "The answer", open = true, limit = 6000 }: { answer: unknown; title?: string; open?: boolean; limit?: number }) {
  const raw = typeof answer === "string" ? answer : JSON.stringify(answer, null, 2) ?? "";
  let parsed: unknown = answer;
  if (typeof answer === "string") {
    try {
      parsed = JSON.parse(answer);
    } catch {
      parsed = answer;
    }
  }
  const rows = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.entries(parsed as Record<string, unknown>).slice(0, 14) : null;
  return (
    <div className="k-answer">
      <p className="k-answer__t">{title}</p>
      {rows ? (
        <dl className="k-answer__rows">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{label(k)}</dt>
              <dd className={typeof v === "number" ? "k-num" : undefined}>{show(v)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="k-answer__text">{typeof parsed === "string" ? (parsed.length > 1200 ? `${parsed.slice(0, 1200)}…` : parsed) : show(parsed)}</p>
      )}
      <details className="k-answer__raw" open={!rows && open ? false : undefined}>
        <summary>Exactly what it sent</summary>
        <pre className="k-code">{raw.slice(0, limit)}</pre>
      </details>
    </div>
  );
}
