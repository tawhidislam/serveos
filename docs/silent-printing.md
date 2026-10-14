# Silent Printing (No Print Dialog)

The web platform **cannot** skip the print dialog from JavaScript — it's a hard
browser security boundary. To get true silent printing (paper comes out with
zero clicks), ServeOS ships with a tiny **local print agent** that runs on the
restaurant's POS/admin machine.

## How it works

```
┌────────────┐  realtime INSERT   ┌──────────────────┐   POST /print    ┌────────────────┐
│  Supabase  │ ─────────────────▶ │  Web app (admin) │ ───────────────▶ │  Print agent   │
└────────────┘                    └──────────────────┘                  └───────┬────────┘
                                                ▲                               │
                                                │ fallback: iframe              │ headless Chrome
                                                │ print dialog                  │ → PDF → `lp`
                                                ▼                               ▼
                                       (agent not running)            OS print queue → paper
```

- **Agent running** → HTML is POSTed to `http://127.0.0.1:38123/print`. The agent
  renders it to PDF with headless Chrome (so the `80mm` thermal `@page` CSS is
  respected) and sends it straight to the OS print queue via `lp`. **No dialog.**
- **Agent not running** → automatic fallback to the hidden-iframe method, which
  opens the normal print dialog. Everything still works, just not silent.

The web app probes the agent on load (and on tab focus), so you can start the
agent while the app is open and it picks it up.

## Setup (one-time, per machine)

**Prerequisites:** Node 18+, Google Chrome (or Chromium), and at least one
printer configured in **System Settings → Printers & Scanners** (CUPS).

```bash
npm run print-agent          # foreground — try it out
npm run print-agent:daemon   # background — daily use (logs: scripts/.print-agent.log)
```

Verify it's up:

```bash
curl http://127.0.0.1:38123/health
# {"ok":true,"printer":"YourPrinter","chrome":true}
```

Then in the web app: enable auto-print with the **printer icon** in the admin
header. A **green dot** on the icon means silent mode is active; **amber** means
it will fall back to the print dialog.

## Configuration (env vars)

| Variable | Default | Purpose |
|---|---|---|
| `PRINT_AGENT_PORT` | `38123` | Localhost port to listen on |
| `PRINT_AGENT_PRINTER` | *(CUPS default)* | Force a specific printer name |
| `PRINT_AGENT_CHROME` | *(auto-detect)* | Path to a Chrome/Chromium binary |
| `PRINT_AGENT_KEEP_PDF` | `false` | Keep rendered PDFs in `$TMPDIR/serveos-print-agent` for debugging |

Example — always print to the kitchen printer:

```bash
PRINT_AGENT_PRINTER="Star TSP100" npm run print-agent:daemon
```

## Security notes

- The agent binds to **127.0.0.1 only** — unreachable from the network.
- It accepts HTML from any locally-running browser tab (CORS `*` is required
  because the app may be served from any origin/domain). A malicious local
  page could in theory send print jobs; the risk is wasted paper, not data.
- No secrets, no database access — it only renders HTML and calls `lp`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Amber dot in the admin toolbar | Agent not running — `npm run print-agent:daemon` |
| `No printer configured` error | Add a printer in System Settings → Printers & Scanners |
| `Chrome not found` | Install Google Chrome or set `PRINT_AGENT_CHROME` |
| Wrong printer gets the ticket | Set `PRINT_AGENT_PRINTER` to the exact CUPS name (`lpstat -a`) |
| Re-print a PDF by hand | `PRINT_AGENT_KEEP_PDF=true`, then open files in `$TMPDIR/serveos-print-agent` |
| Agent dies after logout | Launch it via `launchd`/LaunchAgent, or keep the terminal session alive |

## Auto-start on login (optional, macOS)

Create `~/Library/LaunchAgents/com.serveos.print-agent.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.serveos.print-agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-c</string>
    <string>cd /path/to/breezy-dine && /usr/local/bin/node scripts/print-agent.mjs</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/serveos-print-agent.log</string>
  <key>StandardErrorPath</key><string>/tmp/serveos-print-agent.log</string>
</dict>
</plist>
```

Then: `launchctl load ~/Library/LaunchAgents/com.serveos.print-agent.plist`
