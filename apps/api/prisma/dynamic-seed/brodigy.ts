import type { SeedRandom } from './random';

export type BrodigyQuestionCategory =
  | 'trivia'
  | 'fitness'
  | 'gym'
  | 'sertfit';

export type BrodigySeedQuestion = {
  answer: string;
  category: BrodigyQuestionCategory;
  prompt: string;
};

export const BRODIGY_QUESTION_POOL: readonly BrodigySeedQuestion[] = [
  {
    answer: 'The gluteus maximus is commonly described as the largest muscle in the human body.',
    category: 'trivia',
    prompt: 'What is the largest muscle in the human body?',
  },
  {
    answer: 'Protein and carbohydrates each provide four calories per gram, while fat provides nine.',
    category: 'trivia',
    prompt: 'How many calories are in a gram of protein?',
  },
  {
    answer: 'Progressive overload means gradually increasing a training challenge while keeping technique controlled.',
    category: 'fitness',
    prompt: 'What does progressive overload mean?',
  },
  {
    answer: 'A rest day gives the body time to recover from training stress and adapt to the work performed.',
    category: 'fitness',
    prompt: 'Why are rest days useful in a training plan?',
  },
  {
    answer: 'A simple way to track progress is to record exercises, sets, reps, load, effort, and how the session felt.',
    category: 'fitness',
    prompt: 'What should I record to track workout progress?',
  },
  {
    answer: 'A balanced post-workout meal can combine a protein source, carbohydrate source, fluids, and foods you tolerate well.',
    category: 'fitness',
    prompt: 'What is a practical post-workout meal?',
  },
  {
    answer: 'Macros are protein, carbohydrates, and fat. They provide building material and energy in different proportions.',
    category: 'fitness',
    prompt: 'What are macros?',
  },
  {
    answer: 'Including a protein source in several meals can make a daily protein target easier to reach consistently.',
    category: 'fitness',
    prompt: 'How can I spread protein across the day?',
  },
  {
    answer: 'Compare a consistent food log with multi-week body-weight and performance trends before changing calories.',
    category: 'fitness',
    prompt: 'How can I tell whether my calories support my goal?',
  },
  {
    answer: 'Start with easy movement that raises body temperature, then use controlled warm-up sets for the first main exercise.',
    category: 'fitness',
    prompt: 'What is a simple warm-up before lifting?',
  },
  {
    answer: 'Bring water, a towel, comfortable training clothes, and any access item required by your gym.',
    category: 'gym',
    prompt: 'What should I bring to the gym?',
  },
  {
    answer: 'Wipe shared contact surfaces after use and return equipment to its designated place when you finish.',
    category: 'gym',
    prompt: 'What is good gym equipment etiquette?',
  },
  {
    answer: 'Ask how many sets remain, choose another suitable movement, or wait in the designated area without crowding the user.',
    category: 'gym',
    prompt: 'What should I do if a machine is occupied?',
  },
  {
    answer: 'Choose a load that lets you complete the planned range with stable technique and room to stop if form breaks down.',
    category: 'gym',
    prompt: 'How do I choose a safe starting weight?',
  },
  {
    answer: 'Follow posted gym rules, keep walkways clear, respect shared space, and ask staff when a facility policy is unclear.',
    category: 'gym',
    prompt: 'What is a respectful gym routine?',
  },
  {
    answer: 'SERTFIT workout history can act as the record for reviewing recent exercises, sets, reps, and completed sessions.',
    category: 'sertfit',
    prompt: 'Where can I review my SERTFIT workout history?',
  },
  {
    answer: 'Use the SERTFIT nutrition flow to record the food, quantity, meal, and date so later summaries have useful context.',
    category: 'sertfit',
    prompt: 'How do I log a meal in SERTFIT?',
  },
  {
    answer: 'SERTFIT can use saved exercise history as context for reviewing patterns, but the recorded data remains the source of truth.',
    category: 'sertfit',
    prompt: 'How does SERTFIT use exercise history?',
  },
  {
    answer: 'Review the Brodigy sessions list in SERTFIT to return to previous questions and assistant responses.',
    category: 'sertfit',
    prompt: 'Where can I review Brodigy sessions in SERTFIT?',
  },
  {
    answer: 'A consistent log of workouts, nutrition, and recovery makes SERTFIT summaries more useful over time.',
    category: 'sertfit',
    prompt: 'What makes SERTFIT progress summaries more useful?',
  },
] as const;

export function pickBrodigyQuestion(rng: Pick<SeedRandom, 'pick'>) {
  return rng.pick(BRODIGY_QUESTION_POOL);
}

export function buildBrodigyHistoryKeys(
  accountKeys: readonly string[],
  prioritizedKeys: readonly string[],
) {
  const availableKeys = new Set(accountKeys);
  const orderedKeys: string[] = [];
  const seenKeys = new Set<string>();

  for (const key of [...prioritizedKeys, ...accountKeys]) {
    if (availableKeys.has(key) && !seenKeys.has(key)) {
      orderedKeys.push(key);
      seenKeys.add(key);
    }
  }

  return orderedKeys;
}
