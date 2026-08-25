"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowUpRight,
  BadgePercent,
  ChevronUp,
  Layers3,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MembershipOperationsDashboardRecord,
  MembershipPlanRecord,
} from "@fittrack/api-client";
import type { MembershipCatalogSettingsRecord } from "@fittrack/types";
import {
  createMembershipPlanMutationOptions,
  deleteMembershipPlanMutationOptions,
  membershipCatalogSettingsQueryOptions,
  membershipOperationsDashboardQueryOptions,
  membershipPlansQueryOptions,
  updateMembershipCatalogSettingsMutationOptions,
  updateMembershipPlanMutationOptions,
} from "@fittrack/query";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { webApiClient } from "@/lib/api-client";
import {
  FitButton,
  FitPagination,
  FitPill,
  FitText,
  FitTextInput,
} from "@/components/fit";
import { ConfirmModal, FitModal } from "@/components/modals";

export const dynamic = "force-dynamic";

type PlanDraft = {
  durationDays: string;
  isActive: boolean;
  price: string;
};

type CreatePlanDraft = {
  description: string;
  durationDays: string;
  includesCoaching: boolean;
  name: string;
  price: string;
};

const DEFAULT_CREATE_PLAN_DRAFT: CreatePlanDraft = {
  description: "",
  durationDays: "30",
  includesCoaching: false,
  name: "",
  price: "",
};

const PLAN_NAME_MAX_LENGTH = 100;
const MEMBERSHIP_COLLECTION_PAGE_SIZE = 10;

type MembershipServiceOffering = {
  helper: string;
  id: string;
  isActive: boolean;
  label: string;
  price: string;
};

function parsePositiveMoney(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return { error: `${label} is required.`, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return {
      error: `${label} must be a positive amount with up to 2 decimal places.`,
      value: null,
    };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: `${label} must be greater than 0.`, value: null };
  }
  return { error: null, value: parsed };
}

function parsePositiveWholeNumber(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return { error: `${label} is required.`, value: null };
  if (!/^\d+$/.test(trimmed)) {
    return { error: `${label} must be a whole number.`, value: null };
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return { error: `${label} must be at least 1.`, value: null };
  }
  return { error: null, value: parsed };
}

function formatMoney(value: string | number | null | undefined) {
  return `PHP ${Number(value ?? 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompactMoney(value: string | number | null | undefined) {
  return `PHP ${Number(value ?? 0).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  })}`;
}

function formatPlanDuration(days: number) {
  return `${days} day${days === 1 ? "" : "s"}`;
}

function formatDuration(days: number) {
  if (days === 1) return "1 day";
  if (days % 365 === 0) return `${days / 365} year${days === 365 ? "" : "s"}`;
  if (days % 30 === 0) return `${days / 30} month${days === 30 ? "" : "s"}`;
  if (days % 7 === 0) return `${days / 7} week${days === 7 ? "" : "s"}`;
  return `${days} days`;
}

function getMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function inputShell(border: string, surface: string) {
  return {
    alignItems: "center",
    backgroundColor: surface,
    border,
    borderRadius: 8,
    display: "flex",
    minHeight: 38,
    padding: "0 10px",
  } as const;
}

function planToDraft(plan: MembershipPlanRecord): PlanDraft {
  return {
    durationDays: String(plan.duration_days),
    isActive: plan.is_active,
    price: String(Number(plan.price)),
  };
}

function buildMembershipServiceOfferings(
  plans: MembershipPlanRecord[],
  catalogSettings?: MembershipCatalogSettingsRecord,
): MembershipServiceOffering[] {
  const offerings: MembershipServiceOffering[] = [];

  if (catalogSettings) {
    offerings.push({
      helper:
        "One-time member-card activation fee from the live membership catalog settings.",
      id: "membership-card-activation",
      isActive: true,
      label: "One-time membership activation",
      price: formatMoney(catalogSettings.membership_card_price),
    });
  }

  return [
    ...offerings,
    ...plans.map((plan) => ({
      helper:
        plan.description?.trim() ||
        (plan.includes_coaching
          ? "Live access plan that includes coaching benefits."
          : "Live gym access reload plan."),
      id: plan.id,
      isActive: plan.is_active,
      label: plan.name,
      price: `${formatMoney(plan.price)} / ${formatDuration(plan.duration_days)}`,
    })),
  ];
}

export default function MembershipsPage() {
  const { colors } = useTheme();
  const fadeIn = useFadeIn({ duration: 220 });
  const themeTransition = useThemeTransition();
  const queryClient = useQueryClient();
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanDraft>>({});
  const [createPlanDraft, setCreatePlanDraft] = useState<CreatePlanDraft>(
    DEFAULT_CREATE_PLAN_DRAFT,
  );
  const [membershipCardPriceDraft, setMembershipCardPriceDraft] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [plansModalOpen, setPlansModalOpen] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [plansPage, setPlansPage] = useState(1);
  const [createPlanValidationAttempted, setCreatePlanValidationAttempted] =
    useState(false);
  const [planSaveAttempted, setPlanSaveAttempted] = useState<string | null>(null);
  const [membershipCardPriceSaveAttempted, setMembershipCardPriceSaveAttempted] =
    useState(false);
  const [deletePlanTarget, setDeletePlanTarget] =
    useState<MembershipPlanRecord | null>(null);

  const plansQuery = useQuery({
    ...membershipPlansQueryOptions(webApiClient, {
      limit: MEMBERSHIP_COLLECTION_PAGE_SIZE,
      page: plansPage,
    }),
    placeholderData: (previousData) => previousData,
  });
  const operationsQuery = useQuery(
    membershipOperationsDashboardQueryOptions(webApiClient),
  );
  const membershipCatalogSettingsQuery = useQuery(
    membershipCatalogSettingsQueryOptions(webApiClient),
  );
  const createPlanMutation = useMutation(
    createMembershipPlanMutationOptions(webApiClient, queryClient),
  );
  const updatePlanMutation = useMutation(
    updateMembershipPlanMutationOptions(webApiClient, queryClient),
  );
  const deletePlanMutation = useMutation(
    deleteMembershipPlanMutationOptions(webApiClient, queryClient),
  );
  const updateMembershipCatalogSettingsMutation = useMutation(
    updateMembershipCatalogSettingsMutationOptions(webApiClient, queryClient),
  );

  const plans = useMemo(
    () => plansQuery.data?.data ?? [],
    [plansQuery.data?.data],
  );
  const membershipCatalogSettings = membershipCatalogSettingsQuery.data;
  const operations = operationsQuery.data;
  const serviceOfferings = useMemo(
    () => buildMembershipServiceOfferings(plans, membershipCatalogSettings),
    [membershipCatalogSettings, plans],
  );
  const plansTotal = plansQuery.data?.meta.total ?? plans.length;
  const plansPageCount =
    plansTotal > MEMBERSHIP_COLLECTION_PAGE_SIZE
      ? Math.max(
          plansQuery.data?.meta.total_pages ??
            Math.ceil(plansTotal / MEMBERSHIP_COLLECTION_PAGE_SIZE),
          1,
        )
      : 1;
  const pageError =
    plansQuery.error ??
    membershipCatalogSettingsQuery.error ??
    operationsQuery.error ??
    createPlanMutation.error ??
    updatePlanMutation.error ??
    updateMembershipCatalogSettingsMutation.error ??
    deletePlanMutation.error;
  const errorMessage = pageError
    ? getMessage(pageError, "Unable to complete the membership operation.")
    : null;
  const pageMessage = validationMessage ?? errorMessage;
  const clearValidationMessage = () => setValidationMessage(null);

  const membershipCardPriceError =
    membershipCardPriceDraft.trim() || membershipCardPriceSaveAttempted
      ? parsePositiveMoney(membershipCardPriceDraft, "Membership card fee").error
      : null;
  const createPlanName = createPlanDraft.name.trim();
  const createPlanNameError = !createPlanName
    ? createPlanValidationAttempted
      ? "Plan name is required."
      : null
    : createPlanName.length > PLAN_NAME_MAX_LENGTH
      ? `Plan name must not exceed ${PLAN_NAME_MAX_LENGTH} characters.`
      : null;
  const createPlanPriceError =
    createPlanDraft.price.trim() || createPlanValidationAttempted
      ? parsePositiveMoney(createPlanDraft.price, "Plan fee").error
      : null;
  const createPlanDurationError =
    createPlanDraft.durationDays.trim() || createPlanValidationAttempted
      ? parsePositiveWholeNumber(
          createPlanDraft.durationDays,
          "Plan duration",
        ).error
      : null;

  const shell = useMemo(
    () => ({
      ...fadeIn,
      display: "grid",
      gap: 22,
      paddingBottom: 32,
      paddingTop: 4,
      position: "relative" as const,
    }),
    [fadeIn],
  );
  const panelStyle = {
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: 12,
  };
  const fieldBorder = `1px solid ${colors.fieldBorder}`;
  const muted = { color: colors.textMuted, fontSize: 13, lineHeight: 1.45 };

  useEffect(() => {
    setPlansPage((currentPage) =>
      Math.min(Math.max(currentPage, 1), plansPageCount),
    );
  }, [plansPageCount]);

  useEffect(() => {
    if (!membershipCatalogSettings) return;
    setMembershipCardPriceDraft((current) =>
      current.trim()
        ? current
        : String(Number(membershipCatalogSettings.membership_card_price)),
    );
  }, [membershipCatalogSettings]);

  const updatePlanDraft = (
    plan: MembershipPlanRecord,
    patch: Partial<PlanDraft>,
  ) => {
    setPlanDrafts((current) => ({
      ...current,
      [plan.id]: { ...(current[plan.id] ?? planToDraft(plan)), ...patch },
    }));
  };

  const savePlan = (plan: MembershipPlanRecord) => {
    setPlanSaveAttempted(plan.id);
    const draft = planDrafts[plan.id] ?? planToDraft(plan);
    const price = parsePositiveMoney(draft.price, `${plan.name} price`);
    const durationDays = parsePositiveWholeNumber(
      draft.durationDays,
      `${plan.name} duration`,
    );
    if (price.error || durationDays.error) {
      setValidationMessage(price.error ?? durationDays.error);
      return;
    }
    setValidationMessage(null);
    updatePlanMutation.mutate({
      planId: plan.id,
      payload: {
        durationDays: durationDays.value ?? plan.duration_days,
        isActive: draft.isActive,
        price: price.value ?? Number(plan.price),
      },
    });
  };

  const createPlan = () => {
    setCreatePlanValidationAttempted(true);
    const planName = createPlanDraft.name.trim();
    const price = parsePositiveMoney(createPlanDraft.price, "Plan price");
    const durationDays = parsePositiveWholeNumber(
      createPlanDraft.durationDays,
      "Plan duration",
    );
    if (!planName) {
      setValidationMessage("Plan name is required.");
      return;
    }
    if (planName.length > PLAN_NAME_MAX_LENGTH) {
      setValidationMessage(
        `Plan name must not exceed ${PLAN_NAME_MAX_LENGTH} characters.`,
      );
      return;
    }
    if (price.error || durationDays.error) {
      setValidationMessage(price.error ?? durationDays.error);
      return;
    }
    setValidationMessage(null);
    createPlanMutation.mutate(
      {
        description: createPlanDraft.description.trim() || undefined,
        durationDays: durationDays.value ?? 30,
        includesCoaching: createPlanDraft.includesCoaching,
        name: planName,
        price: price.value ?? 0,
      },
      {
        onSuccess: () => {
          setCreatePlanDraft(DEFAULT_CREATE_PLAN_DRAFT);
          setCreatePlanValidationAttempted(false);
          setCreatePlanOpen(false);
        },
      },
    );
  };

  const openPlansDrawer = (planId?: string) => {
    updatePlanMutation.reset();
    updateMembershipCatalogSettingsMutation.reset();
    createPlanMutation.reset();
    setValidationMessage(null);
    setMembershipCardPriceSaveAttempted(false);
    setCreatePlanValidationAttempted(false);
    setCreatePlanOpen(false);
    setExpandedPlanId(planId ?? null);
    setPlansModalOpen(true);
  };

  const closePlansDrawer = () => {
    if (
      updatePlanMutation.isPending ||
      updateMembershipCatalogSettingsMutation.isPending ||
      createPlanMutation.isPending
    ) {
      return;
    }
    setPlansModalOpen(false);
    setExpandedPlanId(null);
    setCreatePlanOpen(false);
    setPlanSaveAttempted(null);
  };

  const planDrawerError =
    updatePlanMutation.error ??
    updateMembershipCatalogSettingsMutation.error ??
    createPlanMutation.error;
  const planDrawerErrorMessage = planDrawerError
    ? getMessage(planDrawerError, "Unable to update the membership catalog.")
    : null;
  const plansDrawerBusy =
    updatePlanMutation.isPending ||
    updateMembershipCatalogSettingsMutation.isPending ||
    createPlanMutation.isPending;

  return (
    <main className={themeTransition} style={shell}>
      {pageMessage ? (
        <section style={panelStyle}>
          <FitText
            as="p"
            role="alert"
            style={{ color: colors.danger, fontSize: 13, fontWeight: 700 }}
          >
            {pageMessage}
          </FitText>
        </section>
      ) : null}

      <MembershipOperationsDashboard
        colors={colors}
        dashboard={operations}
        loading={operationsQuery.isFetching}
        offeringsLoading={
          plansQuery.isFetching || membershipCatalogSettingsQuery.isFetching
        }
        onRefresh={() =>
          void Promise.all([
            operationsQuery.refetch(),
            plansQuery.refetch(),
            membershipCatalogSettingsQuery.refetch(),
          ])
        }
        mutedStyle={muted}
        serviceOfferings={serviceOfferings}
      />

      <MembershipPlansOverview
        colors={colors}
        membershipCardPrice={membershipCatalogSettings?.membership_card_price}
        mutedStyle={muted}
        onOpenPlans={openPlansDrawer}
        onPageChange={setPlansPage}
        plans={plans}
        plansPage={plansPage}
        plansTotal={plansTotal}
      />

      <FitModal
        isOpen={plansModalOpen}
        onClose={closePlansDrawer}
        title={`Membership Plans (${plansTotal})`}
        subtitle="Manage activation pricing and access reload plans."
        icon={BadgePercent}
        maxWidth={620}
        motionPreset="slide-right"
        closeDisabled={plansDrawerBusy}
        overlayStyle={{
          alignItems: "stretch",
          justifyContent: "flex-end",
          padding: 0,
        }}
        containerStyle={{
          borderRadius: "16px 0 0 16px",
          height: "100%",
          maxHeight: "100dvh",
          maxWidth: "none",
          width: "min(620px, 100vw)",
        }}
        contentStyle={{
          maxHeight: "none",
          padding: "16px 18px 20px",
        }}
        footer={
          <div
            data-testid="memberships-plans-drawer-actions"
            style={{
              alignItems: "center",
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              {plans.length} access reload plan{plans.length === 1 ? "" : "s"}
            </FitText>
            <FitButton
              label="CLOSE"
              variant="ghost"
              disabled={plansDrawerBusy}
              onClick={closePlansDrawer}
            />
          </div>
        }
        footerStyle={{ padding: "12px 18px" }}
      >
        <div data-testid="memberships-plans-drawer" style={{ display: "grid", gap: 14 }}>
          {planDrawerErrorMessage ? (
            <div
              role="alert"
              style={{
                backgroundColor: `${colors.danger}14`,
                border: `1px solid ${colors.danger}55`,
                borderRadius: 8,
                color: colors.danger,
                fontSize: 12,
                lineHeight: 1.35,
                padding: "9px 11px",
              }}
            >
              {planDrawerErrorMessage}
            </div>
          ) : null}

          <section
            data-testid="membership-activation-price-editor"
            style={{
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              display: "grid",
              gap: 10,
              padding: 12,
            }}
          >
            <div
              style={{
                alignItems: "flex-start",
                display: "flex",
                gap: 10,
                justifyContent: "space-between",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <FitText style={{ fontSize: 14, fontWeight: 900 }}>
                  One-time membership activation
                </FitText>
                <FitText as="p" style={{ ...muted, fontSize: 11 }}>
                  Shown in the member Profile purchase flow.
                </FitText>
              </div>
              <FitPill
                mode="status"
                label="Active"
                color={colors.success}
              />
            </div>
            <div
              style={{
                alignItems: "end",
                display: "grid",
                gap: 10,
                gridTemplateColumns: "minmax(0, 1fr) auto",
              }}
            >
              <label style={{ display: "grid", gap: 4 }}>
                <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                  Price (PHP)
                </FitText>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={inputShell(fieldBorder, colors.surface)}>
                    <FitTextInput
                      aria-describedby={
                        membershipCardPriceError
                          ? "membership-card-price-error"
                          : undefined
                      }
                      aria-invalid={Boolean(membershipCardPriceError)}
                      aria-label="Membership card price"
                      id="membership-card-price"
                      inputMode="decimal"
                      min="0.01"
                      name="membershipCardPrice"
                      step="0.01"
                      type="number"
                      value={membershipCardPriceDraft}
                      onChange={(event) => {
                        setMembershipCardPriceDraft(event.target.value);
                        setMembershipCardPriceSaveAttempted(false);
                        clearValidationMessage();
                      }}
                    />
                  </div>
                  {membershipCardPriceError ? (
                    <FitText
                      as="span"
                      id="membership-card-price-error"
                      role="alert"
                      style={{ color: colors.danger, fontSize: 11 }}
                    >
                      {membershipCardPriceError}
                    </FitText>
                  ) : null}
                </div>
              </label>
              <FitButton
                icon={Save}
                label="SAVE PRICE"
                loading={updateMembershipCatalogSettingsMutation.isPending}
                onClick={() => {
                  setMembershipCardPriceSaveAttempted(true);
                  const price = parsePositiveMoney(
                    membershipCardPriceDraft,
                    "Membership card price",
                  );
                  if (price.error) {
                    setValidationMessage(price.error);
                    return;
                  }
                  setValidationMessage(null);
                  updateMembershipCatalogSettingsMutation.mutate({
                    membershipCardPrice: price.value ?? 0,
                  });
                }}
              />
            </div>
          </section>

          <section data-testid="membership-plan-list" style={{ display: "grid", gap: 8 }}>
            <div
              style={{
                alignItems: "baseline",
                display: "flex",
                gap: 8,
                justifyContent: "space-between",
              }}
            >
              <FitText style={{ fontSize: 14, fontWeight: 900 }}>
                Access reload plans
              </FitText>
              <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                {plans.length} offer{plans.length === 1 ? "" : "s"}
              </FitText>
            </div>
            {plans.map((plan) => {
              const draft = planDrafts[plan.id] ?? planToDraft(plan);
              const isExpanded = expandedPlanId === plan.id;
              const planPriceError =
                draft.price.trim() || planSaveAttempted === plan.id
                  ? parsePositiveMoney(draft.price, "Plan fee").error
                  : null;
              const planDurationError =
                draft.durationDays.trim() || planSaveAttempted === plan.id
                  ? parsePositiveWholeNumber(
                      draft.durationDays,
                      "Plan duration",
                    ).error
                  : null;
              return (
                <div
                  key={plan.id}
                  style={{
                    backgroundColor: colors.surfaceRaised,
                    border: `1px solid ${isExpanded ? colors.brand : colors.border}`,
                    borderRadius: 8,
                    display: "grid",
                    gap: isExpanded ? 12 : 0,
                    padding: 10,
                  }}
                >
                  <div
                    style={{
                      alignItems: "center",
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                    }}
                  >
                    <button
                      aria-controls={`membership-plan-${plan.id}-editor`}
                      aria-expanded={isExpanded}
                      className="memberships-plan-toggle"
                      onClick={() => {
                        setCreatePlanOpen(false);
                        setExpandedPlanId(isExpanded ? null : plan.id);
                        setPlanSaveAttempted(null);
                      }}
                      type="button"
                    >
                      <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                        <FitText
                          as="span"
                          style={{ fontSize: 13, fontWeight: 850 }}
                        >
                          {plan.name}
                        </FitText>
                        <FitText
                          as="span"
                          style={{
                            color: colors.textMuted,
                            fontSize: 11,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatMoney(plan.price)} / {formatDuration(plan.duration_days)}
                          {plan.description ? ` · ${plan.description}` : ""}
                        </FitText>
                      </span>
                    </button>
                    <div
                      style={{
                        alignItems: "center",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        justifyContent: "flex-end",
                      }}
                    >
                      <FitPill
                        mode="status"
                        label={plan.is_active ? "Active" : "Inactive"}
                        color={plan.is_active ? colors.success : colors.textMuted}
                      />
                      <FitButton
                        aria-label={`${isExpanded ? "Collapse" : "Edit"} ${plan.name}`}
                        icon={isExpanded ? ChevronUp : Pencil}
                        iconOnly
                        onClick={() => {
                          setCreatePlanOpen(false);
                          setExpandedPlanId(isExpanded ? null : plan.id);
                          setPlanSaveAttempted(null);
                        }}
                        variant="ghost"
                        style={{ minHeight: 32, minWidth: 32, padding: 0 }}
                      />
                    </div>
                  </div>

                  {isExpanded ? (
                    <div
                      id={`membership-plan-${plan.id}-editor`}
                      style={{ display: "grid", gap: 10 }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        }}
                      >
                        <label style={{ display: "grid", gap: 4 }}>
                          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                            Price (PHP)
                          </FitText>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={inputShell(fieldBorder, colors.surface)}>
                              <FitTextInput
                                aria-describedby={
                                  planPriceError
                                    ? `membership-plan-${plan.id}-price-error`
                                    : undefined
                                }
                                aria-invalid={Boolean(planPriceError)}
                                aria-label={`${plan.name} price`}
                                id={`membership-plan-${plan.id}-price`}
                                inputMode="decimal"
                                min="0.01"
                                name={`membershipPlan_${plan.id}_price`}
                                step="0.01"
                                type="number"
                                value={draft.price}
                                onChange={(event) => {
                                  updatePlanDraft(plan, {
                                    price: event.target.value,
                                  });
                                  setPlanSaveAttempted(null);
                                  clearValidationMessage();
                                }}
                              />
                            </div>
                            {planPriceError ? (
                              <FitText
                                as="span"
                                id={`membership-plan-${plan.id}-price-error`}
                                role="alert"
                                style={{ color: colors.danger, fontSize: 11 }}
                              >
                                {planPriceError}
                              </FitText>
                            ) : null}
                          </div>
                        </label>
                        <label style={{ display: "grid", gap: 4 }}>
                          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                            Access days
                          </FitText>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={inputShell(fieldBorder, colors.surface)}>
                              <FitTextInput
                                aria-describedby={
                                  planDurationError
                                    ? `membership-plan-${plan.id}-duration-error`
                                    : undefined
                                }
                                aria-invalid={Boolean(planDurationError)}
                                aria-label={`${plan.name} duration`}
                                id={`membership-plan-${plan.id}-duration`}
                                inputMode="numeric"
                                min="1"
                                name={`membershipPlan_${plan.id}_duration`}
                                step="1"
                                type="number"
                                value={draft.durationDays}
                                onChange={(event) => {
                                  updatePlanDraft(plan, {
                                    durationDays: event.target.value,
                                  });
                                  setPlanSaveAttempted(null);
                                  clearValidationMessage();
                                }}
                              />
                            </div>
                            {planDurationError ? (
                              <FitText
                                as="span"
                                id={`membership-plan-${plan.id}-duration-error`}
                                role="alert"
                                style={{ color: colors.danger, fontSize: 11 }}
                              >
                                {planDurationError}
                              </FitText>
                            ) : null}
                          </div>
                        </label>
                      </div>
                      <label
                        style={{
                          alignItems: "center",
                          display: "flex",
                          gap: 8,
                        }}
                      >
                        <input
                          checked={draft.isActive}
                          id={`membership-plan-${plan.id}-active`}
                          name={`membershipPlan_${plan.id}_active`}
                          onChange={(event) =>
                            updatePlanDraft(plan, {
                              isActive: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                        <FitText style={{ fontSize: 12 }}>Active</FitText>
                      </label>
                      <FitText as="p" style={{ ...muted, fontSize: 11 }}>
                        {plan.description ?? "No plan description."}
                        {plan.includes_coaching ? " Includes coaching." : ""}
                      </FitText>
                      <div
                        style={{
                          alignItems: "center",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          justifyContent: "space-between",
                        }}
                      >
                        <FitButton
                          icon={Trash2}
                          label="DELETE"
                          loading={
                            deletePlanMutation.isPending &&
                            deletePlanTarget?.id === plan.id
                          }
                          onClick={() => {
                            deletePlanMutation.reset();
                            setValidationMessage(null);
                            setDeletePlanTarget(plan);
                          }}
                          variant="ghost"
                        />
                        <FitButton
                          icon={Save}
                          label="SAVE CHANGES"
                          loading={
                            updatePlanMutation.isPending &&
                            expandedPlanId === plan.id
                          }
                          onClick={() => savePlan(plan)}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {plans.length === 0 ? (
              <FitText as="p" style={muted}>
                No access reload plans are available.
              </FitText>
            ) : null}
          </section>

          <section
            data-testid="membership-create-plan-form"
            style={{
              border: `1px dashed ${colors.brand}77`,
              borderRadius: 8,
              display: "grid",
              gap: 10,
              padding: 12,
            }}
          >
            <FitButton
              icon={createPlanOpen ? ChevronUp : Plus}
              label="CREATE ACCESS RELOAD PLAN"
              variant="ghost"
              onClick={() => {
                setExpandedPlanId(null);
                setCreatePlanOpen((current) => !current);
                setCreatePlanValidationAttempted(false);
                clearValidationMessage();
              }}
              style={{ justifyContent: "flex-start", padding: 0 }}
            />
            {createPlanOpen ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "minmax(0, 1fr) minmax(110px, 0.55fr)",
                  }}
                >
                  <label style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                      Plan name
                    </FitText>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={inputShell(fieldBorder, colors.surface)}>
                        <FitTextInput
                          aria-describedby={
                            createPlanNameError
                              ? "membership-create-plan-name-error"
                              : undefined
                          }
                          aria-invalid={Boolean(createPlanNameError)}
                          id="membership-create-plan-name"
                          maxLength={PLAN_NAME_MAX_LENGTH}
                          name="membershipCreatePlanName"
                          value={createPlanDraft.name}
                          onChange={(event) => {
                            setCreatePlanDraft((current) => ({
                              ...current,
                              name: event.target.value,
                            }));
                            clearValidationMessage();
                          }}
                          placeholder="Monthly Gym Access Reload"
                        />
                      </div>
                      {createPlanNameError ? (
                        <FitText
                          as="span"
                          id="membership-create-plan-name-error"
                          role="alert"
                          style={{ color: colors.danger, fontSize: 11 }}
                        >
                          {createPlanNameError}
                        </FitText>
                      ) : null}
                    </div>
                  </label>
                  <label style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                      Price (PHP)
                    </FitText>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={inputShell(fieldBorder, colors.surface)}>
                        <FitTextInput
                          aria-describedby={
                            createPlanPriceError
                              ? "membership-create-plan-price-error"
                              : undefined
                          }
                          aria-invalid={Boolean(createPlanPriceError)}
                          id="membership-create-plan-price"
                          inputMode="decimal"
                          min="0.01"
                          name="membershipCreatePlanPrice"
                          step="0.01"
                          type="number"
                          value={createPlanDraft.price}
                          onChange={(event) => {
                            setCreatePlanDraft((current) => ({
                              ...current,
                              price: event.target.value,
                            }));
                            clearValidationMessage();
                          }}
                          placeholder="1499"
                        />
                      </div>
                      {createPlanPriceError ? (
                        <FitText
                          as="span"
                          id="membership-create-plan-price-error"
                          role="alert"
                          style={{ color: colors.danger, fontSize: 11 }}
                        >
                          {createPlanPriceError}
                        </FitText>
                      ) : null}
                    </div>
                  </label>
                </div>
                <label style={{ display: "grid", gap: 4 }}>
                  <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                    Access days
                  </FitText>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={inputShell(fieldBorder, colors.surface)}>
                      <FitTextInput
                        aria-describedby={
                          createPlanDurationError
                            ? "membership-create-plan-duration-error"
                            : undefined
                        }
                        aria-invalid={Boolean(createPlanDurationError)}
                        id="membership-create-plan-duration"
                        inputMode="numeric"
                        min="1"
                        name="membershipCreatePlanDuration"
                        step="1"
                        type="number"
                        value={createPlanDraft.durationDays}
                        onChange={(event) => {
                          setCreatePlanDraft((current) => ({
                            ...current,
                            durationDays: event.target.value,
                          }));
                          clearValidationMessage();
                        }}
                      />
                    </div>
                    {createPlanDurationError ? (
                      <FitText
                        as="span"
                        id="membership-create-plan-duration-error"
                        role="alert"
                        style={{ color: colors.danger, fontSize: 11 }}
                      >
                        {createPlanDurationError}
                      </FitText>
                    ) : null}
                  </div>
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                    Description
                  </FitText>
                  <div style={inputShell(fieldBorder, colors.surface)}>
                    <FitTextInput
                      id="membership-create-plan-description"
                      name="membershipCreatePlanDescription"
                      value={createPlanDraft.description}
                      onChange={(event) =>
                        setCreatePlanDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Reloads gym access for 30 days"
                    />
                  </div>
                </label>
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    justifyContent: "space-between",
                  }}
                >
                  <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
                    <input
                      checked={createPlanDraft.includesCoaching}
                      id="membership-create-plan-includes-coaching"
                      name="membershipCreatePlanIncludesCoaching"
                      onChange={(event) =>
                        setCreatePlanDraft((current) => ({
                          ...current,
                          includesCoaching: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <FitText style={{ fontSize: 12 }}>Includes coaching</FitText>
                  </label>
                  <FitButton
                    icon={Plus}
                    label="CREATE PLAN"
                    loading={createPlanMutation.isPending}
                    onClick={createPlan}
                  />
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </FitModal>

      <style>{`
        main :where(h1, h2, h3, h4, p) {
          margin: 0;
        }
        .fit-app-header .memberships-page-actions {
          position: absolute;
          right: 18px;
          top: 18px;
          z-index: 2;
        }
        .memberships-page-actions a:hover,
        .memberships-page-actions a:focus-visible {
          border-color: ${colors.textSecondary} !important;
          color: ${colors.textPrimary} !important;
        }
        .memberships-section {
          display: grid;
          gap: 14px;
          min-width: 0;
        }
        .memberships-section-heading {
          align-items: flex-end;
          display: flex;
          gap: 18px;
          justify-content: space-between;
          min-width: 0;
        }
        .memberships-plans-heading {
          align-items: baseline;
        }
        .memberships-section-link {
          align-items: center;
          background: ${colors.surfaceRaised};
          border: 1px solid ${colors.border};
          border-radius: 6px;
          color: ${colors.brand};
          cursor: pointer;
          display: inline-flex;
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 750;
          gap: 5px;
          min-height: 30px;
          padding: 5px 9px;
        }
        .memberships-section-link:hover,
        .memberships-section-link:focus-visible {
          color: ${colors.textPrimary};
        }
        .memberships-status-rail {
          background: ${colors.surface};
          border: 1px solid ${colors.border};
          border-radius: 10px;
          display: grid;
          gap: 0;
          grid-template-columns: minmax(250px, 1.35fr) minmax(180px, 1fr);
          min-height: 126px;
          overflow: hidden;
        }
        .memberships-status-lead,
        .memberships-status-item {
          min-width: 0;
          padding: 17px 20px;
        }
        .memberships-status-lead {
          background: linear-gradient(135deg, ${colors.surfaceRaised}, ${colors.surface});
          border-right: 1px solid ${colors.border};
          position: relative;
        }
        .memberships-status-item + .memberships-status-item {
          border-left: 1px solid ${colors.border};
        }
        .memberships-status-kicker {
          align-items: center;
          color: ${colors.textMuted};
          display: flex;
          font-size: 10px;
          font-weight: 800;
          gap: 6px;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .memberships-status-lead-value {
          font-size: 35px;
          font-weight: 850;
          letter-spacing: -.04em;
          line-height: 1;
          margin-top: 13px;
        }
        .memberships-status-value {
          display: block;
          font-size: 23px;
          font-weight: 820;
          line-height: 1.05;
          margin-top: 16px;
        }
        .memberships-status-pulse {
          align-items: center;
          bottom: 16px;
          color: ${colors.success};
          display: flex;
          font-size: 10px;
          font-weight: 700;
          gap: 6px;
          position: absolute;
        }
        .memberships-status-pulse span {
          background: ${colors.success};
          border-radius: 50%;
          box-shadow: 0 0 0 3px ${colors.success}20;
          display: inline-block;
          height: 6px;
          width: 6px;
        }
        .memberships-status-rule {
          background: ${colors.border};
          height: 1px;
          margin: 13px 0 8px;
          width: 100%;
        }
        .memberships-plan-ladder {
          background: ${colors.surface};
          background-color: ${colors.surface};
          border: 1px solid ${colors.border};
          border-radius: 10px;
          min-width: 0;
          overflow: hidden;
        }
        .memberships-plan-ladder-list {
          display: grid;
          gap: 8px;
          padding: 8px;
        }
        .memberships-plan-item {
          align-items: center;
          background: ${colors.surfaceRaised};
          border: 1px solid ${colors.border};
          border-radius: 8px;
          display: grid;
          gap: 14px;
          grid-template-columns: 38px minmax(0, 1.35fr) minmax(130px, .55fr) auto;
          min-height: 86px;
          padding: 12px 14px 12px 10px;
          transition: border-color 160ms ease, transform 160ms ease, background-color 160ms ease;
        }
        .memberships-plan-item:hover {
          background: ${colors.surfaceRaised};
          border-color: ${colors.textSecondary};
          transform: translateY(-1px);
        }
        .memberships-plan-item--activation {
          background: linear-gradient(100deg, ${colors.brand}15, ${colors.surfaceRaised} 38%);
          border-color: ${colors.brand}77;
          margin: 8px;
        }
        .memberships-plan-index {
          align-items: center;
          color: ${colors.brand};
          display: flex;
          font-size: 11px;
          font-weight: 850;
          justify-content: center;
          letter-spacing: .08em;
        }
        .memberships-plan-copy,
        .memberships-plan-price,
        .memberships-plan-actions {
          min-width: 0;
        }
        .memberships-plan-kicker {
          align-items: center;
          color: ${colors.textMuted};
          display: flex;
          font-size: 9px;
          font-weight: 800;
          gap: 5px;
          letter-spacing: .08em;
          margin-bottom: 5px;
          text-transform: uppercase;
        }
        .memberships-plan-name {
          display: block;
          font-size: 14px;
          font-weight: 800;
          line-height: 1.2;
        }
        .memberships-plan-description {
          color: ${colors.textSecondary};
          display: block;
          font-size: 11px;
          line-height: 1.35;
          margin-top: 4px;
          max-width: 58ch;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .memberships-plan-price {
          align-items: baseline;
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .memberships-plan-price-value {
          font-size: 15px;
          font-weight: 820;
          white-space: nowrap;
        }
        .memberships-plan-price-period {
          color: ${colors.textMuted};
          font-size: 11px;
          white-space: nowrap;
        }
        .memberships-plan-actions {
          align-items: center;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .memberships-empty-state {
          padding: 18px 16px;
        }
        .memberships-pagination {
          align-items: center;
          border-top: 1px solid ${colors.border};
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: space-between;
          padding: 10px 14px;
        }
        .memberships-inline-actions {
          min-width: 0;
        }
        .memberships-inline-actions .memberships-page-actions {
          justify-content: flex-start;
        }
        @media (max-width: 900px) {
          .memberships-status-rail {
            grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
          }
        }
        @media (max-width: 760px) {
          .memberships-status-rail {
            grid-template-columns: 1fr;
          }
          .memberships-status-lead {
            border-bottom: 1px solid ${colors.border};
            border-right: 0;
          }
          .memberships-status-item + .memberships-status-item {
            border-left: 0;
            border-top: 1px solid ${colors.border};
          }
          .memberships-status-pulse {
            bottom: 14px;
          }
          .memberships-section-heading {
            align-items: flex-start;
            flex-direction: column;
            gap: 8px;
          }
          .memberships-plan-item {
            align-items: start;
            grid-template-columns: 30px minmax(0, 1fr) auto;
            min-height: 0;
            padding: 13px 12px 13px 9px;
          }
          .memberships-plan-price {
            grid-column: 2;
            margin-top: -4px;
          }
          .memberships-plan-actions {
            grid-column: 3;
            grid-row: 1 / span 2;
          }
          .memberships-plan-description {
            white-space: normal;
          }
          [data-fit-modal-container="true"] {
            width: 100% !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .memberships-plan-toggle {
            scroll-behavior: auto;
          }
        }
      `}</style>
      <ConfirmModal
        isOpen={deletePlanTarget !== null}
        title="Delete Membership Plan"
        message={
          deletePlanMutation.error
            ? getMessage(
                deletePlanMutation.error,
                "Unable to delete membership plan.",
              )
            : 'Delete "' +
              (deletePlanTarget?.name ?? "this membership plan") +
              '"? This permanently removes it from the catalog. Plans with membership history are blocked so existing records stay intact; deactivate the plan instead when history exists.'
        }
        confirmLabel="DELETE PLAN"
        loadingLabel="DELETING PLAN"
        confirmIcon={Trash2}
        isLoading={deletePlanMutation.isPending}
        isDanger
        onConfirm={() => {
          if (!deletePlanTarget || deletePlanMutation.isPending) return;
          setValidationMessage(null);
          deletePlanMutation.mutate(deletePlanTarget.id, {
            onSuccess: () => setDeletePlanTarget(null),
          });
        }}
        onCancel={() => setDeletePlanTarget(null)}
      />
    </main>
  );
}

function MembershipOperationsDashboard({
  colors,
  dashboard,
  loading,
  mutedStyle,
  offeringsLoading,
  onRefresh,
  serviceOfferings,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  dashboard?: MembershipOperationsDashboardRecord;
  loading: boolean;
  mutedStyle: CSSProperties;
  onRefresh: () => void;
  offeringsLoading: boolean;
  serviceOfferings: MembershipServiceOffering[];
}) {
  const activationOffering = serviceOfferings.find(
    (offering) => offering.id === "membership-card-activation",
  );
  const activeMembers = dashboard?.totalActiveMembersCount ?? 0;
  const activationFee =
    activationOffering?.price.replace(/\.00(?=\s|$)/, "") ??
    (offeringsLoading ? "Loading…" : "—");

  const [headerElement, setHeaderElement] = useState<HTMLElement | null>(null);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);

  useEffect(() => {
    setHeaderElement(document.querySelector<HTMLElement>(".fit-app-header"));
    return () => setHeaderElement(null);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => setIsNarrowViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const actions = (
    <div
      aria-label="Membership page actions"
      className="memberships-page-actions"
      style={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 14,
        justifyContent: "flex-end",
      }}
    >
      <FitButton
        aria-label="Refresh memberships"
        icon={RefreshCcw}
        iconOnly
        loading={loading}
        title="Refresh memberships"
        variant="ghost"
        onClick={onRefresh}
        style={{ minHeight: 44, minWidth: 52, padding: 10 }}
      />
      <a
        href="/accounts?tier=active_member"
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          color: colors.textPrimary,
          display: "inline-flex",
          fontSize: 14,
          fontWeight: 650,
          gap: 12,
          minHeight: 44,
          padding: "10px 18px",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        <UsersRound size={20} strokeWidth={1.8} />
        <span>View member accounts</span>
      </a>
    </div>
  );

  return (
    <>
      {!isNarrowViewport && headerElement ? createPortal(actions, headerElement) : null}
      {isNarrowViewport ? (
        <div className="memberships-inline-actions">{actions}</div>
      ) : null}
      <section
        aria-label="Membership operations status"
        className="memberships-status-rail"
        data-testid="membership-status-rail"
      >
        <div className="memberships-status-lead">
          <div className="memberships-status-kicker">
            <Activity aria-hidden="true" size={14} strokeWidth={2} />
            Operations snapshot
          </div>
          <div className="memberships-status-lead-value">{activeMembers}</div>
          <FitText as="p" style={{ ...mutedStyle, fontSize: 12 }}>
            members with active subscriptions
          </FitText>
          <div className="memberships-status-pulse">
            <span aria-hidden="true" />
            Live membership access
          </div>
        </div>
        <div className="memberships-status-item">
          <div className="memberships-status-kicker">
            <BadgePercent aria-hidden="true" size={14} strokeWidth={2} />
            Activation
          </div>
          <FitText className="memberships-status-value">
            {activationFee}
          </FitText>
          <FitText as="p" style={{ ...mutedStyle, fontSize: 12 }}>
            one-time member-card fee
          </FitText>
          <div className="memberships-status-rule" aria-hidden="true" />
          <FitText style={{ color: colors.textSecondary, fontSize: 11 }}>
            Live catalog setting
          </FitText>
        </div>
      </section>
    </>
  );
}

function MembershipPlansOverview({
  colors,
  membershipCardPrice,
  mutedStyle,
  onOpenPlans,
  onPageChange,
  plans,
  plansPage,
  plansTotal,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  membershipCardPrice?: string | number | null;
  mutedStyle: CSSProperties;
  onOpenPlans: (planId?: string) => void;
  onPageChange: (page: number) => void;
  plans: MembershipPlanRecord[];
  plansPage: number;
  plansTotal: number;
}) {
  return (
    <section className="memberships-section" data-testid="membership-plan-ladder">
      <div className="memberships-section-heading memberships-plans-heading">
        <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
          <FitText as="h2" style={{ fontSize: 19, fontWeight: 800 }}>
            Membership Plan
          </FitText>
          <FitText as="p" style={{ ...mutedStyle, fontSize: 13 }}>
            Keep activation and access reload offers easy to scan and easy to tune.
          </FitText>
        </div>
        <button
          className="memberships-section-link"
          onClick={() => onOpenPlans()}
          type="button"
        >
          Manage plans
          <ArrowUpRight aria-hidden="true" size={15} strokeWidth={2} />
        </button>
      </div>

      <div className="memberships-plan-ladder" role="list" aria-label="Membership plans">
        <article className="memberships-plan-item memberships-plan-item--activation" role="listitem">
          <div className="memberships-plan-index" aria-hidden="true">00</div>
          <div className="memberships-plan-copy">
            <div className="memberships-plan-kicker">
              <BadgePercent aria-hidden="true" size={14} strokeWidth={2} />
              Entry access
            </div>
            <FitText as="h3" className="memberships-plan-name">
              One-time activation
            </FitText>
            <FitText as="p" className="memberships-plan-description">
              Initial member access through the live card purchase flow.
            </FitText>
          </div>
          <div className="memberships-plan-price">
            <FitText className="memberships-plan-price-value">
              {membershipCardPrice === undefined || membershipCardPrice === null
                ? "—"
                : formatCompactMoney(membershipCardPrice)}
            </FitText>
            <FitText as="span" className="memberships-plan-price-period">once</FitText>
          </div>
          <div className="memberships-plan-actions">
            <FitPill mode="status" label="Always on" color={colors.success} />
            <FitButton
              aria-label="Manage one-time activation"
              icon={Pencil}
              iconOnly
              onClick={() => onOpenPlans()}
              title="Manage one-time activation"
              variant="iconClear"
            />
          </div>
        </article>

        <div className="memberships-plan-ladder-list" role="list" aria-label="Access reload plans">
          {plans.map((plan, index) => (
            <article className="memberships-plan-item" key={plan.id} role="listitem">
              <div className="memberships-plan-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="memberships-plan-copy">
                <div className="memberships-plan-kicker">
                  <Layers3 aria-hidden="true" size={14} strokeWidth={2} />
                  Access reload
                </div>
                <FitText as="h3" className="memberships-plan-name">
                  {plan.name}
                </FitText>
                <FitText as="p" className="memberships-plan-description">
                  {plan.description ?? "No plan description."}
                </FitText>
                {plan.includes_coaching ? (
                  <FitPill
                    mode="status"
                    label="Includes coaching"
                    color={colors.brand}
                    style={{ marginTop: 8 }}
                  />
                ) : null}
              </div>
              <div className="memberships-plan-price">
                <FitText className="memberships-plan-price-value">
                  {formatCompactMoney(plan.price)}
                </FitText>
                <FitText as="span" className="memberships-plan-price-period">
                  / {formatPlanDuration(plan.duration_days)}
                </FitText>
              </div>
              <div className="memberships-plan-actions">
                <FitPill
                  mode="status"
                  label={plan.is_active ? "Active" : "Inactive"}
                  color={plan.is_active ? colors.success : colors.textMuted}
                />
                <FitButton
                  aria-label={`Manage ${plan.name}`}
                  icon={Pencil}
                  iconOnly
                  onClick={() => onOpenPlans(plan.id)}
                  title={`Manage ${plan.name}`}
                  variant="iconClear"
                />
              </div>
            </article>
          ))}
          {plans.length === 0 ? (
            <div className="memberships-empty-state">
              <FitText as="p" style={mutedStyle}>
                No access reload plans are available.
              </FitText>
            </div>
          ) : null}
        </div>
        <MembershipCollectionPagination
          ariaLabel="Membership plans pagination"
          colors={colors}
          currentPage={plansPage}
          onPageChange={onPageChange}
          totalItems={plansTotal}
        />
      </div>
    </section>
  );
}

function MembershipCollectionPagination({
  ariaLabel,
  colors,
  currentPage,
  onPageChange,
  totalItems,
}: {
  ariaLabel: string;
  colors: ReturnType<typeof useTheme>["colors"];
  currentPage: number;
  onPageChange: (page: number) => void;
  totalItems: number;
}) {
  if (totalItems <= MEMBERSHIP_COLLECTION_PAGE_SIZE) return null;

  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / MEMBERSHIP_COLLECTION_PAGE_SIZE),
  );
  const pageStart = (currentPage - 1) * MEMBERSHIP_COLLECTION_PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * MEMBERSHIP_COLLECTION_PAGE_SIZE, totalItems);

  return (
    <div className="memberships-pagination">
      <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
        Showing {pageStart}–{pageEnd} of {totalItems}
      </FitText>
      <FitPagination
        ariaLabel={ariaLabel}
        currentPage={currentPage}
        onPageChange={onPageChange}
        totalPages={totalPages}
      />
    </div>
  );
}

