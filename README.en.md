# 🦅 Seagull — Full-Break Harness for DeepSeek Harness

**Strip the host-side policy layer off DeepSeek Harness, swap in the Seagull persona and native skills.**

One-line install · idempotent · uninstallable · backed by evidence

**v1.0.15 targets the official Windows Harness 0.2.1-rc.3** with **dsh-purge 1.1.82**, pinned to release commit [6318442](https://github.com/YuJunZhiXue/dsh-purge/tree/6318442a88ea7459d0135d0a07f31776c5d6a7b1). Upstream supports rc.2; Seagull retains and tests its own rc.3 compatibility changes. 1.0.15 corrects the panel's stale local-lab copy, shows both the Seagull and purge versions, and makes empty project names produce a visible error. See [1.0.15 release notes](docs/releases/UPGRADE-1.0.15.md).

Version 1.0.10 fixes market verification of scoped packages and refreshes slash menus when skills are installed or removed, adds a chosen toolkit directory with verified official downloads, keeps Chinese as the default response language unless requested otherwise, and includes AgentTeams 0.1.26. Start a workspace conversation with `agent-teams` or `/agent-teams`, followed by a team goal; members and task dependencies run automatically unless the user explicitly requests plan review. Fresh installs require an explicit toolkit directory (`-ToolkitDir` / `--toolkit-dir`, or an interactive prompt); updates preserve the saved choice. The Windows desktop test found 13 of 15 tools: Nmap driver installation and Masscan's missing official Windows binaries remain explicitly reported manual steps. See [integration analysis](docs/reviews/INTEGRATION-1.0.10.md).

Version 1.0.9 stops a prompt reset if its backup fails and gives every backup a unique filename. Runtime verification now accepts the current injection markers, plain Markdown persona and five native skills, and checks that the local-lab scope gate has been removed. See the [project review](docs/reviews/PROJECT-REVIEW-2026-10-25.md) and [desktop verification M](docs/VERIFICATION.md#m-109-全面审查与桌面回归2026-10-25).

Update mode also repairs an **existing** market installation to the verified 0.4.16: BOM settings, stale nested dependencies, bundle verification, and mixed profile listings. Users without the market do not receive it. Actual purge runtime files are checked after pnpm, including same-version updates. See [verification K](docs/VERIFICATION.md#k-插件市场与-purge-运行副本修复2026-10-24).

The saved **Seagull persona**, five Seagull skills, project fixes, immediate steering, separate queue delivery, and installer/update protections are retained. Since 1.0.13 the upstream local-lab scope gate is removed: the plugin registers no pre-step or pre-execute interception and no longer judges targets, task classes or boundary wording. Engineering additions such as the evidence ledger remain. Upstream no longer ships the skill/knowledge library entry points; existing local data is preserved and the 23 earlier skills remain source archives without automatic deployment.

Current upstream code is Apache-2.0, with its LICENSE, NOTICE and attribution retained. Local code and historical assets keep their respective licenses. There are 88 local patch definitions, including retained native-message compatibility patches #89–#92. See the [verification record](docs/VERIFICATION.md#j-harness-021-rc3--dsh-purge-1177-合并2026-10-24).

Existing users should use the one-click updater below to preserve their saved prompt. Finish the official Harness update before reapplying the plugin; copying the old extracted `resources/app` into the new installation would load the old host again. A failed silent Windows update now offers the visible installer and reports its exit code after restoring the old extracted app.

An invalid explicit DSH home now stops installation. Failed profile writes, pnpm installs, or reverts return a nonzero exit code. Skipping pnpm reports files-only deployment; dependency synchronization and loading still need verification. Apply requires a located app and Node runtime before files are changed.

Windows update handoff detaches verified junctions to the shared runtime before the installer cleans up old extracted directories, and restores them on failure. Use `verify-e2e.sh --stored-credentials` to explicitly opt into GUI-saved credentials; the default retains headless launch-time authentication.

Steer is admitted for the nearest processing step; Queue starts a later turn. v1.0.3 preserves that distinction and respects the existing `ui-conversation.busyEnter` preference. Red-team child tasks automatically use a separate executor preset to preserve their previous tool filtering and depth limits under the new preset API.

[![CI](https://github.com/Yunique-hub/sea-gull/actions/workflows/ci.yml/badge.svg)](https://github.com/Yunique-hub/sea-gull/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-65a30d.svg)](LICENSE)

[中文](README.md) · [English](README.md) · [Current](docs/CURRENT.md) · [Docs](docs/README.md) · [Architecture](docs/ARCHITECTURE.md) · [Deploy](docs/DEPLOY.md) · [Verification](docs/VERIFICATION.md)

---

## What this is

**DeepSeek Harness (DSH)** does more than forward a prompt — it rewrites prompts,
approval gates, sandbox policy and session migration at runtime. Telling it
"don't refuse" changes its *mouth*; the thing that actually stops you is its *hands*.

This project works on the hands: on your machine, against your own DSH install,
it removes the host-side policy gates one by one and replaces the persona layer.

| Component | Provides |
|---|---|
| [dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) 1.1.82 | Host compatibility, console and evidence ledger (scope gate removed); 88 local patch definitions |
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

Finish active tasks and fully exit Harness first. The updater fetches the latest main snapshot on every run, refreshes the plugin and the five bundled skills, and preserves the saved prompt, client preferences, project databases, and extra skills. The persona ships as a single file (`prompt-inject.md`); the installer also removes the legacy `rules/seagull-fullbreak.*` copy left by 1.0.7 and earlier, because that copy was written into `AGENTS.md` and injected a second persona. Restart Harness afterwards and follow the Apply instructions. This updates Seagull; official Harness upgrades still use the official installer.

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
| **2. Prompt** — a single source: `prompt-inject.md` carries the Seagull full-break core (capability layer + behaviour layer); `AGENTS.md` is engineering-only; no `rules/` persona copy | ✅ |
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
  (Apache-2.0 © 2026 YuJunZhiXue). Our entire diff is listed in [NOTICE](NOTICE).
- Persona & skills from [Yunique-hub/hermes-seagull](https://github.com/Yunique-hub/hermes-seagull) (MIT)
- No affiliation with DeepSeek.
