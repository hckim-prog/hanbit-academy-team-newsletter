import { JWT } from "google-auth-library";
import type { RawReport } from "./types";

const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID ??
  "1M1U0-RTNhlkS9bWvOaALYHW7Mup8sxXboS2wZJPwpN8";
const SHEET_NAME = process.env.GOOGLE_SHEETS_SOURCE_SHEET ?? "김호철";
const SOURCE_HEADER = "주간업무보고(2주간격)";
const RANGE = `${SHEET_NAME}!A1:F1200`;

type SheetsValuesResponse = {
  values?: string[][];
};

export async function getLatestReport(): Promise<RawReport> {
  const rows = await readSheetValues();
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
      sourceRange: `${SHEET_NAME}!A${reportIndex + 1}:F${reportIndex + 1}`,
      signals: reportRow[1] ?? "",
      operations: reportRow[2] ?? "",
      support: reportRow[3] ?? "",
      request: reportRow[4] ?? "",
      next: reportRow[5] ?? "",
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

async function readSheetValues(): Promise<string[][]> {
  const encodedRange = encodeURIComponent(RANGE);
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedRange}`;
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const accessToken = apiKey ? null : await getServiceAccountAccessToken();
  const url = apiKey ? `${baseUrl}?key=${apiKey}` : baseUrl;

  const response = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
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
