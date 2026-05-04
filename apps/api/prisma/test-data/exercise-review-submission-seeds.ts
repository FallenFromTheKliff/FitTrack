import {
  ExerciseCategory,
  ExerciseReviewSubmissionStatus,
} from '@prisma/client';

export type ExerciseReviewSubmissionSeed = {
  category: ExerciseCategory;
  creatorKey: string;
  daysAgo: number;
  description: string;
  evidenceBars: unknown;
  hour: number;
  instructions: string;
  matchHint?: string;
  muscleGroup: string;
  muscleTargets: unknown[];
  originLabel: string;
  proposedName: string;
  queueTag: string;
  reviewedDaysAgo?: number;
  reviewNotes?: string | null;
  sourceLabel: string;
  status: ExerciseReviewSubmissionStatus;
  summary: string;
  title: string;
  triggerLabel: string;
  key: string;
};

export const EXERCISE_REVIEW_SUBMISSION_SEEDS: readonly ExerciseReviewSubmissionSeed[] =
  [
    {
      key: 'member-premium:hammer-curl',
      creatorKey: 'member-premium',
      title: 'Review Dumbbell Hammer Curl Draft',
      proposedName: 'Dumbbell Hammer Curl',
      summary: 'Neutral-grip curl draft with clean three-rep evidence.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Arms',
      description:
        'Creator-submitted hammer curl draft generated from a three-rep capture and awaiting admin review.',
      instructions:
        'Stand tall, keep elbows near the ribs, curl with neutral wrists, then lower under control.',
      matchHint: 'Dumbbell Bicep Curl',
      queueTag: 'creator_review',
      sourceLabel: 'mobile exercise draft',
      originLabel: 'creator mobile capture',
      triggerLabel: 'creator submitted 3-rep capture',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 1,
      hour: 18,
      evidenceBars: {
        captured_reps: 3,
        confidence_avg: 0.86,
        reason_codes: ['ai_draft', 'creator_verified_capture'],
      },
      muscleTargets: [
        { key: 'biceps', role: 'primary', effortPercent: 70 },
        { key: 'forearms', role: 'secondary', effortPercent: 30 },
      ],
      reviewNotes:
        'Seeded pending item so Exercise Lab review queues are not empty.',
    },
    {
      key: 'member-active:rotational-press',
      creatorKey: 'member-active',
      title: 'Rotational Press Pattern',
      proposedName: 'Standing Rotational Press',
      summary: 'Client trace detected a shoulder press with torso rotation.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Shoulders',
      description:
        'Standing press pattern with torso rotation and controlled deceleration through the shoulder line.',
      instructions:
        'Brace the core, rotate through the torso, then press while keeping the shoulder stacked.',
      matchHint: 'Landmine Press',
      queueTag: 'needs_match',
      sourceLabel: 'pose trace available',
      originLabel: 'client custom',
      triggerLabel: 'unknown after 3 reps',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 1,
      hour: 16,
      evidenceBars: [24, 38, 62, 34, 28, 18],
      muscleTargets: [
        { key: 'shoulders', role: 'primary', effortPercent: 65 },
        { key: 'core', role: 'secondary', effortPercent: 35 },
      ],
    },
    {
      key: 'member-pending:band-hinge',
      creatorKey: 'member-pending',
      title: 'Band-Resisted Hinge Pulse',
      proposedName: 'Band-Resisted Hinge Pulse',
      summary: 'Short-range hinge variation recorded by mobile tracker.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Glutes',
      description:
        'Short-range hinge pulses against elastic resistance with emphasis on glute lockout and posture control.',
      instructions:
        'Anchor the band securely, hinge with a neutral spine, then pulse through the top range.',
      matchHint: 'Banded Good Morning',
      queueTag: 'reviewable',
      sourceLabel: 'movement trace available',
      originLabel: 'creator mobile capture',
      triggerLabel: 'custom movement submitted',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 2,
      hour: 14,
      evidenceBars: [18, 32, 51, 55, 36, 22],
      muscleTargets: [
        { key: 'glutes', role: 'primary', effortPercent: 70 },
        { key: 'hamstrings', role: 'secondary', effortPercent: 30 },
      ],
    },
    {
      key: 'member-active:single-leg-hold',
      creatorKey: 'member-active',
      title: 'Single-Leg Hold Variation',
      proposedName: 'Single-Leg Balance Hold',
      summary: 'Balance-focused custom hold with unilateral stability bias.',
      category: ExerciseCategory.balance,
      muscleGroup: 'Core',
      description:
        'Static single-leg hold emphasizing hip control, trunk alignment, and slow corrective balance reactions.',
      instructions:
        'Keep the standing knee soft, square the hips, and hold the trunk upright while resisting sway.',
      matchHint: 'Single-Leg Reach Hold',
      queueTag: 'edge_case',
      sourceLabel: 'asymmetry surfaced',
      originLabel: 'client custom',
      triggerLabel: 'unknown static hold',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 2,
      hour: 11,
      evidenceBars: [14, 18, 43, 27, 21, 30],
      muscleTargets: [
        { key: 'core', role: 'primary', effortPercent: 55 },
        { key: 'glutes', role: 'secondary', effortPercent: 45 },
      ],
    },
    {
      key: 'member-premium:overhead-cable-chop',
      creatorKey: 'member-premium',
      title: 'Overhead Cable Chop',
      proposedName: 'Overhead Cable Chop',
      summary: 'Rotational cable movement with diagonal power pattern.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Core',
      description:
        'Diagonal pull pattern that trains rotational force transfer from the trunk through the upper body.',
      instructions:
        'Set the shoulders down, drive through the torso, and finish the diagonal pull without collapsing the ribs.',
      matchHint: 'Cable Wood Chop',
      queueTag: 'compare',
      sourceLabel: 'compare against library',
      originLabel: 'creator mobile capture',
      triggerLabel: 'creator submitted 4-rep capture',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 3,
      hour: 19,
      evidenceBars: [22, 26, 58, 49, 30, 20],
      muscleTargets: [
        { key: 'core', role: 'primary', effortPercent: 70 },
        { key: 'shoulders', role: 'secondary', effortPercent: 30 },
      ],
    },
    {
      key: 'member-frozen:kneeling-pressout',
      creatorKey: 'member-frozen',
      title: 'Kneeling Press-Out Draft',
      proposedName: 'Half-Kneeling Band Press-Out',
      summary: 'Anti-rotation press-out with a half-kneeling setup.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Core',
      description:
        'Half-kneeling band press-out that resists torso rotation while training shoulder stability.',
      instructions:
        'Set the band at chest height, brace the trunk, press forward, pause, and return under control.',
      matchHint: 'Pallof Press',
      queueTag: 'governance_watch',
      sourceLabel: 'creator queue',
      originLabel: 'mobile pose draft',
      triggerLabel: 'submitted after guided capture',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 3,
      hour: 10,
      evidenceBars: {
        captured_reps: 4,
        confidence_avg: 0.74,
        reason_codes: ['anti_rotation', 'needs_governance_review'],
      },
      muscleTargets: [
        { key: 'core', role: 'primary', effortPercent: 80 },
        { key: 'shoulders', role: 'stabilizer', effortPercent: 20 },
      ],
    },
    {
      key: 'member-active:tempo-squat',
      creatorKey: 'member-active',
      title: 'Tempo Squat Candidate',
      proposedName: 'Three-Count Tempo Squat',
      summary: 'Squat variation with controlled eccentric timing.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Quads',
      description:
        'Bodyweight squat emphasizing a slow three-count descent and stable knee tracking.',
      instructions:
        'Descend for three counts, keep knees tracking over toes, pause briefly, then stand tall.',
      matchHint: 'Bodyweight Squat',
      queueTag: 'taxonomy_review',
      sourceLabel: 'mobile tempo capture',
      originLabel: 'client custom',
      triggerLabel: 'tempo variation submitted',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 4,
      hour: 17,
      evidenceBars: [20, 45, 58, 42, 31, 24],
      muscleTargets: [
        { key: 'quads', role: 'primary', effortPercent: 60 },
        { key: 'glutes', role: 'secondary', effortPercent: 40 },
      ],
    },
    {
      key: 'member-premium:bear-crawl-tap',
      creatorKey: 'member-premium',
      title: 'Bear Crawl Tap',
      proposedName: 'Bear Crawl Shoulder Tap',
      summary: 'Crawling core drill with alternating shoulder taps.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Core',
      description:
        'Quadruped crawl hold with alternating shoulder taps and anti-rotation control.',
      instructions:
        'Set knees under hips, lift slightly, tap the opposite shoulder, and keep hips quiet.',
      matchHint: 'Plank Shoulder Tap',
      queueTag: 'reviewable',
      sourceLabel: 'floor movement capture',
      originLabel: 'creator mobile capture',
      triggerLabel: 'custom floor drill submitted',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 4,
      hour: 12,
      evidenceBars: [18, 22, 49, 53, 38, 26],
      muscleTargets: [
        { key: 'core', role: 'primary', effortPercent: 65 },
        { key: 'shoulders', role: 'secondary', effortPercent: 35 },
      ],
    },
    {
      key: 'member-pending:lateral-lunge-reach',
      creatorKey: 'member-pending',
      title: 'Lateral Lunge Reach',
      proposedName: 'Lateral Lunge With Reach',
      summary: 'Side-lunge draft with reach cue and hip-shift pattern.',
      category: ExerciseCategory.flexibility,
      muscleGroup: 'Adductors',
      description:
        'Lateral lunge with a forward reach that challenges hip mobility and adductor length.',
      instructions:
        'Step wide, shift hips back, reach forward with a long spine, then push back to center.',
      matchHint: 'Cossack Squat',
      queueTag: 'mobility_review',
      sourceLabel: 'mobility capture',
      originLabel: 'client custom',
      triggerLabel: 'range variation submitted',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 5,
      hour: 15,
      evidenceBars: [15, 28, 43, 48, 35, 21],
      muscleTargets: [
        { key: 'adductors', role: 'primary', effortPercent: 70 },
        { key: 'glutes', role: 'secondary', effortPercent: 30 },
      ],
    },
    {
      key: 'member-active:shadow-boxing-step',
      creatorKey: 'member-active',
      title: 'Shadow Boxing Step Combo',
      proposedName: 'Shadow Boxing Step Combo',
      summary: 'Cardio movement combining step rhythm and jab-cross pattern.',
      category: ExerciseCategory.cardio,
      muscleGroup: 'Full Body',
      description:
        'Low-equipment cardio sequence with alternating steps and upper-body striking rhythm.',
      instructions:
        'Step lightly, keep guard up, alternate jab-cross, and maintain a steady breathing cadence.',
      matchHint: 'Shadow Boxing',
      queueTag: 'cardio_review',
      sourceLabel: 'live cardio capture',
      originLabel: 'creator mobile capture',
      triggerLabel: 'custom cardio submitted',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 5,
      hour: 9,
      evidenceBars: [34, 46, 55, 52, 47, 39],
      muscleTargets: [
        { key: 'shoulders', role: 'secondary', effortPercent: 35 },
        { key: 'core', role: 'secondary', effortPercent: 35 },
        { key: 'calves', role: 'stabilizer', effortPercent: 30 },
      ],
    },
    {
      key: 'member-premium:wall-sit-march',
      creatorKey: 'member-premium',
      title: 'Wall Sit March',
      proposedName: 'Wall Sit Alternating March',
      summary: 'Wall-sit hold with alternating march and trunk control.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Quads',
      description:
        'Isometric wall sit combined with alternating knee lifts for quad endurance and core bracing.',
      instructions:
        'Hold a wall sit, brace the trunk, lift one knee without shifting, then alternate sides.',
      matchHint: 'Wall Sit',
      queueTag: 'reviewable',
      sourceLabel: 'hold plus march capture',
      originLabel: 'client custom',
      triggerLabel: 'hold variation submitted',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 6,
      hour: 18,
      evidenceBars: [17, 31, 39, 46, 35, 24],
      muscleTargets: [
        { key: 'quads', role: 'primary', effortPercent: 75 },
        { key: 'core', role: 'stabilizer', effortPercent: 25 },
      ],
    },
    {
      key: 'member-pending:scapular-slide',
      creatorKey: 'member-pending',
      title: 'Scapular Wall Slide Draft',
      proposedName: 'Scapular Wall Slide',
      summary: 'Upper-back mobility drill with wall-contact tracking.',
      category: ExerciseCategory.flexibility,
      muscleGroup: 'Upper Back',
      description:
        'Wall slide variation designed to reinforce scapular upward rotation and shoulder mobility.',
      instructions:
        'Keep ribs down, slide forearms up the wall, pause near the top, and return slowly.',
      matchHint: 'Wall Angels',
      queueTag: 'mobility_review',
      sourceLabel: 'posture capture',
      originLabel: 'creator mobile capture',
      triggerLabel: 'mobility draft submitted',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 6,
      hour: 13,
      evidenceBars: [12, 25, 40, 44, 32, 18],
      muscleTargets: [
        { key: 'upper_back', role: 'primary', effortPercent: 60 },
        { key: 'shoulders', role: 'secondary', effortPercent: 40 },
      ],
    },
    {
      key: 'member-active:reverse-plank-lift',
      creatorKey: 'member-active',
      title: 'Reverse Plank Lift',
      proposedName: 'Reverse Plank Hip Lift',
      summary: 'Posterior-chain floor movement with hip lift emphasis.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Glutes',
      description:
        'Reverse plank variation that lifts the hips while keeping shoulder position stable.',
      instructions:
        'Plant hands behind the hips, press through heels, lift hips, squeeze glutes, and lower with control.',
      matchHint: 'Reverse Plank',
      queueTag: 'reviewable',
      sourceLabel: 'floor draft capture',
      originLabel: 'client custom',
      triggerLabel: 'custom floor movement submitted',
      status: ExerciseReviewSubmissionStatus.pending,
      daysAgo: 7,
      hour: 17,
      evidenceBars: [19, 33, 45, 50, 37, 23],
      muscleTargets: [
        { key: 'glutes', role: 'primary', effortPercent: 55 },
        { key: 'hamstrings', role: 'secondary', effortPercent: 25 },
        { key: 'shoulders', role: 'stabilizer', effortPercent: 20 },
      ],
    },
    {
      key: 'member-active:private-push',
      creatorKey: 'member-active',
      title: 'Incline Push-Up Private Variant',
      proposedName: 'Incline Push-Up',
      summary: 'Incline push-up variation saved privately.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Chest',
      description:
        'Member kept this incline push-up variant private after admin review.',
      instructions:
        'Place hands on a stable raised surface, keep a straight body line, lower, and press away.',
      matchHint: 'Incline Push-Up',
      queueTag: 'resolved_private',
      sourceLabel: 'detected push variation',
      originLabel: 'client custom',
      triggerLabel: 'unknown after 3 reps',
      status: ExerciseReviewSubmissionStatus.left_private,
      daysAgo: 8,
      hour: 13,
      reviewedDaysAgo: 2,
      reviewNotes: 'Clean but kept as a private member variation.',
      evidenceBars: {
        captured_reps: 5,
        confidence_avg: 0.78,
        reason_codes: ['private_variant'],
      },
      muscleTargets: [
        { key: 'chest', role: 'primary', effortPercent: 60 },
        { key: 'triceps', role: 'secondary', effortPercent: 25 },
        { key: 'front_delts', role: 'stabilizer', effortPercent: 15 },
      ],
    },
    {
      key: 'member-premium:published-cable-curl',
      creatorKey: 'member-premium',
      title: 'Cable Curl Published Candidate',
      proposedName: 'Standing Cable Curl',
      summary: 'Cable curl draft already promoted to the global library.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Biceps',
      description:
        'Standing cable curl with stable upper arm position and smooth resistance.',
      instructions:
        'Stand tall, keep elbows near the torso, curl the handle, and lower slowly.',
      matchHint: 'Cable Curl',
      queueTag: 'published',
      sourceLabel: 'creator-approved draft',
      originLabel: 'creator mobile capture',
      triggerLabel: 'admin published from review',
      status: ExerciseReviewSubmissionStatus.published,
      daysAgo: 9,
      hour: 15,
      reviewedDaysAgo: 4,
      reviewNotes: 'Published after contract and muscle targets were confirmed.',
      evidenceBars: [24, 42, 60, 50, 38, 24],
      muscleTargets: [
        { key: 'biceps', role: 'primary', effortPercent: 75 },
        { key: 'forearms', role: 'secondary', effortPercent: 25 },
      ],
    },
    {
      key: 'member-pending:published-step-jack',
      creatorKey: 'member-pending',
      title: 'Low-Impact Step Jack Published',
      proposedName: 'Low-Impact Step Jack',
      summary: 'Cardio draft already approved for global reuse.',
      category: ExerciseCategory.cardio,
      muscleGroup: 'Full Body',
      description:
        'Low-impact jack alternative using alternating side steps and overhead arm reach.',
      instructions:
        'Step side to side, reach arms overhead, keep impact low, and maintain rhythm.',
      matchHint: 'Jumping Jack',
      queueTag: 'published',
      sourceLabel: 'cardio creator capture',
      originLabel: 'client custom',
      triggerLabel: 'admin published from review',
      status: ExerciseReviewSubmissionStatus.published,
      daysAgo: 10,
      hour: 11,
      reviewedDaysAgo: 5,
      reviewNotes: 'Published as a low-impact cardio option.',
      evidenceBars: [36, 44, 55, 57, 49, 41],
      muscleTargets: [
        { key: 'calves', role: 'secondary', effortPercent: 35 },
        { key: 'shoulders', role: 'secondary', effortPercent: 35 },
        { key: 'core', role: 'stabilizer', effortPercent: 30 },
      ],
    },
    {
      key: 'member-frozen:private-row',
      creatorKey: 'member-frozen',
      title: 'Band Row Private Variant',
      proposedName: 'Seated Band Row',
      summary: 'Row variation left private due to duplicate taxonomy.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Back',
      description:
        'Seated band row draft was clean but overlapped the existing global row taxonomy.',
      instructions:
        'Sit tall, pull the band toward the ribs, squeeze shoulder blades, and return slowly.',
      matchHint: 'Seated Cable Row',
      queueTag: 'resolved_private',
      sourceLabel: 'creator review queue',
      originLabel: 'mobile pose draft',
      triggerLabel: 'duplicate global match',
      status: ExerciseReviewSubmissionStatus.left_private,
      daysAgo: 11,
      hour: 14,
      reviewedDaysAgo: 6,
      reviewNotes: 'Kept private because the global library already has a clearer row record.',
      evidenceBars: [20, 36, 52, 48, 34, 22],
      muscleTargets: [
        { key: 'back', role: 'primary', effortPercent: 65 },
        { key: 'biceps', role: 'secondary', effortPercent: 35 },
      ],
    },
    {
      key: 'member-expired:rejected-kip',
      creatorKey: 'member-expired',
      title: 'Kipping Pull Draft',
      proposedName: 'Kipping Pull-Up Swing',
      summary: 'Rejected because the evidence did not prove a safe repeatable contract.',
      category: ExerciseCategory.strength,
      muscleGroup: 'Back',
      description:
        'Swing-assisted pull draft with inconsistent shoulder position and low confidence.',
      instructions:
        'Draft rejected; not suitable for global instruction.',
      matchHint: 'Pull-Up',
      queueTag: 'rejected',
      sourceLabel: 'low confidence capture',
      originLabel: 'client custom',
      triggerLabel: 'unsafe movement evidence',
      status: ExerciseReviewSubmissionStatus.rejected,
      daysAgo: 12,
      hour: 10,
      reviewedDaysAgo: 7,
      reviewNotes:
        'Rejected because the submitted evidence showed unstable shoulder control and no clear coaching contract.',
      evidenceBars: {
        captured_reps: 2,
        confidence_avg: 0.41,
        reason_codes: ['low_confidence', 'unsafe_pattern'],
      },
      muscleTargets: [
        { key: 'back', role: 'primary', effortPercent: 55 },
        { key: 'shoulders', role: 'stabilizer', effortPercent: 45 },
      ],
    },
  ] as const;
