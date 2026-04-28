export const poseStarterCatalog = [
  'push_up',
  'pull_up',
  'squat',
  'bicep_curl',
  'shoulder_press',
  'plank',
] as const;

export const poseExerciseAliasMap = {
  push_up: ['push_up', 'pushup'],
  pull_up: ['pull_up', 'pullup', 'chin_up', 'chinup'],
  squat: ['squat'],
  bicep_curl: ['bicep_curl', 'curl'],
  shoulder_press: ['shoulder_press', 'press'],
  plank: ['plank'],
} satisfies Record<(typeof poseStarterCatalog)[number], readonly string[]>;
