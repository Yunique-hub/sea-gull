import { test } from "node:test";
import assert from "node:assert/strict";
import {
  looksLikeDesktopName,
  isDesktopExecutable,
  isOfficialHarnessExecutable,
} from "../lib/desktop.js";
import { detectSurface, pathLooksDesktop, isCommunityElectronHost } from "../lib/surface.js";

test("DSH NEXT 路径和 exe 按桌面认", () => {
  assert.equal(looksLikeDesktopName("C:/Users/me/AppData/Local/Programs/DSH NEXT/DSH NEXT.exe"), true);
  assert.equal(isDesktopExecutable("C:/Users/me/AppData/Local/Programs/DSH NEXT/DSH NEXT.exe"), true);
  assert.equal(isOfficialHarnessExecutable("C:/Users/me/AppData/Local/Programs/DSH NEXT/DSH NEXT.exe"), true);
  assert.equal(pathLooksDesktop("C:/Users/me/AppData/Local/Programs/DSH NEXT/DSH NEXT.exe"), true);
});

test("DSH NEXT 即使 DSH_SURFACE=web 也判桌面", () => {
  const input = {
    env: { DSH_SURFACE: "web", DSH_PROFILE: "dsh-next" },
    execPath: "C:\\\\Users\\\\me\\\\AppData\\\\Local\\\\Programs\\\\DSH NEXT\\\\DSH NEXT.exe",
  };
  assert.equal(isCommunityElectronHost(input), true);
  assert.equal(detectSurface(input), "desktop");
});

test("普通路径不会因为带 app.asar 就当桌面", () => {
  assert.equal(pathLooksDesktop("/tmp/random-app/resources/app.asar"), false);
});
