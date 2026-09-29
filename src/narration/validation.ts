import { RESET_NARRATION_METADATA } from './prompts.ts';
const { minWords: MIN_WORDS, maxWords: MAX_WORDS, sentencesMin: MIN_SENTENCES, sentencesMax: MAX_SENTENCES } = RESET_NARRATION_METADATA.output;

export function extractNarration(data: unknown): string {
  if (!data || typeof data !== 'object') throw new Error('Invalid narration response');
  const value = data as Record<string, unknown>;
  if (typeof value.narration === 'string') return normalizeGeneratedText(value.narration);
  if (typeof value.output_text === 'string') return normalizeGeneratedText(value.output_text);
  const choices = value.choices;
  if (Array.isArray(choices) && choices.length > 0 && choices[0] && typeof choices[0] === 'object') {
    const message = (choices[0] as Record<string, unknown>).message;
    if (message && typeof message === 'object' && typeof (message as Record<string, unknown>).content === 'string') {
      const content = (message as Record<string, unknown>).content;
      if (typeof content === 'string') return normalizeGeneratedText(content);
    }
  }
  throw new Error('Invalid narration response');
}

function normalizeGeneratedText(value: string): string {
  const trimmed = value.trim();
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (withoutFence.startsWith('{') || withoutFence.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(withoutFence);
      if (parsed && typeof parsed === 'object' && 'narration' in parsed && typeof parsed.narration === 'string') return parsed.narration.trim();
    } catch {
      // Fall through to the same invalid-response error below.
    }
    throw new Error('Invalid narration response');
  }
  // The proxy contract is JSON, but accepting plain text keeps older proxies usable.
  return withoutFence;
}

export function validateNarration(text: string): void {
  if (/\n\s*\n|[?]|<[^>]*>/.test(text)) throw new Error('Narration must be one observational paragraph');
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < MIN_WORDS || words > MAX_WORDS) throw new Error(`Narration must contain ${MIN_WORDS}–${MAX_WORDS} words`);
  if (/\b(?:you|your|we|our|ai|chatbot|prompt|model|therapist)\b/i.test(text)) {
    throw new Error('Narration contains disallowed address or meta language');
  }
  if (/```|^\s*(?:[-*#]\s)|\n\s*(?:[-*#]\s)|["“”]/.test(text)) {
    throw new Error('Narration contains disallowed formatting');
  }
  const sentences = text.split(/[.!?]+/).map(sentence => sentence.trim()).filter(Boolean).length;
  if (sentences < MIN_SENTENCES || sentences > MAX_SENTENCES) throw new Error(`Narration must contain ${MIN_SENTENCES}–${MAX_SENTENCES} sentences`);
}

