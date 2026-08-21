import React, { createContext, useCallback, useContext, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { NutritionGoal } from "@/components/modals/nutrition/GoalsModal";

type FitnessStore = {
  activeGoal: NutritionGoal | null;
};

type FitnessContextType = {
  activeGoal: NutritionGoal | null;
  setActiveGoal: (goal: NutritionGoal) => Promise<void>;
  loadFitnessData: (userId: string) => Promise<void>;
  clearFitnessData: () => void;
};

const FitnessContext = createContext<FitnessContextType | null>(null);
const STORAGE_PREFIX = "fittrack_fitness_";
const SESSION_KEY = "fittrack_session";

export function FitnessProvider({ children }: { children: React.ReactNode }) {
  const [activeGoal, setActiveGoalState] = useState<NutritionGoal | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const persist = useCallback(async (userId: string, next: FitnessStore) => {
    try {
      await AsyncStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(next));
    } catch {}
  }, []);

  const resolveUserId = useCallback(async (): Promise<string | null> => {
    if (currentUserId) return currentUserId;
    try {
      const sess = await AsyncStorage.getItem(SESSION_KEY);
      const user = sess ? JSON.parse(sess) : null;
      return user?.id ?? null;
    } catch {
      return null;
    }
  }, [currentUserId]);

  const loadFitnessData = useCallback(async (userId: string) => {
    setCurrentUserId(userId);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_PREFIX + userId);
      if (!raw) {
        setActiveGoalState(null);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<FitnessStore>;
      setActiveGoalState(parsed.activeGoal ?? null);
    } catch {
      setActiveGoalState(null);
    }
  }, []);

  const setActiveGoal = useCallback(async (goal: NutritionGoal) => {
    setActiveGoalState(goal);
    const uid = await resolveUserId();
    if (!uid) return;
    await persist(uid, {
      activeGoal: goal
    });
  }, [persist, resolveUserId]);

  const clearFitnessData = useCallback(() => {
    setActiveGoalState(null);
    setCurrentUserId(null);
  }, []);

  return (
    <FitnessContext.Provider
      value={{
        activeGoal,
        setActiveGoal,
        loadFitnessData,
        clearFitnessData
      }}
    >
      {children}
    </FitnessContext.Provider>
  );
}

export function useFitness() {
  const ctx = useContext(FitnessContext);
  if (!ctx) throw new Error("useFitness must be used within FitnessProvider");
  return ctx;
}