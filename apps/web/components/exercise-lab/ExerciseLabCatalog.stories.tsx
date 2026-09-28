import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  FitnessExerciseRecord,
  FitnessPaginatedResult,
  MuscleDefinitionRecord,
} from "@fittrack/api-client";
import {
  fitnessExercisesQueryOptions,
  fitnessMuscleDefinitionsQueryOptions,
} from "@fittrack/query";

import { webApiClient } from "@/lib/api-client";

import { ExerciseLabAuthoringModal } from "./ExerciseLabAuthoringModal";
import { ExerciseLabLibrarySurface } from "./ExerciseLabLibrarySurface";
import { ExerciseLabModalLayer } from "./ExerciseLabModalLayer";
import { ExerciseLabMuscleSurface } from "./ExerciseLabMuscleSurface";
import {
  ExerciseLabPageProvider,
  useExerciseLabPage,
} from "./ExerciseLabPageContext";

const EXERCISE_LIBRARY_FIXTURES: FitnessExerciseRecord[] = [
  {
    aliases: [],
    category: "strength",
    createdAt: "2026-01-10T00:00:00.000Z",
    description: "Press a bar from the chest to full extension.",
    handShapeProfile: null,
    id: "story-exercise-bench-press",
    imageUrl: null,
    instructions: "Keep the shoulder blades set and lower the bar with control.",
    isActive: true,
    movementContractIdentity: {
      exerciseId: "story-exercise-bench-press",
      familyKey: null,
      revision: null,
      source: "manual",
      trackingMode: "manual",
    },
    movementFamily: null,
    movementProfile: null,
    movementProfileOverride: null,
    muscleGroup: "chest",
    muscleTargets: [],
    name: "Barbell Bench Press",
    trackingMode: "manual",
    updatedAt: "2026-02-04T00:00:00.000Z",
    videoUrl: null,
  },
  {
    aliases: [],
    category: "strength",
    createdAt: "2026-01-12T00:00:00.000Z",
    description: "Build upper-back pulling strength from a supported stance.",
    handShapeProfile: null,
    id: "story-exercise-cable-row",
    imageUrl: null,
    instructions: "Brace the trunk and draw the handles toward the ribs.",
    isActive: true,
    movementContractIdentity: {
      exerciseId: "story-exercise-cable-row",
      familyKey: null,
      revision: null,
      source: "manual",
      trackingMode: "manual",
    },
    movementFamily: null,
    movementProfile: null,
    movementProfileOverride: null,
    muscleGroup: "upper_back",
    muscleTargets: [],
    name: "Seated Cable Row",
    trackingMode: "manual",
    updatedAt: "2026-02-06T00:00:00.000Z",
    videoUrl: null,
  },
];

const MUSCLE_LIBRARY_FIXTURES: MuscleDefinitionRecord[] = [
  {
    aliases: ["pecs", "pectoralis major"],
    bodyRegion: "Upper Body",
    createdAt: "2026-01-02T00:00:00.000Z",
    iconAssetKey: null,
    iconKey: "target",
    iconKind: "library",
    id: "story-muscle-chest",
    isActive: true,
    isSystem: true,
    key: "chest",
    name: "Chest",
    sortOrder: 10,
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
  {
    aliases: ["lats"],
    bodyRegion: "Back",
    createdAt: "2026-01-03T00:00:00.000Z",
    iconAssetKey: null,
    iconKey: "dumbbell",
    iconKind: "library",
    id: "story-muscle-back",
    isActive: true,
    isSystem: true,
    key: "upper_back",
    name: "Upper Back",
    sortOrder: 20,
    updatedAt: "2026-02-02T00:00:00.000Z",
  },
  {
    aliases: ["rear delts"],
    bodyRegion: "Shoulders",
    createdAt: "2026-01-04T00:00:00.000Z",
    iconAssetKey: null,
    iconKey: "medal",
    iconKind: "library",
    id: "story-muscle-rear-deltoid",
    isActive: false,
    isSystem: false,
    key: "rear_deltoid",
    name: "Rear Deltoid",
    sortOrder: 30,
    updatedAt: "2026-02-03T00:00:00.000Z",
  },
];

const EXERCISE_LIBRARY_QUERY = fitnessExercisesQueryOptions(webApiClient, {
  includeInactive: false,
  limit: 8,
  page: 1,
});
const MUSCLE_LIBRARY_QUERY = fitnessMuscleDefinitionsQueryOptions(webApiClient, {
  includeArchived: true,
});

function createCatalogQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
      },
    },
  });

  const exerciseResult: FitnessPaginatedResult<FitnessExerciseRecord> = {
    data: EXERCISE_LIBRARY_FIXTURES,
    meta: {
      limit: 8,
      page: 1,
      total: EXERCISE_LIBRARY_FIXTURES.length,
      total_pages: 1,
    },
  };

  queryClient.setQueryData(EXERCISE_LIBRARY_QUERY.queryKey, exerciseResult);
  queryClient.setQueryData(
    MUSCLE_LIBRARY_QUERY.queryKey,
    MUSCLE_LIBRARY_FIXTURES,
  );
  return queryClient;
}

type CatalogStorySurface = "library" | "muscles" | "add-muscle" | "authoring";

function CatalogStoryHarness({ surface }: { surface: CatalogStorySurface }) {
  const initialized = useRef(false);
  const { handleOpenCreate, openMuscleEditor, setMode } = useExerciseLabPage();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (surface === "library" || surface === "authoring") {
      setMode("library");
      if (surface === "authoring") handleOpenCreate();
      return;
    }

    setMode("muscles");
    if (surface === "add-muscle") openMuscleEditor();
  }, [handleOpenCreate, openMuscleEditor, setMode, surface]);

  return (
    <div
      style={{
        height: "calc(100vh - 64px)",
        margin: "0 auto",
        maxWidth: 1250,
        minHeight: 620,
        minWidth: 0,
        width: "100%",
      }}
    >
      {surface === "library" || surface === "authoring" ? (
        <ExerciseLabLibrarySurface />
      ) : (
        <ExerciseLabMuscleSurface />
      )}
      {surface === "authoring" ? (
        <>
          <ExerciseLabAuthoringModal />
          <ExerciseLabModalLayer />
        </>
      ) : null}
    </div>
  );
}

function ExerciseLabCatalogStory({ surface }: { surface: CatalogStorySurface }) {
  const [queryClient] = useState(createCatalogQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ExerciseLabPageProvider>
        <CatalogStoryHarness surface={surface} />
      </ExerciseLabPageProvider>
    </QueryClientProvider>
  );
}

const meta = {
  title: "FitTrack/Exercise Lab/Catalog",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/exercise-lab",
        query: {},
      },
    },
    docs: {
      description: {
        component:
          "Production catalog surfaces rendered through ExerciseLabPageProvider with deterministic data seeded against the exact exercise and muscle query keys.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExerciseLibrary: Story = {
  render: () => <ExerciseLabCatalogStory surface="library" />,
};

export const MuscleGroups: Story = {
  render: () => <ExerciseLabCatalogStory surface="muscles" />,
};

export const AddMuscleDefinition: Story = {
  render: () => <ExerciseLabCatalogStory surface="add-muscle" />,
};

export const AuthoringModalOverCatalog: Story = {
  name: "Authoring modal over catalog",
  render: () => <ExerciseLabCatalogStory surface="authoring" />,
};
