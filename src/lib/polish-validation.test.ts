import assert from "node:assert/strict";
import test from "node:test";
import { assertAnchorsPreserved, isAnchorPreserved } from "./polish-validation";

test("숫자 날짜와 한국어 날짜 표기를 같은 식별 정보로 인정한다", () => {
  assert.equal(isAnchorPreserved("7/3", "SKT 미팅은 7월 3일에 진행할 예정이에요."), true);
  assert.doesNotThrow(() => assertAnchorsPreserved("SKT 7/3 미팅", "SKT 미팅은 7월 3일에 진행해요."));
});

test("수치나 영문 식별자가 실제로 사라지면 거부한다", () => {
  assert.throws(
    () => assertAnchorsPreserved("SKT 데이터 300종", "데이터 제공 범위를 협의해요."),
    /SKT|300/u,
  );
});
