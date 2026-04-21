import { useCallback, useRef, useState } from "react";
import { useCameraPermissions } from "expo-camera";

import { useFABState } from "@/contexts/FABStateContext";

export function useCameraCountdown() {
  const { setCameraActive: setGlobalCameraActive } = useFABState();
  const [cameraActive, setCameraActive] = useState(false);
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const initCamera = useCallback(async (isFrozen: boolean) => {
    if (isFrozen) return false;
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return false;
    }
    setCameraActive(true);
    setGlobalCameraActive(true);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownValue(3);
    let count = 3;
    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdownValue(null);
      } else {
        setCountdownValue(count);
      }
    }, 1000);
    return true;
  }, [permission?.granted, requestPermission, setGlobalCameraActive]);

  const cleanupCamera = useCallback(() => {
    setCameraActive(false);
    setGlobalCameraActive(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownValue(null);
  }, [setGlobalCameraActive]);

  return {
    cameraActive,
    setCameraActive,
    countdownValue,
    setCountdownValue,
    permission,
    countdownIntervalRef,
    initCamera,
    cleanupCamera
  };
}
