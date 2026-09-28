import { useRouter } from "expo-router";

import { WorkoutPlansScreen } from "@/components/workout/WorkoutPlansScreen";

export default function WorkoutPlansRoute() {
  const router = useRouter();
  return <WorkoutPlansScreen onBack={() => router.back()} />;
}
