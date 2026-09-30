#!/bin/sh
# Starts the Playwright MCP server for Claude Code.
#
# Claude Code cloud sessions ship Chromium at /opt/pw-browsers/chromium but
# no Google Chrome (Playwright MCP's default) and no display, so there we
# point at that Chromium and run headless. Everywhere else Playwright MCP's
# own defaults apply.
if [ -x /opt/pw-browsers/chromium ]; then
  exec npx -y @playwright/mcp@latest \
    --browser chromium \
    --executable-path /opt/pw-browsers/chromium \
    --headless \
    "$@"
fi
exec npx -y @playwright/mcp@latest "$@"
