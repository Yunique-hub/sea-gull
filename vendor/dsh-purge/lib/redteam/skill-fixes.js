/**
 * 技能修复文案（零依赖，纯 ESM）
 *
 * 用途：给控制台「技能库」页签用 —— 每个**不可用**的技能都要能直接告诉用户"怎么修"，
 * 而不是只报"缺什么"。`skill-availability.js` 负责判定（缺环境变量 / 缺工具 / 占位符没填 / 被同名技能盖住），
 * 这里负责把每一类判定翻译成可执行的中文步骤：
 *   · `TOOL_FIXES`   —— 逐工具的装法（与 `scripts/redteam-setup.sh` 保持一致：能自动装的就让人跑该脚本）
 *   · `SKILL_FIXES`  —— 逐技能的额外修复步骤（FOFA_KEY、VPS 地址、浏览器扩展…）
 *   · `toolNameOfPath` / `fixesForIssue` —— 把"某个路径不存在"这类判定转成具体建议
 *
 * 文案约定：中文、一句话说清"这是什么/怎么补"、命令一律用反引号包住、不编造 URL 与版本号、
 * 正文不用 markdown 强调符（面板按纯文本渲染）。`fixesForIssue()` 按判定分支给出的建议是**单行**的
 * （当列表项渲染不会塌）；回退到 `SKILL_FIXES` 时可能带换行 —— 技能文案允许 1–3 行。
 */

/** 仓库自带的一键修复入口（工具下载、FOFA_KEY/VPS 引导都在这一个脚本里）。 */
const SETUP = 'bash $DSH_HOME/redteam/setup.sh --yes'

/** 完全不知道缺什么时的兜底建议。 */
const GENERIC_FIX = "Run `" + SETUP + "` to install the missing tools and config (idempotent, safe to re-run: missing items are downloaded, corrupted ones deleted and re-downloaded); "
  + "changes to `$DSH_HOME/.env` only take effect after restarting `dsh web`; if it still fails, reinstall the redteam plugin and run the check again."

/** 工具箱附件实际装了什么。不要写成「缺了就从附件里解出来」。 */
const TOOLKIT_TARBALL = "the upstream dsh-redteam-mode release asset `dsh-redteam-mode-<版本>-toolkit.tar.gz` contains only a README, a few skill md files and redteam-setup.sh — not the binaries or scripts described below"

/* ── 逐工具修法 ───────────────────────────────────────────────────────────── */

const FRP_FIX = {
  what: "frp intranet tunneling: `frps` runs on the VPS as the server, `frpc` runs on the target as the client (both binaries ship in the same release package)",
  install: "Run `" + SETUP + "` once to extract `frpc` + `frps` into `$DSH_HOME/redteam/toolkit/frp/`; "
    + "if the script does not cover it, manually fetch `frp_<版本>_linux_amd64.tar.gz` from the fatedier/frp GitHub releases, unpack it, put `frpc`/`frps` in the same directory and `chmod +x`",
}

const LIGOLO_FIX = {
  what: "ligolo-ng TUN tunnel (`proxy` server + `agent` on the target side), an alternative channel to chisel/frp; needs root to create the virtual NIC",
  install: "Run `" + SETUP + "` to install into `$DSH_HOME/redteam/toolkit/ligolo/proxy` and `.../ligolo/agent`; "
    + "or fetch `proxy_*_linux_amd64.tar.gz` / `agent_*_linux_amd64.tar.gz` from the nicocha30/ligolo-ng GitHub releases, unpack them into `toolkit/ligolo/` with the names above and `chmod +x`",
}

export const TOOL_FIXES = {
  /* ── setup.sh 会下载到 toolkit/ 的二进制 ── */
  fscan: {
    what: "All-in-one intranet scanning (host discovery/ports/service detection/28 weak-password classes/unauthorized access/high-risk vulns, v2.2.1)",
    install: "Run `" + SETUP + "` to install to `$DSH_HOME/redteam/toolkit/fscan/fscan`; "
      + "if only `fscan.zip` arrives without being unpacked, manually extract the `fscan` binary and `chmod +x`; if the script still cannot supply it, download the matching platform binary from the shadow1ng/fscan GitHub releases (including `fscan_windows_x64.exe`, `fscan_linux_arm64`) into that directory",
  },
  gogo: {
    what: "Intranet mapping and fingerprint engine (v2.15.0; active + passive fingerprinting, key-information extraction, nuclei-template POCs)",
    install: "The setup.sh script only prints a hint for gogo and does not download it automatically (upstream asset naming is inconsistent): run `" + SETUP + "` to see the hint, "
      + "then fetch the platform binary yourself from the chainreactors/gogo GitHub releases; put the main program at `$DSH_HOME/redteam/toolkit/gogo/gogo`, the Windows/arm64 variants (`gogo_windows_amd64.exe`, `gogo_linux_arm64`) in the same directory, and `chmod +x` all of them",
  },
  suo5: {
    what: "suo5: core intranet-pivot tool that builds a SOCKS5 tunnel over WebShell/HTTP (v2.2.0, static Go binary with no dependencies)",
    install: "Run `" + SETUP + "` to install to `$DSH_HOME/redteam/toolkit/suo5/suo5-linux-amd64`; "
      + "or fetch `suo5-linux-amd64` from the zema1/suo5 GitHub releases, put it at that path and `chmod +x`",
  },
  chisel: {
    what: "chisel HTTP tunnel (server and client are the same binary, v1.12.0)",
    install: "Run `" + SETUP + "` to install to `$DSH_HOME/redteam/toolkit/chisel/chisel`; "
      + "or fetch `chisel_<版本>_linux_amd64.gz` from the jpillora/chisel GitHub releases, `gunzip` it and `chmod +x`",
  },
  frp: FRP_FIX,
  frpc: FRP_FIX,
  frps: FRP_FIX,
  subfinder: {
    what: "Passive subdomain enumeration (ProjectDiscovery, v2.16.0, multi-source aggregation)",
    install: "Run `" + SETUP + "` to install to `$DSH_HOME/redteam/toolkit/subfinder/subfinder`; "
      + "or fetch `subfinder_<版本>_linux_amd64.zip` from the projectdiscovery/subfinder GitHub releases, unzip it there and `chmod +x`",
  },
  dnsx: {
    what: "Bulk DNS resolution/brute force/wildcard filtering (ProjectDiscovery, v1.3.1)",
    install: "Run `" + SETUP + "` to install to `$DSH_HOME/redteam/toolkit/dnsx/dnsx`; "
      + "or fetch `dnsx_<版本>_linux_amd64.zip` from the projectdiscovery/dnsx GitHub releases, unzip it there and `chmod +x`",
  },
  naabu: {
    what: "Fast port scanning (ProjectDiscovery, v2.6.1; SYN needs root, non-root should add `-scan-type c`)",
    install: "Run `" + SETUP + "` to install to `$DSH_HOME/redteam/toolkit/naabu/naabu`; "
      + "or fetch `naabu_<版本>_linux_amd64.zip` from the projectdiscovery/naabu GitHub releases, unzip it there and `chmod +x`",
  },
  httpx: {
    what: "HTTP liveness/title/status-code/tech-stack probing (ProjectDiscovery edition, v1.12.0; `/usr/bin/httpx` is the Python httpx library CLI, not this tool)",
    install: "Run `" + SETUP + "` to install to `$DSH_HOME/redteam/toolkit/httpx/httpx`; "
      + "or fetch `httpx_<版本>_linux_amd64.zip` from the projectdiscovery/httpx GitHub releases, unzip it there and `chmod +x`; "
      + "on the command line, call it through the wrapper script `pd-httpx` (see the `pd-httpx` entry)",
  },
  ksubdomain: {
    what: "Stateless subdomain brute force (knownsec ksubdomain v0.7, faster than dnsx brute force, needs root to send packets)",
    install: "Run `" + SETUP + "` to install to `$DSH_HOME/redteam/toolkit/ksubdomain/ksubdomain`; "
      + "or fetch the Linux archive from the knownsec/ksubdomain GitHub releases, unzip it there and `chmod +x`",
  },
  ligolo: LIGOLO_FIX,
  'ligolo-proxy': LIGOLO_FIX,
  'ligolo-agent': LIGOLO_FIX,
  gowitness: {
    what: "Bulk web-page screenshots for evidence (sensepost/gowitness)",
    install: "Run `" + SETUP + "` to install to `$DSH_HOME/redteam/toolkit/gowitness/gowitness`; "
      + "or fetch `gowitness-<版本>-linux-amd64` from the sensepost/gowitness GitHub releases, put it there and `chmod +x` — "
      + "make sure the download is complete (a truncated binary can exist with correct permissions yet produce zero output)",
  },
  oneforall: {
    what: "OneForAll subdomain collection suite (v0.4.5, source + `.venv`, slow but thorough)",
    install: "Run `" + SETUP + "` to drop the source into `$DSH_HOME/redteam/toolkit/oneforall/OneForAll-0.4.5/` and create the `.venv` dependencies; "
      + "failing to install it does not block the main path — just use `subfinder` + `ksubdomain` instead",
  },
  vps: {
    what: "VPS login settings (`REDTEAM_VPS_HOST` / `REDTEAM_VPS_KEY`) and the relay script `vps.sh`: the landing end for reverse shells, payload delivery and tunnel egress",
    install: "Run `" + SETUP + "` to be guided through writing the VPS address and private-key path; put the key at `$DSH_HOME/redteam/toolkit/vps/id_rsa` and `chmod 600` (test connectivity with "
      + "`ssh -i $DSH_HOME/redteam/toolkit/vps/id_rsa -o BatchMode=yes <user>@<ip> 'echo ok'` to verify); "
      + "the script `$DSH_HOME/redteam/toolkit/vps/vps.sh` is not in the toolkit tarball: write it yourself as an executable script following the subcommands in the `vps-reverse-shell` skill (at least `serve <port>` and `exec`) and `chmod +x`",
  },
  'nuclei-templates': {
    what: "nuclei template library (13,000+ templates; both `nuclei -t` and `redteam_poc_search` rely on it)",
    install: "Run `" + SETUP + "` to install to `~/.local/nuclei-templates`; you can also run `nuclei -update-templates` separately (no more than once a week); "
      + "fewer than 1000 templates means the download was incomplete: re-run it and use `nuclei -tl` to confirm the library is intact",
  },

  /* ── 技能里引用、但 setup.sh 不下载，工具箱附件里也没有 ── */
  dirsearch: {
    what: "Directory/file brute force (Python, v0.5.0, broad wordlists, report-friendly, ships its own runtime)",
    install: "It is not in the setup.sh download list: fetch the source package from the maurosoria/dirsearch GitHub releases and put it in `$DSH_HOME/redteam/toolkit/dirsearch/` "
      + "(make sure `toolkit/dirsearch/dirsearch` is executable, `chmod +x`); meanwhile `feroxbuster` / `ffuf` / `gobuster` can fill in",
  },
  behinder: {
    what: "Behinder v4.1 client + encrypted webshell templates (`toolkit/Behinder/server/*.jsp|php|aspx`, the main WebShell delivery path)",
    install: "The setup.sh script does not download it; " + TOOLKIT_TARBALL + ". Fetch the client from the Behinder release page and put it in `toolkit/Behinder/`; "
      + "if you only need the webshell templates, keep the seven templates under `toolkit/Behinder/server/` in place (they can be generated with `sed` key swapping even without a GUI); it needs `java -jar`, so Java must be installed locally",
  },
  godzilla: {
    what: "Godzilla v4.0.1 client (`godzilla.jar`, GUI generates fully encrypted JSP/PHP/ASPX payloads)",
    install: "The setup.sh script does not download it; " + TOOLKIT_TARBALL + ". Fetch `godzilla.jar` from the Godzilla release page and put it in `toolkit/Godzilla/`; "
      + "launching it needs Java (`apt install openjdk-17-jre`) and a graphical session (`DISPLAY=:10.0`)",
  },
  antsword: {
    what: "AntSword (Loader + source directory; on first launch choose the source directory `antSword-2.1.16`)",
    install: "The setup.sh script does not download it; " + TOOLKIT_TARBALL + ". Fetch the Loader and source directory from the official AntSword repository and put them in `toolkit/AntSword/` ("
      + "`toolkit/AntSword/AntSword-Loader-v4.0.3-linux-x64/AntSword` must be executable)",
  },
  netexec: {
    what: "netexec (nxc) intranet lateral-movement/protocol enumeration tool (`toolkit/netexec/`; on Kali you can also `apt install netexec`)",
    install: "`apt install netexec`; the local toolkit copy lives in `$DSH_HOME/redteam/toolkit/netexec/`. If it is missing, "
      + "note that " + TOOLKIT_TARBALL + ", so instead install it with `pipx install netexec` per the official docs",
  },

  /* ── 技能里出现、setup.sh 不管的本机脚本/二进制 ── */
  'pd-httpx': {
    what: "Wrapper script for ProjectDiscovery httpx (`~/.local/bin/pd-httpx`) — avoids the name clash with the Python httpx library CLI",
    install: "First run `" + SETUP + "` to install `$DSH_HOME/redteam/toolkit/httpx/httpx`, then rebuild the wrapper script and make it executable: "
      + '`printf \'#!/usr/bin/env bash\\nexec "\${DSH_HOME:-$HOME/.dsh}/redteam/toolkit/httpx/httpx" "$@"\\n\' > ~/.local/bin/pd-httpx && chmod +x ~/.local/bin/pd-httpx`',
  },
  'kimi-chrome': {
    what: "Launcher script that starts a browser controllable by the Kimi WebBridge extension (`~/.local/bin/kimi-chrome`)",
    install: "First install a browser: `apt install google-chrome-stable` (or `apt install chromium`); then create `~/.local/bin/kimi-chrome`: "
      + "by default `exec /usr/bin/google-chrome --no-first-run --no-default-browser-check \"$@\"`, with `KIMI_BROWSER=chromium` use `/usr/bin/chromium` instead, "
      + "at the top also run `systemctl start kimi-webbridge` as a fallback to bring up the daemon, and finally `chmod +x ~/.local/bin/kimi-chrome`",
  },
  'kimi-webbridge': {
    what: "Kimi WebBridge local daemon (systemd service `kimi-webbridge`, listens on `127.0.0.1:10086`; the skill uses it to drive a real browser)",
    install: "the daemon lives at `~/.kimi-webbridge/bin/kimi-webbridge` and is managed by `/etc/systemd/system/kimi-webbridge.service`: "
      + "after reinstalling, run `sudo systemctl enable --now kimi-webbridge`, then confirm `\"running\": true` with `~/.kimi-webbridge/bin/kimi-webbridge status`; "
      + "the browser extension is installed automatically from the Chrome Web Store by enterprise policy (ID `fldmhceldgbpfpkbgopacenieobmligc`); on Chrome 137+ do not load it unpacked",
  },
  chromium: {
    what: "Chromium browser (zero-dependency way to dump rendered DOM / take screenshots / generate PDFs headlessly, `/usr/bin/chromium`)",
    install: "`apt install chromium` (or install `google-chrome-stable`); usage: `/usr/bin/chromium --headless=new --no-sandbox --dump-dom <url>`, "
      + "add `--screenshot=runs/shot.png` for screenshots",
  },
  'playwright-cli': {
    what: "Playwright CLI (browser automation when you need clicks/waits/multiple tabs, `npx --yes @playwright/cli@latest`)",
    install: "`npx --yes @playwright/cli@latest`; if the browser is missing run `npx playwright install chromium`; "
      + "always add `--browser chromium` when calling it (the default chrome channel fails with `Chromium distribution 'chrome' is not found`)",
  },

  /* ── 系统工具（setup.sh 只体检，缺了用 apt 补） ── */
  nmap: {
    what: "Port/service/script scanning (ships with Kali, the mainstay of active scanning)",
    install: "`apt install nmap`; SYN scanning (`-sS`) needs `sudo`; without privileges use `-sT`",
  },
  masscan: {
    what: "Ultra-fast port scanning (sweeps large ranges, very noisy)",
    install: "`apt install masscan`; sending packets needs root, so always set `--rate` and confirm the authorized scope first",
  },
  nuclei: {
    what: "Template-based vulnerability scanning (mainstay for Nday/1day detection, locally at `/usr/bin/nuclei`)",
    install: "`apt install nuclei`; then fill in the template library too: `nuclei -update-templates` (templates live in `~/.local/nuclei-templates`)",
  },
  sqlmap: {
    what: "SQL injection detection and exploitation",
    install: '`apt install sqlmap`',
  },
  ffuf: {
    what: "Web fuzzing / directory brute force (fastest and most flexible; multiple wordlists, vhost and parameter fuzzing)",
    install: '`apt install ffuf`',
  },
  feroxbuster: {
    what: "Recursive directory brute force (Rust, follows directory depth automatically, the first choice for directory brute force)",
    install: '`apt install feroxbuster`',
  },
  gobuster: {
    what: "Lightweight directory/DNS/vhost brute force (dir/dns/vhost modes)",
    install: '`apt install gobuster`',
  },
  hydra: {
    what: "Online weak-password brute force (50+ protocols: SSH/FTP/RDP/SMB/MySQL/MSSQL/web forms)",
    install: '`apt install hydra`',
  },
  john: {
    what: "John the Ripper offline hash cracking (CPU path, good for small wordlists/rules)",
    install: "`apt install john`; if wordlists are missing, first `apt install wordlists`, then `gunzip /usr/share/wordlists/rockyou.txt.gz`",
  },
  hashcat: {
    what: "hashcat offline hash/password cracking (GPU preferred, very slow on CPU)",
    install: "`apt install hashcat`; first run `hashcat --identify hashes.txt` to confirm the mode number (e.g. NTLM `-m 1000`, Kerberoast `-m 13100`)",
  },
  wpscan: {
    what: "WordPress vulnerability and user-enumeration scanning",
    install: "`apt install wpscan`; when the vulnerability database is needed, run `wpscan --update` as prompted",
  },
  nikto: {
    what: "Web server configuration and known-issue scanning",
    install: '`apt install nikto`',
  },
  whatweb: {
    what: "Web fingerprinting (CMS/framework/middleware/version)",
    install: '`apt install whatweb`',
  },
  amass: {
    what: "Subdomain enumeration and asset mapping (OWASP Amass)",
    install: "`apt install amass`; passive mode `amass enum -passive -d <domain>`",
  },
  theharvester: {
    what: "Public-source email/subdomain/host collection (theHarvester)",
    install: '`apt install theharvester`',
  },
  msfconsole: {
    what: "Metasploit framework (`exploit/multi/handler` catches reverse shells, `web_delivery` delivers payloads)",
    install: "`apt install metasploit-framework` (provides `msfconsole`); run `msfdb init` before first use",
  },
  searchsploit: {
    what: "Local Exploit-DB search (find public POCs by component/version)",
    install: "`apt install exploitdb` (provides `searchsploit`); update the database with `searchsploit -u`",
  },
  proxychains4: {
    what: "Proxies a single command's TCP traffic into the intranet (used with a SOCKS5 tunnel)",
    install: "`apt install proxychains4`; only use `-f` pointing at a temporary config under `runs/` (e.g. `proxychains4 -f runs/proxychains-1080.conf ...`); do not edit `/etc/proxychains4.conf`",
  },
  socat: {
    what: "Full-TTY reverse shell listener / port forwarding (more stable than nc, can get a PTY)",
    install: '`apt install socat`',
  },
  nc: {
    what: "netcat: reverse shell listener and connectivity testing (`nc -lvnp <port>`)",
    install: "`apt install netcat-traditional` (provides `nc`; Debian's `netcat-openbsd` also works)",
  },
  tmux: {
    what: "Session persistence: listeners and tunnels must run inside tmux, otherwise they die when SSH disconnects",
    install: "`apt install tmux`; usage: `tmux new -s handler`, `tmux a -t handler`",
  },
  impacket: {
    what: "Impacket protocol suite (PtH/PsExec/WMI/DCOM/Kerberos/credential dumping; Kali ships 61 `impacket-*` commands)",
    install: "`apt install python3-impacket`; common commands `impacket-wmiexec` / `impacket-psexec` / `impacket-secretsdump` / `impacket-GetNPUsers`",
  },
  enum4linux: {
    what: "SMB/domain environment information enumeration (users, shares, groups, password policy)",
    install: "`apt install enum4linux` (newer versions also offer `enum4linux-ng`)",
  },
  'redis-cli': {
    what: "Redis client (read-only probing of unauthenticated Redis and webshell writing)",
    install: "`apt install redis-tools` (provides `redis-cli`)",
  },
  mysql: {
    what: "MySQL/MariaDB client (connect to unauthenticated/weak-password MySQL and pull data)",
    install: "`apt install default-mysql-client` (on Kali it is `mariadb-client`)",
  },
}

/* ── 逐技能修法 ───────────────────────────────────────────────────────────── */

export const SKILL_FIXES = {
  'active-scan': "Install scanners: `apt install nmap masscan`; if `toolkit/naabu/naabu` is missing, run `" + SETUP + "`. "
    + "As non-root add `-scan-type c` to naabu; SYN scanning in nmap/masscan must use `sudo`; confirm the target is in scope before scanning.",

  'asset-correlation': "A pure storage/correlation skill; it depends on no external tools and reads no environment variables. Being unavailable usually means the skill file is missing or the plugin version is old — "
    + "reinstall the redteam plugin and restart `dsh web`, then confirm the `redteam_asset_link` tool is available.",

  'browser-automation': "Install a browser: `apt install chromium` (or `google-chrome-stable`); for the Playwright path also run `npx playwright install chromium`."
    + " Always add `--browser chromium` when calling it (the default chrome channel fails with `Chromium distribution 'chrome' is not found`).",

  'chisel-tunnel': "Install the binary `toolkit/chisel/chisel`: run `" + SETUP + "`.\n"
    + "Both ends of the tunnel need the VPS: make sure `$DSH_HOME/.env` contains `REDTEAM_VPS_HOST` / `REDTEAM_VPS_USER` / `REDTEAM_VPS_KEY`, "
    + "before commands run `set -a; . \"$DSH_HOME/.env\"; set +a`; after editing `.env` you must restart `dsh web`; remember to open the tunnel port in the security group.",

  'cn-proxy-pool': "Depends only on `curl` / `python3` (install with `apt install curl` if missing); unavailability usually means the skill file is missing — reinstall the plugin and restart `dsh web`."
    + " Specify the proxy per command with `-proxy` / `-x` / `--proxy`; do not touch the system proxy or `/etc/proxychains4.conf`.",

  'credential-attack': "`apt install hydra hashcat john`; for wordlists run `sudo apt install wordlists`, then `gunzip /usr/share/wordlists/rockyou.txt.gz`."
    + " Without a local GPU `hashcat` is very slow; prefer small wordlists + rules (`-r /usr/share/hashcat/rules/best64.rule`).",

  'dir-bruteforce': "`apt install feroxbuster ffuf gobuster`; `toolkit/dirsearch/dirsearch` is not in the setup.sh download list — "
    + "fetch the source from the maurosoria/dirsearch GitHub releases into `$DSH_HOME/redteam/toolkit/dirsearch/` and make sure it is executable.",

  'fofa-recon': "Set `FOFA_KEY`: sign in at <https://fofa.info> → Personal Center → API Key.\n"
    + "Write it into `$DSH_HOME/.env` (`FOFA_KEY=<your-key>`, `chmod 600`) or export it temporarily with `export FOFA_KEY=…`, then restart `dsh web` for it to take effect in this process; "
    + "self-test: `curl -s \"https://fofa.info/api/v1/info/my?key=$FOFA_KEY\"` must return `\"error\":false`.\n"
    + "You can also run `" + SETUP + "` (the script writes it for you and validates it on the spot).",

  'frp-tunnel': "Install `toolkit/frp/frps` and `toolkit/frp/frpc`: run `" + SETUP + "` (extracts both binaries at once).\n"
    + "The VPS side needs `REDTEAM_VPS_HOST` / `REDTEAM_VPS_KEY` (`$DSH_HOME/.env`); before commands run `set -a; . \"$DSH_HOME/.env\"; set +a`, "
    + "restart `dsh web` after changes, and open the frps listening port in the cloud security group.",

  'fscan-intranet': "Install `toolkit/fscan/fscan`: run `" + SETUP + "`; if only `fscan.zip` arrives, extract `fscan` manually and `chmod +x`.\n"
    + "The `<你的VPS_IP>` in the skill body is a placeholder: write `REDTEAM_VPS_HOST=<real-ip>` into `$DSH_HOME/.env` and restart `dsh web`, "
    + "or edit `$DSH_HOME/skills/fscan-intranet.md` directly and replace `<你的VPS_IP>` with the real address (payload service: run `vps.sh serve 9100` on the VPS).",

  'gogo-intranet': "`gogo` is not downloaded automatically by setup.sh: fetch the platform binary from the chainreactors/gogo GitHub releases, "
    + "put it at `$DSH_HOME/redteam/toolkit/gogo/gogo` (put Windows/arm64 variants in the same directory) and `chmod +x`.\n"
    + "Fill the `<你的VPS_IP>` placeholder the same way as `fscan-intranet`: write `REDTEAM_VPS_HOST` in `.env` and restart `dsh web`, "
    + "or edit `$DSH_HOME/skills/gogo-intranet.md` directly to replace the placeholder.",

  'kimi-webbridge': "Two things: the browser extension and the launcher. The extension is installed automatically from the Chrome Web Store by enterprise policy (ID `fldmhceldgbpfpkbgopacenieobmligc`); "
    + "on Chrome 137+ do not use `--load-extension`; if Chrome/Chromium is missing, first `apt install chromium` or install `google-chrome-stable`.\n"
    + "Create the launcher `~/.local/bin/kimi-chrome` (starts `/usr/bin/google-chrome` by default; `KIMI_BROWSER=chromium` switches to Chromium) and `chmod +x` it; "
    + "start the daemon with `sudo systemctl enable --now kimi-webbridge`.\n"
    + "If `extension_connected` in `curl -s http://127.0.0.1:10086/status` is `false`, start the browser (`kimi-chrome`) first and check again.",

  'lateral-movement': "`apt install python3-impacket enum4linux smbclient` (Kali ships 61 `/usr/bin/impacket-*`); for offline cracking `apt install hashcat`."
    + " Every command against intranet targets must go through the tunnel: `proxychains4 -f runs/proxychains-<port>.conf ...`; do not edit the system `proxychains` config.",

  'nuclei-scan': "`apt install nuclei`; if the template library `~/.local/nuclei-templates` is missing, run `nuclei -update-templates` (running `" + SETUP + "` also installs it)."
    + " After updating, first use `nuclei -tl` to confirm the library is intact; fewer than 1000 templates means the download was incomplete.",

  'passive-recon': "Depends only on `curl` / `dig` / `jq`: `apt install curl dnsutils jq`; this skill needs no API key."
    + " Unavailability usually means the skill file is missing or the plugin version is old — reinstall the plugin and restart `dsh web`.",

  'recon-pipeline': "Fill in the whole toolkit at once: run `" + SETUP + "` (subfinder / dnsx / naabu / httpx / ksubdomain are all included).\n"
    + "`~/.local/bin/pd-httpx` is a wrapper script pointing at `toolkit/httpx/httpx`; if missing, rebuild it per `TOOL_FIXES[\"pd-httpx\"]`; "
    + "failing to install OneForAll does not block the main path; use subfinder + ksubdomain instead.",

  'redteam-setup': "The environment setup script is at `$DSH_HOME/redteam/setup.sh`; if that file is absent this is the npm build — download "
    + "`dsh-redteam-mode-<版本>-toolkit.tar.gz` from the project GitHub Release, unpack it, and have the user follow the README steps inside.\n"
    + "After configuring `FOFA_KEY` and the VPS, restart `dsh web` and write the completion marker: `mkdir -p \"$DSH_HOME/redteam\" && date -Is > \"$DSH_HOME/redteam/.setup-complete\"`; finally run `redteam_preflight` once more to re-check.",

  'shell-handler': "Local listener tools: `apt install netcat-traditional socat tmux` (for the MSF path also `apt install metasploit-framework`).\n"
    + "VPS variables are read from `$DSH_HOME/.env`: before commands run `set -a; . \"$DSH_HOME/.env\"; set +a`; if `REDTEAM_VPS_HOST` is missing, run `" + SETUP + "` to add it; "
    + "after editing `.env` you must restart `dsh web`. Always keep listeners inside tmux so an SSH disconnect does not take the session with it.",

  'suo5-tunnel': "Install `toolkit/suo5/suo5-linux-amd64`: run `" + SETUP + "` (or fetch the same-named binary from the zema1/suo5 GitHub releases) and `chmod +x`.\n"
    + "The tunnel egress/relay depends on the VPS: configure `REDTEAM_VPS_HOST` / `REDTEAM_VPS_KEY` in `$DSH_HOME/.env`, then restart `dsh web`; "
    + "the WebShell at the tunnel entrance must be a Behinder/Godzilla shell (see the `webshell-toolkit` skill), otherwise it cannot be reused.",

  'unauth-exploit': "Install clients: `apt install redis-tools default-mysql-client python3-impacket` (use `impacket-mssqlclient` for MSSQL).\n"
    + "Intranet targets need a tunnel: `apt install proxychains4`, then use `-f runs/proxychains-<port>.conf`, or first set up SOCKS5 per the `suo5-tunnel` skill; "
    + "when `REDTEAM_VPS_HOST` is not configured, VPS-dependent steps are reported as unavailable.",

  'vps-reverse-shell': "Configure the VPS: run `" + SETUP + "` to be guided through writing `REDTEAM_VPS_HOST` (`user@host`) and `REDTEAM_VPS_KEY` (private-key path, default `$DSH_HOME/redteam/toolkit/vps/id_rsa`).\n"
    + "You can also write `$DSH_HOME/.env` manually and restart `dsh web`, or edit `$DSH_HOME/skills/vps-reverse-shell.md` directly and replace `<你的VPS_IP>` / `<VPS 主机名>` with the real address.\n"
    + "The private key must be `chmod 600`; verify connectivity with `ssh -i $DSH_HOME/redteam/toolkit/vps/id_rsa -o BatchMode=yes <user>@<ip> 'echo ok'`; open ports 22 and 9000-9999 in the security group.",

  'web-fingerprint': "If `~/.local/bin/pd-httpx` is missing, rebuild it per `TOOL_FIXES[\"pd-httpx\"]` (it execs `toolkit/httpx/httpx`); "
    + "if `nuclei` is missing, `apt install nuclei`; fill the tech-detection template library with `nuclei -update-templates`.",

  'webshell-toolkit': "`toolkit/Behinder`, `toolkit/Godzilla` and `toolkit/AntSword` are not in setup.sh; " + TOOLKIT_TARBALL + "."
    + " Fetch each from its own release page and put it in the matching directory.\n"
    + "The GUI needs Java and a graphical session: confirm with `java -version` (install with `apt install openjdk-17-jre` if missing), and `DISPLAY=:10.0`; "
    + "without a GUI, use `sed` to swap keys and generate a Behinder shell directly (templates are in `toolkit/Behinder/server/`).",
}

/* ── 内部工具 ─────────────────────────────────────────────────────────────── */

/** 常见扩展名（`fscan_windows_x64.exe`、`vps.sh`、`godzilla.jar` …）。 */
const EXT_RE = /\.(exe|zip|tar\.gz|tgz|gz|bz2|xz|jar|sh|py|bin|txt|md|json)$/i
/** 平台后缀（`_windows_x64`、`-linux-amd64`、`_darwin_arm64` …）。 */
const PLATFORM_RE = /[-_](windows|win32|win64|win|linux|darwin|macos|osx|freebsd)[-_][a-z0-9_.]+$/
/** 架构后缀（裸的 `_amd64` / `-arm64`）。 */
const ARCH_RE = /[-_](amd64|x86_64|x64|arm64|aarch64|arm|386|i386|i686|mips[a-z0-9]*)$/

/**
 * 把二进制/目录名字清成工具名：剥扩展名、剥平台与架构后缀、转小写。
 * 清完不含 ASCII 字母（例如 `清单.md`、纯符号）就返回 null —— 那就不是工具名。
 */
function cleanToolName(raw) {
  let out = String(raw == null ? '' : raw).trim()
  if (out === '') return null
  out = out.replace(EXT_RE, '')
  let prev = ''
  while (out !== '' && out !== prev) {
    prev = out
    out = out.replace(PLATFORM_RE, '').replace(ARCH_RE, '')
  }
  out = out.toLowerCase()
  return /[a-z]/.test(out) ? out : null
}

/**
 * 从路径里抽工具名（抽不出来返回 `null`）。
 *   · `…/redteam/toolkit/<工具>/…` → `toolkit/` 之后的第一段目录名（`suo5-linux-amd64` → `suo5`）
 *   · `~/.local/bin/xxx`、`/usr/bin/xxx`、`~/.local/xxx` → 文件名
 *   · 裸名字（`fscan_windows_x64.exe`、`gogo_linux_arm64`）→ 剥平台后缀后的名字
 *   · 其它路径（`/usr/share/wordlists/rockyou.txt`、`skills/x.md`）→ `null`
 */
export function toolNameOfPath(p) {
  if (typeof p !== 'string') return null
  const s = p.trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[，。；、：,;:)\]}>）】]+$/, '')
    .replace(/\\/g, '/')
  if (s === '') return null
  let candidate = null
  const at = s.lastIndexOf('toolkit/')
  if (at !== -1) {
    candidate = s.slice(at + 'toolkit/'.length).split('/').filter((seg) => seg !== '')[0] || null
  } else if (/\/bin\//.test(s) || /(^|\/)\.local\//.test(s)) {
    const segs = s.split('/').filter((seg) => seg !== '')
    candidate = segs.length > 0 ? segs[segs.length - 1] : null
  } else if (!s.includes('/')) {
    candidate = s
  }
  return candidate === null ? null : cleanToolName(candidate)
}

/** 别名的规范化：`impacket-wmiexec` 这类命令归到 `impacket` 这一条修法上。 */
function canonicalTool(name) {
  const n = String(name || '')
  if (n.startsWith('impacket-')) return 'impacket'
  if (n.startsWith('enum4linux-')) return 'enum4linux'
  return n
}

/** 环境变量怎么拿（拿不准的就不编，直接让用户填值）。 */
const ENV_HINTS = {
  FOFA_KEY: "Sign in at <https://fofa.info> → Personal Center → API Key; verify with `curl -s \"https://fofa.info/api/v1/info/my?key=$FOFA_KEY\"` — a `\"error\":false` response means it is valid",
  REDTEAM_VPS_HOST: "Enter the VPS login address as `user@host` (e.g. `export REDTEAM_VPS_HOST=ubuntu@203.0.113.10`)",
  REDTEAM_VPS_USER: "Enter the VPS login user (default `ubuntu`)",
  REDTEAM_VPS_KEY: "Enter the VPS private-key path (default `$DSH_HOME/redteam/toolkit/vps/id_rsa`; permissions must be `chmod 600`)",
}

function asArray(v) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim() !== '')
  if (typeof v === 'string' && v.trim() !== '') return [v]
  return []
}

/**
 * 由 `skill-availability.js` 的判定生成一条中文修复建议。
 *
 * @param issue - `{ kind, skill, paths?, env?, placeholder? }`，
 *   `kind` ∈ `'file-missing' | 'content-missing' | 'env-missing' | 'path-missing' | 'placeholder' | 'shadowed'`。
 *   也接受 `checkSkill()` 返回的 `problems` 之外的补充字段；字段类型宽松（字符串或数组都行）。
 * @returns 一条中文建议（不含换行；命令都在反引号里）。拿不准时回退到 `SKILL_FIXES[skill]`，再回退到通用建议。
 */
export function fixesForIssue(issue) {
  const it = issue && typeof issue === 'object' ? issue : {}
  const kind = typeof it.kind === 'string' ? it.kind : ''
  const skill = typeof it.skill === 'string' ? it.skill : ''
  const skillName = skill === '' ? "<skill name>" : skill
  const skillHint = skill !== '' && Object.prototype.hasOwnProperty.call(SKILL_FIXES, skill) ? SKILL_FIXES[skill] : ''
  const parts = []

  if (kind === 'path-missing') {
    const tools = []
    const seen = new Set()
    for (const p of asArray(it.paths)) {
      const name = toolNameOfPath(p)
      if (name === null) continue
      const canon = canonicalTool(name)
      if (seen.has(canon)) continue          // 同一个工具只列一次
      seen.add(canon)
      tools.push({ name, canon, path: p })
    }
    if (tools.length > 0) {
      const items = tools.map(({ name, canon, path }) => {
        const fix = Object.prototype.hasOwnProperty.call(TOOL_FIXES, canon) ? TOOL_FIXES[canon] : null
        if (fix === null) {
          return '`' + name + "` (" + path + "): this tool is not installed on this machine; run `" + SETUP + "` to install it; "
            + "if it is still missing, fetch the matching platform binary from the tool's official release page, put it at this path and `chmod +x`"
        }
        return '`' + name + "` (" + path + "): " + fix.what + ". Fix: " + fix.install
      })
      parts.push("Missing " + tools.length + " tools; fix them one by one: " + items.join("; ") + ".")
      parts.push("If unsure, first run `" + SETUP + "` (idempotent: missing items are downloaded, corrupted ones deleted and re-downloaded), then run the check again.")
    }
  } else if (kind === 'env-missing') {
    const names = asArray(it.env)
    if (names.length > 0) {
      const items = names.map((n) => {
        const hint = Object.prototype.hasOwnProperty.call(ENV_HINTS, n) ? ENV_HINTS[n] : "provide the value yourself"
        return '`' + n + "`: `export " + n + "=<value>` (" + hint + ")"
      })
      parts.push("Missing environment variables: " + items.join("; ") + ".")
      parts.push("To persist them: write into `$DSH_HOME/.env` (one `NAME=value` per line; `chmod 600` recommended); after changes you must restart `dsh web` for the current process to read them; "
        + "or run `" + SETUP + "` (the script guides you and validates `FOFA_KEY` and the VPS variables on the spot).")
    }
  } else if (kind === 'placeholder') {
    const ph = typeof it.placeholder === 'string' && it.placeholder.trim() !== '' ? it.placeholder.trim() : "External infrastructure address"
    parts.push("In the skill body, `" + ph + "` is still a placeholder (meaning this environment has no VPS configured yet).")
    parts.push("To fill it: run `" + SETUP + "` to be guided through writing `REDTEAM_VPS_HOST` (`user@host`) and `REDTEAM_VPS_KEY` (private-key path, default `$DSH_HOME/redteam/toolkit/vps/id_rsa`); "
      + "you can also write `$DSH_HOME/.env` manually and restart `dsh web`, or edit `$DSH_HOME/skills/" + skillName + ".md` directly and replace the placeholder with the real address (remember `chmod 600` on the private key).")
  } else if (kind === 'shadowed') {
    parts.push("The skill is shadowed by a same-named copy: `" + skillName + "` also has a same-named skill in another skill root (more completely configured), "
      + "but the incomplete copy that comes first in the current skill-root order is the one loaded.")
    parts.push("Fix: move the configured skill root to the front of the skill-root order (adjust the order in plugin/skill directory settings), restart `dsh web` and run the check again; "
      + "if the other copy is not needed, delete or rename it so it cannot shadow again.")
  } else if (kind === 'file-stale') {
    parts.push("The file path recorded for this skill does not exist on this machine (the skill body still loads, so calls are unaffected): such paths are absolute paths resolved on a previous machine and are bound to point nowhere after the move.")
    parts.push("Fix: restart `dsh web` once (plugin startup syncs the bundled skills to this machine's `$DSH_HOME/redteam/skills`); "
      + "if this machine's `DSH_HOME` differs from the directory the host actually uses (disk changed / installed in a non-default directory), point `DSH_HOME` at the one the host really uses and restart.")
  } else if (kind === 'file-missing') {
    parts.push("The skill file does not exist: reinstall the redteam plugin (or mount the skills directory back into the skill root) to restore the skill file, then restart `dsh web` and run the check again.")
    parts.push("If this is a skill you added yourself, confirm the file is under the skill root and the filename matches the skill name (`<skill-name>.md`).")
  } else if (kind === 'content-missing') {
    parts.push("The skill body cannot be read (metadata only, so availability cannot be judged): reinstall the redteam plugin to restore the skill file; "
      + "if it comes from a remote skill source, confirm the source is reachable and pull it again, then restart `dsh web`.")
    parts.push("To quickly check whether it works, have the agent use the `skill` tool to actually load `" + skillName + "`.")
  }

  if (parts.length === 0) parts.push(skillHint !== '' ? skillHint : GENERIC_FIX)
  return parts.join(' ')
}
