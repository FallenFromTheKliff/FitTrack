import { Suspense } from "react";
import { connection } from "next/server";

import ExerciseLabClientPage from "./ExerciseLabClientPage";

export const dynamic = "force-dynamic";

export default async function ExerciseLabPage() {
  await connection();

  return (
    <Suspense fallback={null}>
      <ExerciseLabClientPage />
    </Suspense>
  );
}
