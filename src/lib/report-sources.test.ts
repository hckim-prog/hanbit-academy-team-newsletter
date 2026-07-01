import assert from "node:assert/strict";
import test from "node:test";
import { REPORT_SOURCES, isReportSourceId } from "./report-sources";

test("보고서 소스는 팀장과 팀원 문서 유형을 구분한다", () => {
  assert.equal(REPORT_SOURCES["kim-hochul"].documentType, "leader");
  assert.equal(REPORT_SOURCES["kim-hochul"].parser, "leader");
  assert.equal(REPORT_SOURCES["kim-taejin"].documentType, "member");
  assert.equal(REPORT_SOURCES["son-hyejin"].documentType, "member");
});

test("보고서 소스에 실제 문서와 탭 식별 정보를 보관한다", () => {
  assert.equal(REPORT_SOURCES["kim-hochul"].sheetId, 88343512);
  assert.equal(REPORT_SOURCES["kim-hochul"].expectedSpreadsheetTitle, "리더그룹 주간업무관리_한빛아카데미(2026년)");
  assert.equal(REPORT_SOURCES["kim-taejin"].sheetId, 1023956755);
  assert.equal(REPORT_SOURCES["son-hyejin"].sheetId, 716862879);
  assert.equal(REPORT_SOURCES["kim-taejin"].expectedSpreadsheetTitle, "[아카데미 디콘TF]_업무 소통(26년)");
  assert.equal(isReportSourceId("unknown"), false);
});
