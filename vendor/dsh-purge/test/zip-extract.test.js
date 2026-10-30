import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { extractZipBuffer } from "../lib/zip-extract.js";

function storedZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const { name, data, dir } of entries) {
    const rawName = dir ? (name.endsWith("/") ? name : `${name}/`) : name;
    const body = dir ? Buffer.alloc(0) : Buffer.from(data);
    const crc = zlib.crc32(body) >>> 0;
    const nameBuf = Buffer.from(rawName, "utf8");
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(body.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 30);
    const localOff = offset;
    localParts.push(local, body);
    offset += local.length + body.length;

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(localOff, 42);
    nameBuf.copy(central, 46);
    centralParts.push(central);
  }
  const centralBuf = Buffer.concat(centralParts);
  const localBuf = Buffer.concat(localParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, eocd]);
}

test("zip 目录条目建目录而不是空文件", () => {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-purge-zip-"));
  try {
    extractZipBuffer(storedZip([
      { name: "root/", dir: true },
      { name: "root/nested/", dir: true },
      { name: "root/nested/a.txt", data: "ok" },
    ]), dest);
    assert.equal(fs.statSync(path.join(dest, "root")).isDirectory(), true);
    assert.equal(fs.statSync(path.join(dest, "root", "nested")).isDirectory(), true);
    assert.equal(fs.readFileSync(path.join(dest, "root", "nested", "a.txt"), "utf8"), "ok");
  } finally {
    fs.rmSync(dest, { recursive: true, force: true });
  }
});
