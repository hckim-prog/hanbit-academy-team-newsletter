import type { ReportSource, ReportSourceId } from "./types";

export const REPORT_SOURCES: Record<ReportSourceId, ReportSource> = {
  "kim-hochul": {
    id: "kim-hochul",
    sourcePerson: "김호철",
    documentType: "leader",
    spreadsheetId: "1M1U0-RTNhlkS9bWvOaALYHW7Mup8sxXboS2wZJPwpN8",
    sheetId: 88343512,
    expectedSpreadsheetTitle: "리더그룹 주간업무관리_한빛아카데미(2026년)",
    expectedSheetTitle: "김호철",
    parser: "leader",
    reportYear: 2026,
  },
  "kim-taejin": {
    id: "kim-taejin",
    sourcePerson: "김태진",
    documentType: "member",
    spreadsheetId: "1XxHN1CdHfEwWqzm71pE0iUsbco9WzPm7QzpM2wTxlHw",
    sheetId: 1023956755,
    expectedSpreadsheetTitle: "[아카데미 디콘TF]_업무 소통(26년)",
    expectedSheetTitle: "김태진",
    parser: "member",
    reportYear: 2026,
  },
  "son-hyejin": {
    id: "son-hyejin",
    sourcePerson: "손혜진",
    documentType: "member",
    spreadsheetId: "1XxHN1CdHfEwWqzm71pE0iUsbco9WzPm7QzpM2wTxlHw",
    sheetId: 716862879,
    expectedSpreadsheetTitle: "[아카데미 디콘TF]_업무 소통(26년)",
    expectedSheetTitle: "손혜진",
    parser: "member",
    reportYear: 2026,
  },
};

export function isReportSourceId(value: unknown): value is ReportSourceId {
  return typeof value === "string" && value in REPORT_SOURCES;
}

export function getReportSource(sourceId: ReportSourceId): ReportSource {
  const source = REPORT_SOURCES[sourceId];
  if (sourceId !== "kim-hochul" || !process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    return source;
  }

  return { ...source, spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID };
}
