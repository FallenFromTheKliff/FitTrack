export function getAnalyticsPieColors(colors: {
  brand: string;
  textSecondary: string;
  success: string;
}) {
  return [colors.brand, colors.textSecondary, colors.success];
}

export const ANALYTICS_DEFAULT_PERIOD = "6m";
