const WANTED_HEADING = /^(etymology|name|toponymy|history)\b/i;
const HEADING = /^(={2,4})\s*([^=\n]+?)\s*\1\s*$/;

export function extractGroundingText(wikitext: string): string | null {
  const chunks: string[] = [];
  let capture = false;

  for (const line of wikitext.split('\n')) {
    const heading = HEADING.exec(line.trim());
    if (heading) {
      const level = heading[1]?.length ?? 2;
      const title = heading[2]?.trim() ?? '';
      if (level === 2) capture = WANTED_HEADING.test(title);
      continue;
    }
    if (capture) chunks.push(line);
  }

  const plain = cleanWiki(chunks.join('\n')).trim();
  return plain.length > 0 ? plain : null;
}

export function excerpt(sourceText: string, max = 420): string {
  const flat = sourceText.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = (lastSpace > 200 ? cut.slice(0, lastSpace) : cut).trim();
  return `${trimmed}…`;
}

function cleanWiki(value: string): string {
  return value
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^/]*\/>/gi, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'{2,}/g, '');
}
