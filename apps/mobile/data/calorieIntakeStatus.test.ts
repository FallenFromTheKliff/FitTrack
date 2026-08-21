const calorieStatusModulePath = "./calorieIntakeStatus.ts";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function runCalorieIntakeStatusRegression() {
  const { resolveCalorieIntakeStatus } = await import(calorieStatusModulePath);

  assertEqual(
    resolveCalorieIntakeStatus(500, null),
    {
      deviationPercent: null,
      label: "Target not set",
      progressPercent: 0,
      remainingCalories: null,
      tone: "neutral",
    },
    "a missing target stays neutral",
  );
  assertEqual(
    resolveCalorieIntakeStatus(500, 0).tone,
    "neutral",
    "a zero target stays neutral",
  );
  assertEqual(
    resolveCalorieIntakeStatus(0, 2_000),
    {
      deviationPercent: -100,
      label: "No calories logged",
      progressPercent: 0,
      remainingCalories: 2_000,
      tone: "danger",
    },
    "an empty day is red",
  );
  assertEqual(
    resolveCalorieIntakeStatus(2_000, 2_000),
    {
      deviationPercent: 0,
      label: "On target",
      progressPercent: 100,
      remainingCalories: 0,
      tone: "success",
    },
    "an exact target is green",
  );
  assertEqual(
    [
      resolveCalorieIntakeStatus(1_900, 2_000).tone,
      resolveCalorieIntakeStatus(2_100, 2_000).tone,
    ],
    ["success", "success"],
    "the inclusive five-percent boundaries are green",
  );
  assertEqual(
    [
      resolveCalorieIntakeStatus(1_600, 2_000).tone,
      resolveCalorieIntakeStatus(2_400, 2_000).tone,
    ],
    ["warning", "warning"],
    "the inclusive twenty-percent under and over boundaries are yellow",
  );
  assertEqual(
    [
      resolveCalorieIntakeStatus(1_599, 2_000).tone,
      resolveCalorieIntakeStatus(2_401, 2_000).tone,
    ],
    ["danger", "danger"],
    "intake more than twenty percent under or over is red",
  );
}

void runCalorieIntakeStatusRegression();
