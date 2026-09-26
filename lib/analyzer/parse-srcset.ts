export interface SrcsetCandidate {
  url: string;
  descriptor: string | null;
}

export function parseSrcset(value: string): SrcsetCandidate[] {
  const candidates: SrcsetCandidate[] = [];
  let current = "";
  let quote: string | null = null;

  for (const character of value) {
    if ((character === "'" || character === '"') && quote === null) quote = character;
    else if (character === quote) quote = null;
    if (character === "," && quote === null) {
      addCandidate(current, candidates);
      current = "";
    } else {
      current += character;
    }
  }
  addCandidate(current, candidates);
  return candidates;
}

function addCandidate(value: string, candidates: SrcsetCandidate[]): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const parts = trimmed.split(/\s+/);
  const url = parts.shift();
  if (!url) return;
  candidates.push({ url: url.replace(/^['"]|['"]$/g, ""), descriptor: parts.join(" ") || null });
}
