"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowUpRight,
  BadgePercent,
  CalendarDays,
  CheckCircle2,
  ChevronUp,
  Clock3,
  Layers3,
  Megaphone,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GymPromotionRecord,
  MembershipOperationsDashboardRecord,
  MembershipPlanRecord,
} from "@fittrack/api-client";
import type { MembershipCatalogSettingsRecord } from "@fittrack/types";
import {
  createGymPromotionMutationOptions,
  createMembershipPlanMutationOptions,
  deleteMembershipPlanMutationOptions,
  deactivateGymPromotionMutationOptions,
  gymPromotionsQueryOptions,
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
  FitTextArea,
  FitTextInput,
} from "@/components/fit";
import { CalendarModal, ConfirmModal, FitModal } from "@/components/modals";

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

type PromoDraft = {
  description: string;
  endsAt: string;
  pricingNote: string;
  promoCode: string;
  startsAt: string;
  title: string;
};
type PromoCalendarTarget = "startsAt" | "endsAt";

const DEFAULT_CREATE_PLAN_DRAFT: CreatePlanDraft = {
  description: "",
  durationDays: "30",
  includesCoaching: false,
  name: "",
  price: "",
};

const DEFAULT_PROMO_DRAFT: PromoDraft = {
  description: "",
  endsAt: "",
  pricingNote: "",
  promoCode: "",
  startsAt: "",
  title: "",
};

const PLAN_NAME_MAX_LENGTH = 100;
const PROMO_CODE_MAX_LENGTH = 100;
const PROMO_TITLE_MAX_LENGTH = 255;
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

function parsePromoDate(value: string, label: string) {
  if (!value.trim()) return { error: `${label} is required.`, value: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { error: `${label} must be a valid date and time.`, value: null };
  }
  return { error: null, value: parsed };
}

function validatePromoCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > PROMO_CODE_MAX_LENGTH) {
    return `Promo code must not exceed ${PROMO_CODE_MAX_LENGTH} characters.`;
  }
  if (!/^[a-z0-9_-]+$/i.test(trimmed)) {
    return "Promo code can only use letters, numbers, hyphens, or underscores.";
  }
  return null;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPromotionDateRange(startsAt: string, endsAt: string) {
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  const startYear = startDate.toLocaleDateString("en-PH", { year: "numeric" });
  const endYear = endDate.toLocaleDateString("en-PH", { year: "numeric" });
  const startLabel = startDate.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
  });
  const endLabel = endDate.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
  });

  return startYear === endYear
    ? `${startLabel} – ${endLabel}, ${endYear}`
    : `${startLabel}, ${startYear} – ${endLabel}, ${endYear}`;
}

function toIsoDateTime(value: string, endOfDay = false) {
  const normalized =
    value.length === 10
      ? value + (endOfDay ? "T23:59:59.999" : "T00:00:00")
      : value;
  return new Date(normalized).toISOString();
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

type PromoFieldErrors = {
  description: string | null;
  endsAt: string | null;
  promoCode: string | null;
  startsAt: string | null;
  title: string | null;
};

function getPromoFieldErrors(
  draft: PromoDraft,
  showRequiredErrors = false,
): PromoFieldErrors {
  const title = draft.title.trim();
  const description = draft.description.trim();
  const startsAt = parsePromoDate(draft.startsAt, "Promo start");
  const endsAt = parsePromoDate(draft.endsAt, "Promo end");
  const promoCodeError = validatePromoCode(draft.promoCode);
  const titleError = !title
    ? showRequiredErrors
      ? "Promo title is required."
      : null
    : title.length > PROMO_TITLE_MAX_LENGTH
      ? `Promo title must not exceed ${PROMO_TITLE_MAX_LENGTH} characters.`
      : null;
  const descriptionError = !description
    ? showRequiredErrors
      ? "Promo description is required."
      : null
    : null;
  const startsAtError = !draft.startsAt.trim()
    ? showRequiredErrors
      ? startsAt.error
      : null
    : startsAt.error;
  let endsAtError = !draft.endsAt.trim()
    ? showRequiredErrors
      ? endsAt.error
      : null
    : endsAt.error;

  if (
    !endsAtError &&
    startsAt.value &&
    endsAt.value &&
    endsAt.value.getTime() < startsAt.value.getTime()
  ) {
    endsAtError = "Promo end must be on or after the start date.";
  }

  return {
    description: descriptionError,
    endsAt: endsAtError,
    promoCode: promoCodeError,
    startsAt: startsAtError,
    title: titleError,
  };
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

export default function MembershipsPromosPage() {
  const { colors } = useTheme();
  const fadeIn = useFadeIn({ duration: 220 });
  const themeTransition = useThemeTransition();
  const queryClient = useQueryClient();
  const [planDrafts, setPlanDrafts] = useState<Record<string, PlanDraft>>({});
  const [createPlanDraft, setCreatePlanDraft] = useState<CreatePlanDraft>(
    DEFAULT_CREATE_PLAN_DRAFT,
  );
  const [membershipCardPriceDraft, setMembershipCardPriceDraft] = useState("");
  const [promoDraft, setPromoDraft] = useState<PromoDraft>(DEFAULT_PROMO_DRAFT);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [plansModalOpen, setPlansModalOpen] = useState(false);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [promoValidationAttempted, setPromoValidationAttempted] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [plansPage, setPlansPage] = useState(1);
  const [promotionsPage, setPromotionsPage] = useState(1);
  const [createPlanValidationAttempted, setCreatePlanValidationAttempted] =
    useState(false);
  const [planSaveAttempted, setPlanSaveAttempted] = useState<string | null>(null);
  const [membershipCardPriceSaveAttempted, setMembershipCardPriceSaveAttempted] =
    useState(false);
  const [deletePlanTarget, setDeletePlanTarget] =
    useState<MembershipPlanRecord | null>(null);
  const [deactivatePromoTarget, setDeactivatePromoTarget] =
    useState<GymPromotionRecord | null>(null);
  const [promoCalendarTarget, setPromoCalendarTarget] =
    useState<PromoCalendarTarget | null>(null);

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
  const promotionsQuery = useQuery({
    ...gymPromotionsQueryOptions(webApiClient, {
      limit: MEMBERSHIP_COLLECTION_PAGE_SIZE,
      page: promotionsPage,
    }),
    placeholderData: (previousData) => previousData,
  });
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
  const createPromotionMutation = useMutation(
    createGymPromotionMutationOptions(webApiClient, queryClient),
  );
  const deactivatePromotionMutation = useMutation(
    deactivateGymPromotionMutationOptions(webApiClient, queryClient),
  );

  const plans = useMemo(
    () => plansQuery.data?.data ?? [],
    [plansQuery.data?.data],
  );
  const membershipCatalogSettings = membershipCatalogSettingsQuery.data;
  const operations = operationsQuery.data;
  const promotions = promotionsQuery.data?.data ?? [];
  const serviceOfferings = useMemo(
    () => buildMembershipServiceOfferings(plans, membershipCatalogSettings),
    [membershipCatalogSettings, plans],
  );
  const plansTotal = plansQuery.data?.meta.total ?? plans.length;
  const promotionsTotal = promotionsQuery.data?.meta.total ?? promotions.length;
  const plansPageCount =
    plansTotal > MEMBERSHIP_COLLECTION_PAGE_SIZE
      ? Math.max(
          plansQuery.data?.meta.total_pages ??
            Math.ceil(plansTotal / MEMBERSHIP_COLLECTION_PAGE_SIZE),
          1,
        )
      : 1;
  const promotionsPageCount =
    promotionsTotal > MEMBERSHIP_COLLECTION_PAGE_SIZE
      ? Math.max(
          promotionsQuery.data?.meta.total_pages ??
            Math.ceil(promotionsTotal / MEMBERSHIP_COLLECTION_PAGE_SIZE),
          1,
        )
      : 1;
  const pageError =
    plansQuery.error ??
    membershipCatalogSettingsQuery.error ??
    operationsQuery.error ??
    promotionsQuery.error ??
    createPlanMutation.error ??
    updatePlanMutation.error ??
    updateMembershipCatalogSettingsMutation.error ??
    createPromotionMutation.error ??
    deactivatePromotionMutation.error ??
    deletePlanMutation.error;
  const errorMessage = pageError
    ? getMessage(pageError, "Unable to complete the membership operation.")
    : null;
  const pageMessage = validationMessage ?? errorMessage;
  const clearValidationMessage = () => setValidationMessage(null);

  const promoFieldErrors = useMemo(
    () => getPromoFieldErrors(promoDraft, promoValidationAttempted),
    [promoDraft, promoValidationAttempted],
  );

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
    setPromotionsPage((currentPage) =>
      Math.min(Math.max(currentPage, 1), promotionsPageCount),
    );
  }, [promotionsPageCount]);

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

  const createPromotion = () => {
    setPromoValidationAttempted(true);
    const promoErrors = getPromoFieldErrors(promoDraft, true);
    const firstPromoError =
      promoErrors.title ??
      promoErrors.description ??
      promoErrors.startsAt ??
      promoErrors.endsAt ??
      promoErrors.promoCode;
    if (firstPromoError) {
      setValidationMessage(null);
      return;
    }

    const title = promoDraft.title.trim();
    const description = promoDraft.description.trim();
    const startsAt = parsePromoDate(promoDraft.startsAt, "Promo start");
    const endsAt = parsePromoDate(promoDraft.endsAt, "Promo end");
    const promoCodeError = validatePromoCode(promoDraft.promoCode);
    if (!title) {
      setValidationMessage("Promo title is required.");
      return;
    }
    if (title.length > PROMO_TITLE_MAX_LENGTH) {
      setValidationMessage(
        `Promo title must not exceed ${PROMO_TITLE_MAX_LENGTH} characters.`,
      );
      return;
    }
    if (!description) {
      setValidationMessage("Promo description is required.");
      return;
    }
    if (startsAt.error || endsAt.error) {
      setValidationMessage(startsAt.error ?? endsAt.error);
      return;
    }
    if (
      startsAt.value &&
      endsAt.value &&
      endsAt.value.getTime() < startsAt.value.getTime()
    ) {
      setValidationMessage("Promo end must be on or after the start date.");
      return;
    }
    if (promoCodeError) {
      setValidationMessage(promoCodeError);
      return;
    }
    setValidationMessage(null);
    createPromotionMutation.mutate(
      {
        description,
        endsAt: toIsoDateTime(promoDraft.endsAt),
        pricingNote: promoDraft.pricingNote.trim() || undefined,
        promoCode: promoDraft.promoCode.trim().toUpperCase() || undefined,
        startsAt: toIsoDateTime(promoDraft.startsAt),
        title,
      },
      {
        onSuccess: () => {
          setPromoDraft(DEFAULT_PROMO_DRAFT);
          setPromoValidationAttempted(false);
          setPromoModalOpen(false);
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

  const openPromoModal = () => {
    createPromotionMutation.reset();
    setValidationMessage(null);
    setPromoValidationAttempted(false);
    setPromoModalOpen(true);
  };

  const updatePromoDraft = (patch: Partial<PromoDraft>) => {
    setPromoDraft((current) => ({ ...current, ...patch }));
    createPromotionMutation.reset();
    clearValidationMessage();
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
            promotionsQuery.refetch(),
          ])
        }
        onOpenPromo={openPromoModal}
        mutedStyle={muted}
        promotionsCount={promotionsTotal}
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

      <section className="memberships-section" data-testid="membership-campaign-runway">
        <div className="memberships-section-heading">
          <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
            <FitText as="h2" style={{ fontSize: 19, fontWeight: 800 }}>
              Campaign runway
            </FitText>
            <FitText as="p" style={{ ...muted, fontSize: 13 }}>
              Time-bound offers currently moving through the member feed.
            </FitText>
          </div>
          <div className="memberships-runway-status">
            <span aria-hidden="true" />
            {promotionsTotal} active campaign{promotionsTotal === 1 ? "" : "s"}
          </div>
        </div>

        <div className="memberships-campaign-runway">
          <div className="memberships-campaign-head" aria-hidden="true">
            <span />
            <span>Campaign</span>
            <span>Active window</span>
            <span>Offer detail</span>
            <span />
          </div>
          <div className="memberships-campaign-list" role="list" aria-label="Active promotions">
            {promotions.map((promo, index) => (
              <article
                className="memberships-campaign-item"
                key={promo.id}
                role="listitem"
              >
                <div className="memberships-campaign-marker" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <i />
                </div>
                <div className="memberships-campaign-copy">
                  <div className="memberships-campaign-title-row">
                    <FitText as="h3" className="memberships-campaign-title">
                      {promo.title}
                    </FitText>
                    {promo.promo_code ? (
                      <FitPill
                        mode="status"
                        label={promo.promo_code}
                        color={colors.brand}
                      />
                    ) : null}
                  </div>
                  <FitText as="p" className="memberships-campaign-description">
                    {promo.description}
                  </FitText>
                </div>
                <div className="memberships-campaign-window">
                  <Clock3 aria-hidden="true" size={14} strokeWidth={2} />
                  <FitText>{formatPromotionDateRange(promo.starts_at, promo.ends_at)}</FitText>
                </div>
                <div className="memberships-campaign-offer">
                  <FitText className="memberships-campaign-offer-label">
                    {promo.pricing_note || "Member offer"}
                  </FitText>
                  <div className="memberships-campaign-track" aria-hidden="true">
                    <span style={{ width: `${Math.min(84, 46 + index * 18)}%` }} />
                  </div>
                </div>
                <div className="memberships-campaign-actions">
                  <FitPill mode="status" label="Active" color={colors.success} />
                  <FitButton
                    aria-label={`Deactivate ${promo.title}`}
                    icon={MoreVertical}
                    iconOnly
                    loading={deactivatePromotionMutation.isPending}
                    onClick={() => setDeactivatePromoTarget(promo)}
                    title={`Deactivate ${promo.title}`}
                    variant="iconClear"
                  />
                </div>
              </article>
            ))}
            {promotions.length === 0 ? (
              <div className="memberships-empty-state">
                <FitText as="p" style={muted}>
                  No active promotions are available.
                </FitText>
              </div>
            ) : null}
          </div>
          <MembershipCollectionPagination
            ariaLabel="Active promotions pagination"
            colors={colors}
            currentPage={promotionsPage}
            onPageChange={setPromotionsPage}
            totalItems={promotionsTotal}
          />
        </div>
      </section>

      <FitModal
        isOpen={promoModalOpen}
        onClose={() => setPromoModalOpen(false)}
        title="Create promotion"
        subtitle="Publish a time-bound membership or amenity offer."
        icon={Megaphone}
        maxWidth={640}
        closeDisabled={createPromotionMutation.isPending}
        contentStyle={{ maxHeight: "min(70vh, 620px)", padding: "16px 20px" }}
        footer={
          <div
            data-testid="membership-promo-actions"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "flex-end",
              width: "100%",
            }}
          >
            <FitButton
              label="CANCEL"
              variant="ghost"
              disabled={createPromotionMutation.isPending}
              onClick={() => setPromoModalOpen(false)}
            />
            <FitButton
              icon={BadgePercent}
              label="CREATE PROMO"
              loading={createPromotionMutation.isPending}
              onClick={createPromotion}
            />
          </div>
        }
        footerStyle={{ padding: "12px 20px" }}
      >
        <div data-testid="membership-promo-form" style={{ display: "grid", gap: 12 }}>
          {createPromotionMutation.error ? (
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
              {getMessage(
                createPromotionMutation.error,
                "Unable to create this promotion.",
              )}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            <label style={{ display: "grid", gap: 4 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                Promo title
              </FitText>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
                  <FitTextInput
                    aria-describedby={
                      promoFieldErrors.title
                        ? "membership-promo-title-error"
                        : undefined
                    }
                    aria-invalid={Boolean(promoFieldErrors.title)}
                    id="membership-promo-title"
                    maxLength={PROMO_TITLE_MAX_LENGTH}
                    name="membershipPromoTitle"
                    value={promoDraft.title}
                    onChange={(event) =>
                      updatePromoDraft({ title: event.target.value })
                    }
                    placeholder="Summer Starter Pack"
                    disabled={createPromotionMutation.isPending}
                  />
                </div>
                {promoFieldErrors.title ? (
                  <FitText
                    as="span"
                    id="membership-promo-title-error"
                    role="alert"
                    style={{ color: colors.danger, fontSize: 11 }}
                  >
                    {promoFieldErrors.title}
                  </FitText>
                ) : null}
              </div>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                Promo code <span style={{ color: colors.textMuted }}>(optional)</span>
              </FitText>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
                  <FitTextInput
                    aria-describedby={
                      promoFieldErrors.promoCode
                        ? "membership-promo-code-error"
                        : undefined
                    }
                    aria-invalid={Boolean(promoFieldErrors.promoCode)}
                    id="membership-promo-code"
                    maxLength={PROMO_CODE_MAX_LENGTH}
                    name="membershipPromoCode"
                    value={promoDraft.promoCode}
                    onChange={(event) =>
                      updatePromoDraft({ promoCode: event.target.value })
                    }
                    placeholder="SUMMER26"
                    disabled={createPromotionMutation.isPending}
                  />
                </div>
                {promoFieldErrors.promoCode ? (
                  <FitText
                    as="span"
                    id="membership-promo-code-error"
                    role="alert"
                    style={{ color: colors.danger, fontSize: 11 }}
                  >
                    {promoFieldErrors.promoCode}
                  </FitText>
                ) : null}
              </div>
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            {(["startsAt", "endsAt"] as const).map((target) => {
              const isStart = target === "startsAt";
              const error = promoFieldErrors[target];
              const errorId = `membership-promo-${target}-error`;
              return (
                <label key={target} style={{ display: "grid", gap: 4 }}>
                  <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
                    {isStart ? "Start date" : "End date"}
                  </FitText>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div
                      style={{
                        ...inputShell(fieldBorder, colors.surfaceRaised),
                        padding: 0,
                      }}
                    >
                      <FitButton
                        aria-describedby={error ? errorId : undefined}
                        aria-invalid={Boolean(error)}
                        icon={CalendarDays}
                        id={`membership-promo-${target}`}
                        label={
                          promoDraft[target]
                            ? formatDate(promoDraft[target])
                            : isStart
                              ? "SELECT START DATE"
                              : "SELECT END DATE"
                        }
                        name={`membershipPromo${isStart ? "Starts" : "Ends"}At`}
                        onClick={() => {
                          clearValidationMessage();
                          setPromoCalendarTarget(target);
                        }}
                        variant="ghost"
                        disabled={createPromotionMutation.isPending}
                        style={{
                          justifyContent: "flex-start",
                          minHeight: 38,
                          padding: "0 10px",
                          width: "100%",
                        }}
                      />
                    </div>
                    {error ? (
                      <FitText
                        as="span"
                        id={errorId}
                        role="alert"
                        style={{ color: colors.danger, fontSize: 11 }}
                      >
                        {error}
                      </FitText>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>

          <label style={{ display: "grid", gap: 4 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              Description
            </FitText>
            <div style={{ display: "grid", gap: 4 }}>
              <div
                style={{
                  ...inputShell(fieldBorder, colors.surfaceRaised),
                  alignItems: "stretch",
                  minHeight: 82,
                  padding: "8px 10px",
                }}
              >
                <FitTextArea
                  aria-describedby={
                    promoFieldErrors.description
                      ? "membership-promo-description-error"
                      : undefined
                  }
                  aria-invalid={Boolean(promoFieldErrors.description)}
                  id="membership-promo-description"
                  name="membershipPromoDescription"
                  rows={3}
                  value={promoDraft.description}
                  onChange={(event) =>
                    updatePromoDraft({ description: event.target.value })
                  }
                  placeholder="Get two weeks free on annual plans."
                  disabled={createPromotionMutation.isPending}
                />
              </div>
              {promoFieldErrors.description ? (
                <FitText
                  as="span"
                  id="membership-promo-description-error"
                  role="alert"
                  style={{ color: colors.danger, fontSize: 11 }}
                >
                  {promoFieldErrors.description}
                </FitText>
              ) : null}
            </div>
          </label>

          <label style={{ display: "grid", gap: 4 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 11 }}>
              Pricing note <span style={{ color: colors.textMuted }}>(optional)</span>
            </FitText>
            <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
              <FitTextInput
                id="membership-promo-pricing-note"
                name="membershipPromoPricingNote"
                value={promoDraft.pricingNote}
                onChange={(event) =>
                  updatePromoDraft({ pricingNote: event.target.value })
                }
                placeholder="Applies to new signups."
                disabled={createPromotionMutation.isPending}
              />
            </div>
          </label>
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
          grid-template-columns: minmax(250px, 1.35fr) repeat(2, minmax(180px, 1fr));
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
        .memberships-status-pulse span,
        .memberships-runway-status span {
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
        .memberships-plan-ladder,
        .memberships-campaign-runway {
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
        .memberships-runway-status {
          align-items: center;
          color: ${colors.success};
          display: inline-flex;
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 750;
          gap: 7px;
        }
        .memberships-campaign-head,
        .memberships-campaign-item {
          align-items: center;
          display: grid;
          gap: 14px;
          grid-template-columns: 38px minmax(0, 1.2fr) minmax(170px, .75fr) minmax(150px, .65fr) auto;
        }
        .memberships-campaign-head {
          border-bottom: 1px solid ${colors.border};
          color: ${colors.textMuted};
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .08em;
          min-height: 38px;
          padding: 0 14px;
          text-transform: uppercase;
        }
        .memberships-campaign-list {
          display: grid;
        }
        .memberships-campaign-item {
          border-bottom: 1px solid ${colors.border};
          min-height: 88px;
          padding: 12px 14px;
        }
        .memberships-campaign-item:last-child {
          border-bottom: 0;
        }
        .memberships-campaign-marker {
          align-self: stretch;
          align-items: center;
          color: ${colors.brand};
          display: flex;
          flex-direction: column;
          font-size: 10px;
          font-weight: 850;
          gap: 7px;
          justify-content: center;
        }
        .memberships-campaign-marker i {
          background: ${colors.brand}77;
          display: block;
          flex: 1;
          min-height: 14px;
          width: 1px;
        }
        .memberships-campaign-item:last-child .memberships-campaign-marker i {
          opacity: 0;
        }
        .memberships-campaign-copy,
        .memberships-campaign-window,
        .memberships-campaign-offer,
        .memberships-campaign-actions {
          min-width: 0;
        }
        .memberships-campaign-title-row {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .memberships-campaign-title {
          font-size: 13px;
          font-weight: 800;
          min-width: 0;
        }
        .memberships-campaign-description,
        .memberships-campaign-offer-label {
          color: ${colors.textSecondary};
          display: block;
          font-size: 11px;
          line-height: 1.35;
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .memberships-campaign-window {
          align-items: center;
          color: ${colors.textSecondary};
          display: flex;
          font-size: 11px;
          gap: 6px;
        }
        .memberships-campaign-track {
          background: ${colors.border};
          border-radius: 999px;
          height: 4px;
          margin-top: 9px;
          overflow: hidden;
          width: 100%;
        }
        .memberships-campaign-track span {
          background: ${colors.brand};
          border-radius: inherit;
          display: block;
          height: 100%;
        }
        .memberships-campaign-actions {
          align-items: center;
          display: flex;
          gap: 6px;
          justify-content: flex-end;
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
            grid-template-columns: minmax(0, 1.25fr) repeat(2, minmax(0, 1fr));
          }
          .memberships-campaign-head,
          .memberships-campaign-item {
            grid-template-columns: 32px minmax(0, 1.15fr) minmax(135px, .75fr) auto;
          }
          .memberships-campaign-head > :nth-child(4) {
            display: none;
          }
          .memberships-campaign-offer {
            display: none;
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
          .memberships-plan-description,
          .memberships-campaign-description {
            white-space: normal;
          }
          .memberships-campaign-head {
            display: none;
          }
          .memberships-campaign-item {
            align-items: start;
            grid-template-columns: 28px minmax(0, 1fr) auto;
            min-height: 0;
            padding: 13px 12px;
          }
          .memberships-campaign-window {
            grid-column: 2;
            margin-top: 6px;
          }
          .memberships-campaign-actions {
            grid-column: 3;
            grid-row: 1 / span 2;
          }
          .memberships-campaign-marker {
            grid-row: 1 / span 3;
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
      <CalendarModal
        isOpen={promoCalendarTarget !== null}
        minDate={
          promoCalendarTarget === "endsAt"
            ? promoDraft.startsAt || null
            : null
        }
        closeOnSelect={false}
        keepViewOnMonthSelect
        keepViewOnYearSelect
        preserveViewOnSelectedDateChange
        noScroll={false}
        selectedDate={
          promoCalendarTarget
            ? promoDraft[promoCalendarTarget] || undefined
            : undefined
        }
        onSelect={(dateYmd) => {
          if (!promoCalendarTarget) return;
          updatePromoDraft({ [promoCalendarTarget]: dateYmd });
        }}
        onClose={() => setPromoCalendarTarget(null)}
      />
      <ConfirmModal
        isOpen={deactivatePromoTarget !== null}
        title="Deactivate Promotion"
        message={`Deactivate ${deactivatePromoTarget?.title ?? "this promotion"}? It will stop appearing in active offers and gym-chat promotion answers.`}
        confirmLabel="DEACTIVATE PROMO"
        loadingLabel="DEACTIVATING PROMO"
        confirmIcon={CheckCircle2}
        isLoading={deactivatePromotionMutation.isPending}
        onConfirm={() => {
          if (!deactivatePromoTarget) return;
          setValidationMessage(null);
          deactivatePromotionMutation.mutate(deactivatePromoTarget.id, {
            onSuccess: () => setDeactivatePromoTarget(null),
          });
        }}
        onCancel={() => setDeactivatePromoTarget(null)}
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
  onOpenPromo,
  offeringsLoading,
  onRefresh,
  promotionsCount,
  serviceOfferings,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  dashboard?: MembershipOperationsDashboardRecord;
  loading: boolean;
  mutedStyle: CSSProperties;
  onOpenPromo: () => void;
  onRefresh: () => void;
  offeringsLoading: boolean;
  promotionsCount: number;
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
      <FitButton
        icon={Plus}
        label="Create promotion"
        onClick={onOpenPromo}
        style={{ minHeight: 44, padding: "11px 20px" }}
      />
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
        <div className="memberships-status-item">
          <div className="memberships-status-kicker">
            <Megaphone aria-hidden="true" size={14} strokeWidth={2} />
            Campaigns
          </div>
          <FitText className="memberships-status-value">
            {promotionsCount}
          </FitText>
          <FitText as="p" style={{ ...mutedStyle, fontSize: 12 }}>
            active promotions in the member feed
          </FitText>
          <div className="memberships-status-rule" aria-hidden="true" />
          <FitText style={{ color: colors.textSecondary, fontSize: 11 }}>
            Time-bound offers
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
            Membership plan ladder
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
