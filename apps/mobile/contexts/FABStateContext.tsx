import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react-native";
import type { SharedValue } from "react-native-reanimated";

export type FABMenuItem = {
  label: string;
  sub?: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
};

export type FABConfig = {
  screenIcon: LucideIcon;
  menuItems: FABMenuItem[];
  scrollY: SharedValue<number>;
  visible: boolean;
};

type FABStateContextType = {
  isFabOpen: boolean;
  setFabOpen: (open: boolean) => void;
  isReservationOpen: boolean;
  setReservationOpen: (open: boolean) => void;
  fabConfig: FABConfig | null;
  registerFAB: (config: FABConfig) => void;
  unregisterFAB: () => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  openGoalsSignal: boolean;
  enterCancelModeSignal: boolean;
  bookingRefreshTick: number;
  fireBookingRefresh: () => void;
  fireOpenGoals: () => void;
  fireEnterCancelMode: () => void;
  resetSignal: () => void;
  isCameraActive: boolean;
  setCameraActive: (active: boolean) => void;
};

const FABStateContext = createContext<FABStateContextType>({
  isFabOpen: false,
  setFabOpen: () => {},
  isReservationOpen: false,
  setReservationOpen: () => {},
  fabConfig: null,
  registerFAB: () => {},
  unregisterFAB: () => {},
  isSidebarOpen: false,
  setSidebarOpen: () => {},
  openGoalsSignal: false,
  enterCancelModeSignal: false,
  bookingRefreshTick: 0,
  fireBookingRefresh: () => {},
  fireOpenGoals: () => {},
  fireEnterCancelMode: () => {},
  resetSignal: () => {},
  isCameraActive: false,
  setCameraActive: () => {}
});

export function FABStateProvider({ children }: { children: ReactNode }) {
  const [isFabOpen, setFabOpenState] = useState(false);
  const [isReservationOpen, setReservationOpenState] = useState(false);
  const [fabConfig, setFabConfig] = useState<FABConfig | null>(null);
  const [isSidebarOpen, setSidebarOpenState] = useState(false);
  const [openGoalsSignal, setOpenGoalsSignal] = useState(false);
  const [enterCancelModeSignal, setEnterCancelModeSignal] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [bookingRefreshTick, setBookingRefreshTick] = useState(0);

  const setFabOpen = useCallback((open: boolean) => {
    setFabOpenState(open);
    if (open) setSidebarOpenState(false);
  }, []);

  const setReservationOpen = useCallback((open: boolean) => {
    setReservationOpenState(open);
    if (open) setFabOpenState(false);
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    if (open) setFabOpenState(false);
  }, []);

  const registerFAB = useCallback((config: FABConfig) => setFabConfig(config), []);

  const setCameraActive = useCallback((active: boolean) => {
    setIsCameraActive(active);
  }, []);

  const fireOpenGoals = useCallback(() => {
    setFabOpenState(false);
    setOpenGoalsSignal(true);
  }, []);

  const fireEnterCancelMode = useCallback(() => {
    setFabOpenState(false);
    setEnterCancelModeSignal(true);
  }, []);
  const fireBookingRefresh = useCallback(() => {
    setBookingRefreshTick((prev) => prev + 1);
  }, []);

  const resetSignal = useCallback(() => {
    setOpenGoalsSignal(false);
    setEnterCancelModeSignal(false);
  }, []);

  const unregisterFAB = useCallback(() => {
    setFabConfig(null);
    setFabOpenState(false);
  }, []);

  return (
    <FABStateContext.Provider
      value={{
        isFabOpen,
        setFabOpen,
        isReservationOpen,
        setReservationOpen,
        fabConfig,
        registerFAB,
        unregisterFAB,
        isSidebarOpen,
        setSidebarOpen,
        openGoalsSignal,
        enterCancelModeSignal,
        bookingRefreshTick,
        fireBookingRefresh,
        fireOpenGoals,
        fireEnterCancelMode,
        resetSignal,
        isCameraActive,
        setCameraActive
      }}
    >
      {children}
    </FABStateContext.Provider>
  );
}

export function useFABState() {
  return useContext(FABStateContext);
}