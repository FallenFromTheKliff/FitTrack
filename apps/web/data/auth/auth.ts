export type ForgotPasswordStep = "email" | "otp" | "password";

export type LoginHeroStat = {
  label: string;
  value: string;
};

export const LOGIN_BACKGROUND_IMAGE_URL =
  "url(https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1920&q=80)";

export const MAX_LOGIN_ATTEMPTS = 5;

function formatWholeNumber(value: number) {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatPeso(value: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return "PHP 0";
  }

  return `PHP ${new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0
  }).format(parsedValue)}`;
}

export function buildLoginHeroStats(summary?: {
  active_members: number;
  sessions_today: number;
  total_revenue: string;
} | null): LoginHeroStat[] {
  if (!summary) {
    return [
      { label: "Active Members", value: "—" },
      { label: "Sessions Today", value: "—" },
      { label: "All-time Revenue", value: "—" }
    ];
  }

  return [
    {
      label: "Active Members",
      value: formatWholeNumber(summary.active_members)
    },
    {
      label: "Sessions Today",
      value: formatWholeNumber(summary.sessions_today)
    },
    {
      label: "All-time Revenue",
      value: formatPeso(summary.total_revenue)
    }
  ];
}
