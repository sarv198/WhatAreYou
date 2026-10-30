import type { QuizId } from './quizzes';

/** The words and settings that make each quiz feel like its own thing. Engine data lives in quizzes.ts. */
export interface QuizCopy {
  /** URL path the quiz lives at. */
  path: string;
  /** Local storage key for saved progress. The main quiz keeps its original key. */
  storageKey: string;
  /** Browser tab title and share sheet title. */
  documentTitle: string;
  /** Short name used in the quiz header and share text, e.g. "What animal are you?". */
  question: string;
  eyebrow: string;
  /** Headline with an emphasised middle: "What <em>animal</em> are you?". */
  headline: { before: string; em: string; after: string };
  lede: (count: number) => string;
  cta: string;
  disclaimer: string;
  footer: string[];
  /** What the quiz calls its candidates in running copy ("animals", "creatures"). */
  noun: string;
  broadWhy: string;
  revealing: string;
  themeColor: string;
}

export const QUIZ_COPY: Record<QuizId, QuizCopy> = {
  animals: {
    path: '/',
    storageKey: 'what-animal-are-you:v1',
    documentTitle: 'What Animal Are You?',
    question: 'What animal are you?',
    eyebrow: 'A field guide to you',
    headline: { before: 'What', em: 'animal', after: 'are you?' },
    lede: (count) => `${count} animals. A handful of questions. We’ll figure it out.`,
    cta: 'Find my animal',
    disclaimer: 'No astrology. No nonsense. Just vibes, instincts, and questionable methodology.',
    footer: ['Adaptive: every answer changes the next question', 'Usually 9–13 questions', 'About two minutes'],
    noun: 'animals',
    broadWhy:
      'The first few questions sketch the big picture: where you live, how you spend your time, who you run with and when you come alive.',
    revealing: 'Consulting the animal kingdom…',
    themeColor: '#0c120f',
  },
  prehistoric: {
    path: '/prehistoric',
    storageKey: 'what-animal-are-you:prehistoric:v1',
    documentTitle: 'What Prehistoric Animal Are You?',
    question: 'What prehistoric animal are you?',
    eyebrow: 'A fossil record of you',
    headline: { before: 'What', em: 'prehistoric', after: 'animal are you?' },
    lede: (count) => `${count} creatures from deep time. Ten questions at most. We’ll dig you up.`,
    cta: 'Dig up my creature',
    disclaimer: 'Real fossils, rough science, and a meteor’s worth of guesswork.',
    footer: ['Adaptive: every answer changes the next question', 'Usually 7–10 questions', 'About a minute'],
    noun: 'creatures',
    broadWhy: 'The first few questions sketch the big picture: where you live, how you spend your time and who you run with.',
    revealing: 'Digging through the fossil record…',
    themeColor: '#140c09',
  },
};
