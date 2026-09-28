const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN_X = 48;
const PAGE_MARGIN_TOP = 88;
const PAGE_MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2;
const BODY_BOTTOM = PAGE_HEIGHT - PAGE_MARGIN_BOTTOM;

type PdfFontKey = 'regular' | 'bold';
type PdfColor = [number, number, number];

const BRAND_ORANGE: PdfColor = [0.93, 0.31, 0.08];
const TEXT_PRIMARY: PdfColor = [0.12, 0.14, 0.16];
const TEXT_SECONDARY: PdfColor = [0.36, 0.39, 0.42];
const TEXT_MUTED: PdfColor = [0.47, 0.49, 0.52];
const BORDER_SOFT: PdfColor = [0.84, 0.85, 0.86];

// Helvetica metrics are embedded so wrapping stays deterministic without a
// runtime font or PDF package dependency. Values are thousandths of a point.
const HELVETICA_REGULAR_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
] as const;

const HELVETICA_BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
  584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
  278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
  556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
  500, 389, 280, 389, 584,
] as const;

const WIN_ANSI_SPECIALS: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  ƒ: 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  ˆ: 0x88,
  '‰': 0x89,
  Š: 0x8a,
  '‹': 0x8b,
  Œ: 0x8c,
  Ž: 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  š: 0x9a,
  '›': 0x9b,
  œ: 0x9c,
  ž: 0x9e,
  Ÿ: 0x9f,
};

export interface BusinessAnalyticsInsightPdfInput {
  id: string;
  createdAt: string;
  focus: string;
  period: string;
  startDate: string;
  endDate: string;
  analysisDepth: string;
  dataFingerprint: string;
  summary: string;
  highlights: unknown[];
  risks: unknown[];
  opportunities: unknown[];
  anomalyFlags: unknown[];
  recommendedActions: unknown[];
  selectedSections: string[];
  sectionContexts: Record<string, unknown>;
  sectionAnalyses: Record<string, unknown>;
  failedSections: string[];
  previousOutcome?: {
    score: number | null;
    verdict:
      | 'effective'
      | 'partially_effective'
      | 'not_effective'
      | 'insufficient_data';
    explanation: string;
    previousInsightId: string | null;
    previousCreatedAt: string | null;
  } | null;
}

type ReportBlockKind =
  | 'title'
  | 'subtitle'
  | 'metadata'
  | 'heading'
  | 'subheading'
  | 'paragraph'
  | 'listItem'
  | 'supportingLabel'
  | 'supportingValue'
  | 'note';

type ReportBlock = {
  kind: ReportBlockKind;
  text: string;
  indent?: number;
  prefix?: string;
  hanging?: number;
  keepWithNext?: boolean;
  pageBreakBefore?: boolean;
};

type BlockStyle = {
  color: PdfColor;
  font: PdfFontKey;
  fontSize: number;
  lineHeight: number;
  before: number;
  after: number;
};

type PreparedBlock = {
  lines: string[];
  style: BlockStyle;
  indent: number;
  hanging: number;
  prefix: string;
  keepWithNext: boolean;
  pageBreakBefore: boolean;
};

type PositionedLine = {
  text: string;
  x: number;
  top: number;
  style: BlockStyle;
};

type LayoutPage = {
  lines: PositionedLine[];
  cursor: number;
};

const BLOCK_STYLES: Record<ReportBlockKind, BlockStyle> = {
  title: {
    color: TEXT_PRIMARY,
    font: 'bold',
    fontSize: 23,
    lineHeight: 27,
    before: 0,
    after: 3,
  },
  subtitle: {
    color: TEXT_SECONDARY,
    font: 'regular',
    fontSize: 10,
    lineHeight: 14,
    before: 0,
    after: 12,
  },
  metadata: {
    color: TEXT_SECONDARY,
    font: 'regular',
    fontSize: 8.5,
    lineHeight: 12,
    before: 0,
    after: 1,
  },
  heading: {
    color: TEXT_PRIMARY,
    font: 'bold',
    fontSize: 12,
    lineHeight: 16,
    before: 13,
    after: 4,
  },
  subheading: {
    color: BRAND_ORANGE,
    font: 'bold',
    fontSize: 9,
    lineHeight: 12,
    before: 7,
    after: 2,
  },
  paragraph: {
    color: TEXT_PRIMARY,
    font: 'regular',
    fontSize: 9.5,
    lineHeight: 13.5,
    before: 0,
    after: 5,
  },
  listItem: {
    color: TEXT_PRIMARY,
    font: 'regular',
    fontSize: 9.3,
    lineHeight: 13.2,
    before: 0,
    after: 3,
  },
  supportingLabel: {
    color: TEXT_PRIMARY,
    font: 'bold',
    fontSize: 8.8,
    lineHeight: 12,
    before: 4,
    after: 1,
  },
  supportingValue: {
    color: TEXT_SECONDARY,
    font: 'regular',
    fontSize: 8.5,
    lineHeight: 12,
    before: 0,
    after: 2,
  },
  note: {
    color: TEXT_MUTED,
    font: 'regular',
    fontSize: 8.5,
    lineHeight: 12,
    before: 2,
    after: 3,
  },
};

function normalizeText(value: unknown): string {
  const rawValue =
    value === null || value === undefined
      ? ''
      : typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          typeof value === 'bigint'
        ? String(value)
        : '';
  return rawValue
    .normalize('NFC')
    .replace(/₱/g, 'PHP ')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, '-')
    .replace(/…/g, '...')
    .replace(/(?:Â·|·)/g, ' - ')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}

function winAnsiByte(character: string): number | null {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) {
    return null;
  }
  if (codePoint >= 0x20 && codePoint <= 0x7e) {
    return codePoint;
  }
  if (codePoint >= 0xa0 && codePoint <= 0xff) {
    return codePoint;
  }
  return WIN_ANSI_SPECIALS[character] ?? null;
}

function safePdfText(value: string): string {
  const output: string[] = [];
  for (const character of value) {
    if (winAnsiByte(character) !== null) {
      output.push(character);
      continue;
    }
    const codePoint = character.codePointAt(0) ?? 0;
    output.push(
      '[U+' + codePoint.toString(16).toUpperCase().padStart(4, '0') + ']',
    );
  }
  return output.join('');
}

function escapePdfText(value: string): string {
  return safePdfText(normalizeText(value))
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function fontWidth(character: string, font: PdfFontKey): number {
  const decomposed = character.normalize('NFD').charAt(0);
  const codePoint = decomposed.codePointAt(0) ?? 0;
  if (codePoint >= 32 && codePoint <= 126) {
    const widths =
      font === 'bold' ? HELVETICA_BOLD_WIDTHS : HELVETICA_REGULAR_WIDTHS;
    return widths[codePoint - 32] ?? 556;
  }
  if (codePoint === 0x20) {
    return 278;
  }
  return 556;
}

function textWidth(value: string, fontSize: number, font: PdfFontKey): number {
  let width = 0;
  for (const character of safePdfText(value)) {
    width += fontWidth(character, font);
  }
  return (width * fontSize) / 1000;
}

function splitLongToken(
  token: string,
  maxWidth: number,
  fontSize: number,
  font: PdfFontKey,
): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const character of token) {
    const candidate = current + character;
    if (current && textWidth(candidate, fontSize, font) > maxWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks.length ? chunks : [''];
}

function wrappedLines(
  value: unknown,
  maxWidth: number,
  fontSize: number,
  font: PdfFontKey,
): string[] {
  const source = safePdfText(normalizeText(value));
  if (!source) {
    return [];
  }
  const output: string[] = [];
  for (const sourceLine of source.split('\n')) {
    if (!sourceLine) {
      output.push('');
      continue;
    }
    const words = sourceLine.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (textWidth(candidate, fontSize, font) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        output.push(current);
        current = '';
      }
      if (textWidth(word, fontSize, font) <= maxWidth) {
        current = word;
        continue;
      }
      const chunks = splitLongToken(word, maxWidth, fontSize, font);
      output.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1] ?? '';
    }
    if (current) {
      output.push(current);
    }
  }
  return output;
}

function formatNumber(value: number): string {
  return Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : String(value);
}

function formatMoney(value: number | string): string {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount)
    ? 'PHP ' +
        amount.toLocaleString('en-PH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
    : normalizeText(value);
}

type ValueUnit = 'money' | 'percentage';

const EXPLICIT_MONEY_KEYS = new Set([
  'amount',
  'booking_revenue',
  'billed',
  'cash_membership_revenue',
  'coaching_gym_revenue',
  'coaching_payments_collected',
  'coaching_revenue',
  'coach_payout',
  'cost',
  'deposit',
  'gym_cut',
  'gym_membership_revenue',
  'membership_card_revenue',
  'membership_revenue',
  'paymongo_membership_revenue',
  'payout',
  'price',
  'product_revenue',
  'refund',
  'revenue',
  'revenue_amount',
  'revenue_change',
  'revenue_comparison',
  'retail_inventory_value',
  'retail_sales_revenue',
  'sale_amount',
  'service_fee',
  'subtotal',
  'total_amount',
  'total_billed',
  'total_revenue',
  'unit_price',
]);

const EXPLICIT_MONEY_KEY_PATTERN =
  /(?:^|_)(?:revenue|amount|price|cost|payout|billed|fee|charge|refund|deposit)(?:$|_)/;

const DATE_ONLY_KEYS = new Set([
  'date',
  'start',
  'end',
  'start_date',
  'end_date',
  'previous_start_date',
  'previous_end_date',
  'window_start',
  'window_end',
  'log_date',
  'bucket_start',
  'bucket_end',
]);

const TIMESTAMP_KEYS = new Set([
  'at',
  'time',
  'timestamp',
  'created',
  'updated',
  'occurred',
  'generated',
  'created_at',
  'updated_at',
  'occurred_at',
  'generated_at',
  'started_at',
  'ended_at',
]);

function normalizeFieldKey(key: string): string {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function isDateOnlyKey(key: string): boolean {
  const normalized = normalizeFieldKey(key);
  return (
    DATE_ONLY_KEYS.has(normalized) ||
    normalized.endsWith('_date') ||
    normalized.endsWith('_day')
  );
}

function isTimestampKey(key: string): boolean {
  const normalized = normalizeFieldKey(key);
  return (
    TIMESTAMP_KEYS.has(normalized) ||
    normalized.endsWith('_at') ||
    normalized.endsWith('_time') ||
    normalized.endsWith('_timestamp')
  );
}

function isExplicitMoneyKey(key: string): boolean {
  const normalized = normalizeFieldKey(key);
  return (
    EXPLICIT_MONEY_KEYS.has(normalized) ||
    EXPLICIT_MONEY_KEY_PATTERN.test(normalized)
  );
}

function isExplicitPercentageKey(key: string): boolean {
  const normalized = normalizeFieldKey(key);
  return (
    normalized === 'percentage' ||
    normalized === 'percent' ||
    normalized === 'percentages' ||
    /(?:^|_)(?:percentage|percent)(?:s|$|_)/.test(normalized)
  );
}

function unitForKey(
  key: string,
  parentUnit?: ValueUnit,
): ValueUnit | undefined {
  const normalized = normalizeFieldKey(key);
  if (isExplicitPercentageKey(normalized)) {
    return 'percentage';
  }
  if (isExplicitMoneyKey(normalized)) {
    return 'money';
  }
  if (parentUnit === 'percentage') {
    return 'percentage';
  }
  if (
    parentUnit === 'money' &&
    (normalized === 'current' ||
      normalized === 'previous' ||
      normalized === 'absolute_change')
  ) {
    return 'money';
  }
  return undefined;
}

function formatDateValue(value: string, withTime: boolean): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return normalizeText(value);
  }
  const datePart = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    timeZone: withTime ? 'Asia/Manila' : 'UTC',
    year: 'numeric',
  }).format(date);
  if (!withTime) {
    return datePart;
  }
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: true,
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(date);
  return datePart + ', ' + timePart + ' PHT';
}

function displayScalar(
  value: unknown,
  key = '',
  parentUnit?: ValueUnit,
): string {
  const unit = unitForKey(key, parentUnit);
  if (value === null || value === undefined) {
    return 'Not recorded';
  }
  if (typeof value === 'string') {
    const normalized = normalizeText(value);
    if (isDateOnlyKey(key) && normalized) {
      return formatDateValue(normalized, false);
    }
    if (isTimestampKey(key) && normalized) {
      return formatDateValue(normalized, true);
    }
    if (unit === 'money' && /^-?\d+(?:\.\d+)?$/.test(normalized)) {
      return formatMoney(normalized);
    }
    if (unit === 'percentage' && /^-?\d+(?:\.\d+)?$/.test(normalized)) {
      return formatNumber(Number(normalized)) + '%';
    }
    return normalized;
  }
  if (typeof value === 'number') {
    if (unit === 'money') {
      return formatMoney(value);
    }
    if (unit === 'percentage') {
      return formatNumber(value) + '%';
    }
    return formatNumber(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return normalizeText(value);
}

function humanizeLabel(value: string): string {
  const known: Record<string, string> = {
    anomaly_flags: 'Anomaly flags',
    analysis_depth: 'Analysis depth',
    data_fingerprint: 'Data fingerprint',
    failed_sections: 'Failed sections',
    model_used: 'Original insight model',
    recommended_actions: 'Recommended actions',
    section_analyses: 'Section analyses',
    section_contexts: 'Section contexts',
    selected_sections: 'Selected sections',
    token_count: 'Original insight token count',
  };
  if (known[value]) {
    return known[value];
  }
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function humanizeSection(value: string): string {
  return humanizeLabel(value).replace(/\bAi\b/g, 'AI');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function comparable(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map((item) => comparable(item)).join('|') + ']';
  }
  if (isRecord(value)) {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => key + ':' + comparable(value[key]))
        .join('|') +
      '}'
    );
  }
  return normalizeText(value);
}

function insightDuplicateKeys(
  input: BusinessAnalyticsInsightPdfInput,
): Set<string> {
  const duplicates = new Set<string>();
  duplicates.add('summary:' + comparable(input.summary));
  duplicates.add('executive_summary:' + comparable(input.summary));
  for (const [key, values] of [
    ['highlights', input.highlights],
    ['risks', input.risks],
    ['opportunities', input.opportunities],
    ['anomaly_flags', input.anomalyFlags],
    ['recommended_actions', input.recommendedActions],
  ] as Array<[string, unknown[]]>) {
    duplicates.add(key + ':' + comparable(values));
  }
  return duplicates;
}

function appendHeading(
  blocks: ReportBlock[],
  text: string,
  pageBreakBefore = false,
): void {
  blocks.push({
    kind: 'heading',
    text,
    keepWithNext: true,
    pageBreakBefore,
  });
}

function appendInsightList(
  blocks: ReportBlock[],
  title: string,
  values: unknown[],
): void {
  if (!values.length) {
    return;
  }
  appendHeading(blocks, title);
  values.forEach((value, index) => {
    const prefix = String(index + 1) + '. ';
    if (isRecord(value)) {
      blocks.push({
        kind: 'listItem',
        text: '',
        prefix,
        hanging: 16,
        keepWithNext: true,
      });
      appendSupportingRecord(blocks, value, 1, new WeakSet<object>());
      return;
    }
    blocks.push({
      kind: 'listItem',
      text: displayScalar(value),
      prefix,
      hanging: 16,
    });
  });
}

function appendSupportingValue(
  blocks: ReportBlock[],
  label: string,
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
  parentUnit?: ValueUnit,
): void {
  const indent = Math.min(depth * 14, 56);
  const unit = unitForKey(label, parentUnit);
  if (Array.isArray(value)) {
    blocks.push({
      kind: 'supportingLabel',
      text: humanizeLabel(label),
      indent,
      keepWithNext: true,
    });
    if (!value.length) {
      blocks.push({
        kind: 'supportingValue',
        text: 'None recorded',
        indent: indent + 10,
      });
      return;
    }
    value.forEach((item, index) => {
      if (isRecord(item) || Array.isArray(item)) {
        blocks.push({
          kind: 'supportingLabel',
          text: String(index + 1) + '.',
          indent: Math.min((depth + 1) * 14, 70),
          keepWithNext: true,
        });
        appendSupportingValue(blocks, 'Details', item, depth + 2, seen, unit);
        return;
      }
      blocks.push({
        kind: 'supportingValue',
        text: displayScalar(item, label, unit),
        prefix: '- ',
        hanging: 10,
        indent: indent + 10,
      });
    });
    return;
  }
  if (isRecord(value)) {
    if (seen.has(value)) {
      blocks.push({
        kind: 'supportingValue',
        text: humanizeLabel(label) + ': Repeated reference',
        indent,
      });
      return;
    }
    seen.add(value);
    blocks.push({
      kind: 'supportingLabel',
      text: humanizeLabel(label),
      indent,
      keepWithNext: true,
    });
    const entries = Object.entries(value);
    if (!entries.length) {
      blocks.push({
        kind: 'supportingValue',
        text: 'No fields recorded',
        indent: indent + 10,
      });
    }
    for (const [key, item] of entries) {
      appendSupportingValue(blocks, key, item, depth + 1, seen, unit);
    }
    return;
  }
  blocks.push({
    kind: 'supportingValue',
    text: humanizeLabel(label) + ': ' + displayScalar(value, label, unit),
    indent,
  });
}

function appendSupportingRecord(
  blocks: ReportBlock[],
  value: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>,
  parentUnit?: ValueUnit,
): void {
  for (const [key, item] of Object.entries(value)) {
    appendSupportingValue(blocks, key, item, depth, seen, parentUnit);
  }
}

function appendSupportingSection(
  blocks: ReportBlock[],
  section: string,
  value: unknown,
): void {
  blocks.push({
    kind: 'subheading',
    text: humanizeSection(section),
    keepWithNext: true,
  });
  const before = blocks.length;
  if (isRecord(value)) {
    appendSupportingRecord(blocks, value, 0, new WeakSet<object>());
  } else if (Array.isArray(value)) {
    appendSupportingValue(blocks, 'Values', value, 0, new WeakSet<object>());
  } else {
    blocks.push({
      kind: 'supportingValue',
      text: displayScalar(value),
      indent: 0,
    });
  }
  if (blocks.length === before) {
    blocks.push({
      kind: 'note',
      text: 'No additional stored detail was recorded.',
    });
  }
}

function formatPreviousOutcomeHighlight(
  outcome: NonNullable<BusinessAnalyticsInsightPdfInput['previousOutcome']>,
): string {
  const datedLabel = outcome.previousCreatedAt
    ? 'Previous AI recommendation outcome (' +
      formatDateValue(outcome.previousCreatedAt, false) +
      ')'
    : 'Previous AI recommendation outcome';
  const scoreLabel =
    outcome.score === null ? 'N/A' : String(outcome.score) + '/10';
  const verdictLabel = humanizeLabel(outcome.verdict);
  const explanation =
    normalizeText(outcome.explanation) ||
    'The available data was insufficient to evaluate the previous recommendation.';
  const disclosure =
    'Comparison only; this does not verify that the recommendation was implemented.';

  return (
    datedLabel +
    ': ' +
    scoreLabel +
    ' - ' +
    verdictLabel +
    '. ' +
    explanation +
    ' ' +
    disclosure
  );
}

function buildBlocks(input: BusinessAnalyticsInsightPdfInput): ReportBlock[] {
  const blocks: ReportBlock[] = [
    { kind: 'title', text: 'Business Insight' },
    { kind: 'subtitle', text: 'FitTrack | Saved insight snapshot' },
  ];
  const metadata: Array<[string, string]> = [
    ['Focus', humanizeSection(input.focus)],
    ['Period', humanizeLabel(input.period)],
    ['Analysis depth', humanizeLabel(input.analysisDepth)],
    [
      'Window',
      formatDateValue(input.startDate, false) +
        ' to ' +
        formatDateValue(input.endDate, false),
    ],
    ['Created', formatDateValue(input.createdAt, true)],
    [
      'Selected sections',
      input.selectedSections.map(humanizeSection).join(', ') || 'Overview',
    ],
  ];
  for (const [label, value] of metadata) {
    blocks.push({ kind: 'metadata', text: label + ': ' + value });
  }

  appendHeading(blocks, 'Executive summary');
  blocks.push({
    kind: 'paragraph',
    text: normalizeText(input.summary) || 'No insight summary was recorded.',
  });
  const highlights = input.previousOutcome
    ? [
        formatPreviousOutcomeHighlight(input.previousOutcome),
        ...input.highlights,
      ].slice(0, 5)
    : input.highlights;
  appendInsightList(blocks, 'Top highlights', highlights);
  appendInsightList(blocks, 'Priority risks', input.risks);
  appendInsightList(blocks, 'Opportunities', input.opportunities);
  appendInsightList(blocks, 'Anomaly flags', input.anomalyFlags);
  appendInsightList(blocks, 'Recommended actions', input.recommendedActions);

  if (input.failedSections.length) {
    appendHeading(blocks, 'Delivery notes');
    blocks.push({
      kind: 'note',
      text:
        'Sections with incomplete analysis: ' +
        input.failedSections.map(humanizeSection).join(', ') +
        '.',
    });
  }

  const contextEntries = Object.entries(input.sectionContexts);
  const hasContextData = contextEntries.some(([, value]) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (isRecord(value)) {
      return Object.keys(value).length > 0;
    }
    return (
      value !== null && value !== undefined && normalizeText(value).length > 0
    );
  });
  appendHeading(blocks, 'Supporting data', hasContextData);
  if (!contextEntries.length) {
    blocks.push({
      kind: 'note',
      text: 'No stored section context was available for this legacy insight.',
    });
  } else {
    blocks.push({
      kind: 'note',
      text: 'Stored snapshot values are shown below as labeled fields.',
    });
    for (const [section, value] of contextEntries) {
      appendSupportingSection(blocks, section, value);
    }
  }

  const duplicateKeys = insightDuplicateKeys(input);
  const analysisEntries = Object.entries(input.sectionAnalyses);
  if (analysisEntries.length) {
    appendHeading(blocks, 'Stored analysis detail');
    for (const [section, value] of analysisEntries) {
      blocks.push({
        kind: 'subheading',
        text: humanizeSection(section),
        keepWithNext: true,
      });
      const before = blocks.length;
      if (isRecord(value)) {
        const seen = new WeakSet<object>();
        for (const [key, item] of Object.entries(value)) {
          const canonicalKey = key === 'executive_summary' ? 'summary' : key;
          if (duplicateKeys.has(canonicalKey + ':' + comparable(item))) {
            continue;
          }
          appendSupportingValue(blocks, key, item, 0, seen);
        }
      } else {
        appendSupportingValue(blocks, 'Value', value, 0, new WeakSet<object>());
      }
      if (blocks.length === before) {
        blocks.push({
          kind: 'note',
          text: 'No distinct section detail beyond the executive findings was recorded.',
        });
      }
    }
  }

  appendHeading(blocks, 'Reference');
  blocks.push({
    kind: 'metadata',
    text: 'Insight ID: ' + (normalizeText(input.id) || 'Not recorded'),
  });
  blocks.push({
    kind: 'metadata',
    text:
      'Data fingerprint: ' +
      (normalizeText(input.dataFingerprint) || 'Not recorded'),
  });
  return blocks;
}

function prepareBlock(block: ReportBlock): PreparedBlock {
  const style = BLOCK_STYLES[block.kind];
  const indent = Math.max(0, Math.min(block.indent ?? 0, CONTENT_WIDTH - 24));
  const prefix = block.prefix ?? '';
  const hanging = prefix ? (block.hanging ?? 12) : 0;
  const maxWidth = Math.max(24, CONTENT_WIDTH - indent - hanging);
  return {
    lines: wrappedLines(block.text, maxWidth, style.fontSize, style.font),
    style,
    indent,
    hanging,
    prefix,
    keepWithNext: Boolean(block.keepWithNext),
    pageBreakBefore: Boolean(block.pageBreakBefore),
  };
}

function newPage(pages: LayoutPage[]): LayoutPage {
  const page: LayoutPage = { lines: [], cursor: PAGE_MARGIN_TOP };
  pages.push(page);
  return page;
}

function layoutBlocks(blocks: ReportBlock[]): LayoutPage[] {
  const prepared = blocks
    .map(prepareBlock)
    .filter((block) => block.lines.length > 0);
  const pages: LayoutPage[] = [];
  let page = newPage(pages);

  prepared.forEach((block, index) => {
    const next = prepared[index + 1];
    const nextMinHeight = next
      ? next.style.before + next.style.lineHeight + next.style.after
      : 0;
    if (page.lines.length > 0 && block.pageBreakBefore) {
      page = newPage(pages);
    }
    if (
      page.lines.length > 0 &&
      block.keepWithNext &&
      page.cursor +
        block.style.before +
        block.style.lineHeight +
        block.style.after +
        nextMinHeight >
        BODY_BOTTOM
    ) {
      page = newPage(pages);
    }

    let offset = 0;
    let before = block.style.before;
    while (offset < block.lines.length) {
      const remaining = block.lines.length - offset;
      const available = BODY_BOTTOM - page.cursor - before;
      let lineCount = Math.floor(
        (available - block.style.after) / block.style.lineHeight,
      );
      if (lineCount < 1) {
        page = newPage(pages);
        before = 0;
        continue;
      }
      lineCount = Math.min(lineCount, remaining);
      const isFinalChunk = lineCount === remaining;
      if (!isFinalChunk) {
        lineCount = Math.min(
          lineCount,
          Math.floor(
            (BODY_BOTTOM - page.cursor - before) / block.style.lineHeight,
          ),
        );
      }
      for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
        const source = block.lines[offset + lineIndex] ?? '';
        page.lines.push({
          text:
            lineIndex === 0 && offset === 0 ? block.prefix + source : source,
          x:
            PAGE_MARGIN_X +
            block.indent +
            (lineIndex === 0 && offset === 0 ? 0 : block.hanging),
          top: page.cursor + before + lineIndex * block.style.lineHeight,
          style: block.style,
        });
      }
      page.cursor +=
        before +
        lineCount * block.style.lineHeight +
        (isFinalChunk ? block.style.after : 0);
      offset += lineCount;
      before = 0;
      if (!isFinalChunk) {
        page = newPage(pages);
      }
    }
  });
  return pages;
}

function formatNumberForPdf(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function pdfColor(color: PdfColor, operator: 'rg' | 'RG'): string {
  return color.map(formatNumberForPdf).join(' ') + ' ' + operator;
}

function fontName(font: PdfFontKey): string {
  return font === 'bold' ? '/F2' : '/F1';
}

function pushText(
  commands: string[],
  text: string,
  x: number,
  top: number,
  font: PdfFontKey,
  fontSize: number,
  color: PdfColor,
): void {
  const y = PAGE_HEIGHT - top - fontSize;
  commands.push(
    pdfColor(color, 'rg') +
      ' ' +
      fontName(font) +
      ' ' +
      formatNumberForPdf(fontSize) +
      ' Tf 1 0 0 1 ' +
      formatNumberForPdf(x) +
      ' ' +
      formatNumberForPdf(y) +
      ' Tm (' +
      escapePdfText(text) +
      ') Tj',
  );
}

function pushRightText(
  commands: string[],
  text: string,
  right: number,
  top: number,
  font: PdfFontKey,
  fontSize: number,
  color: PdfColor,
): void {
  pushText(
    commands,
    text,
    right - textWidth(text, fontSize, font),
    top,
    font,
    fontSize,
    color,
  );
}

function pageStream(
  page: LayoutPage,
  pageNumber: number,
  pageCount: number,
): string {
  const commands: string[] = [
    'q',
    '1 1 1 rg 0 0 ' + PAGE_WIDTH + ' ' + PAGE_HEIGHT + ' re f',
    pdfColor(BRAND_ORANGE, 'RG') +
      ' 2 w ' +
      PAGE_MARGIN_X +
      ' ' +
      (PAGE_HEIGHT - 47) +
      ' m ' +
      (PAGE_WIDTH - PAGE_MARGIN_X) +
      ' ' +
      (PAGE_HEIGHT - 47) +
      ' l S',
    pdfColor(BORDER_SOFT, 'RG') +
      ' 0.6 w ' +
      PAGE_MARGIN_X +
      ' 39 m ' +
      (PAGE_WIDTH - PAGE_MARGIN_X) +
      ' 39 l S',
    'Q',
    'BT',
  ];
  pushText(commands, 'FITTRACK', PAGE_MARGIN_X, 25, 'bold', 8.5, BRAND_ORANGE);
  pushText(
    commands,
    'BUSINESS INSIGHT',
    PAGE_MARGIN_X + 52,
    25,
    'regular',
    8.5,
    TEXT_SECONDARY,
  );
  pushRightText(
    commands,
    'SAVED SNAPSHOT',
    PAGE_WIDTH - PAGE_MARGIN_X,
    25,
    'bold',
    7.5,
    TEXT_MUTED,
  );
  for (const line of page.lines) {
    pushText(
      commands,
      line.text,
      line.x,
      line.top,
      line.style.font,
      line.style.fontSize,
      line.style.color,
    );
  }
  pushText(
    commands,
    'FitTrack - Saved insight snapshot',
    PAGE_MARGIN_X,
    808,
    'regular',
    7.5,
    TEXT_MUTED,
  );
  pushRightText(
    commands,
    'Page ' + pageNumber + ' of ' + pageCount,
    PAGE_WIDTH - PAGE_MARGIN_X,
    808,
    'regular',
    7.5,
    TEXT_MUTED,
  );
  commands.push('ET');
  return commands.join('\n');
}

function buildPdf(pages: LayoutPage[]): Buffer {
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  const pageObjectIds: number[] = [];
  pages.forEach((page, index) => {
    const pageObjectId = objects.length + 1;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    const stream = pageStream(page, index + 1, pages.length);
    objects.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' +
        PAGE_WIDTH +
        ' ' +
        PAGE_HEIGHT +
        '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' +
        contentObjectId +
        ' 0 R >>',
    );
    objects.push(
      '<< /Length ' +
        Buffer.byteLength(stream, 'latin1') +
        ' >>\nstream\n' +
        stream +
        '\nendstream',
    );
  });
  objects[1] =
    '<< /Type /Pages /Kids [' +
    pageObjectIds.map((id) => id + ' 0 R').join(' ') +
    '] /Count ' +
    pages.length +
    ' >>';

  let output = '%PDF-1.4\n%FitTrack\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, 'latin1'));
    output += index + 1 + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xrefOffset = Buffer.byteLength(output, 'latin1');
  output += 'xref\n0 ' + (objects.length + 1) + '\n';
  output += '0000000000 65535 f \n';
  for (let index = 1; index < offsets.length; index += 1) {
    output += String(offsets[index]).padStart(10, '0') + ' 00000 n \n';
  }
  output += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  output += 'startxref\n' + xrefOffset + '\n%%EOF\n';
  return Buffer.from(output, 'latin1');
}

export function buildBusinessAnalyticsInsightPdf(
  input: BusinessAnalyticsInsightPdfInput,
): Buffer {
  const pages = layoutBlocks(buildBlocks(input));
  return buildPdf(pages.length ? pages : [newPage([])]);
}
