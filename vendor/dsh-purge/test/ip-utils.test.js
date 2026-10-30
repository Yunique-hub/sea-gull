import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ipToInt, isIpv6, cidrOf, scopeOfIp, slugify, slugTarget, defaultPocFilename,
} from "../lib/redteam/ip-utils.js";

test("ipToInt 把 IPv4 转成 32 位整数", () => {
  assert.equal(ipToInt("10.0.0.1"), 167772161);
  assert.equal(ipToInt("192.168.1.1"), 3232235777);
  assert.equal(ipToInt("0.0.0.0"), 0);
});

test("ipToInt 对非 IPv4 返回 null", () => {
  assert.equal(ipToInt(""), null);
  assert.equal(ipToInt("abc"), null);
  assert.equal(ipToInt(null), null);
  assert.equal(ipToInt("1.2.3"), null);
});

test("isIpv6 识别 IPv6 字面量", () => {
  assert.equal(isIpv6("2001:db8::1"), true);
  assert.equal(isIpv6("::1"), true);
  assert.equal(isIpv6("::ffff:192.0.2.1"), true);
  assert.equal(isIpv6("10.0.0.1"), false);
  assert.equal(isIpv6(""), false);
});

test("cidrOf 归一到网段", () => {
  assert.equal(cidrOf("10.0.0.5"), "10.0.0.0/24");
  assert.equal(cidrOf("::1"), "0:0:0:0::/64");
  assert.equal(cidrOf("not-an-ip"), "not-an-ip");
});

test("scopeOfIp 区分内网外网", () => {
  assert.equal(scopeOfIp("10.1.2.3"), "internal");
  assert.equal(scopeOfIp("192.168.1.1"), "internal");
  assert.equal(scopeOfIp("127.0.0.1"), "internal");
  assert.equal(scopeOfIp("172.16.0.1"), "internal");
  assert.equal(scopeOfIp("172.32.0.1"), "external");
  assert.equal(scopeOfIp("8.8.8.8"), "external");
  assert.equal(scopeOfIp("fc00::1"), "internal");
  assert.equal(scopeOfIp("2001:db8::1"), "external");
});

test("slugify 归一化为 slug", () => {
  assert.equal(slugify("Hello World!"), "hello-world");
  assert.equal(slugify("  中文 空格  "), "中文-空格");
});

test("slugTarget 归一化目标", () => {
  assert.equal(slugTarget("10.0.0.5"), "10.0.0.5");
  assert.equal(slugTarget("10.0.0.5:8080"), "10.0.0.5");
  assert.equal(slugTarget("https://example.com/path"), "example.com");
  assert.equal(slugTarget(""), "unknown");
});

test("defaultPocFilename 按语言取扩展名", () => {
  assert.equal(defaultPocFilename("t", "x", "python"), "poc.py");
  assert.equal(defaultPocFilename("t", "x", "go"), "poc.go");
  assert.equal(defaultPocFilename("t", "template", ""), "poc.yaml");
  assert.equal(defaultPocFilename("t", "x", ""), "poc.txt");
});
