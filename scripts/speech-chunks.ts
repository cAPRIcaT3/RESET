/** Kokoro's 510-token phoneme window can truncate a whole 130-word paragraph. */
export function speechChunks(text: string): string[] {
  const chunks: string[] = [];
  for (const sentence of text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]) {
    let chunk = '';
    for (const word of sentence.trim().split(/\s+/)) {
      if (chunk && chunk.length + word.length + 1 > 220) { chunks.push(chunk); chunk = ''; }
      chunk += `${chunk ? ' ' : ''}${word}`;
    }
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}
