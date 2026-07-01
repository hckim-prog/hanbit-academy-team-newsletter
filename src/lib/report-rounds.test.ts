import assert from "node:assert/strict";
import test from "node:test";
import { createReportRound } from "./report-rounds";

test("팀장 기준일과 하루 이내의 팀원 보고를 같은 회차로 묶는다", () => {
  const round = createReportRound(
    { sourceId: "kim-hochul", reportDate: "2026-06-26", sourceRange: "김호철!A8:F8" },
    [
      { sourceId: "kim-taejin", reportDate: "6월 26일", sourceRange: "김태진!A8:F8" },
      { sourceId: "son-hyejin", reportDate: "2026-06-25", sourceRange: "손혜진!A18:F18" },
    ],
  );

  assert.equal(round.roundId, "2026-06-26");
  assert.deepEqual(round.members.map((member) => member.sourcePerson), ["김태진", "손혜진"]);
  assert.deepEqual(round.members.map((member) => member.dayDifference), [0, 1]);
  assert.equal(round.excludedCandidates.length, 0);
});

test("2일 차이는 경고하고 3일 이상은 자동 제외 후보로 분리한다", () => {
  const warningRound = createReportRound(
    { sourceId: "kim-hochul", reportDate: "2026-06-26", sourceRange: "김호철!A8:F8" },
    [{ sourceId: "kim-taejin", reportDate: "2026-06-24", sourceRange: "김태진!A8:F8" }],
  );
  assert.equal(warningRound.members[0]?.alignment, "warning");
  assert.equal(warningRound.warnings.length, 1);

  const excludedRound = createReportRound(
    { sourceId: "kim-hochul", reportDate: "2026-06-26", sourceRange: "김호철!A8:F8" },
    [{ sourceId: "son-hyejin", reportDate: "2026-06-23", sourceRange: "손혜진!A18:F18" }],
  );
  assert.equal(excludedRound.members.length, 0);
  assert.equal(excludedRound.excludedCandidates[0]?.dayDifference, 3);
});
