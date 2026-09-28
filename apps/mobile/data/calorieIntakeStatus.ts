export type CalorieIntakeTone = "neutral" | "success" | "warning" | "danger";

export type CalorieIntakeStatus = {
  deviationPercent: number | null;
  label: string;
  progressPercent: number;
  remainingCalories: number | null;
  tone: CalorieIntakeTone;
};

function normalizeCalories(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

export function resolveCalorieIntakeStatus(
  consumedCalories: number | null | undefined,
  targetCalories: number | null | undefined,
): CalorieIntakeStatus {
  if (
    typeof targetCalories !== "number" ||
    !Number.isFinite(targetCalories) ||
    targetCalories <= 0
  ) {
    return {
      deviationPercent: null,
      label: "Target not set",
      progressPercent: 0,
      remainingCalories: null,
      tone: "neutral",
    };
  }

  const consumed = normalizeCalories(consumedCalories);
  const deviationPercent = ((consumed - targetCalories) / targetCalories) * 100;
  const absoluteDeviation = Math.abs(deviationPercent);
  const progressPercent = Math.min((consumed / targetCalories) * 100, 100);
  const remainingCalories = targetCalories - consumed;

  if (consumed === 0) {
    return {
      deviationPercent,
      label: "No calories logged",
      progressPercent,
      remainingCalories,
      tone: "danger",
    };
  }

  if (absoluteDeviation <= 5) {
    return {
      deviationPercent,
      label: "On target",
      progressPercent,
      remainingCalories,
      tone: "success",
    };
  }

  if (absoluteDeviation <= 20) {
    return {
      deviationPercent,
      label: deviationPercent < 0 ? "Slightly under target" : "Slightly over target",
      progressPercent,
      remainingCalories,
      tone: "warning",
    };
  }

  return {
    deviationPercent,
    label: deviationPercent < 0 ? "Well below target" : "Well above target",
    progressPercent,
    remainingCalories,
    tone: "danger",
  };
}
