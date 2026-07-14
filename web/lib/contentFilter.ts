/**
 * Profanity censor for user-submitted content.
 * Censors severe swears / slurs, keeping the FIRST and LAST letter and
 * replacing the middle with asterisks (e.g. "fuck" -> "f**k").
 * Whole-word, case-insensitive matching to avoid censoring innocent words.
 *
 * Edit BAD_WORDS to tune. Keep it to genuinely severe terms.
 */

const BAD_WORDS: string[] = [
  // English — severe
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch',
  'cunt', 'asshole', 'dickhead', 'bastard', 'whore', 'slut', 'prick',
  // English — slurs (discrimination)
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded', 'tranny', 'kike', 'spic', 'chink', 'coon',
  // Romanian — severe
  'pula', 'pizda', 'muie', 'muist', 'coaie', 'cacat', 'futu', 'fut', 'curva', 'curve', 'jegos', 'bou',
  'tigan', 'cioara', 'poponar', 'retardat',
];

// Escape + build a single whole-word, case-insensitive matcher.
const escaped = BAD_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const RE = new RegExp(`\\b(${escaped.join('|')})\\b`, 'giu');

function censorWord(word: string): string {
  if (word.length <= 2) return word; // nothing meaningful to hide
  return word[0] + '*'.repeat(word.length - 2) + word[word.length - 1];
}

/** Returns the text with severe words censored (first + last letter kept). */
export function censor(text: string): string {
  if (!text) return text;
  return text.replace(RE, (m) => censorWord(m));
}

/** True if the text contains a censored word (useful for logging/flags). */
export function hasProfanity(text: string): boolean {
  if (!text) return false;
  RE.lastIndex = 0;
  return RE.test(text);
}
