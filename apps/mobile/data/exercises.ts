export type ExerciseReference = {
  id: string;
  name: string;
  muscleGroup: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  recommendation: string;
};

export const EXERCISE_REFERENCES: ExerciseReference[] = [
  {
    id: "ex-001",
    name: "Bodyweight Squat",
    muscleGroup: "Legs",
    level: "Beginner",
    recommendation: "Keep your chest up and drive through your heels on every rep."
  },
  {
    id: "ex-013",
    name: "Push-Up",
    muscleGroup: "Chest",
    level: "Beginner",
    recommendation: "Keep a straight body line, lower until the elbows bend deeply, and press without letting the hips sag."
  },
  {
    id: "ex-014",
    name: "Dip",
    muscleGroup: "Chest",
    level: "Intermediate",
    recommendation: "Lower with control, keep both elbows moving together, and press back to a tall top lockout."
  },
  {
    id: "ex-002",
    name: "Incline Push-Up",
    muscleGroup: "Chest",
    level: "Beginner",
    recommendation: "Use a stable bench and keep your body in a straight line."
  },
  {
    id: "ex-003",
    name: "Glute Bridge",
    muscleGroup: "Glutes",
    level: "Beginner",
    recommendation: "Squeeze your glutes at the top and avoid arching your lower back."
  },
  {
    id: "ex-004",
    name: "Bird Dog",
    muscleGroup: "Core",
    level: "Beginner",
    recommendation: "Move slowly and keep your hips level as your arm and leg extend."
  },
  {
    id: "ex-005",
    name: "Dumbbell Romanian Deadlift",
    muscleGroup: "Hamstrings",
    level: "Intermediate",
    recommendation: "Hinge at the hips and keep the dumbbells close to your legs."
  },
  {
    id: "ex-006",
    name: "Seated Cable Row",
    muscleGroup: "Back",
    level: "Intermediate",
    recommendation: "Pull to your lower ribs and pause briefly with your shoulder blades squeezed."
  },
  {
    id: "ex-007",
    name: "Walking Lunge",
    muscleGroup: "Legs",
    level: "Intermediate",
    recommendation: "Take controlled steps and keep your front knee aligned with your toes."
  },
  {
    id: "ex-008",
    name: "Dumbbell Shoulder Press",
    muscleGroup: "Shoulders",
    level: "Intermediate",
    recommendation: "Brace your core and press straight overhead without leaning back."
  },
  {
    id: "ex-015",
    name: "Dumbbell Bicep Curl",
    muscleGroup: "Arms",
    level: "Beginner",
    recommendation: "Keep the elbows pinned, squeeze hard at the top, and avoid any hip swing."
  },
  {
    id: "ex-009",
    name: "Pull-Up",
    muscleGroup: "Back",
    level: "Advanced",
    recommendation: "Start from a dead hang and pull until your chin clears the bar."
  },
  {
    id: "ex-010",
    name: "Barbell Front Squat",
    muscleGroup: "Legs",
    level: "Advanced",
    recommendation: "Keep your elbows high and maintain an upright torso throughout the lift."
  },
  {
    id: "ex-011",
    name: "Barbell Hip Thrust",
    muscleGroup: "Glutes",
    level: "Advanced",
    recommendation: "Pause for a full second at lockout while maintaining a neutral spine."
  },
  {
    id: "ex-012",
    name: "Turkish Get-Up",
    muscleGroup: "Full Body",
    level: "Advanced",
    recommendation: "Break the movement into steps and keep your eyes on the kettlebell."
  }
];
