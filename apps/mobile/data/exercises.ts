export type ExerciseReference = {
  id: string;
  name: string;
  muscleGroup: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  recommendation: string;
};
