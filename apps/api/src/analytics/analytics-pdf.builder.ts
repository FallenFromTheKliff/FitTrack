import type {
  AnalyticsAttendanceResponseDTO,
  AnalyticsDailyInsightsTrendResponseDTO,
  AnalyticsPdfSection,
  AnalyticsRevenueResponseDTO,
  AnalyticsSnapshotResponseDTO,
} from './dto/analytics.dto';

type PdfFontKey = 'regular' | 'bold';
type PdfColor = [number, number, number];
type PdfPoint = { x: number; top: number };

type PdfTextOptions = {
  align?: 'center' | 'left' | 'right';
  color?: PdfColor;
  font?: PdfFontKey;
  fontSize?: number;
};

type PdfStrokeOptions = {
  lineWidth?: number;
  strokeColor?: PdfColor;
};

type PdfBoxOptions = PdfStrokeOptions & {
  fillColor?: PdfColor;
};

export type AnalyticsPdfInsightBlock = {
  anomalyFlags?: string[];
  highlights: string[];
  opportunities?: string[];
  recommendedActions: string[];
  risks?: string[];
  source?: 'deterministic' | 'saved-ai';
  summary: string;
};

type BuildAnalyticsPdfArgs = {
  attendance: AnalyticsAttendanceResponseDTO;
  attendanceLabel: string;
  dailyInsightsTrend: AnalyticsDailyInsightsTrendResponseDTO;
  exportedBy: {
    name: string;
    role: string;
  };
  generatedAt: string;
  inventory: {
    equipment_types: number;
    equipment_under_maintenance: number;
    equipment_units_available: number;
    equipment_units_total: number;
    low_stock_items: number;
    out_of_stock_items: number;
    retail_inventory_value: string;
    retail_items: number;
    top_products: Array<{
      name: string;
      quantity_sold: number;
      revenue: string;
    }>;
  };
  insights: {
    attendance: AnalyticsPdfInsightBlock;
    dailyInsights: AnalyticsPdfInsightBlock;
    inventory: AnalyticsPdfInsightBlock;
    performanceKpis: AnalyticsPdfInsightBlock;
    recentActivities: AnalyticsPdfInsightBlock;
    recommendations: AnalyticsPdfInsightBlock;
    revenue: AnalyticsPdfInsightBlock;
    systemAlerts: AnalyticsPdfInsightBlock;
  };
  revenue: AnalyticsRevenueResponseDTO;
  sections: AnalyticsPdfSection[];
  snapshot: AnalyticsSnapshotResponseDTO;
};

type PdfTableColumn = {
  align?: 'left' | 'right';
  key: string;
  label: string;
  width: number;
};

type PdfTableRow = Record<string, string>;

type ChartSeries = {
  color: PdfColor;
  key: string;
  label: string;
  values: number[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN_X = 38;
const PAGE_MARGIN_TOP = 38;
const PAGE_MARGIN_BOTTOM = 42;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN_X * 2;

const HEADER_ACCENT = [0.9176, 0.3451, 0.0314] as PdfColor;
const TEXT_PRIMARY = [0.0784, 0.1059, 0.1647] as PdfColor;
const TEXT_SECONDARY = [0.4039, 0.4471, 0.5216] as PdfColor;
const TEXT_MUTED = [0.5529, 0.5922, 0.6667] as PdfColor;
const BORDER_SOFT = [0.8588, 0.8784, 0.9137] as PdfColor;
const SURFACE_PANEL = [0.9804, 0.9843, 0.9922] as PdfColor;
const SURFACE_CHART = [0.9647, 0.9725, 0.9882] as PdfColor;
const SURFACE_RECOMMEND = [0.9412, 0.9686, 1] as PdfColor;
const TEXT_RECOMMEND = [0.0941, 0.3216, 0.6118] as PdfColor;
const GRID_LINE = [0.9137, 0.9255, 0.949] as PdfColor;
const BAR_COLORS = [
  [0.9176, 0.3451, 0.0314],
  [0.149, 0.4824, 0.9608],
  [0.1647, 0.7176, 0.5059],
  [0.6588, 0.2706, 0.9333],
  [0.9686, 0.6902, 0.1216],
  [0.2039, 0.3255, 0.5765],
] as PdfColor[];

function formatMoney(value: string) {
  const amount = Number(value);
  return `PHP ${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompactChartValue(value: number) {
  const absoluteValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const compact = (divisor: number, suffix: string) => {
    const scaledValue = absoluteValue / divisor;
    const maximumFractionDigits = scaledValue >= 100 ? 0 : 2;
    return `${sign}${scaledValue.toLocaleString('en-US', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    })}${suffix}`;
  };

  if (absoluteValue >= 1_000_000_000) {
    return compact(1_000_000_000, 'B');
  }
  if (absoluteValue >= 1_000_000) {
    return compact(1_000_000, 'M');
  }
  if (absoluteValue >= 1_000) {
    return compact(1_000, 'k');
  }

  return Math.round(value).toLocaleString('en-US');
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-PH', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatBucketLabel(
  bucketStart: string,
  period: AnalyticsAttendanceResponseDTO['period'],
  short = false,
) {
  const date = new Date(bucketStart);

  switch (period) {
    case 'hourly':
      return date.toLocaleTimeString('en-PH', {
        hour: 'numeric',
        minute: short ? undefined : '2-digit',
      });
    case 'daily':
      return date.toLocaleDateString('en-PH', {
        day: 'numeric',
        month: short ? 'short' : 'long',
      });
    case 'weekly':
      return `Week of ${date.toLocaleDateString('en-PH', {
        day: 'numeric',
        month: 'short',
      })}`;
    case 'yearly':
      return date.toLocaleDateString('en-PH', {
        year: 'numeric',
      });
    case 'monthly':
    default:
      return date.toLocaleDateString('en-PH', {
        month: 'short',
        year: 'numeric',
      });
  }
}

function normalizePdfText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/₱/g, 'PHP ')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•]/g, '-')
    .replace(/(?:Â·|·|…)/g, (match) => (match === '…' ? '...' : ' - '))
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\r/g, '')
    .replace(/\n/g, ' ');
}

function encodePdfText(value: string) {
  return normalizePdfText(value)
    .replace(/\s\?\s/g, ' - ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatColor([red, green, blue]: PdfColor) {
  return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)}`;
}

function approximateTextWidth(
  text: string,
  fontSize: number,
  font: PdfFontKey,
) {
  let units = 0;

  for (const character of normalizePdfText(text)) {
    if (character === ' ') {
      units += 0.3;
    } else if (/[A-Z0-9]/.test(character)) {
      units += font === 'bold' ? 0.62 : 0.6;
    } else if (/[ilI.,:;!'"]/u.test(character)) {
      units += 0.24;
    } else if (/[mwMW@#%&]/u.test(character)) {
      units += 0.86;
    } else {
      units += font === 'bold' ? 0.56 : 0.54;
    }
  }

  return units * fontSize;
}

function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  font: PdfFontKey,
) {
  const normalized = normalizePdfText(text).trim();
  if (!normalized) {
    return ['-'];
  }

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (approximateTextWidth(candidate, fontSize, font) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    let chunk = '';
    for (const letter of word) {
      const nextChunk = `${chunk}${letter}`;
      if (approximateTextWidth(nextChunk, fontSize, font) <= maxWidth) {
        chunk = nextChunk;
      } else {
        if (chunk) {
          lines.push(chunk);
        }
        chunk = letter;
      }
    }
    currentLine = chunk;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function toNumber(value: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

class PdfPage {
  private readonly commands: string[] = [];

  drawRect(
    x: number,
    top: number,
    width: number,
    height: number,
    options: PdfBoxOptions = {},
  ) {
    const y = PAGE_HEIGHT - top - height;
    const shouldFill = Boolean(options.fillColor);
    const shouldStroke = Boolean(options.strokeColor);

    if (options.fillColor) {
      this.commands.push(`${formatColor(options.fillColor)} rg`);
    }
    if (options.strokeColor) {
      this.commands.push(`${formatColor(options.strokeColor)} RG`);
    }
    if (options.lineWidth) {
      this.commands.push(`${options.lineWidth.toFixed(2)} w`);
    }

    const operator = shouldFill && shouldStroke ? 'B' : shouldFill ? 'f' : 'S';
    this.commands.push(
      `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${operator}`,
    );
  }

  drawLine(
    x1: number,
    top1: number,
    x2: number,
    top2: number,
    options: PdfStrokeOptions = {},
  ) {
    const y1 = PAGE_HEIGHT - top1;
    const y2 = PAGE_HEIGHT - top2;
    this.commands.push(
      `${formatColor(options.strokeColor ?? TEXT_MUTED)} RG`,
      `${(options.lineWidth ?? 1).toFixed(2)} w`,
      `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`,
    );
  }

  drawPolyline(points: PdfPoint[], options: PdfStrokeOptions = {}) {
    if (points.length < 2) {
      return;
    }

    const commands = points.map((point, index) => {
      const y = PAGE_HEIGHT - point.top;
      return `${point.x.toFixed(2)} ${y.toFixed(2)} ${index === 0 ? 'm' : 'l'}`;
    });

    this.commands.push(
      `${formatColor(options.strokeColor ?? TEXT_MUTED)} RG`,
      `${(options.lineWidth ?? 1).toFixed(2)} w`,
      commands.join(' '),
      'S',
    );
  }

  drawPolygon(points: PdfPoint[], options: PdfBoxOptions = {}) {
    if (points.length < 3) {
      return;
    }

    const commands = points.map((point, index) => {
      const y = PAGE_HEIGHT - point.top;
      return `${point.x.toFixed(2)} ${y.toFixed(2)} ${index === 0 ? 'm' : 'l'}`;
    });

    if (options.fillColor) {
      this.commands.push(`${formatColor(options.fillColor)} rg`);
    }
    if (options.strokeColor) {
      this.commands.push(`${formatColor(options.strokeColor)} RG`);
    }
    if (options.lineWidth) {
      this.commands.push(`${options.lineWidth.toFixed(2)} w`);
    }

    const shouldFill = Boolean(options.fillColor);
    const shouldStroke = Boolean(options.strokeColor);
    const operator = shouldFill && shouldStroke ? 'b' : shouldFill ? 'f' : 's';

    this.commands.push(commands.join(' '), operator);
  }

  drawText(x: number, top: number, text: string, options: PdfTextOptions = {}) {
    const font = options.font === 'bold' ? '/F2' : '/F1';
    const fontSize = options.fontSize ?? 12;
    const color = options.color ?? TEXT_PRIMARY;
    const safeText = encodePdfText(text);
    const textWidth = approximateTextWidth(
      safeText,
      fontSize,
      options.font ?? 'regular',
    );
    const drawX =
      options.align === 'center'
        ? x - textWidth / 2
        : options.align === 'right'
          ? x - textWidth
          : x;
    const y = PAGE_HEIGHT - top - fontSize;

    this.commands.push('BT');
    this.commands.push(`${font} ${fontSize.toFixed(2)} Tf`);
    this.commands.push(`${formatColor(color)} rg`);
    this.commands.push(
      `1 0 0 1 ${drawX.toFixed(2)} ${y.toFixed(2)} Tm (${safeText}) Tj`,
    );
    this.commands.push('ET');
  }

  toStream() {
    return this.commands.join('\n');
  }
}

class PdfDocument {
  private readonly pages: PdfPage[] = [];

  addPage() {
    const page = new PdfPage();
    this.pages.push(page);
    return page;
  }

  toBuffer() {
    const objects: Buffer[] = [];
    const pushObject = (body: Buffer | string) => {
      objects.push(
        typeof body === 'string' ? Buffer.from(body, 'ascii') : body,
      );
      return objects.length;
    };

    const fontRegularObject = pushObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    );
    const fontBoldObject = pushObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    );

    const pageObjectIds: number[] = [];

    for (const page of this.pages) {
      const contentStream = Buffer.from(page.toStream(), 'ascii');
      const contentObject = pushObject(
        Buffer.concat([
          Buffer.from(
            `<< /Length ${contentStream.length} >>\nstream\n`,
            'ascii',
          ),
          contentStream,
          Buffer.from('\nendstream', 'ascii'),
        ]),
      );

      const pageObject = pushObject(
        `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 ${fontRegularObject} 0 R /F2 ${fontBoldObject} 0 R >> >> /Contents ${contentObject} 0 R >>`,
      );
      pageObjectIds.push(pageObject);
    }

    const pagesObjectId = pushObject(
      `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds
        .map((id) => `${id} 0 R`)
        .join(' ')}] >>`,
    );
    const catalogObjectId = pushObject(
      `<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`,
    );

    for (const pageObjectId of pageObjectIds) {
      const pageObject = objects[pageObjectId - 1].toString('ascii');
      objects[pageObjectId - 1] = Buffer.from(
        pageObject.replace('/Parent 0 0 R', `/Parent ${pagesObjectId} 0 R`),
        'ascii',
      );
    }

    let output = '%PDF-1.4\n%FitTrack\n';
    const offsets: number[] = [0];

    objects.forEach((objectBuffer, index) => {
      offsets.push(Buffer.byteLength(output, 'ascii'));
      output += `${index + 1} 0 obj\n`;
      output += objectBuffer.toString('ascii');
      output += '\nendobj\n';
    });

    const xrefOffset = Buffer.byteLength(output, 'ascii');
    output += `xref\n0 ${objects.length + 1}\n`;
    output += '0000000000 65535 f \n';

    for (let index = 1; index < offsets.length; index += 1) {
      output += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`;
    }

    output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectId} 0 R >>\n`;
    output += `startxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(output, 'ascii');
  }
}

class AnalyticsPdfComposer {
  private readonly document = new PdfDocument();
  private currentPage = this.document.addPage();
  private cursorY = PAGE_MARGIN_TOP;

  build(args: BuildAnalyticsPdfArgs) {
    const sections = new Set(args.sections);

    this.drawHeader(args.generatedAt, args.exportedBy);
    if (sections.has('daily')) this.drawDailyInsightsSection(args);
    if (sections.has('kpis')) this.drawPerformanceSection(args);
    if (sections.has('revenue')) this.drawRevenueSection(args);
    if (sections.has('inventory')) this.drawInventorySection(args);
    if (sections.has('attendance')) this.drawAttendanceSection(args);
    if (sections.has('alerts')) this.drawSystemAlertsSection(args);
    if (sections.has('activities')) this.drawRecentActivitiesSection(args);
    if (sections.has('recommendations')) {
      this.drawRecommendationsSection(args.insights.recommendations);
    }

    return this.document.toBuffer();
  }

  private drawHeader(
    generatedAt: string,
    exportedBy: BuildAnalyticsPdfArgs['exportedBy'],
  ) {
    this.currentPage.drawRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, {
      fillColor: [1, 1, 1],
    });
    this.currentPage.drawRect(PAGE_MARGIN_X, this.cursorY, 152, 4, {
      fillColor: HEADER_ACCENT,
    });
    this.cursorY += 16;
    this.currentPage.drawText(
      PAGE_MARGIN_X,
      this.cursorY,
      'FitTrack Analytics',
      {
        color: HEADER_ACCENT,
        font: 'bold',
        fontSize: 11,
      },
    );
    this.cursorY += 18;
    this.currentPage.drawText(PAGE_MARGIN_X, this.cursorY, 'Analytics Export', {
      color: TEXT_PRIMARY,
      font: 'bold',
      fontSize: 26,
    });
    this.cursorY += 34;
    const subtitleHeight = this.drawParagraph(
      PAGE_MARGIN_X,
      this.cursorY,
      CONTENT_WIDTH,
      `Generated ${formatDateTime(generatedAt)}. This report is rendered directly from live analytics data with embedded charts and factual section details.`,
      {
        color: TEXT_SECONDARY,
        fontSize: 10.5,
      },
    );
    this.cursorY += subtitleHeight + 5;
    const exporterHeight = this.drawParagraph(
      PAGE_MARGIN_X,
      this.cursorY,
      CONTENT_WIDTH,
      `Exported by ${exportedBy.name} (${exportedBy.role})`,
      {
        color: TEXT_PRIMARY,
        font: 'bold',
        fontSize: 10.5,
      },
    );
    this.cursorY += exporterHeight + 10;
    this.currentPage.drawRect(PAGE_MARGIN_X, this.cursorY, CONTENT_WIDTH, 1, {
      fillColor: BORDER_SOFT,
    });
    this.cursorY += 22;
  }

  private drawDailyInsightsSection(args: BuildAnalyticsPdfArgs) {
    const peakAttendanceLabel = this.getPeakAttendanceLabel(args.attendance);
    const topRevenueSource = args.revenue.top_revenue_sources[0];

    this.drawSectionHeading(
      'Operations Snapshot',
      'Current operating totals and member activity trends across the selected attendance window.',
      224,
    );

    this.drawLineChartCard({
      title: 'Active Members and Sessions Over Time',
      subtitle: `${this.describeWindow(args.dailyInsightsTrend.start_date, args.dailyInsightsTrend.end_date)} · ${args.dailyInsightsTrend.period} buckets`,
      labels: args.dailyInsightsTrend.series.map((point) =>
        formatBucketLabel(
          point.bucket_start,
          args.dailyInsightsTrend.period,
          true,
        ),
      ),
      series: [
        {
          color: BAR_COLORS[1],
          key: 'active_members',
          label: 'Active Members',
          values: args.dailyInsightsTrend.series.map(
            (point) => point.active_members,
          ),
        },
        {
          color: HEADER_ACCENT,
          key: 'sessions',
          label: 'Sessions',
          values: args.dailyInsightsTrend.series.map((point) => point.sessions),
        },
      ],
    });

    this.drawMetricTiles([
      {
        label: 'Active Members',
        value: String(args.snapshot.daily_insights.active_members),
      },
      {
        label: 'Sessions Today',
        value: String(args.snapshot.daily_insights.sessions_today),
      },
      {
        label: 'Recent Activities',
        value: String(args.snapshot.daily_insights.recent_activities),
      },
      {
        label: 'Live Alerts',
        value: String(args.snapshot.system_alerts.length),
      },
      {
        label: 'Window Check-ins',
        value: String(args.attendance.total_check_ins),
      },
      {
        label: 'Revenue Window',
        value: formatMoney(args.revenue.totals.total_revenue),
      },
    ]);

    this.drawSimpleMetricTable([
      ['Active Members', String(args.snapshot.daily_insights.active_members)],
      ['Sessions Today', String(args.snapshot.daily_insights.sessions_today)],
      [
        'Recent Activities',
        String(args.snapshot.daily_insights.recent_activities),
      ],
      ['Live Alerts', String(args.snapshot.system_alerts.length)],
      ['Attendance Window', args.attendanceLabel],
      ['Window Check-ins', String(args.attendance.total_check_ins)],
      ['Peak Check-in Window', peakAttendanceLabel],
      ['Revenue Window Total', formatMoney(args.revenue.totals.total_revenue)],
      [
        'Top Revenue Source',
        topRevenueSource
          ? `${topRevenueSource.source_label} (${topRevenueSource.share_percentage.toFixed(1)}%)`
          : 'No revenue source data available',
      ],
    ]);
  }

  private drawPerformanceSection(args: BuildAnalyticsPdfArgs) {
    const peakAttendanceLabel = this.getPeakAttendanceLabel(args.attendance);

    this.drawSectionHeading(
      'Performance KPIs',
      'Current operational totals for revenue, attendance, bookings, appointments, member growth, and coaching output.',
      262,
    );

    const kpis = [
      {
        label: 'Revenue',
        value: toNumber(args.snapshot.performance_kpis.total_revenue),
        valueLabel: `PHP ${formatCompactChartValue(
          toNumber(args.snapshot.performance_kpis.total_revenue),
        )}`,
      },
      {
        label: 'Bookings',
        value: args.snapshot.performance_kpis.total_venue_bookings,
        valueLabel: String(args.snapshot.performance_kpis.total_venue_bookings),
      },
      {
        label: 'Appointments',
        value: args.snapshot.performance_kpis.total_coaching_appointments,
        valueLabel: String(
          args.snapshot.performance_kpis.total_coaching_appointments,
        ),
      },
      {
        label: 'New Members',
        value: args.snapshot.performance_kpis.new_members,
        valueLabel: String(args.snapshot.performance_kpis.new_members),
      },
      {
        label: 'Check-ins',
        value: args.snapshot.performance_kpis.check_ins,
        valueLabel: String(args.snapshot.performance_kpis.check_ins),
      },
      {
        label: 'Window Check-ins',
        value: args.attendance.total_check_ins,
        valueLabel: String(args.attendance.total_check_ins),
      },
      {
        label: 'Coaching',
        value: args.snapshot.performance_kpis.coaching_sessions,
        valueLabel: String(args.snapshot.performance_kpis.coaching_sessions),
      },
    ];

    this.drawBarChartCard({
      title: 'KPI Comparison',
      subtitle:
        'Normalized grouped bars so revenue and volume metrics can be compared in one view.',
      items: kpis.map((item, index) => ({
        color: BAR_COLORS[index % BAR_COLORS.length],
        label: item.label,
        value: item.value,
        valueLabel: item.valueLabel,
      })),
    });

    this.drawSimpleMetricTable([
      [
        'Total Revenue',
        formatMoney(args.snapshot.performance_kpis.total_revenue),
      ],
      [
        'Total Venue Bookings',
        String(args.snapshot.performance_kpis.total_venue_bookings),
      ],
      [
        'Total Coaching Appointments',
        String(args.snapshot.performance_kpis.total_coaching_appointments),
      ],
      ['New Members', String(args.snapshot.performance_kpis.new_members)],
      ['Check-ins', String(args.snapshot.performance_kpis.check_ins)],
      ['Selected Attendance Window', args.attendanceLabel],
      ['Selected Window Check-ins', String(args.attendance.total_check_ins)],
      ['Peak Check-in Window', peakAttendanceLabel],
      [
        'Coaching Sessions',
        String(args.snapshot.performance_kpis.coaching_sessions),
      ],
    ]);
  }

  private drawRevenueSection(args: BuildAnalyticsPdfArgs) {
    this.drawSectionHeading(
      'Revenue',
      'Revenue source mix and total revenue movement across the selected export window.',
      278,
    );

    this.drawRevenueCharts(args.revenue);
    this.drawSimpleMetricTable([
      [
        'Total Generated Revenue',
        formatMoney(args.revenue.totals.total_revenue),
      ],
      ...args.revenue.top_revenue_sources.map((source): [string, string] => [
        `${source.source_label} (${source.share_percentage.toFixed(1)}%)`,
        formatMoney(source.revenue),
      ]),
    ]);
  }

  private drawInventorySection(args: BuildAnalyticsPdfArgs) {
    this.drawSectionHeading(
      'Inventory Performance',
      'Current retail and equipment inventory health with top retail item performance from the selected revenue window.',
      80,
    );

    this.drawMetricTiles([
      {
        label: 'Retail Items',
        value: String(args.inventory.retail_items),
      },
      {
        label: 'Low Stock',
        value: String(args.inventory.low_stock_items),
      },
      {
        label: 'Out of Stock',
        value: String(args.inventory.out_of_stock_items),
      },
      {
        label: 'Inventory Value',
        value: formatMoney(args.inventory.retail_inventory_value),
      },
    ]);

    const topRetailItems =
      args.inventory.top_products.length > 0
        ? args.inventory.top_products.map((product, index) => ({
            color: BAR_COLORS[index % BAR_COLORS.length],
            label: product.name,
            value: Math.max(toNumber(product.revenue), product.quantity_sold),
            valueLabel: `${product.quantity_sold} sold`,
          }))
        : [
            {
              color: BAR_COLORS[0],
              label: 'No sales data',
              value: 0,
              valueLabel: '0 sold',
            },
          ];

    this.drawBarChartCard({
      title: 'Top Retail Items',
      subtitle:
        'Top-selling retail products ranked by the selected export window activity.',
      items: topRetailItems,
    });

    this.drawSimpleMetricTable([
      ['Equipment Types', String(args.inventory.equipment_types)],
      [
        'Equipment Availability',
        `${args.inventory.equipment_units_available} / ${args.inventory.equipment_units_total} units`,
      ],
      [
        'Equipment Under Maintenance',
        String(args.inventory.equipment_under_maintenance),
      ],
      [
        'Top Retail Product',
        args.inventory.top_products[0]
          ? `${args.inventory.top_products[0].name} (${args.inventory.top_products[0].quantity_sold} sold)`
          : 'No retail sales data for this window',
      ],
    ]);
  }

  private drawAttendanceSection(args: BuildAnalyticsPdfArgs) {
    this.drawSectionHeading(
      'Attendance',
      `${args.attendanceLabel}. Peak buckets: ${this.getPeakAttendanceLabel(args.attendance)}.`,
      250,
    );

    this.drawAttendanceBarChart(args.attendance);
    this.drawGenericTable({
      title: 'Attendance Breakdown',
      columns: [
        { key: 'bucket', label: 'Bucket', width: 0.58 },
        { align: 'right', key: 'checkIns', label: 'Check-ins', width: 0.42 },
      ],
      rows: args.attendance.series.map((entry) => ({
        bucket: formatBucketLabel(entry.bucket_start, args.attendance.period),
        checkIns: String(entry.check_ins),
      })),
    });
  }

  private drawSystemAlertsSection(args: BuildAnalyticsPdfArgs) {
    this.drawSectionHeading(
      'System Alerts',
      'Operational warnings sourced from live stock thresholds and equipment availability.',
      100,
    );

    this.drawGenericTable({
      title: 'Warning Lanes',
      columns: [
        { key: 'alert', label: 'Alert', width: 0.24 },
        { key: 'action', label: 'Action', width: 0.2 },
        { key: 'details', label: 'Details', width: 0.56 },
      ],
      rows: args.snapshot.system_alerts.map((alert) => ({
        alert: alert.title,
        action: alert.action_label,
        details: alert.body,
      })),
      rowStyle: 'warning',
    });
  }

  private drawRecentActivitiesSection(args: BuildAnalyticsPdfArgs) {
    this.drawSectionHeading(
      'Recent Activities',
      'Latest member-facing and operational events captured by the live analytics feed.',
      100,
    );

    this.drawGenericTable({
      title: 'Activity Timeline',
      columns: [
        { key: 'member', label: 'Member', width: 0.2 },
        { key: 'action', label: 'Action', width: 0.22 },
        { key: 'time', label: 'Time', width: 0.2 },
        { key: 'status', label: 'Status', width: 0.14 },
        { key: 'details', label: 'Details', width: 0.24 },
      ],
      rows: args.snapshot.recent_activities.map((activity) => ({
        member: activity.actor_name,
        action: activity.title,
        time: formatDateTime(activity.occurred_at),
        status: activity.status.replace(/_/g, ' '),
        details: activity.description,
      })),
    });
  }

  private drawRecommendationsSection(insight: AnalyticsPdfInsightBlock) {
    const highlights = insight.highlights.slice(0, 3);
    const risksAndAnomalies = [
      ...(insight.risks ?? []).map((risk) => `Risk: ${risk}`),
      ...(insight.anomalyFlags ?? []).map((anomaly) => `Anomaly: ${anomaly}`),
    ].slice(0, 3);
    const opportunities = (insight.opportunities ?? []).slice(0, 3);
    const actions = insight.recommendedActions.slice(0, 3);

    this.drawSectionHeading(
      'Saved AI Business Insight',
      'Decision-oriented analysis reused from the matching dashboard insight.',
      80,
    );

    this.drawInsightTextGroup('EXECUTIVE SUMMARY', insight.summary);
    this.drawInsightListGroup('TOP HIGHLIGHTS', highlights);
    this.drawInsightListGroup('PRIORITY RISKS & ANOMALIES', risksAndAnomalies);
    this.drawInsightListGroup('OPPORTUNITIES', opportunities);
    this.drawInsightListGroup('RECOMMENDED ACTIONS', actions);
  }

  private drawInsightTextGroup(title: string, text: string) {
    if (!text) {
      return;
    }

    const textHeight = this.measureParagraphHeight(
      text,
      CONTENT_WIDTH - 28,
      11,
      'regular',
    );
    const cardHeight = 30 + textHeight + 14;
    this.ensureSpace(cardHeight + 12);
    const top = this.cursorY;

    this.currentPage.drawRect(PAGE_MARGIN_X, top, CONTENT_WIDTH, cardHeight, {
      fillColor: SURFACE_RECOMMEND,
      strokeColor: [0.7412, 0.8392, 0.9725],
      lineWidth: 0.9,
    });
    this.currentPage.drawText(PAGE_MARGIN_X + 14, top + 10, title, {
      color: TEXT_RECOMMEND,
      font: 'bold',
      fontSize: 9.5,
    });
    this.drawParagraph(PAGE_MARGIN_X + 14, top + 30, CONTENT_WIDTH - 28, text, {
      color: TEXT_PRIMARY,
      fontSize: 11,
    });
    this.cursorY += cardHeight + 12;
  }

  private drawInsightListGroup(title: string, items: string[]) {
    if (items.length === 0) {
      return;
    }

    const listHeight = this.measureBulletListHeight(
      items,
      CONTENT_WIDTH - 36,
      10.5,
    );
    const cardHeight = 30 + listHeight + 10;
    this.ensureSpace(cardHeight + 12);
    const top = this.cursorY;

    this.currentPage.drawRect(PAGE_MARGIN_X, top, CONTENT_WIDTH, cardHeight, {
      fillColor: SURFACE_RECOMMEND,
      strokeColor: [0.7412, 0.8392, 0.9725],
      lineWidth: 0.9,
    });
    this.currentPage.drawText(PAGE_MARGIN_X + 14, top + 10, title, {
      color: TEXT_RECOMMEND,
      font: 'bold',
      fontSize: 9.5,
    });
    this.drawBulletList(
      PAGE_MARGIN_X + 18,
      top + 30,
      CONTENT_WIDTH - 36,
      items,
      { color: TEXT_PRIMARY, fontSize: 10.5 },
    );
    this.cursorY += cardHeight + 12;
  }

  private drawSectionHeading(
    title: string,
    subtitle: string,
    minimumFollowingHeight = 0,
  ) {
    this.ensureSpace(72 + minimumFollowingHeight);
    this.currentPage.drawText(PAGE_MARGIN_X, this.cursorY, title, {
      color: TEXT_PRIMARY,
      font: 'bold',
      fontSize: 18,
    });
    this.cursorY += 24;
    const subtitleHeight = this.drawParagraph(
      PAGE_MARGIN_X,
      this.cursorY,
      CONTENT_WIDTH,
      subtitle,
      {
        color: TEXT_SECONDARY,
        fontSize: 10,
      },
    );
    this.cursorY += subtitleHeight + 12;
  }

  private drawMetricTiles(items: Array<{ label: string; value: string }>) {
    const gap = 12;
    const columnCount = items.length > 4 ? 3 : Math.max(items.length, 1);
    const rowCount = Math.ceil(items.length / columnCount);
    const tileWidth = (CONTENT_WIDTH - gap * (columnCount - 1)) / columnCount;
    const labelWidth = tileWidth - 24;
    const labelFontSize = 8.5;
    const labelLineHeight = 10;
    const labelLines = items.map((item) =>
      wrapText(item.label.toUpperCase(), labelWidth, labelFontSize, 'bold'),
    );
    const maximumLabelLines = Math.max(
      ...labelLines.map((lines) => lines.length),
      1,
    );
    const valueTopOffset = 12 + maximumLabelLines * labelLineHeight + 6;
    const tileHeight = valueTopOffset + 22;
    const gridHeight = rowCount * tileHeight + (rowCount - 1) * gap;

    this.ensureSpace(gridHeight + 14);
    items.forEach((item, index) => {
      const rowIndex = Math.floor(index / columnCount);
      const columnIndex = index % columnCount;
      const x = PAGE_MARGIN_X + columnIndex * (tileWidth + gap);
      const tileTop = this.cursorY + rowIndex * (tileHeight + gap);
      this.currentPage.drawRect(x, tileTop, tileWidth, tileHeight, {
        fillColor: SURFACE_PANEL,
        strokeColor: BORDER_SOFT,
        lineWidth: 0.8,
      });
      labelLines[index].forEach((line, lineIndex) => {
        this.currentPage.drawText(x + 12, tileTop + 10 + lineIndex * 10, line, {
          color: TEXT_MUTED,
          font: 'bold',
          fontSize: labelFontSize,
        });
      });

      let valueFontSize = 18;
      while (
        valueFontSize > 11 &&
        approximateTextWidth(item.value, valueFontSize, 'bold') > labelWidth
      ) {
        valueFontSize -= 0.5;
      }
      this.currentPage.drawText(x + 12, tileTop + valueTopOffset, item.value, {
        color: TEXT_PRIMARY,
        font: 'bold',
        fontSize: valueFontSize,
      });
    });
    this.cursorY += gridHeight + 14;
  }

  private drawLineChartCard(args: {
    labels: string[];
    series: ChartSeries[];
    subtitle: string;
    title: string;
  }) {
    const cardHeight = 210;
    this.ensureSpace(cardHeight + 14);
    const chartTop = this.cursorY;

    this.drawCard(PAGE_MARGIN_X, chartTop, CONTENT_WIDTH, cardHeight);
    this.currentPage.drawText(PAGE_MARGIN_X + 14, chartTop + 12, args.title, {
      color: TEXT_PRIMARY,
      font: 'bold',
      fontSize: 12,
    });
    this.currentPage.drawText(
      PAGE_MARGIN_X + 14,
      chartTop + 28,
      args.subtitle.replace(/[^\x20-\x7E]+/g, ' - '),
      {
        color: TEXT_SECONDARY,
        fontSize: 9.5,
      },
    );
    this.drawLegend(
      PAGE_MARGIN_X + CONTENT_WIDTH - 110,
      chartTop + 12,
      args.series.map((series) => ({
        color: series.color,
        label: series.label,
      })),
      96,
    );

    const chartX = PAGE_MARGIN_X + 16;
    const chartY = chartTop + 50;
    const chartWidth = CONTENT_WIDTH - 32;
    const chartHeight = 134;
    this.drawChartFrame(chartX, chartY, chartWidth, chartHeight);

    const allValues = args.series.flatMap((series) => series.values);
    const maxValue = Math.max(...allValues, 0);

    if (maxValue <= 0 || args.labels.length === 0) {
      this.currentPage.drawText(
        chartX + chartWidth / 2,
        chartY + chartHeight / 2 - 4,
        'No chart data available for this window.',
        {
          align: 'center',
          color: TEXT_MUTED,
          fontSize: 10,
        },
      );
      this.cursorY += cardHeight + 14;
      return;
    }

    const innerLeft = chartX + 42;
    const innerRight = chartX + chartWidth - 10;
    const innerTop = chartY + 14;
    const innerBottom = chartY + chartHeight - 24;
    const plotWidth = innerRight - innerLeft;
    const plotHeight = innerBottom - innerTop;

    this.drawChartGrid(innerLeft, innerTop, plotWidth, plotHeight, maxValue);

    args.series.forEach((series) => {
      const points = series.values.map((value, index) => {
        const x =
          innerLeft +
          (args.labels.length === 1
            ? plotWidth / 2
            : (index / (args.labels.length - 1)) * plotWidth);
        const y = innerBottom - (value / maxValue) * plotHeight;
        return { x, top: y };
      });

      this.currentPage.drawPolyline(points, {
        lineWidth: 2.1,
        strokeColor: series.color,
      });

      points.forEach((point) => {
        this.currentPage.drawRect(point.x - 1.8, point.top - 1.8, 3.6, 3.6, {
          fillColor: series.color,
          strokeColor: series.color,
          lineWidth: 0.2,
        });
      });
    });

    this.drawXAxisLabels(innerLeft, innerBottom + 8, plotWidth, args.labels);
    this.cursorY += cardHeight + 14;
  }

  private drawBarChartCard(args: {
    items: Array<{
      color: PdfColor;
      label: string;
      value: number;
      valueLabel: string;
    }>;
    subtitle: string;
    title: string;
  }) {
    const cardHeight = 248;
    this.ensureSpace(cardHeight + 14);
    const chartTop = this.cursorY;

    this.drawCard(PAGE_MARGIN_X, chartTop, CONTENT_WIDTH, cardHeight);
    this.currentPage.drawText(PAGE_MARGIN_X + 14, chartTop + 12, args.title, {
      color: TEXT_PRIMARY,
      font: 'bold',
      fontSize: 12,
    });
    this.currentPage.drawText(
      PAGE_MARGIN_X + 14,
      chartTop + 28,
      args.subtitle.replace(/[^\x20-\x7E]+/g, ' - '),
      {
        color: TEXT_SECONDARY,
        fontSize: 9.5,
      },
    );

    const chartX = PAGE_MARGIN_X + 16;
    const chartY = chartTop + 50;
    const chartWidth = CONTENT_WIDTH - 32;
    const chartHeight = 172;
    this.drawChartFrame(chartX, chartY, chartWidth, chartHeight);

    const maxValue = Math.max(...args.items.map((item) => item.value), 0);
    const innerLeft = chartX + 42;
    const innerRight = chartX + chartWidth - 10;
    const innerTop = chartY + 16;
    const innerBottom = chartY + chartHeight - 34;
    const plotWidth = innerRight - innerLeft;
    const plotHeight = innerBottom - innerTop;
    const gap = 10;
    const barWidth =
      (plotWidth - gap * (args.items.length - 1)) / args.items.length;

    this.drawChartGrid(innerLeft, innerTop, plotWidth, plotHeight, maxValue);

    args.items.forEach((item, index) => {
      const normalized = maxValue > 0 ? item.value / maxValue : 0;
      const barHeight = Math.max(4, normalized * plotHeight);
      const x = innerLeft + index * (barWidth + gap);
      const barTop = innerBottom - barHeight;

      this.currentPage.drawRect(x, barTop, barWidth, barHeight, {
        fillColor: item.color,
      });
      this.currentPage.drawText(
        x + barWidth / 2,
        barTop - 14,
        item.valueLabel,
        {
          align: 'center',
          color: TEXT_PRIMARY,
          font: 'bold',
          fontSize: 8.5,
        },
      );

      const wrappedLabel = wrapText(
        item.label,
        barWidth + 12,
        8.5,
        'bold',
      ).slice(0, 2);
      wrappedLabel.forEach((line, lineIndex) => {
        this.currentPage.drawText(
          x + barWidth / 2,
          innerBottom + 10 + lineIndex * 10,
          line,
          {
            align: 'center',
            color: TEXT_SECONDARY,
            font: 'bold',
            fontSize: 8.5,
          },
        );
      });
    });

    this.cursorY += cardHeight + 14;
  }

  private drawRevenueCharts(revenue: AnalyticsRevenueResponseDTO) {
    const cardHeight = 264;
    this.ensureSpace(cardHeight + 14);
    const top = this.cursorY;
    const gap = 12;
    const leftWidth = (CONTENT_WIDTH - gap) * 0.4;
    const rightWidth = CONTENT_WIDTH - leftWidth - gap;

    this.drawCard(PAGE_MARGIN_X, top, leftWidth, cardHeight);
    this.drawCard(PAGE_MARGIN_X + leftWidth + gap, top, rightWidth, cardHeight);

    this.currentPage.drawText(PAGE_MARGIN_X + 14, top + 12, 'Revenue Mix', {
      color: TEXT_PRIMARY,
      font: 'bold',
      fontSize: 12,
    });
    this.currentPage.drawText(
      PAGE_MARGIN_X + leftWidth + gap + 14,
      top + 12,
      'Revenue Trend',
      {
        color: TEXT_PRIMARY,
        font: 'bold',
        fontSize: 12,
      },
    );

    const slices = revenue.top_revenue_sources.map((source, index) => ({
      color: BAR_COLORS[index % BAR_COLORS.length],
      label: source.source_label,
      value: toNumber(source.revenue),
      valueLabel: `${source.share_percentage.toFixed(1)}%`,
    }));

    this.drawPieChart(
      PAGE_MARGIN_X + 18,
      top + 38,
      leftWidth - 36,
      134,
      slices,
    );
    this.drawLegend(
      PAGE_MARGIN_X + 20,
      top + 180,
      slices.map((slice) => ({
        color: slice.color,
        label: `${slice.label} · ${slice.valueLabel}`,
      })),
      leftWidth - 40,
    );

    const revenueSeries = revenue.series.map((entry) =>
      toNumber(entry.total_revenue),
    );
    this.drawLineChartInFrame({
      labels: revenue.series.map((entry) =>
        formatBucketLabel(entry.bucket_start, revenue.period, true),
      ),
      series: [
        {
          color: HEADER_ACCENT,
          key: 'revenue',
          label: 'Revenue',
          values: revenueSeries,
        },
      ],
      frameX: PAGE_MARGIN_X + leftWidth + gap + 14,
      frameTop: top + 38,
      frameWidth: rightWidth - 28,
      frameHeight: 188,
      yValueFormatter: (value) => `PHP ${formatCompactChartValue(value)}`,
    });

    this.cursorY += cardHeight + 14;
  }

  private drawAttendanceBarChart(attendance: AnalyticsAttendanceResponseDTO) {
    const cardHeight = 236;
    this.ensureSpace(cardHeight + 14);
    const top = this.cursorY;
    this.drawCard(PAGE_MARGIN_X, top, CONTENT_WIDTH, cardHeight);
    this.currentPage.drawText(
      PAGE_MARGIN_X + 14,
      top + 12,
      'Attendance Volume',
      {
        color: TEXT_PRIMARY,
        font: 'bold',
        fontSize: 12,
      },
    );
    this.currentPage.drawText(
      PAGE_MARGIN_X + 14,
      top + 28,
      'Peak buckets are highlighted to show where staffing pressure concentrates.',
      {
        color: TEXT_SECONDARY,
        fontSize: 9.5,
      },
    );

    const chartX = PAGE_MARGIN_X + 16;
    const chartY = top + 50;
    const chartWidth = CONTENT_WIDTH - 32;
    const chartHeight = 160;
    this.drawChartFrame(chartX, chartY, chartWidth, chartHeight);

    const values = attendance.series.map((entry) => entry.check_ins);
    const maxValue = Math.max(...values, 0);
    const peakValue = maxValue;
    const innerLeft = chartX + 36;
    const innerRight = chartX + chartWidth - 10;
    const innerTop = chartY + 16;
    const innerBottom = chartY + chartHeight - 28;
    const plotWidth = innerRight - innerLeft;
    const plotHeight = innerBottom - innerTop;
    const gap = 6;
    const barWidth = Math.max(
      8,
      (plotWidth - gap * Math.max(attendance.series.length - 1, 0)) /
        Math.max(attendance.series.length, 1),
    );

    this.drawChartGrid(innerLeft, innerTop, plotWidth, plotHeight, maxValue);

    attendance.series.forEach((entry, index) => {
      const normalized = maxValue > 0 ? entry.check_ins / maxValue : 0;
      const barHeight = Math.max(4, normalized * plotHeight);
      const x = innerLeft + index * (barWidth + gap);
      const barTop = innerBottom - barHeight;
      const isPeak = entry.check_ins === peakValue && peakValue > 0;

      this.currentPage.drawRect(x, barTop, barWidth, barHeight, {
        fillColor: isPeak ? HEADER_ACCENT : BAR_COLORS[1],
      });

      if (isPeak) {
        this.currentPage.drawText(
          x + barWidth / 2,
          barTop - 12,
          String(entry.check_ins),
          {
            align: 'center',
            color: TEXT_PRIMARY,
            font: 'bold',
            fontSize: 8.5,
          },
        );
      }
    });

    this.drawXAxisLabels(
      innerLeft,
      innerBottom + 8,
      plotWidth,
      attendance.series.map((entry) =>
        formatBucketLabel(entry.bucket_start, attendance.period, true),
      ),
    );

    this.cursorY += cardHeight + 14;
  }

  private drawSimpleMetricTable(rows: Array<[string, string]>) {
    this.drawGenericTable({
      title: 'Data Summary',
      columns: [
        { key: 'metric', label: 'Metric', width: 0.62 },
        { align: 'right', key: 'value', label: 'Value', width: 0.38 },
      ],
      rows: rows.map(([metric, value]) => ({ metric, value })),
    });
  }

  private drawGenericTable(args: {
    columns: PdfTableColumn[];
    rowStyle?: 'default' | 'warning';
    rows: PdfTableRow[];
    title: string;
  }) {
    const headerHeight = 24;
    const titleHeight = 20;
    const rowPaddingX = 8;
    const rowPaddingY = 7;
    const rows =
      args.rows.length > 0
        ? args.rows
        : [
            args.columns.reduce<PdfTableRow>((accumulator, column, index) => {
              accumulator[column.key] =
                index === 0 ? 'No data available for this section.' : '';
              return accumulator;
            }, {}),
          ];

    const columnWidths = args.columns.map(
      (column) => CONTENT_WIDTH * column.width,
    );
    const rowLayouts = rows.map((row) => {
      const cellLines = args.columns.map((column, index) =>
        wrapText(
          row[column.key] ?? '-',
          columnWidths[index] - rowPaddingX * 2,
          9.5,
          column.align === 'right'
            ? 'regular'
            : index === 0
              ? 'bold'
              : 'regular',
        ),
      );
      const lineCount = Math.max(...cellLines.map((lines) => lines.length), 1);

      return {
        cellLines,
        rowHeight: lineCount * 12 + rowPaddingY * 2,
      };
    });

    const drawTableTitle = (firstRowHeight: number, continued = false) => {
      this.ensureSpace(titleHeight + headerHeight + firstRowHeight + 88);
      this.currentPage.drawText(
        PAGE_MARGIN_X,
        this.cursorY,
        continued ? `${args.title} (continued)` : args.title,
        {
          color: TEXT_PRIMARY,
          font: 'bold',
          fontSize: 11.5,
        },
      );
      this.cursorY += titleHeight;
      this.drawTableHeader(args.columns, headerHeight, rowPaddingX);
    };

    drawTableTitle(rowLayouts[0].rowHeight);

    rowLayouts.forEach(({ cellLines, rowHeight }, rowIndex) => {
      if (this.cursorY + rowHeight + 88 > PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
        this.addPage();
        drawTableTitle(rowHeight, true);
      }

      this.currentPage.drawRect(
        PAGE_MARGIN_X,
        this.cursorY,
        CONTENT_WIDTH,
        rowHeight,
        {
          fillColor:
            args.rowStyle === 'warning'
              ? rowIndex % 2 === 0
                ? [1, 0.9725, 0.949]
                : [1, 0.9843, 0.9686]
              : rowIndex % 2 === 0
                ? [1, 1, 1]
                : [0.9922, 0.9941, 0.998],
          strokeColor: BORDER_SOFT,
          lineWidth: 0.45,
        },
      );

      let cellX = PAGE_MARGIN_X;
      args.columns.forEach((column, index) => {
        const lines = cellLines[index];
        lines.forEach((line, lineIndex) => {
          const textX =
            column.align === 'right'
              ? cellX + columnWidths[index] - rowPaddingX
              : cellX + rowPaddingX;

          this.currentPage.drawText(
            textX,
            this.cursorY + rowPaddingY + lineIndex * 12,
            line,
            {
              align: column.align,
              color: index === 0 ? TEXT_PRIMARY : TEXT_SECONDARY,
              font:
                column.align === 'right'
                  ? 'regular'
                  : index === 0
                    ? 'bold'
                    : 'regular',
              fontSize: 9.5,
            },
          );
        });
        cellX += columnWidths[index];
      });

      this.cursorY += rowHeight;
    });

    this.cursorY += 12;
  }

  private drawTableHeader(
    columns: PdfTableColumn[],
    headerHeight: number,
    paddingX: number,
  ) {
    this.currentPage.drawRect(
      PAGE_MARGIN_X,
      this.cursorY,
      CONTENT_WIDTH,
      headerHeight,
      {
        fillColor: SURFACE_PANEL,
        strokeColor: BORDER_SOFT,
        lineWidth: 0.8,
      },
    );

    let cellX = PAGE_MARGIN_X;
    columns.forEach((column) => {
      const textX =
        column.align === 'right'
          ? cellX + CONTENT_WIDTH * column.width - paddingX
          : cellX + paddingX;

      this.currentPage.drawText(
        textX,
        this.cursorY + 8,
        column.label.toUpperCase(),
        {
          align: column.align,
          color: TEXT_MUTED,
          font: 'bold',
          fontSize: 8.5,
        },
      );
      cellX += CONTENT_WIDTH * column.width;
    });

    this.cursorY += headerHeight;
  }

  private drawParagraph(
    x: number,
    top: number,
    width: number,
    text: string,
    options: PdfTextOptions = {},
  ) {
    const font = options.font ?? 'regular';
    const fontSize = options.fontSize ?? 12;
    const lineHeight = fontSize + 4;
    const lines = wrapText(text, width, fontSize, font);

    lines.forEach((line, index) => {
      this.currentPage.drawText(x, top + index * lineHeight, line, {
        color: options.color,
        font,
        fontSize,
      });
    });

    return lines.length * lineHeight;
  }

  private drawBulletList(
    x: number,
    top: number,
    width: number,
    items: string[],
    options: PdfTextOptions = {},
  ) {
    if (items.length === 0) {
      return 0;
    }

    let offset = 0;
    items.forEach((item) => {
      const bulletTop = top + offset;
      this.currentPage.drawText(x, bulletTop, '-', {
        color: options.color,
        font: 'bold',
        fontSize: options.fontSize ?? 10,
      });
      offset += this.drawParagraph(
        x + 10,
        bulletTop,
        width - 10,
        item,
        options,
      );
      offset += 4;
    });

    return offset;
  }

  private measureParagraphHeight(
    text: string,
    width: number,
    fontSize: number,
    font: PdfFontKey,
  ) {
    return wrapText(text, width, fontSize, font).length * (fontSize + 4);
  }

  private measureBulletListHeight(
    items: string[],
    width: number,
    fontSize: number,
  ) {
    return items
      .slice(0, 5)
      .reduce(
        (total, item) =>
          total +
          this.measureParagraphHeight(item, width - 10, fontSize, 'regular') +
          4,
        0,
      );
  }

  private drawCard(x: number, top: number, width: number, height: number) {
    this.currentPage.drawRect(x, top, width, height, {
      fillColor: SURFACE_CHART,
      strokeColor: BORDER_SOFT,
      lineWidth: 0.8,
    });
  }

  private drawChartFrame(
    x: number,
    top: number,
    width: number,
    height: number,
  ) {
    this.currentPage.drawRect(x, top, width, height, {
      fillColor: [1, 1, 1],
      strokeColor: BORDER_SOFT,
      lineWidth: 0.7,
    });
  }

  private drawChartGrid(
    x: number,
    top: number,
    width: number,
    height: number,
    maxValue: number,
    valueFormatter: (value: number) => string = formatCompactChartValue,
  ) {
    const steps = 4;
    for (let index = 0; index <= steps; index += 1) {
      const ratio = index / steps;
      const y = top + height - ratio * height;
      this.currentPage.drawLine(x, y, x + width, y, {
        lineWidth: 0.45,
        strokeColor: GRID_LINE,
      });
      const label = valueFormatter(maxValue * ratio);
      this.currentPage.drawText(x - 6, y - 4, label, {
        align: 'right',
        color: TEXT_MUTED,
        fontSize: 8,
      });
    }
    this.currentPage.drawLine(x, top, x, top + height, {
      lineWidth: 0.7,
      strokeColor: BORDER_SOFT,
    });
    this.currentPage.drawLine(x, top + height, x + width, top + height, {
      lineWidth: 0.7,
      strokeColor: BORDER_SOFT,
    });
  }

  private drawXAxisLabels(
    x: number,
    top: number,
    width: number,
    labels: string[],
  ) {
    if (labels.length === 0) {
      return;
    }

    const stride = Math.max(1, Math.ceil(labels.length / 6));
    labels.forEach((label, index) => {
      if (index % stride !== 0 && index !== labels.length - 1) {
        return;
      }
      const drawX =
        x +
        (labels.length === 1
          ? width / 2
          : (index / (labels.length - 1)) * width);
      this.currentPage.drawText(drawX, top, label, {
        align: 'center',
        color: TEXT_MUTED,
        fontSize: 8,
      });
    });
  }

  private drawLegend(
    x: number,
    top: number,
    items: Array<{ color: PdfColor; label: string }>,
    width: number,
  ) {
    let offset = 0;
    items.slice(0, 4).forEach((item) => {
      this.currentPage.drawRect(x, top + offset + 2, 8, 8, {
        fillColor: item.color,
      });
      this.currentPage.drawText(x + 14, top + offset, item.label, {
        color: TEXT_SECONDARY,
        fontSize: 8.5,
      });
      offset +=
        this.measureParagraphHeight(item.label, width - 14, 8.5, 'regular') + 2;
    });
  }

  private drawLineChartInFrame(args: {
    frameHeight: number;
    frameTop: number;
    frameWidth: number;
    frameX: number;
    labels: string[];
    series: ChartSeries[];
    yValueFormatter?: (value: number) => string;
  }) {
    this.drawChartFrame(
      args.frameX,
      args.frameTop,
      args.frameWidth,
      args.frameHeight,
    );

    const innerLeft = args.frameX + (args.yValueFormatter ? 54 : 42);
    const innerRight = args.frameX + args.frameWidth - 10;
    const innerTop = args.frameTop + 16;
    const innerBottom = args.frameTop + args.frameHeight - 24;
    const plotWidth = innerRight - innerLeft;
    const plotHeight = innerBottom - innerTop;
    const allValues = args.series.flatMap((series) => series.values);
    const maxValue = Math.max(...allValues, 0);

    if (maxValue <= 0 || args.labels.length === 0) {
      this.currentPage.drawText(
        args.frameX + args.frameWidth / 2,
        args.frameTop + args.frameHeight / 2 - 4,
        'No chart data available for this window.',
        {
          align: 'center',
          color: TEXT_MUTED,
          fontSize: 10,
        },
      );
      return;
    }

    this.drawChartGrid(
      innerLeft,
      innerTop,
      plotWidth,
      plotHeight,
      maxValue,
      args.yValueFormatter,
    );

    args.series.forEach((series) => {
      const points = series.values.map((value, index) => {
        const x =
          innerLeft +
          (args.labels.length === 1
            ? plotWidth / 2
            : (index / (args.labels.length - 1)) * plotWidth);
        const y = innerBottom - (value / maxValue) * plotHeight;
        return { x, top: y };
      });

      this.currentPage.drawPolyline(points, {
        lineWidth: 2.1,
        strokeColor: series.color,
      });
    });

    this.drawXAxisLabels(innerLeft, innerBottom + 8, plotWidth, args.labels);
  }

  private drawPieChart(
    x: number,
    top: number,
    width: number,
    size: number,
    slices: Array<{ color: PdfColor; label: string; value: number }>,
  ) {
    const chartSize = Math.min(width * 0.72, size);
    const centerX = x + chartSize / 2;
    const centerTop = top + chartSize / 2;
    const radius = chartSize / 2 - 4;
    const total = sum(slices.map((slice) => slice.value));

    if (total <= 0) {
      this.currentPage.drawText(centerX, centerTop, 'No revenue mix data', {
        align: 'center',
        color: TEXT_MUTED,
        fontSize: 10,
      });
      return;
    }

    let startAngle = -Math.PI / 2;
    slices.forEach((slice) => {
      const arc = (slice.value / total) * Math.PI * 2;
      const stepCount = Math.max(6, Math.ceil((arc * 180) / Math.PI / 12));
      const points: PdfPoint[] = [{ x: centerX, top: centerTop }];

      for (let index = 0; index <= stepCount; index += 1) {
        const angle = startAngle + (arc * index) / stepCount;
        points.push({
          x: centerX + Math.cos(angle) * radius,
          top: centerTop + Math.sin(angle) * radius,
        });
      }

      this.currentPage.drawPolygon(points, {
        fillColor: slice.color,
        lineWidth: 0.5,
        strokeColor: [1, 1, 1],
      });
      startAngle += arc;
    });
  }

  private ensureSpace(height: number) {
    if (this.cursorY + height <= PAGE_HEIGHT - PAGE_MARGIN_BOTTOM) {
      return;
    }

    this.addPage();
  }

  private addPage() {
    this.currentPage = this.document.addPage();
    this.currentPage.drawRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, {
      fillColor: [1, 1, 1],
    });
    this.cursorY = PAGE_MARGIN_TOP;
  }

  private describeWindow(startDate: string, endDate: string) {
    return `${new Date(startDate).toLocaleDateString('en-PH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })} to ${new Date(endDate).toLocaleDateString('en-PH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }

  private getPeakAttendanceLabel(attendance: AnalyticsAttendanceResponseDTO) {
    if (attendance.peak_hours.length === 0) {
      return 'no concentrated peaks recorded';
    }

    return attendance.peak_hours
      .slice(0, 3)
      .map((entry) => `${entry.hour_label} (${entry.check_ins})`)
      .join(', ');
  }
}

export function buildAnalyticsPdfBuffer(args: BuildAnalyticsPdfArgs) {
  const composer = new AnalyticsPdfComposer();
  return composer.build(args);
}
