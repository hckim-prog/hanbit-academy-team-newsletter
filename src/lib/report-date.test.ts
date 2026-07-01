import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReportDate } from "./report-date";

test("지원하는 보고 날짜 형식을 YYYY-MM-DD로 정규화한다", () => {
  for (const value of ["2026-06-26", "2026.06.26", "2026/06/26", "2026년 6월 26일"]) {
    assert.equal(normalizeReportDate(value), "2026-06-26");
  }
});

test("연도 없는 날짜는 문서 제목, reportYear, 현재 연도 순서로 해석한다", () => {
  assert.equal(
    normalizeReportDate("6월 26일", { spreadsheetTitle: "리더그룹 주간업무관리_한빛아카데미(2026년)", reportYear: 2025 }),
    "2026-06-26",
  );
  assert.equal(normalizeReportDate("6월 26일", { reportYear: 2026, currentYear: 2024 }), "2026-06-26");
  assert.equal(normalizeReportDate("6월 26일", { currentYear: 2027 }), "2027-06-26");
});

test("실제로 존재하지 않는 날짜는 거부한다", () => {
  assert.equal(normalizeReportDate("2026-02-30"), null);
});
