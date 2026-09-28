import { POSE_AUTO_REP_EXERCISE_KEYS } from '../../../../../packages/utils/pose';

export const poseStarterCatalog = POSE_AUTO_REP_EXERCISE_KEYS.map(
  (exerciseKey) => {
    const contractByExerciseKey: Record<string, string> = {
      bench: 'dumbbell_bench_press',
      'barbell-bench': 'bench_press',
      'incline-dumbbell-press': 'incline_dumbbell_press',
      'cable-fly': 'cable_fly',
      'lateral-raise': 'lateral_raise',
      'lat-pulldown': 'lat_pulldown',
      'barbell-row': 'barbell_row',
      'leg-press': 'leg_press',
      'leg-extension': 'leg_extension',
      'seated-leg-curl': 'seated_leg_curl',
      'calf-raise': 'calf_raise',
      'biceps-curl': 'bicep_curl',
      'hammer-curl': 'hammer_curl',
      'triceps-pushdown': 'triceps_pushdown',
      'rope-face-pull': 'rope_face_pull',
      'hip-thrust': 'hip_thrust',
      'split-squat': 'split_squat',
      'cable-crunch': 'cable_crunch',
      deadlift: 'romanian_deadlift',
      row: 'seated_cable_row',
      'pull-up': 'pull_up',
      'push-up': 'push_up',
      'shoulder-press': 'shoulder_press',
    };
    return contractByExerciseKey[exerciseKey] ?? exerciseKey;
  },
);

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
} satisfies Record<string, readonly string[]>;
