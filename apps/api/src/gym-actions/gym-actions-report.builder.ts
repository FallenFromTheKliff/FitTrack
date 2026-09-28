import type {
  GymActionsReportDTO,
  GymActionsReportRowDTO,
} from './gym-actions-report.dto';

type PdfFont = 'regular' | 'bold';
type PdfColor = [number, number, number];

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 40;
const MARGIN_TOP = 38;
const MARGIN_BOTTOM = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const TABLE_INNER_PADDING = 8;
const TABLE_COLUMN_GAP = 8;
const TABLE_COLUMNS_WIDTH =
  CONTENT_WIDTH - TABLE_INNER_PADDING * 2 - TABLE_COLUMN_GAP * 3;
const TABLE_COLUMN_WIDTHS = {
  primary: 105,
  details: 190,
  status: 88,
  occurred: TABLE_COLUMNS_WIDTH - 105 - 190 - 88,
} as const;
const ACCENT: PdfColor = [0.9176, 0.3451, 0.0314];
const PRIMARY: PdfColor = [0.0784, 0.1059, 0.1647];
const SECONDARY: PdfColor = [0.4039, 0.4471, 0.5216];
const MUTED: PdfColor = [0.5529, 0.5922, 0.6667];
const BORDER: PdfColor = [0.8588, 0.8784, 0.9137];
const PANEL: PdfColor = [0.9804, 0.9843, 0.9922];

function normalizePdfText(value: string): string {
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
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

function encodePdfText(value: string): string {
  return normalizePdfText(value)
    .replace(/\s\?\s/g, ' - ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function color(value: PdfColor): string {
  return value.map((part) => part.toFixed(3)).join(' ');
}

function textWidth(value: string, size: number, font: PdfFont): number {
  let units = 0;
  for (const character of normalizePdfText(value)) {
    if (character === ' ') units += 0.3;
    else if (/[A-Z0-9]/.test(character)) units += font === 'bold' ? 0.62 : 0.6;
    else if (/[ilI.,:;!'"/]/u.test(character)) units += 0.24;
    else if (/[mwMW@#%&]/u.test(character)) units += 0.86;
    else units += font === 'bold' ? 0.56 : 0.54;
  }
  return units * size;
}

function splitLongWord(
  value: string,
  maxWidth: number,
  size: number,
  font: PdfFont,
): string[] {
  if (textWidth(value, size, font) <= maxWidth) return [value];

  const chunks: string[] = [];
  let remaining = value;
  while (remaining) {
    const remainingWidth = textWidth(remaining, size, font);
    const linesRemaining = Math.ceil(remainingWidth / maxWidth);
    if (linesRemaining <= 1) {
      chunks.push(remaining);
      break;
    }

    const targetWidth = remainingWidth / linesRemaining;
    const minimumWidth = Math.max(
      0,
      remainingWidth - maxWidth * (linesRemaining - 1),
    );
    let bestEnd = 0;
    let bestWidth = 0;
    let candidateWidth = 0;
    for (let index = 0; index < remaining.length; index += 1) {
      candidateWidth = textWidth(remaining.slice(0, index + 1), size, font);
      if (candidateWidth > maxWidth) break;
      if (candidateWidth < minimumWidth) continue;
      if (
        bestEnd === 0 ||
        Math.abs(candidateWidth - targetWidth) <
          Math.abs(bestWidth - targetWidth)
      ) {
        bestEnd = index + 1;
        bestWidth = candidateWidth;
      }
    }

    if (bestEnd === 0) {
      for (let index = 0; index < remaining.length; index += 1) {
        candidateWidth = textWidth(remaining.slice(0, index + 1), size, font);
        if (candidateWidth > maxWidth) break;
        bestEnd = index + 1;
      }
    }

    chunks.push(remaining.slice(0, bestEnd));
    remaining = remaining.slice(bestEnd);
  }

  return chunks;
}

function wrapText(
  value: string,
  maxWidth: number,
  size: number,
  font: PdfFont,
): string[] {
  const normalized = normalizePdfText(value);
  if (!normalized) return ['-'];

  const lines: string[] = [];
  let current = '';
  for (const word of normalized.split(/\s+/)) {
    const wordChunks = splitLongWord(word, maxWidth, size, font);
    if (wordChunks.length > 1) {
      if (current) lines.push(current);
      lines.push(...wordChunks.slice(0, -1));
      current = wordChunks[wordChunks.length - 1];
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size, font) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

class PdfPage {
  private readonly commands: string[] = [];

  drawRect(
    x: number,
    top: number,
    width: number,
    height: number,
    fillColor?: PdfColor,
    strokeColor?: PdfColor,
  ) {
    const y = PAGE_HEIGHT - top - height;
    if (fillColor) this.commands.push(`${color(fillColor)} rg`);
    if (strokeColor) this.commands.push(`${color(strokeColor)} RG`);
    this.commands.push(
      `${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${fillColor && strokeColor ? 'B' : fillColor ? 'f' : 'S'}`,
    );
  }

  drawLine(
    x1: number,
    top: number,
    x2: number,
    strokeColor: PdfColor = BORDER,
  ) {
    const y = PAGE_HEIGHT - top;
    this.commands.push(
      `${color(strokeColor)} RG`,
      `0.70 w`,
      `${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`,
    );
  }

  drawText(
    x: number,
    top: number,
    value: string,
    options: { color?: PdfColor; font?: PdfFont; size?: number } = {},
  ) {
    const font = options.font === 'bold' ? '/F2' : '/F1';
    const size = options.size ?? 10;
    const safe = encodePdfText(value);
    const y = PAGE_HEIGHT - top - size;
    this.commands.push(
      'BT',
      `${font} ${size.toFixed(2)} Tf`,
      `${color(options.color ?? PRIMARY)} rg`,
      `1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${safe}) Tj`,
      'ET',
    );
  }

  toStream(): string {
    return this.commands.join('\n');
  }
}

class PdfDocument {
  private readonly pages: PdfPage[] = [];

  addPage(): PdfPage {
    const page = new PdfPage();
    this.pages.push(page);
    return page;
  }

  toBuffer(): Buffer {
    const objects: Buffer[] = [];
    const pushObject = (body: string | Buffer): number => {
      objects.push(
        typeof body === 'string' ? Buffer.from(body, 'ascii') : body,
      );
      return objects.length;
    };

    const regularFont = pushObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    );
    const boldFont = pushObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    );
    const pageIds: number[] = [];
    for (const page of this.pages) {
      const stream = Buffer.from(page.toStream(), 'ascii');
      const streamId = pushObject(
        Buffer.concat([
          Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'ascii'),
          stream,
          Buffer.from('\nendstream', 'ascii'),
        ]),
      );
      pageIds.push(
        pushObject(
          `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 ${regularFont} 0 R /F2 ${boldFont} 0 R >> >> /Contents ${streamId} 0 R >>`,
        ),
      );
    }

    const pagesId = pushObject(
      `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`,
    );
    const catalogId = pushObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    for (const pageId of pageIds) {
      const page = objects[pageId - 1].toString('ascii');
      objects[pageId - 1] = Buffer.from(
        page.replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`),
        'ascii',
      );
    }

    let output = '%PDF-1.4\n%FitTrack Gym Actions\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(output, 'ascii'));
      output += `${index + 1} 0 obj\n${object.toString('ascii')}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(output, 'ascii');
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let index = 1; index < offsets.length; index += 1) {
      output += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(output, 'ascii');
  }
}

type ReportRow = Pick<
  GymActionsReportRowDTO,
  'actor' | 'amount' | 'occurred_at' | 'primary' | 'secondary' | 'status'
>;

type PdfColumnKey = 'primary' | 'details' | 'status' | 'occurred';

type PdfColumn = {
  key: PdfColumnKey;
  x: number;
  width: number;
};

const ISO_TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(?=\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$)/;

function formatPdfTimestamp(value: string): string {
  const normalized = normalizePdfText(value);
  const match = normalized.match(ISO_TIMESTAMP_PATTERN);
  return match
    ? `${match[1]} ${normalized.slice(match[0].length)}`
    : normalized;
}

function createTableColumns(): PdfColumn[] {
  const columns: PdfColumn[] = [];
  let x = MARGIN_X + TABLE_INNER_PADDING;
  const keys: PdfColumnKey[] = ['primary', 'details', 'status', 'occurred'];
  keys.forEach((key, index) => {
    columns.push({ key, x, width: TABLE_COLUMN_WIDTHS[key] });
    x += TABLE_COLUMN_WIDTHS[key];
    if (index < keys.length - 1) x += TABLE_COLUMN_GAP;
  });
  return columns;
}

function rowCell(
  row: ReportRow,
  key: 'primary' | 'details' | 'status' | 'occurred',
): string {
  switch (key) {
    case 'primary':
      return row.primary;
    case 'details':
      return (
        [row.secondary, row.actor ? `By ${row.actor}` : undefined]
          .filter(Boolean)
          .join(' · ') || '-'
      );
    case 'status': {
      const amount =
        row.amount === undefined
          ? undefined
          : `PHP ${row.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return [row.status, amount].filter(Boolean).join(' · ') || '-';
    }
    case 'occurred':
      return formatPdfTimestamp(row.occurred_at ?? '-');
  }
}

export function buildGymActionsPdf(input: GymActionsReportDTO): Buffer {
  const document = new PdfDocument();
  let page = document.addPage();
  let cursor = MARGIN_TOP;
  const columns = createTableColumns();

  const drawReportHeader = () => {
    page.drawRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, [1, 1, 1]);
    page.drawRect(MARGIN_X, cursor, 150, 4, ACCENT);
    cursor += 16;
    page.drawText(MARGIN_X, cursor, 'FitTrack Gym Actions', {
      color: ACCENT,
      font: 'bold',
      size: 11,
    });
    cursor += 20;
    page.drawText(MARGIN_X, cursor, input.title, {
      color: PRIMARY,
      font: 'bold',
      size: 24,
    });
    cursor += 32;
    page.drawText(MARGIN_X, cursor, input.section_label, {
      color: SECONDARY,
      font: 'bold',
      size: 11,
    });
    cursor += 18;
    page.drawText(
      MARGIN_X,
      cursor,
      `Matching records: ${input.total_records.toLocaleString('en-US')}`,
      {
        color: PRIMARY,
        font: 'bold',
        size: 11,
      },
    );
    cursor += 20;
    for (const filter of input.filter_summaries ?? []) {
      const lines = wrapText(`Filter: ${filter}`, CONTENT_WIDTH, 9, 'regular');
      for (const line of lines) {
        page.drawText(MARGIN_X, cursor, line, { color: SECONDARY, size: 9 });
        cursor += 12;
      }
    }
    cursor += 8;
    page.drawLine(MARGIN_X, cursor, PAGE_WIDTH - MARGIN_X);
    cursor += 16;
  };

  const drawTableHeader = () => {
    page.drawRect(MARGIN_X, cursor - 4, CONTENT_WIDTH, 22, PANEL, BORDER);
    const labels: Record<PdfColumnKey, string> = {
      primary: 'RECORD',
      details: 'DETAILS',
      status: 'STATUS / VALUE',
      occurred: 'OCCURRED',
    };
    for (const column of columns) {
      page.drawText(column.x, cursor, labels[column.key], {
        color: MUTED,
        font: 'bold',
        size: 7.5,
      });
    }
    cursor += 28;
  };

  drawReportHeader();
  drawTableHeader();

  if (input.rows.length === 0) {
    page.drawText(
      MARGIN_X,
      cursor,
      'No matching records for the applied filters.',
      {
        color: SECONDARY,
        size: 10,
      },
    );
  } else {
    input.rows.forEach((row, index) => {
      const lineSets = columns.map((column) =>
        wrapText(rowCell(row, column.key), column.width, 8.5, 'regular'),
      );
      const rowHeight =
        Math.max(...lineSets.map((lines) => lines.length)) * 11 + 12;
      if (cursor + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        page = document.addPage();
        cursor = MARGIN_TOP;
        drawReportHeader();
        drawTableHeader();
      }

      if (index % 2 === 0) {
        page.drawRect(
          MARGIN_X,
          cursor - 5,
          CONTENT_WIDTH,
          rowHeight,
          [0.996, 0.997, 1],
        );
      }
      lineSets.forEach((lines, columnIndex) => {
        lines.forEach((line, lineIndex) => {
          page.drawText(columns[columnIndex].x, cursor + lineIndex * 11, line, {
            color: columnIndex === 0 ? PRIMARY : SECONDARY,
            font: columnIndex === 0 ? 'bold' : 'regular',
            size: 8.5,
          });
        });
      });
      cursor += rowHeight;
      page.drawLine(MARGIN_X, cursor - 4, PAGE_WIDTH - MARGIN_X, BORDER);
    });
  }

  return document.toBuffer();
}
