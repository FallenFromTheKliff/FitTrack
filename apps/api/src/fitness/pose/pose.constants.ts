import { POSE_AUTO_REP_EXERCISE_KEYS } from '../../../../../packages/utils/pose';

export const poseStarterCatalog = POSE_AUTO_REP_EXERCISE_KEYS.map(
  (exerciseKey) => {
    switch (exerciseKey) {
      case 'barbell-bench':
        return 'bench_press';
      case 'biceps-curl':
        return 'bicep_curl';
      case 'pull-up':
        return 'pull_up';
      case 'push-up':
        return 'push_up';
      case 'shoulder-press':
        return 'shoulder_press';
      default:
        return exerciseKey;
    }
  },
) as unknown as readonly [
  'squat',
  'bench_press',
  'bicep_curl',
  'dip',
  'plank',
  'pull_up',
  'push_up',
  'shoulder_press',
];

export const poseExerciseAliasMap = {
  push_up: ['push_up', 'pushup'],
  pull_up: ['pull_up', 'pullup', 'chin_up', 'chinup'],
  squat: ['squat'],
  bicep_curl: ['bicep_curl', 'curl'],
  shoulder_press: ['shoulder_press', 'press'],
  plank: ['plank'],
  bench_press: [
    'bench_press',
    'bench press',
    'barbell bench',
    'barbell-bench',
    'barbell_bench',
  ],
  dip: ['dip', 'tricep dip', 'parallel bar dip', 'bench dip', 'assisted dip'],
} satisfies Record<(typeof poseStarterCatalog)[number], readonly string[]>;
