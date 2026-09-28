"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  ChevronUp,
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
import type {
  CreateMembershipPlanInput,
  MembershipAccessCandidateRecord,
  MembershipCatalogSettingsRecord,
  RevokeFreeDayPassInput,
  UpdateMembershipPlanInput,
} from "@fittrack/types";
import {
  createMembershipPlanMutationOptions,
  deleteMembershipPlanMutationOptions,
  membershipCatalogSettingsQueryOptions,
  membershipManagementPlansQueryOptions,
  membershipAccessCandidatesQueryOptions,
  membershipOperationsDashboardQueryOptions,
  manualAttendanceCheckInMutationOptions,
  recordCashMembershipMutationOptions,
  grantFreeDayPassMutationOptions,
  membershipAccessCandidatesQueryKey,
  revokeFreeDayPassMutationOptions,
  revokeMembershipSubscriptionMutationOptions,
  updateMembershipCatalogSettingsMutationOptions,
  updateMembershipPlanMutationOptions,
  updateAdminMembershipCardMutationOptions,
} from "@fittrack/query";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { webApiClient } from "@/lib/api-client";
import { createClientIdempotencyKey } from "@/lib/commerce-checkout";
import {
  durationPartsFromDays,
  formatMembershipDuration,
  MEMBERSHIP_DURATION_UNITS,
  parseMembershipDuration,
  type MembershipDurationUnit,
} from "@/lib/membership-duration";
import {
  FitButton,
  FitPagination,
  FitPill,
  FitSelect,
  FitText,
  FitTextArea,
  FitTextInput,
} from "@/components/fit";
import { ConfirmModal, FitModal } from "@/components/modals";

export const dynamic = "force-dynamic";

type PlanDraft = {
  description: string;
  durationQuantity: string;
  durationUnit: MembershipDurationUnit;
  isActive: boolean;
  price: string;
};

type PlanTouchedFields = {
  duration: boolean;
  price: boolean;
};

type CreatePlanDraft = {
  description: string;
  durationQuantity: string;
  durationUnit: MembershipDurationUnit;
  name: string;
  price: string;
};

const DEFAULT_CREATE_PLAN_DRAFT: CreatePlanDraft = {
  description: "",
  durationQuantity: "1",
  durationUnit: "months",
  name: "",
  price: "",
};

const PLAN_NAME_MAX_LENGTH = 100;
const MEMBERSHIP_COLLECTION_PAGE_SIZE = 10;
const MEMBERSHIP_DURATION_OPTIONS = MEMBERSHIP_DURATION_UNITS.map((unit) => ({
  label: unit[0].toUpperCase() + unit.slice(1),
  value: unit,
}));

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

type MembershipAccessAction = "grant" | "revoke";
type MembershipAccessProduct =
  | "membership_card"
  | "gym_membership"
  | "free_day_pass";

type AccessGrantConfirmation = {
  candidate: MembershipAccessCandidateRecord;
  plan: MembershipPlanRecord | null;
  product: MembershipAccessProduct;
};

type AccessRevokeConfirmation = {
  candidate: MembershipAccessCandidateRecord;
  payload: RevokeFreeDayPassInput;
  product: MembershipAccessProduct;
};

function formatAccessDate(value: string | null | undefined) {
  if (!value) return "No expiry recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
    boxSizing: "border-box",
    display: "flex",
    minHeight: 38,
    minWidth: 0,
    padding: "0 10px",
    width: "100%",
  } as const;
}

function planToDraft(plan: MembershipPlanRecord): PlanDraft {
  const duration = durationPartsFromDays(plan.duration_days);
  return {
    description: plan.description ?? "",
    durationQuantity: duration.quantity,
    durationUnit: duration.unit,
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
        "One-time Membership Card price from the live membership catalog settings.",
      id: "membership-card-price",
      isActive: true,
      label: "Membership Card",
      price: formatMoney(catalogSettings.membership_card_price),
    });
  }

  return [
    ...offerings,
    ...plans.map((plan) => ({
      helper:
        plan.description?.trim() ||
        "Available Gym Membership plan.",
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
  const [membershipCardPriceTouched, setMembershipCardPriceTouched] =
    useState(false);
  const [plansModalOpen, setPlansModalOpen] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [plansPage, setPlansPage] = useState(1);
  const [planTouchedFields, setPlanTouchedFields] = useState<
    Record<string, PlanTouchedFields>
  >({});
  const [createPlanNameTouched, setCreatePlanNameTouched] = useState(false);
  const [createPlanPriceTouched, setCreatePlanPriceTouched] = useState(false);
  const [createPlanDurationTouched, setCreatePlanDurationTouched] =
    useState(false);
  const [createPlanValidationAttempted, setCreatePlanValidationAttempted] =
    useState(false);
  const [planSaveAttempted, setPlanSaveAttempted] = useState<string | null>(null);
  const [membershipCardPriceSaveAttempted, setMembershipCardPriceSaveAttempted] =
    useState(false);
  const [deletePlanTarget, setDeletePlanTarget] =
    useState<MembershipPlanRecord | null>(null);
  const [createPlanConfirmation, setCreatePlanConfirmation] =
    useState<CreateMembershipPlanInput | null>(null);
  const [updatePlanConfirmation, setUpdatePlanConfirmation] = useState<{
    plan: MembershipPlanRecord;
    payload: UpdateMembershipPlanInput;
  } | null>(null);
  const [cashSaleOpen, setCashSaleOpen] = useState(false);

  const plansQuery = useQuery({
    ...membershipManagementPlansQueryOptions(webApiClient, {
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
    operationsQuery.error;
  const errorMessage = pageError
    ? getMessage(pageError, "Unable to complete the membership operation.")
    : null;
  const pageMessage = errorMessage;

  const membershipCardPriceError =
    membershipCardPriceTouched || membershipCardPriceSaveAttempted
      ? parsePositiveMoney(membershipCardPriceDraft, "Membership card fee").error
      : null;
  const createPlanName = createPlanDraft.name.trim();
  const createPlanNameError = (() => {
    if (!createPlanNameTouched && !createPlanValidationAttempted) return null;
    if (!createPlanName) return "Plan name is required.";
    if (createPlanName.length > PLAN_NAME_MAX_LENGTH) {
      return `Plan name must not exceed ${PLAN_NAME_MAX_LENGTH} characters.`;
    }
    return null;
  })();
  const createPlanPriceError =
    createPlanPriceTouched || createPlanValidationAttempted
      ? parsePositiveMoney(createPlanDraft.price, "Plan fee").error
      : null;
  const createPlanDuration = parseMembershipDuration(
    createPlanDraft.durationQuantity,
    createPlanDraft.durationUnit,
  );
  const createPlanDurationError =
    createPlanDurationTouched || createPlanValidationAttempted
      ? createPlanDuration.error
      : null;
  const createPlanDurationHelperId = "membership-create-plan-duration-helper";
  const createPlanDurationDescribedBy = `${createPlanDurationHelperId}${
    createPlanDurationError ? " membership-create-plan-duration-error" : ""
  }`;

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

  const touchPlanField = (
    planId: string,
    field: keyof PlanTouchedFields,
  ) => {
    setPlanTouchedFields((current) => ({
      ...current,
      [planId]: {
        ...(current[planId] ?? { duration: false, price: false }),
        [field]: true,
      },
    }));
  };

  const savePlan = (plan: MembershipPlanRecord) => {
    setPlanSaveAttempted(plan.id);
    const draft = planDrafts[plan.id] ?? planToDraft(plan);
    const price = parsePositiveMoney(draft.price, `${plan.name} price`);
    const duration = parseMembershipDuration(
      draft.durationQuantity,
      draft.durationUnit,
    );
    if (price.error || duration.error) {
      return;
    }
    updatePlanMutation.reset();
    setUpdatePlanConfirmation({
      plan,
      payload: {
        description: draft.description.trim(),
        durationDays: duration.days ?? plan.duration_days,
        isActive: draft.isActive,
        price: price.value ?? Number(plan.price),
      },
    });
  };

  const createPlan = () => {
    setCreatePlanValidationAttempted(true);
    const planName = createPlanDraft.name.trim();
    const price = parsePositiveMoney(createPlanDraft.price, "Plan price");
    const duration = parseMembershipDuration(
      createPlanDraft.durationQuantity,
      createPlanDraft.durationUnit,
    );
    if (!planName) {
      return;
    }
    if (planName.length > PLAN_NAME_MAX_LENGTH) {
      return;
    }
    if (price.error || duration.error) {
      return;
    }
    createPlanMutation.reset();
    setCreatePlanConfirmation({
      description: createPlanDraft.description.trim() || undefined,
      durationDays: duration.days ?? 30,
      name: planName,
      price: price.value ?? 0,
    });
  };

  const confirmCreatePlan = () => {
    if (!createPlanConfirmation || createPlanMutation.isPending) return;
    createPlanMutation.mutate(createPlanConfirmation, {
      onSuccess: () => {
        setCreatePlanConfirmation(null);
        setCreatePlanDraft(DEFAULT_CREATE_PLAN_DRAFT);
        setCreatePlanValidationAttempted(false);
        setCreatePlanNameTouched(false);
        setCreatePlanPriceTouched(false);
        setCreatePlanDurationTouched(false);
        setCreatePlanOpen(false);
      },
    });
  };

  const confirmUpdatePlan = () => {
    if (!updatePlanConfirmation || updatePlanMutation.isPending) return;
    updatePlanMutation.mutate(
      {
        planId: updatePlanConfirmation.plan.id,
        payload: updatePlanConfirmation.payload,
      },
      { onSuccess: () => setUpdatePlanConfirmation(null) },
    );
  };

  const openPlansDrawer = (planId?: string) => {
    updatePlanMutation.reset();
    updateMembershipCatalogSettingsMutation.reset();
    createPlanMutation.reset();
    setMembershipCardPriceTouched(false);
    setMembershipCardPriceSaveAttempted(false);
    setPlanTouchedFields({});
    setCreatePlanValidationAttempted(false);
    setCreatePlanNameTouched(false);
    setCreatePlanPriceTouched(false);
    setCreatePlanDurationTouched(false);
    setCreatePlanConfirmation(null);
    setUpdatePlanConfirmation(null);
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
    setMembershipCardPriceTouched(false);
    setMembershipCardPriceSaveAttempted(false);
    setPlanTouchedFields({});
    setCreatePlanValidationAttempted(false);
    setCreatePlanNameTouched(false);
    setCreatePlanPriceTouched(false);
    setCreatePlanDurationTouched(false);
    setCreatePlanConfirmation(null);
    setUpdatePlanConfirmation(null);
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

      <section
        style={{
          alignItems: "center",
          backgroundColor: colors.surfaceRaised,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          padding: 14,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <FitText style={{ fontSize: 14, fontWeight: 850 }}>
            Membership access management
          </FitText>
          <FitText as="p" style={{ ...muted, fontSize: 12 }}>
            Grant eligible access, record onsite sales, or revoke an active pass with a reason.
          </FitText>
        </div>
        <FitButton
          icon={CreditCard}
          label="MANAGE MEMBERSHIP ACCESS"
          onClick={() => setCashSaleOpen(true)}
        />
      </section>

      <FitModal
        isOpen={plansModalOpen}
        onClose={closePlansDrawer}
        title={`Gym Membership Plans (${plansTotal})`}
        subtitle="Manage Membership Card pricing and Gym Membership availability."
        icon={CalendarDays}
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
              {plans.length} Gym Membership plan{plans.length === 1 ? "" : "s"}
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
            data-testid="membership-card-price-editor"
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
                  Membership Card
                </FitText>
                <FitText as="p" style={{ ...muted, fontSize: 11 }}>
                  Shown in the member Profile purchase flow.
                </FitText>
              </div>
              <FitPill
                mode="status"
                label="Active"
                color={colors.success}
                style={{ borderRadius: 5 }}
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
                        setMembershipCardPriceTouched(true);
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
                    return;
                  }
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
                Gym Membership Plans
              </FitText>
              <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                {plans.length} offer{plans.length === 1 ? "" : "s"}
              </FitText>
            </div>
            {plans.map((plan) => {
              const draft = planDrafts[plan.id] ?? planToDraft(plan);
              const isExpanded = expandedPlanId === plan.id;
              const planPriceError =
                planTouchedFields[plan.id]?.price || planSaveAttempted === plan.id
                  ? parsePositiveMoney(draft.price, "Plan fee").error
                  : null;
              const planDuration = parseMembershipDuration(
                draft.durationQuantity,
                draft.durationUnit,
              );
              const planTouched = planTouchedFields[plan.id];
              const planDurationError =
                planTouched?.duration || planSaveAttempted === plan.id
                  ? planDuration.error
                  : null;
              const planDurationHelperId =
                `membership-plan-${plan.id}-duration-helper`;
              const planDurationDescribedBy = `${planDurationHelperId}${
                planDurationError
                  ? ` membership-plan-${plan.id}-duration-error`
                  : ""
              }`;
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
                        style={{ borderRadius: 5 }}
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
                      style={{ display: "grid", gap: 10, minWidth: 0 }}
                    >
                      <div
                        className="memberships-plan-editor-fields"
                        style={{
                          boxSizing: "border-box",
                          display: "grid",
                          gap: 10,
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          minWidth: 0,
                          width: "100%",
                        }}
                      >
                        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
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
                                    touchPlanField(plan.id, "price");
                                    setPlanSaveAttempted(null);
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
                        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
                          <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                            Access duration
                          </FitText>
                          <FitText
                            as="span"
                            aria-live="polite"
                            id={planDurationHelperId}
                            style={{ ...muted, fontSize: 10 }}
                          >
                            {planDuration.days
                              ? `${formatMembershipDuration(draft.durationQuantity, draft.durationUnit)} = ${formatPlanDuration(planDuration.days)}. Expiry is calculated from activation.`
                              : "Choose a positive whole-number duration. Expiry is calculated from activation."}
                          </FitText>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div
                              className="memberships-duration-fields"
                              style={{
                                boxSizing: "border-box",
                                display: "grid",
                                gap: 8,
                                gridTemplateColumns: "minmax(0, 1fr) minmax(120px, 0.9fr)",
                                minWidth: 0,
                                width: "100%",
                              }}
                            >
                              <div style={inputShell(fieldBorder, colors.surface)}>
                                <FitTextInput
                                  aria-describedby={planDurationDescribedBy}
                                  aria-invalid={Boolean(planDurationError)}
                                  aria-label={`${plan.name} duration quantity`}
                                  id={`membership-plan-${plan.id}-duration-quantity`}
                                  inputMode="numeric"
                                  min="1"
                                  name={`membershipPlan_${plan.id}_duration_quantity`}
                                  step="1"
                                  type="number"
                                  value={draft.durationQuantity}
                                  onChange={(event) => {
                                    updatePlanDraft(plan, {
                                      durationQuantity: event.target.value,
                                    });
                                    touchPlanField(plan.id, "duration");
                                    setPlanSaveAttempted(null);
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  ...inputShell(fieldBorder, colors.surface),
                                  padding: 0,
                                }}
                              >
                                <FitSelect
                                  aria-describedby={planDurationDescribedBy}
                                  aria-label={`${plan.name} duration unit`}
                                  compact
                                  fullWidth
                                  id={`membership-plan-${plan.id}-duration-unit`}
                                  name={`membershipPlan_${plan.id}_duration_unit`}
                                  onChange={(event) => {
                                    updatePlanDraft(plan, {
                                      durationUnit: event.target.value as MembershipDurationUnit,
                                    });
                                    touchPlanField(plan.id, "duration");
                                    setPlanSaveAttempted(null);
                                  }}
                                  options={MEMBERSHIP_DURATION_OPTIONS}
                                  style={{ minHeight: 36 }}
                                  value={draft.durationUnit}
                                />
                              </div>
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
                      <div
                        style={{
                          alignItems: "center",
                          display: "flex",
                          gap: 8,
                        }}
                      >
                        <button
                          aria-checked={draft.isActive}
                          aria-label={`${plan.name} availability`}
                          id={`membership-plan-${plan.id}-active`}
                          onClick={() =>
                            updatePlanDraft(plan, {
                              isActive: !draft.isActive,
                            })
                          }
                          role="switch"
                          style={{
                            backgroundColor: draft.isActive ? colors.success : colors.border,
                            border: 0,
                            borderRadius: 999,
                            cursor: "pointer",
                            display: "inline-flex",
                            height: 20,
                            padding: 2,
                            width: 36,
                          }}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              backgroundColor: colors.surface,
                              borderRadius: "50%",
                              display: "block",
                              height: 16,
                              transform: draft.isActive ? "translateX(16px)" : "translateX(0)",
                              transition: "transform 140ms ease",
                              width: 16,
                            }}
                          />
                        </button>
                        <FitText style={{ fontSize: 12 }}>
                          {draft.isActive ? "Available" : "Inactive"}
                        </FitText>
                      </div>
                      <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
                        <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                          Description
                        </FitText>
                        <div
                          style={{
                            ...inputShell(fieldBorder, colors.surface),
                            alignItems: "stretch",
                            boxSizing: "border-box",
                            minHeight: 96,
                            minWidth: 0,
                            overflow: "hidden",
                            padding: "6px 10px",
                          }}
                        >
                          <FitTextArea
                            aria-label={`${plan.name} description`}
                            id={`membership-plan-${plan.id}-description`}
                            name={`membershipPlan_${plan.id}_description`}
                            placeholder="Describe the gym access included in this plan (coaching is sold separately)."
                            rows={4}
                            value={draft.description}
                            onChange={(event) => {
                              updatePlanDraft(plan, {
                                description: event.target.value,
                              });
                              setPlanSaveAttempted(null);
                            }}
                            style={{
                              minHeight: 82,
                              minWidth: 0,
                              padding: "4px 0",
                              width: "100%",
                            }}
                          />
                        </div>
                      </label>
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
                No Gym Membership plans are available.
              </FitText>
            ) : null}
          </section>

          <section
            data-testid="membership-create-plan-form"
            style={{
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              display: "grid",
              gap: 10,
              padding: 12,
            }}
          >
            <FitButton
              icon={createPlanOpen ? ChevronUp : Plus}
              label="CREATE GYM MEMBERSHIP PLAN"
              variant="ghost"
              onClick={() => {
                setExpandedPlanId(null);
                setCreatePlanOpen((current) => !current);
                setCreatePlanValidationAttempted(false);
                setCreatePlanNameTouched(false);
                setCreatePlanPriceTouched(false);
                setCreatePlanDurationTouched(false);
              }}
              style={{ justifyContent: "flex-start", padding: 0 }}
            />
            {createPlanOpen ? (
              <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
                <div
                  className="memberships-create-plan-fields"
                  style={{
                    boxSizing: "border-box",
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "minmax(0, 1fr) minmax(110px, 0.55fr)",
                    minWidth: 0,
                    width: "100%",
                  }}
                >
                  <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
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
                            setCreatePlanNameTouched(true);
                          }}
                      placeholder="Monthly Membership"
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
                  <label style={{ display: "grid", gap: 4, minWidth: 0 }}>
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
                            setCreatePlanPriceTouched(true);
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
                    Access duration
                  </FitText>
                  <FitText
                    as="span"
                    aria-live="polite"
                    id={createPlanDurationHelperId}
                    style={{ ...muted, fontSize: 10 }}
                  >
                    {createPlanDuration.days
                      ? `${formatMembershipDuration(createPlanDraft.durationQuantity, createPlanDraft.durationUnit)} = ${formatPlanDuration(createPlanDuration.days)}. Expiry is calculated from activation.`
                      : "Choose a positive whole-number duration. Expiry is calculated from activation."}
                  </FitText>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div
                      className="memberships-duration-fields"
                      style={{
                        boxSizing: "border-box",
                        display: "grid",
                        gap: 8,
                        gridTemplateColumns: "minmax(0, 1fr) minmax(120px, 0.9fr)",
                        minWidth: 0,
                        width: "100%",
                      }}
                    >
                      <div style={inputShell(fieldBorder, colors.surface)}>
                        <FitTextInput
                          aria-describedby={createPlanDurationDescribedBy}
                          aria-invalid={Boolean(createPlanDurationError)}
                          aria-label="New Gym Membership duration quantity"
                          id="membership-create-plan-duration-quantity"
                          inputMode="numeric"
                          min="1"
                          name="membershipCreatePlanDurationQuantity"
                          step="1"
                          type="number"
                          value={createPlanDraft.durationQuantity}
                          onChange={(event) => {
                            setCreatePlanDraft((current) => ({
                              ...current,
                              durationQuantity: event.target.value,
                            }));
                            setCreatePlanDurationTouched(true);
                          }}
                        />
                      </div>
                      <div
                        style={{
                          ...inputShell(fieldBorder, colors.surface),
                          padding: 0,
                        }}
                      >
                        <FitSelect
                          aria-describedby={createPlanDurationDescribedBy}
                          aria-label="New Gym Membership duration unit"
                          compact
                          fullWidth
                          id="membership-create-plan-duration-unit"
                          name="membershipCreatePlanDurationUnit"
                          onChange={(event) => {
                            setCreatePlanDraft((current) => ({
                              ...current,
                              durationUnit: event.target.value as MembershipDurationUnit,
                            }));
                            setCreatePlanDurationTouched(true);
                          }}
                          options={MEMBERSHIP_DURATION_OPTIONS}
                          style={{ minHeight: 36 }}
                          value={createPlanDraft.durationUnit}
                        />
                      </div>
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
                  <div
                    style={{
                      ...inputShell(fieldBorder, colors.surface),
                      alignItems: "stretch",
                      minHeight: 96,
                      overflow: "hidden",
                      padding: "6px 10px",
                    }}
                  >
                    <FitTextArea
                      aria-label="New Gym Membership description"
                      id="membership-create-plan-description"
                      name="membershipCreatePlanDescription"
                      rows={4}
                      value={createPlanDraft.description}
                      onChange={(event) =>
                        setCreatePlanDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Describe the gym access included in this plan (coaching is sold separately)."
                      style={{
                        minHeight: 82,
                        minWidth: 0,
                        padding: "4px 0",
                        width: "100%",
                      }}
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

      <RecordCashMembershipModal
        colors={colors}
        isOpen={cashSaleOpen}
        membershipCardPrice={membershipCatalogSettings?.membership_card_price}
        onClose={() => setCashSaleOpen(false)}
        plans={plans}
      />

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
          transition: none;
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
        .memberships-plan-editor-fields,
        .memberships-create-plan-fields,
        .memberships-duration-fields {
          min-width: 0;
          width: 100%;
        }
        @media (max-width: 540px) {
          .memberships-plan-editor-fields,
          .memberships-create-plan-fields,
          .memberships-duration-fields {
            grid-template-columns: minmax(0, 1fr) !important;
          }
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
        isOpen={createPlanConfirmation !== null}
        title="Create Gym Membership Plan"
        message={
          createPlanMutation.error
            ? getMessage(createPlanMutation.error, "Unable to create membership plan.")
            : createPlanConfirmation
              ? `Create "${createPlanConfirmation.name}" for ${formatMoney(
                  createPlanConfirmation.price,
                )} with ${formatDuration(createPlanConfirmation.durationDays)} of gym access? The plan will be available for new grants after creation.`
              : "Create this membership plan?"
        }
        confirmLabel="CREATE PLAN"
        loadingLabel="CREATING PLAN"
        confirmIcon={Plus}
        isLoading={createPlanMutation.isPending}
        onConfirm={confirmCreatePlan}
        onCancel={() => {
          if (createPlanMutation.isPending) return;
          setCreatePlanConfirmation(null);
          createPlanMutation.reset();
        }}
      />
      <ConfirmModal
        isOpen={updatePlanConfirmation !== null}
        title="Save Membership Plan Changes"
        message={
          updatePlanMutation.error
            ? getMessage(updatePlanMutation.error, "Unable to update membership plan.")
            : updatePlanConfirmation
              ? `Save changes to "${updatePlanConfirmation.plan.name}" at ${formatMoney(
                  updatePlanConfirmation.payload.price,
                )} for ${formatDuration(
                  updatePlanConfirmation.payload.durationDays ??
                    updatePlanConfirmation.plan.duration_days,
                )}? The updated ${
                  updatePlanConfirmation.payload.isActive ? "available" : "inactive"
                } status will apply to future grants.`
              : "Save these membership plan changes?"
        }
        confirmLabel="SAVE CHANGES"
        loadingLabel="SAVING CHANGES"
        confirmIcon={Save}
        isLoading={updatePlanMutation.isPending}
        onConfirm={confirmUpdatePlan}
        onCancel={() => {
          if (updatePlanMutation.isPending) return;
          setUpdatePlanConfirmation(null);
          updatePlanMutation.reset();
        }}
      />
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
          deletePlanMutation.mutate(deletePlanTarget.id, {
            onSuccess: () => setDeletePlanTarget(null),
          });
        }}
        onCancel={() => setDeletePlanTarget(null)}
      />
    </main>
  );
}

function RecordCashMembershipModal({
  colors,
  isOpen,
  membershipCardPrice,
  onClose,
  plans,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  isOpen: boolean;
  membershipCardPrice?: string | number | null;
  onClose: () => void;
  plans: MembershipPlanRecord[];
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<MembershipAccessAction>("grant");
  const [purchaseType, setPurchaseType] =
    useState<MembershipAccessProduct>("membership_card");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);
  const [revokeValidationAttempted, setRevokeValidationAttempted] =
    useState(false);
  const [completed, setCompleted] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [grantConfirmation, setGrantConfirmation] =
    useState<AccessGrantConfirmation | null>(null);
  const [revokeConfirmation, setRevokeConfirmation] =
    useState<AccessRevokeConfirmation | null>(null);
  const cashSaleIdempotencyKeyRef = useRef<string | null>(null);
  const candidatesQuery = useQuery({
    ...membershipAccessCandidatesQueryOptions(webApiClient, {
      action,
      product: purchaseType,
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    enabled: isOpen && !completed,
  });
  const saleMutation = useMutation(
    recordCashMembershipMutationOptions(webApiClient, queryClient),
  );
  const grantFreeDayPassMutation = useMutation(
    grantFreeDayPassMutationOptions(webApiClient, queryClient),
  );
  const membershipCardMutation = useMutation(
    updateAdminMembershipCardMutationOptions(webApiClient, queryClient),
  );
  const revokeSubscriptionMutation = useMutation(
    revokeMembershipSubscriptionMutationOptions(webApiClient, queryClient),
  );
  const revokeFreeDayPassMutation = useMutation(
    revokeFreeDayPassMutationOptions(webApiClient, queryClient),
  );
  const manualCheckInMutation = useMutation(
    manualAttendanceCheckInMutationOptions(webApiClient, queryClient),
  );
  const activePlans = plans.filter((plan) => plan.is_active);
  const candidates = candidatesQuery.data ?? [];
  const selectedPlan = activePlans.find((plan) => plan.id === planId);
  const selectedCandidate = candidates.find(
    (candidate) => candidate.memberId === memberId,
  );
  const reasonError =
    reasonTouched || revokeValidationAttempted
      ? !reason.trim()
        ? "A short reason is required."
        : null
      : null;
  const revokeTargetError =
    action === "revoke" &&
    purchaseType === "gym_membership" &&
    selectedCandidate &&
    !selectedCandidate.subscriptionId
      ? "This account has no active Gym Membership subscription to revoke."
      : null;
  const isBusy =
    saleMutation.isPending ||
    grantFreeDayPassMutation.isPending ||
    membershipCardMutation.isPending ||
    revokeSubscriptionMutation.isPending ||
    revokeFreeDayPassMutation.isPending ||
    manualCheckInMutation.isPending;

  useEffect(() => {
    if (isOpen) {
      if (!cashSaleIdempotencyKeyRef.current) {
        cashSaleIdempotencyKeyRef.current = createClientIdempotencyKey();
      }
      return;
    }
    setSearch("");
    setAction("grant");
    setMemberId(null);
    setPurchaseType("membership_card");
    setPlanId("");
    setReason("");
    setReasonTouched(false);
    setRevokeValidationAttempted(false);
    setCompleted(false);
    setSuccessMessage(null);
    setGrantConfirmation(null);
    setRevokeConfirmation(null);
    cashSaleIdempotencyKeyRef.current = null;
    saleMutation.reset();
    grantFreeDayPassMutation.reset();
    membershipCardMutation.reset();
    revokeSubscriptionMutation.reset();
    revokeFreeDayPassMutation.reset();
    manualCheckInMutation.reset();
  }, [isOpen]);

  useEffect(() => {
    setMemberId(null);
    setPlanId("");
    setReason("");
    setReasonTouched(false);
    setRevokeValidationAttempted(false);
    setGrantConfirmation(null);
    setRevokeConfirmation(null);
    saleMutation.reset();
    grantFreeDayPassMutation.reset();
    membershipCardMutation.reset();
    revokeSubscriptionMutation.reset();
    revokeFreeDayPassMutation.reset();
  }, [action, purchaseType]);

  useEffect(() => {
    if (memberId && !selectedCandidate) {
      setMemberId(null);
    }
  }, [memberId, selectedCandidate]);

  useEffect(() => {
    if (action === "grant" && purchaseType === "gym_membership" && !selectedPlan) {
      setPlanId(activePlans[0]?.id ?? "");
    }
  }, [action, activePlans, purchaseType, selectedPlan]);

  const close = () => {
    if (!isBusy) onClose();
  };
  const checkInNow = () => {
    if (!memberId || manualCheckInMutation.isPending) return;
    manualCheckInMutation.mutate({ userId: memberId });
  };
  const reviewGrant = () => {
    if (!selectedCandidate || (purchaseType === "gym_membership" && !selectedPlan)) {
      return;
    }
    saleMutation.reset();
    grantFreeDayPassMutation.reset();
    setGrantConfirmation({
      candidate: selectedCandidate,
      plan: selectedPlan ?? null,
      product: purchaseType,
    });
  };
  const confirmGrant = () => {
    if (
      !grantConfirmation ||
      saleMutation.isPending ||
      grantFreeDayPassMutation.isPending ||
      (grantConfirmation.product === "gym_membership" && !grantConfirmation.plan)
    ) {
      return;
    }
    if (grantConfirmation.product === "free_day_pass") {
      grantFreeDayPassMutation.mutate(
        grantConfirmation.candidate.memberId,
        {
          onSuccess: () => {
            setGrantConfirmation(null);
            setCompleted(true);
            setSuccessMessage(
              "Free 1-Day Pass granted. The member has 24 hours to redeem it; the first successful QR check-in consumes it.",
            );
          },
        },
      );
      return;
    }
    const idempotencyKey =
      cashSaleIdempotencyKeyRef.current ?? createClientIdempotencyKey();
    cashSaleIdempotencyKeyRef.current = idempotencyKey;
    saleMutation.mutate(
      {
        idempotencyKey,
        memberId: grantConfirmation.candidate.memberId,
        planId:
          grantConfirmation.product === "gym_membership"
            ? grantConfirmation.plan?.id
            : undefined,
        purchaseType: grantConfirmation.product,
      },
      {
        onSuccess: () => {
          setGrantConfirmation(null);
          setCompleted(true);
          setSuccessMessage(
            grantConfirmation.product === "membership_card"
              ? "Membership Card access granted successfully."
              : "Gym Membership access granted successfully.",
          );
        },
      },
    );
  };
  const reviewRevoke = () => {
    setRevokeValidationAttempted(true);
    if (
      !selectedCandidate ||
      !reason.trim() ||
      (purchaseType === "gym_membership" && !selectedCandidate.subscriptionId)
    ) {
      return;
    }
    membershipCardMutation.reset();
    revokeSubscriptionMutation.reset();
    revokeFreeDayPassMutation.reset();
    setRevokeConfirmation({
      candidate: selectedCandidate,
      payload: { reason: reason.trim() },
      product: purchaseType,
    });
  };
  const confirmRevoke = () => {
    if (!revokeConfirmation || isBusy) return;
    if (revokeConfirmation.product === "free_day_pass") {
      revokeFreeDayPassMutation.mutate(
        {
          memberId: revokeConfirmation.candidate.memberId,
          payload: revokeConfirmation.payload,
        },
        {
          onSuccess: () => {
            setRevokeConfirmation(null);
            setCompleted(true);
            setSuccessMessage("Free 1-Day Pass access revoked successfully.");
          },
        },
      );
      return;
    }
    if (revokeConfirmation.product === "membership_card") {
      membershipCardMutation.mutate(
        {
          id: revokeConfirmation.candidate.memberId,
          payload: {
            action: "revoke",
            reason: revokeConfirmation.payload.reason,
            source: "admin_repair",
          },
        },
        {
          onSuccess: async (result) => {
            await queryClient.invalidateQueries({
              queryKey: membershipAccessCandidatesQueryKey(),
            });
            setRevokeConfirmation(null);
            setCompleted(true);
            setSuccessMessage(
              result.message || "Membership Card access revoked successfully.",
            );
          },
        },
      );
      return;
    }
    const subscriptionId = revokeConfirmation.candidate.subscriptionId;
    if (!subscriptionId) return;
    revokeSubscriptionMutation.mutate(
      {
        subscriptionId,
        payload: revokeConfirmation.payload,
      },
      {
        onSuccess: (result) => {
          setRevokeConfirmation(null);
          setCompleted(true);
          setSuccessMessage(
            result.message || "Gym Membership access revoked successfully.",
          );
        },
      },
    );
  };
  const nameFor = (candidate: MembershipAccessCandidateRecord) =>
    candidate.displayName.trim() || "FitTrack member";
  const productLabel =
    purchaseType === "membership_card"
      ? "Membership Card"
      : purchaseType === "gym_membership"
        ? "Gym Membership"
        : "Free 1-Day Pass";
  const selectedAmount =
    purchaseType === "membership_card"
      ? membershipCardPrice == null
        ? "—"
        : formatMoney(membershipCardPrice)
      : purchaseType === "gym_membership"
        ? selectedPlan
          ? formatMoney(selectedPlan.price)
          : "—"
        : "FREE";

  return (
    <>
      <FitModal
      isOpen={isOpen}
      onClose={close}
      title={action === "grant" ? "Grant Membership Access" : "Revoke Membership Access"}
      subtitle={
        action === "grant"
          ? "Only accounts eligible for the selected access type are shown."
          : "Only active access grants are shown. Revocation preserves payment history."
      }
      icon={CreditCard}
      maxWidth={560}
      footer={
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            width: "100%",
          }}
        >
          <FitButton
            disabled={isBusy}
            label={completed ? "CLOSE" : "CANCEL"}
            onClick={close}
            variant="ghost"
          />
          {!completed ? (
            <FitButton
              aria-label={
                action === "grant" ? "Review membership grant" : "Review membership revocation"
              }
              disabled={
                candidatesQuery.isFetching ||
                !selectedCandidate ||
                (action === "grant" && purchaseType === "gym_membership" && !selectedPlan) ||
                (action === "revoke" &&
                  (Boolean(reasonError) || Boolean(revokeTargetError)))
              }
              label={action === "grant" ? "REVIEW GRANT" : "REVIEW REVOCATION"}
              onClick={action === "grant" ? reviewGrant : reviewRevoke}
            />
          ) : null}
        </div>
      }
    >
      {completed ? (
        <div
          data-testid="membership-access-success"
          style={{
            backgroundColor: `${colors.success}12`,
            border: `1px solid ${colors.success}55`,
            borderRadius: 8,
            display: "grid",
            gap: 8,
            padding: 12,
          }}
        >
          <FitText style={{ color: colors.success, fontSize: 15, fontWeight: 850 }}>
            {successMessage ?? "Membership access updated successfully."}
          </FitText>
           <FitText as="p" style={{ color: colors.textSecondary, fontSize: 12 }}>
             {purchaseType === "free_day_pass"
               ? "No payment or revenue was created. Access history was preserved."
               : "Payment records and account history were preserved."}
           </FitText>
           {purchaseType === "gym_membership" && action === "grant" ? (
            <FitButton
              label="CHECK IN NOW"
              loading={manualCheckInMutation.isPending}
              loadingLabel="CHECKING IN..."
              onClick={checkInNow}
            />
          ) : null}
          {manualCheckInMutation.error ? (
            <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12 }}>
              {getMessage(manualCheckInMutation.error, "Unable to check in this member now.")}
            </FitText>
          ) : null}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              Access action
            </FitText>
            <div
              aria-label="Membership access action"
              role="group"
              style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
            >
              {(["grant", "revoke"] as const).map((nextAction) => (
                <FitButton
                  key={nextAction}
                  aria-pressed={action === nextAction}
                  label={nextAction === "grant" ? "GRANT ACCESS" : "REVOKE ACCESS"}
                  onClick={() => setAction(nextAction)}
                  variant={action === nextAction ? "primary" : "ghost"}
                />
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              Access type
            </FitText>
            <div
              aria-label="Membership access type"
              role="group"
              style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
            >
               {(["membership_card", "gym_membership", "free_day_pass"] as const).map((kind) => (
                 <FitButton
                  key={kind}
                  aria-pressed={purchaseType === kind}
                  label={
                    kind === "membership_card"
                      ? "MEMBERSHIP CARD"
                       : kind === "gym_membership"
                         ? "GYM MEMBERSHIP PLAN"
                         : "FREE 1-DAY PASS"
                  }
                  onClick={() => setPurchaseType(kind)}
                  variant={purchaseType === kind ? "primary" : "ghost"}
                />
              ))}
            </div>
          </div>
          <label style={{ display: "grid", gap: 5 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              {action === "grant" ? "Search eligible accounts" : "Search active grants"}
            </FitText>
            <div style={inputShell(`1px solid ${colors.fieldBorder}`, colors.surface)}>
              <FitTextInput
                aria-label={
                  action === "grant" ? "Search eligible accounts" : "Search active grants"
                }
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or email"
              />
            </div>
          </label>
          <div
            aria-label={action === "grant" ? "Eligible account results" : "Active access results"}
            role="listbox"
            style={{
              display: "grid",
              gap: 6,
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            {candidatesQuery.isFetching ? (
              <FitText as="p" style={{ color: colors.textMuted, fontSize: 12 }}>
                Loading eligible accounts…
              </FitText>
            ) : null}
            {candidatesQuery.error ? (
              <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12 }}>
                {getMessage(
                  candidatesQuery.error,
                  "Unable to load eligible membership accounts.",
                )}
              </FitText>
            ) : null}
            {!candidatesQuery.isFetching && !candidatesQuery.error && candidates.length === 0 ? (
              <FitText as="p" style={{ color: colors.textMuted, fontSize: 12 }}>
                {action === "grant"
                  ? `No accounts are eligible for ${productLabel} access.`
                  : `No active ${productLabel} grants found.`}
              </FitText>
            ) : null}
            {!candidatesQuery.isFetching && !candidatesQuery.error
              ? candidates.map((candidate) => {
                  return (
                    <button
                      key={candidate.memberId}
                      aria-selected={candidate.memberId === memberId}
                      onClick={() => setMemberId(candidate.memberId)}
                      role="option"
                      style={{
                        backgroundColor:
                          candidate.memberId === memberId
                            ? `${colors.brand}18`
                            : colors.surfaceRaised,
                        border: `1px solid ${
                          candidate.memberId === memberId ? colors.brand : colors.border
                        }`,
                        borderRadius: 6,
                        color: colors.textPrimary,
                        cursor: "pointer",
                        display: "grid",
                        gap: 2,
                        padding: "8px 10px",
                        textAlign: "left",
                      }}
                      type="button"
                    >
                      <span style={{ fontSize: 12, fontWeight: 750 }}>
                        {nameFor(candidate)}
                      </span>
                      <span style={{ color: colors.textMuted, fontSize: 11 }}>
                        {candidate.email ?? "Email unavailable"}
                      </span>
                      {action === "revoke" ? (
                        <span style={{ color: colors.textMuted, fontSize: 10 }}>
                          {candidate.planName ??
                            (purchaseType === "free_day_pass"
                              ? "Free 1-Day Pass"
                              : "Membership Card")}
                          {(purchaseType === "free_day_pass"
                            ? candidate.freePassExpiresAt
                            : candidate.expiresAt)
                            ? ` · expires ${formatAccessDate(
                                purchaseType === "free_day_pass"
                                  ? candidate.freePassExpiresAt
                                  : candidate.expiresAt,
                              )}`
                            : " · active access"}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              : null}
          </div>
           {action === "grant" && purchaseType === "gym_membership" ? (
            <label style={{ display: "grid", gap: 5 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                Active plan
              </FitText>
              <FitSelect
                aria-label="Active Gym Membership plan"
                fullWidth
                onChange={(event) => setPlanId(event.target.value)}
                options={activePlans.map((plan) => ({
                  label: plan.name,
                  value: plan.id,
                }))}
                placeholder="Select a plan"
                style={{
                  border: `1px solid ${colors.fieldBorder}`,
                  borderRadius: 8,
                  minHeight: 38,
                }}
                value={planId}
              />
            </label>
          ) : null}
          {action === "grant" ? (
            <div
              style={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 12px",
              }}
            >
              <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                 {selectedCandidate
                   ? purchaseType === "free_day_pass"
                     ? "No payment required"
                     : "Resolved amount"
                   : "Select an eligible account"}
              </FitText>
              <FitText style={{ fontSize: 14, fontWeight: 850 }}>{selectedAmount}</FitText>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 5 }}>
              <label style={{ display: "grid", gap: 5 }}>
                <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                  Reason for revocation
                </FitText>
                <div
                  style={{
                    ...inputShell(
                      `1px solid ${reasonError ? colors.danger : colors.fieldBorder}`,
                      colors.surface,
                    ),
                    alignItems: "stretch",
                    minHeight: 76,
                    padding: "6px 10px",
                  }}
                >
                  <FitTextArea
                    aria-describedby={reasonError ? "membership-revoke-reason-error" : undefined}
                    aria-invalid={Boolean(reasonError)}
                    id="membership-revoke-reason"
                    maxLength={200}
                    placeholder="e.g. Access cancelled at the front desk"
                    rows={3}
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setReasonTouched(true);
                    }}
                    style={{ minHeight: 64, minWidth: 0, padding: "4px 0", width: "100%" }}
                  />
                </div>
              </label>
              {reasonError ? (
                <FitText
                  as="span"
                  id="membership-revoke-reason-error"
                  role="alert"
                  style={{ color: colors.danger, fontSize: 11 }}
                >
                  {reasonError}
                </FitText>
              ) : null}
              {revokeTargetError ? (
                <FitText as="span" role="alert" style={{ color: colors.danger, fontSize: 11 }}>
                  {revokeTargetError}
                </FitText>
              ) : null}
            </div>
          )}
           {saleMutation.error && action === "grant" ? (
            <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12 }}>
              {getMessage(saleMutation.error, "Unable to grant membership access.")}
            </FitText>
           ) : null}
           {grantFreeDayPassMutation.error &&
           action === "grant" &&
           purchaseType === "free_day_pass" ? (
             <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12 }}>
               {getMessage(
                 grantFreeDayPassMutation.error,
                 "Unable to grant the free 1-Day Pass.",
               )}
             </FitText>
           ) : null}
          {membershipCardMutation.error && action === "revoke" ? (
            <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12 }}>
              {getMessage(
                membershipCardMutation.error,
                "Unable to revoke Membership Card access.",
              )}
            </FitText>
          ) : null}
           {revokeSubscriptionMutation.error && action === "revoke" ? (
            <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12 }}>
              {getMessage(
                revokeSubscriptionMutation.error,
                "Unable to revoke Gym Membership access.",
              )}
            </FitText>
           ) : null}
           {revokeFreeDayPassMutation.error &&
           action === "revoke" &&
           purchaseType === "free_day_pass" ? (
             <FitText as="p" role="alert" style={{ color: colors.danger, fontSize: 12 }}>
               {getMessage(
                 revokeFreeDayPassMutation.error,
                 "Unable to revoke the free 1-Day Pass.",
               )}
             </FitText>
           ) : null}
        </div>
      )}
      </FitModal>
      <ConfirmModal
        isOpen={grantConfirmation !== null}
        title="Confirm Membership Grant"
        message={
          saleMutation.error || grantFreeDayPassMutation.error
            ? getMessage(
                saleMutation.error ?? grantFreeDayPassMutation.error,
                "Unable to grant membership access.",
              )
            : grantConfirmation
              ? grantConfirmation.product === "free_day_pass"
                ? `Grant a FREE 1-DAY PASS to ${nameFor(
                    grantConfirmation.candidate,
                  )}? Admin/staff grants 24 hours to redeem it. The first successful QR check-in consumes the pass. No payment or revenue is created.`
                : `Grant ${
                    grantConfirmation.product === "membership_card"
                      ? "Membership Card"
                      : `Gym Membership plan “${grantConfirmation.plan?.name ?? "selected plan"}”`
                  } to ${nameFor(grantConfirmation.candidate)} for ${formatMoney(
                    grantConfirmation.product === "membership_card"
                      ? membershipCardPrice
                      : grantConfirmation.plan?.price,
                  )}? This records the onsite cash payment and enables access immediately.`
              : "Confirm this membership grant?"
        }
        confirmLabel="GRANT ACCESS"
        loadingLabel="GRANTING ACCESS"
        confirmIcon={CreditCard}
        isLoading={saleMutation.isPending || grantFreeDayPassMutation.isPending}
        onConfirm={confirmGrant}
        onCancel={() => {
          if (saleMutation.isPending || grantFreeDayPassMutation.isPending) return;
          setGrantConfirmation(null);
          saleMutation.reset();
          grantFreeDayPassMutation.reset();
        }}
      />
      <ConfirmModal
        isOpen={revokeConfirmation !== null}
        title="Confirm Access Revocation"
        message={
          membershipCardMutation.error ||
          revokeSubscriptionMutation.error ||
          revokeFreeDayPassMutation.error
            ? getMessage(
                membershipCardMutation.error ??
                  revokeSubscriptionMutation.error ??
                  revokeFreeDayPassMutation.error,
                "Unable to revoke membership access.",
              )
            : revokeConfirmation
              ? `Revoke ${
                  revokeConfirmation.product === "membership_card"
                    ? "Membership Card"
                    : revokeConfirmation.product === "free_day_pass"
                      ? "FREE 1-DAY PASS"
                      : `Gym Membership access${
                          revokeConfirmation.candidate.planName
                            ? ` for ${revokeConfirmation.candidate.planName}`
                            : ""
                        }`
                } from ${nameFor(revokeConfirmation.candidate)}? Access ends immediately. No refund is issued, no access history is deleted, and ${
                  revokeConfirmation.product === "free_day_pass"
                    ? "no payment record is created or deleted"
                    : "payment history remains preserved"
                }.`
              : "Confirm this access revocation?"
        }
        confirmLabel="REVOKE ACCESS"
        loadingLabel="REVOKING ACCESS"
        confirmIcon={Trash2}
        isDanger
        isLoading={
          membershipCardMutation.isPending ||
          revokeSubscriptionMutation.isPending ||
          revokeFreeDayPassMutation.isPending
        }
        onConfirm={confirmRevoke}
        onCancel={() => {
          if (
            membershipCardMutation.isPending ||
            revokeSubscriptionMutation.isPending ||
            revokeFreeDayPassMutation.isPending
          ) {
            return;
          }
          setRevokeConfirmation(null);
          membershipCardMutation.reset();
          revokeSubscriptionMutation.reset();
          revokeFreeDayPassMutation.reset();
        }}
      />
    </>
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
  const membershipCardOffering = serviceOfferings.find(
    (offering) => offering.id === "membership-card-price",
  );
  const activeMembers = dashboard?.totalActiveMembersCount ?? 0;
  const membershipCardPrice =
    membershipCardOffering?.price.replace(/\.00(?=\s|$)/, "") ??
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
            <CreditCard aria-hidden="true" size={14} strokeWidth={2} />
            Membership Card
          </div>
          <FitText className="memberships-status-value">
            {membershipCardPrice}
          </FitText>
          <FitText as="p" style={{ ...mutedStyle, fontSize: 12 }}>
            one-time Membership Card price
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
            Gym Membership Plans
          </FitText>
          <FitText as="p" style={{ ...mutedStyle, fontSize: 13 }}>
            Keep gym access terms easy to scan and easy to manage.
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
              <CreditCard aria-hidden="true" size={14} strokeWidth={2} />
              Membership Card
            </div>
            <FitText as="h3" className="memberships-plan-name">
              Membership Card
            </FitText>
            <FitText as="p" className="memberships-plan-description">
              Unlocks Brodigy and premium app features; does not grant gym entry.
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
            <FitPill
              mode="status"
              label="Available"
              color={colors.success}
              style={{ borderRadius: 5 }}
            />
            <FitButton
              aria-label="Manage Membership Card pricing"
              icon={Pencil}
              iconOnly
              onClick={() => onOpenPlans()}
              title="Manage Membership Card pricing"
              variant="iconClear"
            />
          </div>
        </article>

        <div className="memberships-plan-ladder-list" role="list" aria-label="Gym Membership plans">
          {plans.map((plan, index) => (
            <article className="memberships-plan-item" key={plan.id} role="listitem">
              <div className="memberships-plan-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="memberships-plan-copy">
                <div className="memberships-plan-kicker">
                    <CalendarDays aria-hidden="true" size={14} strokeWidth={2} />
                    Gym access
                </div>
                <FitText as="h3" className="memberships-plan-name">
                  {plan.name}
                </FitText>
                <FitText as="p" className="memberships-plan-description">
                  {plan.description ?? "No plan description."}
                </FitText>
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
                  style={{ borderRadius: 5 }}
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
                No Gym Membership plans are available.
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
