"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export const ANALYTICS_SECTION_FILTER_OPTIONS = [
  {
    label: "All Sections",
    value: "all",
  },
  {
    label: "AI Insights",
    value: "insights",
  },
  {
    label: "Performance KPIs",
    value: "kpis",
  },
  {
    label: "System Alerts",
    value: "alerts",
  },
  {
    label: "Range Insights",
    value: "daily",
  },
  {
    label: "Revenue",
    value: "revenue",
  },
] as const;

export type AnalyticsSectionFilter =
  (typeof ANALYTICS_SECTION_FILTER_OPTIONS)[number]["value"];

type AnalyticsSectionFilterContextValue = {
  sectionFilter: AnalyticsSectionFilter;
  setSectionFilter: Dispatch<SetStateAction<AnalyticsSectionFilter>>;
  shouldShowSection: (section: AnalyticsSectionFilter) => boolean;
};

const defaultAnalyticsSectionFilterContext: AnalyticsSectionFilterContextValue =
  {
    sectionFilter: "all",
    setSectionFilter: () => undefined,
    shouldShowSection: () => true,
  };

const AnalyticsSectionFilterContext =
  createContext<AnalyticsSectionFilterContextValue>(
    defaultAnalyticsSectionFilterContext,
  );

export function AnalyticsSectionFilterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [sectionFilter, setSectionFilter] =
    useState<AnalyticsSectionFilter>("all");

  const value = useMemo(
    () => ({
      sectionFilter,
      setSectionFilter,
      shouldShowSection: (section: AnalyticsSectionFilter) =>
        sectionFilter === "all" || sectionFilter === section,
    }),
    [sectionFilter],
  );

  return (
    <AnalyticsSectionFilterContext.Provider value={value}>
      {children}
    </AnalyticsSectionFilterContext.Provider>
  );
}

export function useAnalyticsSectionFilter() {
  return useContext(AnalyticsSectionFilterContext);
}
