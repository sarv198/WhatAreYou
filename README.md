# What Animal Are You?

An adaptive personality quiz that matches you to one of 70 animals. It isn't a fixed list of questions. After four broad questions, each question is picked live because it best separates the animals you might still be.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine, navigation and edge-case tests
npm run simulate   # offline tuning report (reachability, accuracy, result spread)
npm run build
```

## How it works

```
answers ──► user trait vector ──► compatibility per animal ──► candidate scores
                                                                   │
            next question ◄── highest expected information gain ◄──┘
```

1. **Trait model.** Animals and answers share one vocabulary of about 50 traits (`src/data/traits.ts`): habitat, activity cycle, social style, mind, temperament, danger response, natural gifts. Animals rate each trait from 0 to 1. Answers push traits from −1 to +1.
2. **Scoring** (`src/lib/scoring.ts`). Answers are folded into a cumulative user vector: a weighted mean direction per trait plus how much evidence backs it. Each animal's compatibility is an evidence-weighted similarity to that vector, blended with a *distinctiveness* term. That term measures how characteristic each answer is of the animal compared with the animal it suits best, so generalists don't soak up every mixed answer set. Compatibilities go through a softmax whose sharpness grows with evidence. No animal is ever eliminated outright.
3. **Question selection** (`src/lib/informationGain.ts`, `src/lib/adaptiveQuiz.ts`). Broad questions come first, in a fixed order. After that, for every unanswered question the engine simulates each possible answer, weighted by how likely the remaining candidates are to give it, and re-scores. It then picks the question with the largest expected drop in entropy across the animals still in the running.
4. **Stopping.** The quiz stops when one animal is clearly ahead (after at least 9 questions), when no question would teach anything more, or at 13 questions.
5. **Results** (`src/lib/resultGenerator.ts`). Shows the winner, the traits you share with it, the answers that most favoured it over the average animal, and your closest matches. Match strength is a friendly curve over compatibility, deliberately not presented as a probability.

Everything in the engine is a pure function of the answers. The same answers always give the same result.

## Adding an animal

Append an object to `src/data/animals.ts`:

```ts
{
  id: 'honey-badger',
  name: 'Honey Badger',
  animalClass: 'mammal',
  tagline: 'The Unbothered Menace',
  color: '#5a5550',
  wikiTitle: 'Honey_badger',          // optional: pulls a photo from Wikipedia
  description: 'You are fearless, stubborn…',
  traits: ['Fearless', 'Stubborn', 'Resourceful'],
  strengths: ['Nerve', 'Grit', 'Ingenuity'],
  funFact: 'Honey badgers have loose, thick skin that lets them twist around and bite back.',
  profile: {
    habitat: { desert: 0.8, grassland: 0.9 },
    rhythm: { evening: 0.8, night: 1 },
    temperament: { aggression: 1, confidence: 1 },
    // …only the traits that matter; the rest fall back to neutral defaults
  },
}
```

That's all. Scoring, question selection, the animal field on screen and the results pick it up automatically. The data is validated at startup (unknown traits, values outside 0–1 and duplicate ids all throw). Run `npm run simulate` afterwards to check the new animal can actually be reached and isn't shadowing a neighbour.

Questions work the same way: add the question to `src/data/questions.ts` and its answer effects to `src/data/traitMappings.ts`.

## Project layout

```
src/
  data/        animals, questions, trait registry, answer → trait mappings
  lib/         scoring, information gain, adaptive selection, results, quiz state reducer
  hooks/       useQuiz (state + persistence), useAnimalImage (Wikipedia photos)
  components/  Landing, QuizScreen, QuestionCard, Field, Revealing, ResultScreen, AnimalPortrait
tests/         scoring, adaptive selection, navigation, edge cases
scripts/       simulate.ts, the tuning harness
```

Quiz progress is saved to `localStorage`, so a reload never loses your place. Going back and changing an answer recomputes everything from the answers themselves, and later questions are re-chosen if the path changes.

Animal photos load at runtime from the Wikipedia REST API and are credited on the result page. If a photo can't load, an illustrated fallback is shown instead.

*A playful personality model, not science.*
