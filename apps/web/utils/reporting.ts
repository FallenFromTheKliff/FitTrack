"use client";

type OpenReportPrintViewArgs = {
  elementId: string;
  title: string;
};

type SpreadsheetCell =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date;

type SpreadsheetSection = {
  title: string;
  columns: string[];
  rows: SpreadsheetCell[][];
};

type DownloadExcelCompatibleReportArgs = {
  fileName: string;
  sections: SpreadsheetSection[];
  title?: string;
};

function serializeDocumentStyles() {
  return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");
}

export function openReportPrintView({
  elementId,
  title
}: OpenReportPrintViewArgs) {
  if (typeof window === "undefined") return false;

  const reportElement = document.getElementById(elementId);
  if (!reportElement) return false;

  const printWindow = window.open("", "_blank", "width=1280,height=900");
  if (!printWindow) return false;

  const styles = serializeDocumentStyles();

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${styles}
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }

      body {
        padding: 28px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      button,
      select,
      [data-print-hidden="true"] {
        display: none !important;
      }

      .recharts-responsive-container {
        min-height: 220px;
      }
    </style>
  </head>
  <body>
    ${reportElement.outerHTML}
  </body>
</html>`);
  printWindow.document.close();
  printWindow.focus();

  window.setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);

  return true;
}

function toSpreadsheetValue(value: SpreadsheetCell) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "";
  return String(value);
}

function escapeSpreadsheetCell(value: SpreadsheetCell) {
  const normalized = toSpreadsheetValue(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const escaped = normalized.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

function buildSpreadsheetCsv({
  sections,
  title
}: Pick<DownloadExcelCompatibleReportArgs, "sections" | "title">) {
  const lines: string[] = [];

  if (title) {
    lines.push(escapeSpreadsheetCell(title));
    lines.push(escapeSpreadsheetCell(`Exported at ${new Date().toLocaleString()}`));
    lines.push("");
  }

  sections.forEach((section, index) => {
    lines.push(escapeSpreadsheetCell(section.title));
    lines.push(section.columns.map((column) => escapeSpreadsheetCell(column)).join(","));

    section.rows.forEach((row) => {
      lines.push(row.map((cell) => escapeSpreadsheetCell(cell)).join(","));
    });

    if (index < sections.length - 1) {
      lines.push("");
    }
  });

  return `\uFEFF${lines.join("\r\n")}`;
}

export function downloadExcelCompatibleReport({
  fileName,
  sections,
  title
}: DownloadExcelCompatibleReportArgs) {
  if (typeof window === "undefined") return false;
  if (sections.length === 0) return false;

  const csv = buildSpreadsheetCsv({ sections, title });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(blobUrl);

  return true;
}
