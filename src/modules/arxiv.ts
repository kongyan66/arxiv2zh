export interface ArxivIdentifier {
  id: string;
  baseId: string;
  apiId: string;
  version?: number;
  canonicalURL: string;
}

const MODERN_ID = /^(\d{4}\.\d{4,5})(?:v(\d+))?$/i;
const LEGACY_ID = /^([a-z][a-z0-9.-]*\/\d{7})(?:v(\d+))?$/i;

function cleanCandidate(value: string): string {
  return value
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\.pdf$/i, "")
    .replace(/^arxiv:/i, "")
    .trim();
}

function fromCandidate(candidate: string): ArxivIdentifier | null {
  const cleaned = cleanCandidate(candidate);
  const match = cleaned.match(MODERN_ID) || cleaned.match(LEGACY_ID);
  if (!match) return null;

  const baseId = match[1];
  const version = match[2] ? Number(match[2]) : undefined;
  const id = `${baseId}${version ? `v${version}` : ""}`;
  return {
    id,
    baseId,
    apiId: id.replace("/", "_"),
    version,
    canonicalURL: `https://arxiv.org/abs/${id}`,
  };
}

export function parseArxivIdentifier(input: string): ArxivIdentifier | null {
  const value = input.trim();
  if (!value) return null;

  const urlMatch = value.match(
    /https?:\/\/(?:www\.)?(?:arxiv\.org|alphaxiv\.org)\/(?:abs|pdf)\/([^\s?#]+)/i,
  );
  if (urlMatch) return fromCandidate(urlMatch[1]);

  const doiMatch = value.match(/10\.48550\/arxiv\.([a-z0-9./-]+(?:v\d+)?)/i);
  if (doiMatch) return fromCandidate(doiMatch[1]);

  const tokenMatch = value.match(
    /(?:^|\s|\[|\()((?:\d{4}\.\d{4,5}|[a-z][a-z0-9.-]*\/\d{7})(?:v\d+)?)(?=$|\s|\]|\)|[,;])/i,
  );
  return fromCandidate(tokenMatch?.[1] || value);
}

export function resolveArxivIdentifier(
  candidates: Array<string | null | undefined>,
): ArxivIdentifier | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = parseArxivIdentifier(candidate);
    if (parsed) return parsed;
  }
  return null;
}
