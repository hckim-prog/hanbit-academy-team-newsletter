import { JWT } from "google-auth-library";
import type { RawReport } from "./types";

const DEFAULT_PRIMARY_SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID ??
  "1M1U0-RTNhlkS9bWvOaALYHW7Mup8sxXboS2wZJPwpN8";
const DEFAULT_PRIMARY_SHEET = process.env.GOOGLE_SHEETS_SOURCE_SHEET ?? "김호철";
const DEFAULT_MEMBER_SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_MEMBER_SPREADSHEET_ID ??
  "1XxHN1CdHfEwWqzm71pE0iUsbco9WzPm7QzpM2wTxlHw";
const DEFAULT_MEMBER_SHEETS = process.env.GOOGLE_SHEETS_MEMBER_SHEETS ?? "김태진,손혜진";
const SOURCE_HEADER = "주간업무보고(2주간격)";
const READ_RANGE = "A1:F1200";
const MIN_CONTENT_CELLS = 2;
const SOURCE_BLOCK_SEPARATOR = "\n\n---SOURCE---\n\n";

type SheetSource = {
  name: string;
  spreadsheetId: string;
  sheetName: string;
  role: "primary" | "member";
};

type SheetsValuesResponse = {
  values?: string[][];
};

export async function getLatestReport(): Promise<RawReport> {
  const sources = getSheetSources();
  const [primarySource, ...memberSources] = sources;
  if (!primarySource) {
    throw new Error("뉴스레터를 만들 기본 시트 소스가 없습니다.");
  }

  const primaryReport = await readLatestReportFromSource(primarySource);
  if (!primaryReport) {
    throw new Error(`'${primarySource.sheetName}' 시트에서 '${SOURCE_HEADER}' 아래의 날짜 보고 행을 찾지 못했습니다.`);
  }

  const memberResults = await Promise.allSettled(memberSources.map(readLatestReportFromSource));
  const memberReports = memberResults
    .filter((result): result is PromiseFulfilledResult<RawReport | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((report): report is RawReport => Boolean(report));

  return mergeReports(primaryReport, memberReports);
}

async function readLatestReportFromSource(source: SheetSource): Promise<RawReport | null> {
  const rows = await readSheetValues(source);
  const candidates: RawReport[] = [];

  rows.forEach((row, index) => {
    if ((row[0] ?? "").trim() !== SOURCE_HEADER) {
      return;
    }

    const reportIndex = index + 1;
    const reportRow = rows[reportIndex];
    if (!reportRow) {
      return;
    }

    const parsed = parseKoreanMonthDay(reportRow[0] ?? "");
    if (!parsed) {
      return;
    }

    if (!hasEnoughReportContent(reportRow)) {
      return;
    }

    const sourceRange = `${source.sheetName}!A${reportIndex + 1}:F${reportIndex + 1}`;
    candidates.push({
      displayDate: reportRow[0] ?? "",
      parsedTime: parsed.getTime(),
      sourceRange,
      sources: [
        {
          name: source.name,
          displayDate: reportRow[0] ?? "",
          parsedTime: parsed.getTime(),
          sourceRange,
        },
      ],
      signals: reportRow[1] ?? "",
      operations: reportRow[2] ?? "",
      support: reportRow[3] ?? "",
      request: reportRow[4] ?? "",
      next: reportRow[5] ?? "",
    });
  });

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => b.parsedTime - a.parsedTime);
  return candidates[0];
}

async function readSheetValues(source: SheetSource): Promise<string[][]> {
  const range = `${source.sheetName}!${READ_RANGE}`;
  const encodedRange = encodeURIComponent(range);
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${source.spreadsheetId}/values/${encodedRange}`;
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

function getSheetSources(): SheetSource[] {
  const explicitSources = parseExplicitSources(process.env.GOOGLE_SHEETS_SOURCES);
  if (explicitSources.length) {
    return explicitSources;
  }

  const primary: SheetSource = {
    name: DEFAULT_PRIMARY_SHEET,
    spreadsheetId: DEFAULT_PRIMARY_SPREADSHEET_ID,
    sheetName: DEFAULT_PRIMARY_SHEET,
    role: "primary",
  };
  const members = DEFAULT_MEMBER_SHEETS.split(",")
    .map((sheetName) => sheetName.trim())
    .filter(Boolean)
    .map<SheetSource>((sheetName) => ({
      name: sheetName,
      spreadsheetId: DEFAULT_MEMBER_SPREADSHEET_ID,
      sheetName,
      role: "member",
    }));

  return [primary, ...members];
}

function parseExplicitSources(value: string | undefined): SheetSource[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [name, spreadsheetId, sheetName] = entry.split(":").map((part) => part.trim());
      if (!name || !spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_SOURCES는 이름:스프레드시트ID:시트명 형식으로 입력해 주세요.");
      }

      return {
        name,
        spreadsheetId,
        sheetName: sheetName || name,
        role: index === 0 ? "primary" : "member",
      };
    });
}

function mergeReports(primaryReport: RawReport, memberReports: RawReport[]): RawReport {
  const reports = [primaryReport, ...memberReports].sort((a, b) => {
    const roleOrder = a === primaryReport ? -1 : b === primaryReport ? 1 : 0;
    return roleOrder || b.parsedTime - a.parsedTime;
  });

  return {
    displayDate: primaryReport.displayDate,
    parsedTime: primaryReport.parsedTime,
    sourceRange: reports.map((report) => report.sourceRange).join(", "),
    sources: reports.flatMap((report) => report.sources),
    signals: joinReportBlocks(reports.map((report) => report.signals)),
    operations: joinReportBlocks(reports.map((report) => report.operations)),
    support: joinReportBlocks(reports.map((report) => report.support)),
    request: joinReportBlocks(reports.map((report) => report.request)),
    next: joinReportBlocks(reports.map((report) => report.next)),
  };
}

function joinReportBlocks(blocks: string[]): string {
  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .join(SOURCE_BLOCK_SEPARATOR);
}

function hasEnoughReportContent(row: string[]): boolean {
  const contentCells = row
    .slice(1, 6)
    .map((cell) => (cell ?? "").trim())
    .filter(Boolean);

  return contentCells.length >= MIN_CONTENT_CELLS;
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
