import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseTargetPort, tunnelIsLegit, parseRowCount, applyScoreCaps, scoreServiceKey,
} from "../lib/redteam/score-rules.js";

test("parseTargetPort 解析端口", () => {
  assert.equal(parseTargetPort("http://h:8080/x"), 8080);
  assert.equal(parseTargetPort("10.0.0.5:6379"), 6379);
  assert.equal(parseTargetPort("http://h/x"), null);
  assert.equal(parseTargetPort("10.0.0.5:99999"), null);
  assert.equal(parseTargetPort(""), null);
});

test("tunnelIsLegit 判定隧道是否跨靶标边界", () => {
  assert.equal(tunnelIsLegit("self-only"), false);
  assert.equal(tunnelIsLegit("target-outbound"), true);
  assert.equal(tunnelIsLegit(""), null);
  assert.equal(tunnelIsLegit(null), null);
});

test("parseRowCount 从证据解析数据量", () => {
  assert.equal(parseRowCount("120 万条"), 1200000);
  assert.equal(parseRowCount("1300万行"), 13000000);
  assert.equal(parseRowCount("2.5万行"), 25000);
  assert.equal(parseRowCount("1200000 records"), 1200000);
  assert.equal(parseRowCount(""), null);
  assert.equal(parseRowCount("密码是 123456"), null);
});

test("scoreServiceKey 同一服务归一键", () => {
  assert.equal(scoreServiceKey({ target: "http://h:8080" }), "th:8080");
  assert.equal(scoreServiceKey({ target: "10.0.0.5:6379" }), "t10.0.0.5:6379");
  assert.equal(scoreServiceKey({}), null);
});

test("applyScoreCaps 同一服务只计最高权限分", () => {
  const pointsByCode = new Map([
    ["web-account-admin", { rule: 1, cap: 20, dedup_scope: "service", points: 20 }],
    ["web-account-user", { rule: 1, cap: 20, dedup_scope: "service", points: 10 }],
  ]);
  const rows = [
    { id: 1, code: "web-account-user", points: 10, target: "http://h:8080" },
    { id: 2, code: "web-account-admin", points: 20, target: "http://h:8080" },
  ];
  const r = applyScoreCaps(rows, pointsByCode);
  assert.equal(r.capped, 1);
  const byId = Object.fromEntries(r.items.map((x) => [x.id, x]));
  assert.equal(byId[1].capped, true);
  assert.equal(byId[1].capped_reason_kind, "dedup");
  assert.equal(byId[1].capped_by_id, 2);
  assert.equal(byId[2].capped, false);
});

test("applyScoreCaps 规则上限累计封顶", () => {
  const pointsByCode = new Map([
    ["web-account-admin", { rule: 1, cap: 20, dedup_scope: "service", points: 20 }],
  ]);
  const rows = [
    { id: 1, code: "web-account-admin", points: 20, target: "http://h1:80" },
    { id: 2, code: "web-account-admin", points: 20, target: "http://h2:80" },
  ];
  const r = applyScoreCaps(rows, pointsByCode);
  assert.equal(r.capped, 1);
  const byId = Object.fromEntries(r.items.map((x) => [x.id, x]));
  assert.equal(byId[1].capped, false);
  assert.equal(byId[2].capped, true);
  assert.equal(byId[2].capped_reason_kind, "cap");
});
