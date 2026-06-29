import { JWT } from "google-auth-library";
import type { RawReport, ReportSourceId } from "./types";
import { stripSourceListNumbering } from "./korean-style";

const SOURCE_HEADER = "주간업무보고(2주간격)";

const REPORT_SOURCES: Record<ReportSourceId, { spreadsheetId: string; sheetId: number }> = {
  "kim-hochul": {
    spreadsheetId:
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID ??
      "1M1U0-RTNhlkS9bWvOaALYHW7Mup8sxXboS2wZJPwpN8",
    sheetId: 88343512,
  },
  "kim-taejin": {
    spreadsheetId: "1XxHN1CdHfEwWqzm71pE0iUsbco9WzPm7QzpM2wTxlHw",
    sheetId: 1023956755,
  },
  "son-hyejin": {
    spreadsheetId: "1XxHN1CdHfEwWqzm71pE0iUsbco9WzPm7QzpM2wTxlHw",
    sheetId: 716862879,
  },
};

type SheetsValuesResponse = {
  values?: string[][];
};

type SpreadsheetMetadataResponse = {
  sheets?: Array<{
    properties?: {
      sheetId?: number;
      title?: string;
    };
  }>;
};

type SheetsAuthorization = {
  apiKey?: string;
  accessToken?: string;
};

export function isReportSourceId(value: unknown): value is ReportSourceId {
  return typeof value === "string" && value in REPORT_SOURCES;
}

export async function getLatestReport(sourceId: ReportSourceId = "kim-hochul"): Promise<RawReport> {
  return (await getLatestReports([sourceId]))[0];
}

export async function getLatestReports(sourceIds: ReportSourceId[]): Promise<RawReport[]> {
  const authorization = await getSheetsAuthorization();
  return Promise.all(sourceIds.map((sourceId) => getLatestReportFromSource(sourceId, authorization)));
}

async function getLatestReportFromSource(
  sourceId: ReportSourceId,
  authorization: SheetsAuthorization,
): Promise<RawReport> {
  const source = REPORT_SOURCES[sourceId];
  const sheetName = await resolveSheetName(source.spreadsheetId, source.sheetId, authorization);
  const rows = await readSheetValues(source.spreadsheetId, sheetName, authorization);
  const candidates: RawReport[] = [];

  rows.forEach((row, index) => {
    if ((row[0] ?? "").trim() !== SOURCE_HEADER) {
      return;
    }

    const reportIndex = findNextReportRowIndex(rows, index + 1);
    if (reportIndex === -1) {
      return;
    }

    const reportRow = rows[reportIndex];
    const parsed = parseKoreanMonthDay(reportRow[0] ?? "");
    if (!parsed) {
      return;
    }

    candidates.push({
      displayDate: reportRow[0] ?? "",
      parsedTime: parsed.getTime(),
      sourceRange: `${sheetName}!A${reportIndex + 1}:F${reportIndex + 1}`,
      signals: stripSourceListNumbering(reportRow[1] ?? ""),
      operations: stripSourceListNumbering(reportRow[2] ?? ""),
      support: stripSourceListNumbering(reportRow[3] ?? ""),
      request: stripSourceListNumbering(reportRow[4] ?? ""),
      next: stripSourceListNumbering(reportRow[5] ?? ""),
    });
  });

  if (!candidates.length) {
    throw new Error(`'${SOURCE_HEADER}' 아래의 날짜 보고 행을 찾지 못했습니다.`);
  }

  candidates.sort((a, b) => b.parsedTime - a.parsedTime);
  return candidates[0];
}

function findNextReportRowIndex(rows: string[][], startIndex: number): number {
  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) {
      continue;
    }

    const firstCell = (row[0] ?? "").trim();
    if (index > startIndex && firstCell === SOURCE_HEADER) {
      return -1;
    }

    if (parseKoreanMonthDay(firstCell)) {
      return index;
    }
  }

  return -1;
}

async function resolveSheetName(
  spreadsheetId: string,
  sheetId: number,
  authorization: SheetsAuthorization,
): Promise<string> {
  const query = new URLSearchParams({ fields: "sheets.properties(sheetId,title)" });
  if (authorization.apiKey) {
    query.set("key", authorization.apiKey);
  }

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?${query}`, {
    headers: authorization.accessToken
      ? { Authorization: `Bearer ${authorization.accessToken}` }
      : undefined,
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Google Sheets 탭 확인에 실패했습니다. HTTP ${response.status}: ${detail.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as SpreadsheetMetadataResponse;
  const sheetName = data.sheets
    ?.map((sheet) => sheet.properties)
    .find((properties) => properties?.sheetId === sheetId)?.title;

  if (!sheetName) {
    throw new Error("선택한 Google Sheets 탭을 찾지 못했습니다.");
  }

  return sheetName;
}

async function readSheetValues(
  spreadsheetId: string,
  sheetName: string,
  authorization: SheetsAuthorization,
): Promise<string[][]> {
  const encodedRange = encodeURIComponent(`${sheetName}!A1:F1200`);
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`;
  const url = authorization.apiKey ? `${baseUrl}?key=${authorization.apiKey}` : baseUrl;

  const response = await fetch(url, {
    headers: authorization.accessToken
      ? { Authorization: `Bearer ${authorization.accessToken}` }
      : undefined,
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Google Sheets 읽기에 실패했습니다. HTTP ${response.status}: ${detail.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as SheetsValuesResponse;
  return data.values ?? [];
}

async function getSheetsAuthorization(): Promise<SheetsAuthorization> {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (apiKey) {
    return { apiKey };
  }

  return { accessToken: await getServiceAccountAccessToken() };
}

async function getServiceAccountAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new Error(
      "Google Sheet 읽기 권한이 필요합니다. GOOGLE_SHEETS_API_KEY 또는 GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_PRIVATE_KEY를 설정해 주세요.",
    );
  }

  const client = new JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const token = await client.getAccessToken();
  if (!token.token) {
    throw new Error("Google 서비스 계정 액세스 토큰을 만들지 못했습니다.");
  }

  return token.token;
}

function parseKoreanMonthDay(value: string): Date | null {
  const match = value.trim().match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (!match) {
    return null;
  }

  const year = new Date().getFullYear();
  return new Date(year, Number(match[1]) - 1, Number(match[2]));
}
