import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { GymActionsReportController } from './gym-actions-report.controller';
import { buildGymActionsPdf } from './gym-actions-report.builder';
import type { GymActionsReportDTO } from './gym-actions-report.dto';

function reportInput(rowCount: number): GymActionsReportDTO {
  return {
    filter_summaries: ['Aug 1, 2026 - Aug 28, 2026', 'Status: completed'],
    rows: Array.from({ length: rowCount }, (_, index) => ({
      actor: 'Staff A',
      amount: index % 2 === 0 ? 150 : undefined,
      occurred_at: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
      primary: `Member ${index + 1}`,
      secondary: 'QR check-in',
      status: 'Completed',
    })),
    section: 'attendance',
    section_label: 'Attendance',
    title: 'Gym Actions Report',
    total_records: rowCount,
  };
}

type PdfTextDraw = { x: number; y: number; text: string };

function pdfTextDraws(pdf: Buffer): PdfTextDraw[] {
  const source = pdf.toString('ascii');
  return Array.from(
    source.matchAll(
      /1 0 0 1 (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) Tm \(((?:\\.|[^\\)])*)\) Tj/g,
    ),
    (match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
      text: (match[3] ?? '').replace(/\\([\\()])/g, '$1'),
    }),
  );
}

function tableRightEdge(pdf: Buffer): number {
  const rectangles = Array.from(
    pdf.toString('ascii').matchAll(
      /(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) re B/g,
    ),
    (match) => ({
      x: Number(match[1]),
      width: Number(match[3]),
    }),
  );
  const table = rectangles.sort((left, right) => right.width - left.width)[0];
  expect(table).toBeDefined();
  return (table?.x ?? 0) + (table?.width ?? 0);
}

function longAttendanceInput(): GymActionsReportDTO {
  return {
    ...reportInput(0),
    rows: [
      {
        actor: '213d5d9f-b577-51b2-92f6-130aa0779ed8',
        occurred_at: '2026-08-25T14:45:00.000Z',
        primary: 'Bea Lorenzo',
        secondary: 'Not recorded · Closed',
        status: 'Completed',
      },
    ],
    total_records: 1,
  };
}

describe('Gym Actions PDF export', () => {
  it('renders report identity, filters, matching count, and normalized rows', () => {
    const pdf = buildGymActionsPdf(reportInput(2));
    const text = pdf.toString('ascii');

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('FitTrack Gym Actions');
    expect(text).toContain('Gym Actions Report');
    expect(text).toContain('Filter: Aug 1, 2026 - Aug 28, 2026');
    expect(text).toContain('Matching records: 2');
    expect(text).toContain('Member 1');
    expect(text).toContain('Member 2');
    expect(text).toContain('QR check-in');
  });

  it('creates additional PDF pages rather than allowing long rows to overlap', () => {
    const pdf = buildGymActionsPdf(reportInput(180));
    const text = pdf.toString('ascii');

    expect((text.match(/\/Type \/Page /g) ?? []).length).toBeGreaterThan(1);
    expect(text).toContain('Member 180');
    expect(text).toContain('Matching records: 180');
  });

  it('keeps long attendance details and timestamps readable within the table bounds', () => {
    const pdf = buildGymActionsPdf(longAttendanceInput());
    const draws = pdfTextDraws(pdf);
    const detailsHeader = draws.find((draw) => draw.text === 'DETAILS');
    const occurredHeader = draws.find((draw) => draw.text === 'OCCURRED');

    expect(detailsHeader).toBeDefined();
    expect(occurredHeader).toBeDefined();

    const detailsDraws = draws.filter(
      (draw) => draw.x === detailsHeader?.x && draw.text !== 'DETAILS',
    );
    const occurredDraws = draws.filter(
      (draw) => draw.x === occurredHeader?.x && draw.text !== 'OCCURRED',
    );
    const detailsText = detailsDraws.map((draw) => draw.text).join(' ');
    const occurredText = occurredDraws.map((draw) => draw.text).join(' ');
    const uuid = '213d5d9f-b577-51b2-92f6-130aa0779ed8';
    const timestamp = '2026-08-25T14:45:00.000Z';

    expect(detailsText).toContain('Not recorded - Closed');
    expect(detailsText.replace(/\s/g, '')).toContain(uuid);
    expect(detailsDraws.map((draw) => draw.text)).not.toContain(uuid.slice(-1));

    expect(occurredText).toMatch(/2026-08-25\s+14:45:00\.000Z/);
    expect(occurredText).not.toContain('T14:45');
    expect(occurredText.replace(/\s/g, '')).toContain(timestamp.replace('T', ''));

    const rightEdge = tableRightEdge(pdf);
    expect(draws.every((draw) => draw.x <= rightEdge)).toBe(true);
  });

  it('locks the export route to authenticated admin and staff users', () => {
    const exportHandler = Object.getOwnPropertyDescriptor(
      GymActionsReportController.prototype,
      'exportPdf',
    )?.value as object;
    const guards = Reflect.getMetadata(GUARDS_METADATA, exportHandler) as
      | unknown[]
      | undefined;
    const roles = Reflect.getMetadata(ROLES_KEY, exportHandler) as
      | UserRole[]
      | undefined;

    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(roles).toEqual([UserRole.admin, UserRole.staff]);
  });

  it('writes an attachment response using the generated PDF buffer', () => {
    const setHeader = jest.fn();
    const send = jest.fn();
    const controller = new GymActionsReportController();

    controller.exportPdf(reportInput(1), { setHeader, send } as never);

    expect(setHeader).toHaveBeenCalledWith('content-type', 'application/pdf');
    expect(setHeader).toHaveBeenCalledWith(
      'content-disposition',
      'attachment; filename="fittrack-gym-actions-export.pdf"',
    );
    expect(send).toHaveBeenCalledWith(expect.any(Buffer));
  });
});
