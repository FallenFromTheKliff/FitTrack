"use client";
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

export function useFitSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor)
  );
}
