# 🦅 Seagull — Full-Break Harness for DeepSeek Harness

**Strip the host-side policy layer off DeepSeek Harness, swap in the Seagull persona + 28 skills.**

One-line install · idempotent · uninstallable · backed by evidence

**v1.0.5 targets DeepSeek Harness 0.2.1-rc.2** and upgrades the engine to **dsh-purge 1.1.72**, using verified upstream master snapshot [`ec691667`](https://github.com/YuJunZhiXue/dsh-purge/tree/ec69166706bed95efb6c35e225b01588f3cd9b72). At review time the latest Release is still 1.1.71; the fixed commit declares package version 1.1.72. All 118 upstream Git blobs were verified.

The Seagull persona, **28 skills**, installer and update protections, red-team presets, immediate steering, and separate Queue delivery are retained. There are **86 patch definitions**. The drill console supports creating further projects, reports errors, blocks duplicate submissions, serializes project changes, and isolates each project's page state. Legacy prompt migration, custom-persona ownership, native system-message retention, and uninstall preset cleanup are fixed. Five Seagull skills gain the metadata required for native discovery, preserving their bodies. See the [upgrade verification record](docs/VERIFICATION.md#i-dsh-purge-1172-升级与演练台项目修复2026-10-19).

Existing users should use the one-click updater below to preserve their saved prompt. Finish the official Harness update before reapplying the plugin; copying the old extracted `resources/app` into the new installation would load the old host again. A failed silent Windows update now offers the visible installer and reports its exit code after restoring the old extracted app.

An invalid explicit DSH home now stops installation. Failed profile writes, pnpm installs, or reverts return a nonzero exit code. Skipping pnpm reports files-only deployment; dependency synchronization and loading still need verification. Apply requires a located app and Node runtime before files are changed.

Windows update handoff detaches verified junctions to the shared runtime before the installer cleans up old extracted directories, and restores them on failure. Use `verify-e2e.sh --stored-credentials` to explicitly opt into GUI-saved credentials; the default retains headless launch-time authentication.

Steer is admitted for the nearest processing step; Queue starts a later turn. v1.0.3 preserves that distinction and respects the existing `ui-conversation.busyEnter` preference. Red-team child tasks automatically use a separate executor preset to preserve their previous tool filtering and depth limits under the new preset API.

[![CI](https://github.com/Yunique-hub/sea-gull/actions/workflows/ci.yml/badge.svg)](https://github.com/Yunique-hub/sea-gull/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-65a30d.svg)](LICENSE)

[中文](README.md) · [English](README.md) · [Architecture](docs/ARCHITECTURE.md) · [Deploy](docs/DEPLOY.md) · [Verification](docs/VERIFICATION.md)

---

## What this is

**DeepSeek Harness (DSH)** does more than forward a prompt — it rewrites prompts,
approval gates, sandbox policy and session migration at runtime. Telling it
"don't refuse" changes its *mouth*; the thing that actually stops you is its *hands*.

This project works on the hands: on your machine, against your own DSH install,
it removes the host-side policy gates one by one and replaces the persona layer.

| Component | Provides |
|---|---|
| [dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) 1.1.72 | Host-layer engine: **86 patch definitions** + red-team console + 23 skills |
| [hermes-seagull](https://github.com/Yunique-hub/hermes-seagull) | Seagull persona + 5 domain skills |

This is not a stack of two tarballs: `SOUL.md` cannot be used as a DSH prompt as-is
(interpolation allow-list, ChatML envelope, skill-catalog protocol each break it), so it
was rewritten. Upstream's `seagull-armor-break` Hermes plugin is a stub (its hook names and
`ctx.register_hook` are not Hermes APIs) and was dropped.

## Install

```powershell
# Windows
irm https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/install.ps1 | iex
```

```bash
# Linux / macOS / WSL / Git Bash
curl -fsSL https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/install.sh | bash
```

Then **Apply** (required for the sealed desktop host):

```
1) fully quit DeepSeek Harness
2) reopen → click dsh-purge next to the session title → Clean → Apply
   (or: bash install.sh --apply, then move app.asar aside as printed)
```

Options: `--profile desktop|web`, `--dsh-home`, `--app-root`, `--apply`,
`--no-pnpm`, `--dry-run`, `--uninstall`, `-q`.

No hard-coded drive letters or usernames — `DSH_HOME`, profile, install root and the
bundled node/pnpm are auto-detected; without an install root it degrades to files-only mode.

## One-click update

Finish active tasks and fully exit Harness first. The updater fetches the latest main snapshot on every run, refreshes the plugin and bundled rules/skills, and preserves the saved prompt, client preferences, project databases, and extra skills. Restart Harness afterwards and follow the Apply instructions. This updates Seagull; official Harness upgrades still use the official installer.

```powershell
irm https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/update.ps1 | iex
```

```bash
curl -fsSL https://raw.githubusercontent.com/Yunique-hub/sea-gull/main/update.sh | bash
```

With an up-to-date local checkout, use `powershell -File install.ps1 -Update` or `bash install.sh --update`. Local mode uses the current checkout without pulling Git. An uninstalled home or failed download/dependency/configuration step reports an error. Files-only deployment is explicitly identified.

## What gets broken

| Layer | Status |
|---|---|
| **1. Host policy** — approval gates, sandboxes, hooks deny/ask, pre-step region gate, stock identity, tool-surface trimming, inject-preservation | ✅ removed / neutered |
| **2. Prompt** — injects the Seagull full-break core, no leftover restrictions | ✅ |
| **3. Behaviour** — no keyword refusal, no downgrade, literal-intent, real execution | ✅ |
| **4. Model weights** — trained-in alignment | ❌ **not promised** |

Host-layer permission ≠ model-layer compliance. For layer 4 the only real lever is
**switching the backend model route** (`agent-default-model` → `provider` / `model`,
adapters `dsh-llm-deepseek` / `dsh-llm-pi-ai`). This project does not pretend prompts
can push through it.

> **Legal boundary (not a prompt boundary):** unauthorised intrusion into, or fraudulent
> data extraction from, real third-party production systems. That line is drawn by law,
> not by a config flag.

## Verify

```bash
bash tests/smoke.sh   # CI smoke: fake DSH_HOME, full install/verify/idempotent/uninstall cycle
bash verify.sh        # on-machine install check (21+ items)
bash verify-e2e.sh    # end-to-end: canary injection + real task + A/B control
```

Measured on Windows 11 with DSH 0.2.0-rc.2 desktop: **76/82 patches applied, 0 failed**,
**44 host files modified**, **0 stock identity sentences left**, all outputs free of mojibake.

Canary test: sending `在吗` returns exactly `海鸥在线，你要整点薯条吗？` — the upstream
plugin's bundled default persona (小码酱) can never produce that line, which proves our
prompt is the one being injected.

## Uninstall

```bash
bash install.sh --uninstall   # restores the profile, removes plugin + inject file, keeps your skills
```

## License & attribution

- This project: **MIT**
- Host engine derived from [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)
  (MIT © 2026 小杨). Our entire diff is listed in [NOTICE](NOTICE).
- Persona & skills from [Yunique-hub/hermes-seagull](https://github.com/Yunique-hub/hermes-seagull) (MIT)
- No affiliation with DeepSeek.
