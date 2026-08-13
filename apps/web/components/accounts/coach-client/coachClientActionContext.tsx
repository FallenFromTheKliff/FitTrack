"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CoachClientAction } from "./coachClientPresentation";

type CoachClientActionContextValue = {
  action: CoachClientAction | null;
  closeAction: () => void;
  openAction: (action: CoachClientAction) => void;
  openSessionReport: (appointmentId?: string) => void;
  reportAppointmentId: string | null;
};

const CoachClientActionContext =
  createContext<CoachClientActionContextValue | null>(null);

export function CoachClientActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<CoachClientAction | null>(null);
  const [reportAppointmentId, setReportAppointmentId] = useState<string | null>(null);
  const closeAction = useCallback(() => {
    setAction(null);
    setReportAppointmentId(null);
  }, []);
  const openAction = useCallback(
    (nextAction: CoachClientAction) => {
      setReportAppointmentId(null);
      setAction(nextAction);
    },
    [],
  );
  const openSessionReport = useCallback((appointmentId?: string) => {
    setReportAppointmentId(appointmentId ?? null);
    setAction("feedback");
  }, []);
  const value = useMemo(
    () => ({
      action,
      closeAction,
      openAction,
      openSessionReport,
      reportAppointmentId,
    }),
    [action, closeAction, openAction, openSessionReport, reportAppointmentId],
  );

  return (
    <CoachClientActionContext.Provider value={value}>
      {children}
    </CoachClientActionContext.Provider>
  );
}

export function useCoachClientAction() {
  const context = useContext(CoachClientActionContext);
  if (!context) {
    throw new Error(
      "useCoachClientAction must be used inside CoachClientActionProvider",
    );
  }
  return context;
}

export type { CoachClientAction } from "./coachClientPresentation";
