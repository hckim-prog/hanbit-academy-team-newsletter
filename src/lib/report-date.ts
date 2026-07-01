type NormalizeReportDateOptions = {
  spreadsheetTitle?: string;
  reportYear?: number;
  currentYear?: number;
};

export function normalizeReportDate(
  value: string,
  options: NormalizeReportDateOptions = {},
): string | null {
  const source = value.trim();
  const explicit = source.match(/^(\d{4})\s*(?:년|[./-])\s*(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*일?$/u);
  if (explicit) {
    return validIsoDate(Number(explicit[1]), Number(explicit[2]), Number(explicit[3]));
  }

  const monthDay = source.match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일$/u);
  if (!monthDay) {
    return null;
  }

  const titleYear = options.spreadsheetTitle?.match(/(20\d{2})\s*년?/u)?.[1];
  const year = titleYear
    ? Number(titleYear)
    : options.reportYear ?? options.currentYear ?? new Date().getFullYear();
  return validIsoDate(year, Number(monthDay[1]), Number(monthDay[2]));
}

export function reportDateTimestamp(value: string): number {
  return new Date(`${value}T00:00:00+09:00`).getTime();
}

function validIsoDate(year: number, month: number, day: number): string | null {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
