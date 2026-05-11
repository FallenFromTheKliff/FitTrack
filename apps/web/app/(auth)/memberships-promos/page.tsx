"use client";

import { useMemo, useState, type ReactNode } from "react";
import { BadgePercent, CheckCircle2, Plus, RefreshCcw, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GymPromotionRecord, MembershipPlanRecord } from "@fittrack/api-client";
import {
  createGymPromotionMutationOptions,
  createMembershipPlanMutationOptions,
  deactivateGymPromotionMutationOptions,
  gymPromotionsQueryOptions,
  membershipPlansQueryOptions,
  updateMembershipPlanMutationOptions,
} from "@fittrack/query";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { webApiClient } from "@/lib/api-client";
import {
  FitButton,
  FitPill,
  FitText,
  FitTextArea,
  FitTextInput,
} from "@/components/fit";
import { ConfirmModal } from "@/components/modals";

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

function toIsoDateTime(value: string) {
  return new Date(value).toISOString();
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
    borderRadius: 12,
    display: "flex",
    minHeight: 44,
    padding: "0 12px",
  } as const;
}

function planToDraft(plan: MembershipPlanRecord): PlanDraft {
  return {
    durationDays: String(plan.duration_days),
    isActive: plan.is_active,
    price: String(Number(plan.price)),
  };
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
  const [promoDraft, setPromoDraft] = useState<PromoDraft>(DEFAULT_PROMO_DRAFT);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [deactivatePromoTarget, setDeactivatePromoTarget] =
    useState<GymPromotionRecord | null>(null);

  const plansQuery = useQuery(
    membershipPlansQueryOptions(webApiClient, { limit: 20, page: 1 }),
  );
  const promotionsQuery = useQuery(
    gymPromotionsQueryOptions(webApiClient, { limit: 20, page: 1 }),
  );
  const createPlanMutation = useMutation(
    createMembershipPlanMutationOptions(webApiClient, queryClient),
  );
  const updatePlanMutation = useMutation(
    updateMembershipPlanMutationOptions(webApiClient, queryClient),
  );
  const createPromotionMutation = useMutation(
    createGymPromotionMutationOptions(webApiClient, queryClient),
  );
  const deactivatePromotionMutation = useMutation(
    deactivateGymPromotionMutationOptions(webApiClient, queryClient),
  );

  const plans = plansQuery.data?.data ?? [];
  const promotions = promotionsQuery.data?.data ?? [];
  const plansTotal = plansQuery.data?.meta.total ?? plans.length;
  const promotionsTotal = promotionsQuery.data?.meta.total ?? promotions.length;
  const pageError =
    plansQuery.error ??
    promotionsQuery.error ??
    createPlanMutation.error ??
    updatePlanMutation.error ??
    createPromotionMutation.error ??
    deactivatePromotionMutation.error;
  const errorMessage = pageError
    ? getMessage(pageError, "Unable to complete the membership operation.")
    : null;
  const pageMessage = validationMessage ?? errorMessage;

  const shell = useMemo(
    () => ({
      ...fadeIn,
      display: "grid",
      gap: 18,
      paddingBottom: 32,
    }),
    [fadeIn],
  );
  const panelStyle = {
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: 14,
  };
  const fieldBorder = `1px solid ${colors.fieldBorder}`;
  const muted = { color: colors.textMuted, fontSize: 13, lineHeight: 1.45 };

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
        onSuccess: () => setCreatePlanDraft(DEFAULT_CREATE_PLAN_DRAFT),
      },
    );
  };

  const createPromotion = () => {
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
        onSuccess: () => setPromoDraft(DEFAULT_PROMO_DRAFT),
      },
    );
  };

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

      <MembershipSurface
        colors={colors}
        heading={`MEMBERSHIP PLANS (${plansTotal})`}
        action={
          <FitButton
            icon={RefreshCcw}
            label="REFRESH"
            variant="ghost"
            onClick={() => void plansQuery.refetch()}
            loading={plansQuery.isFetching}
          />
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          {plans.map((plan) => {
            const draft = planDrafts[plan.id] ?? planToDraft(plan);
            return (
              <div
                key={plan.id}
                style={{
                  ...panelStyle,
                  backgroundColor: colors.surface,
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: "minmax(0, 1fr) minmax(140px, 0.24fr) minmax(120px, 0.2fr) minmax(96px, auto)",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                  <FitText as="p" style={{ fontSize: 16, fontWeight: 800 }}>
                    {plan.name}
                  </FitText>
                  <FitText as="p" style={muted}>
                    {plan.description ?? "No plan description."}
                  </FitText>
                  <FitPill
                    mode="status"
                    label={plan.includes_coaching ? "Includes coaching" : "Gym access"}
                    color={colors.brand}
                    style={{ justifySelf: "start", maxWidth: "100%" }}
                  />
                </div>
                <label style={{ display: "grid", gap: 6 }}>
                  <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Price</FitText>
                  <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
                    <FitTextInput
                      aria-label={`${plan.name} price`}
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      type="number"
                      value={draft.price}
                      onChange={(event) =>
                        updatePlanDraft(plan, { price: event.target.value })
                      }
                    />
                  </div>
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Days</FitText>
                  <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
                    <FitTextInput
                      aria-label={`${plan.name} duration`}
                      inputMode="numeric"
                      min="1"
                      step="1"
                      type="number"
                      value={draft.durationDays}
                      onChange={(event) =>
                        updatePlanDraft(plan, { durationDays: event.target.value })
                      }
                    />
                  </div>
                </label>
                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
                    <input
                      checked={draft.isActive}
                      onChange={(event) =>
                        updatePlanDraft(plan, { isActive: event.target.checked })
                      }
                      type="checkbox"
                    />
                    <FitText style={{ fontSize: 12 }}>Active</FitText>
                  </label>
                  <FitButton
                    icon={Save}
                    label="SAVE"
                    loading={updatePlanMutation.isPending}
                    onClick={() => savePlan(plan)}
                  />
                </div>
              </div>
            );
          })}
          {plans.length === 0 ? (
            <FitText as="p" style={muted}>
              No active membership plans are available.
            </FitText>
          ) : null}
        </div>
        <div
          style={{
            borderTop: `1px solid ${colors.border}`,
            display: "grid",
            gap: 12,
            marginTop: 6,
            paddingTop: 16,
          }}
        >
          <FitText style={{ fontSize: 13, fontWeight: 900, color: colors.textMuted }}>
            CREATE MEMBERSHIP PLAN
          </FitText>
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "minmax(180px, 1fr) minmax(120px, 0.35fr) minmax(120px, 0.35fr) auto",
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Plan name</FitText>
            <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
              <FitTextInput
                maxLength={PLAN_NAME_MAX_LENGTH}
                value={createPlanDraft.name}
                onChange={(event) =>
                  setCreatePlanDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Monthly Membership"
              />
            </div>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Price</FitText>
            <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
              <FitTextInput
                inputMode="decimal"
                min="0.01"
                step="0.01"
                type="number"
                value={createPlanDraft.price}
                onChange={(event) =>
                  setCreatePlanDraft((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
                placeholder="1499"
              />
            </div>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Days</FitText>
            <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
              <FitTextInput
                inputMode="numeric"
                min="1"
                step="1"
                type="number"
                value={createPlanDraft.durationDays}
                onChange={(event) =>
                  setCreatePlanDraft((current) => ({
                    ...current,
                    durationDays: event.target.value,
                  }))
                }
              />
            </div>
          </label>
          <FitButton
            icon={Plus}
            label="CREATE"
            loading={createPlanMutation.isPending}
            onClick={createPlan}
          />
          <label style={{ display: "grid", gap: 6, gridColumn: "1 / span 3" }}>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Description</FitText>
            <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
              <FitTextInput
                value={createPlanDraft.description}
                onChange={(event) =>
                  setCreatePlanDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Access to gym equipment and member app benefits"
              />
            </div>
          </label>
          <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <input
              checked={createPlanDraft.includesCoaching}
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
        </div>
        </div>
      </MembershipSurface>

      <MembershipSurface
        colors={colors}
        heading={`ACTIVE PROMOS (${promotionsTotal})`}
        action={
          <FitButton
            icon={RefreshCcw}
            label="REFRESH"
            variant="ghost"
            onClick={() => void promotionsQuery.refetch()}
            loading={promotionsQuery.isFetching}
          />
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          {promotions.map((promo) => (
            <div
              key={promo.id}
              style={{
                ...panelStyle,
                backgroundColor: colors.surface,
                display: "grid",
                gap: 14,
                gridTemplateColumns: "minmax(0, 1fr) auto",
              }}
            >
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <FitText as="p" style={{ fontSize: 16, fontWeight: 800 }}>
                    {promo.title}
                  </FitText>
                  {promo.promo_code ? (
                    <FitPill mode="status" label={promo.promo_code} color={colors.brand} />
                  ) : null}
                  <FitPill mode="status" label="Active" color={colors.success} />
                </div>
                <FitText as="p" style={muted}>{promo.description}</FitText>
                <FitText as="p" style={{ ...muted, color: colors.textSecondary }}>
                  {formatDate(promo.starts_at)} to {formatDate(promo.ends_at)}
                  {promo.pricing_note ? ` | ${promo.pricing_note}` : ""}
                </FitText>
              </div>
              <FitButton
                icon={CheckCircle2}
                label="DEACTIVATE"
                variant="ghost"
                loading={deactivatePromotionMutation.isPending}
                onClick={() => setDeactivatePromoTarget(promo)}
              />
            </div>
          ))}
          {promotions.length === 0 ? (
            <FitText as="p" style={muted}>
              No active promotions are available.
            </FitText>
          ) : null}
        </div>
        <div
          style={{
            borderTop: `1px solid ${colors.border}`,
            display: "grid",
            gap: 12,
            marginTop: 6,
            paddingTop: 16,
          }}
        >
          <FitText style={{ fontSize: 13, fontWeight: 900, color: colors.textMuted }}>
            CREATE PROMO
          </FitText>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 0.4fr 0.4fr" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Promo title</FitText>
              <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
                <FitTextInput
                  maxLength={PROMO_TITLE_MAX_LENGTH}
                  value={promoDraft.title}
                  onChange={(event) =>
                    setPromoDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Summer Starter Pack"
                />
              </div>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Starts</FitText>
              <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
                <FitTextInput
                  type="datetime-local"
                  value={promoDraft.startsAt}
                  onChange={(event) =>
                    setPromoDraft((current) => ({
                      ...current,
                      startsAt: event.target.value,
                    }))
                  }
                />
              </div>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Ends</FitText>
              <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
                <FitTextInput
                  type="datetime-local"
                  value={promoDraft.endsAt}
                  onChange={(event) =>
                    setPromoDraft((current) => ({
                      ...current,
                      endsAt: event.target.value,
                    }))
                  }
                />
              </div>
            </label>
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Description</FitText>
            <div style={{ ...inputShell(fieldBorder, colors.surfaceRaised), minHeight: 92 }}>
              <FitTextArea
                rows={3}
                value={promoDraft.description}
                onChange={(event) =>
                  setPromoDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Get two weeks free on annual plans."
              />
            </div>
          </label>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "0.35fr 1fr auto" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Code</FitText>
              <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
                <FitTextInput
                  maxLength={PROMO_CODE_MAX_LENGTH}
                  value={promoDraft.promoCode}
                  onChange={(event) =>
                    setPromoDraft((current) => ({
                      ...current,
                      promoCode: event.target.value,
                    }))
                  }
                  placeholder="SUMMER26"
                />
              </div>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <FitText style={{ color: colors.textMuted, fontSize: 12 }}>Pricing note</FitText>
              <div style={inputShell(fieldBorder, colors.surfaceRaised)}>
                <FitTextInput
                  value={promoDraft.pricingNote}
                  onChange={(event) =>
                    setPromoDraft((current) => ({
                      ...current,
                      pricingNote: event.target.value,
                    }))
                  }
                  placeholder="Applies to new signups."
                />
              </div>
            </label>
            <FitButton
              icon={BadgePercent}
              label="CREATE PROMO"
              loading={createPromotionMutation.isPending}
              onClick={createPromotion}
              style={{ alignSelf: "end" }}
            />
          </div>
        </div>
        </div>
      </MembershipSurface>

      <style>{`
        main :where(h1, h2, h3, h4, p) {
          margin: 0;
        }
        @media (max-width: 980px) {
          main > section:first-child,
          main [style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
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
    </main>
  );
}

function MembershipSurface({
  action,
  children,
  colors,
  heading,
}: {
  action: ReactNode;
  children: ReactNode;
  colors: ReturnType<typeof useTheme>["colors"];
  heading: string;
}) {
  return (
    <section
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          alignItems: "center",
          backgroundColor: colors.surfaceRaised,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
          padding: "14px 16px",
        }}
      >
        <FitText style={{ fontSize: 18, fontWeight: 900 }}>
          {heading}
        </FitText>
        {action}
      </div>
      <div style={{ display: "grid", gap: 14, padding: 14 }}>{children}</div>
    </section>
  );
}
