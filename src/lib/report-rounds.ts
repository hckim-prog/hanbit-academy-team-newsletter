import { normalizeReportDate, reportDateTimestamp } from "./report-date";
import { getReportSource } from "./report-sources";
import type { ReportRound, ReportSourceId } from "./types";

type RoundCandidate = {
  sourceId: ReportSourceId;
  reportDate: string;
  sourceRange: string;
};

export function createReportRound(
  leaderCandidate: RoundCandidate,
  memberCandidates: RoundCandidate[],
): ReportRound {
  const leaderSource = getReportSource(leaderCandidate.sourceId);
  if (leaderSource.documentType !== "leader") {
    throw new Error("회차 기준 보고서는 leader 문서여야 합니다.");
  }

  const anchorDate = normalizeCandidateDate(leaderCandidate);
  const anchorTime = reportDateTimestamp(anchorDate);
  const round: ReportRound = {
    roundId: anchorDate,
    anchorDate,
    leader: {
      sourceId: leaderSource.id,
      sourcePerson: leaderSource.sourcePerson,
      reportDate: anchorDate,
      sourceRange: leaderCandidate.sourceRange,
    },
    members: [],
    excludedCandidates: [],
    warnings: [],
  };

  for (const candidate of memberCandidates) {
    const source = getReportSource(candidate.sourceId);
    if (source.documentType !== "member") {
      throw new Error("팀원 회차 후보는 member 문서여야 합니다.");
    }

    const reportDate = normalizeCandidateDate(candidate);
    const dayDifference = Math.abs(reportDateTimestamp(reportDate) - anchorTime) / 86_400_000;
    const common = {
      sourceId: source.id,
      sourcePerson: source.sourcePerson,
      reportDate,
      sourceRange: candidate.sourceRange,
      dayDifference,
    };

    if (dayDifference <= 1) {
      round.members.push({ ...common, alignment: "included" });
    } else if (dayDifference === 2) {
      round.members.push({ ...common, alignment: "warning" });
      round.warnings.push(`${source.sourcePerson} 보고는 기준일과 2일 차이가 있어 확인이 필요합니다.`);
    } else {
      round.excludedCandidates.push(common);
    }
  }

  return round;
}

function normalizeCandidateDate(candidate: RoundCandidate): string {
  const source = getReportSource(candidate.sourceId);
  const normalized = normalizeReportDate(candidate.reportDate, {
    spreadsheetTitle: source.expectedSpreadsheetTitle,
    reportYear: source.reportYear,
  });
  if (!normalized) {
    throw new Error(`${source.sourcePerson} 보고 날짜를 해석할 수 없습니다: ${candidate.reportDate}`);
  }
  return normalized;
}
