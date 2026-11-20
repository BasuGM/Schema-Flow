#!/bin/sh
# Stops what a perf or e2e run can leave behind: headless Chrome from the perf scripts, Playwright's
# browsers and the static servers on :3000-:3002. Run it before measuring, and check that
# `uptime` shows a 1-minute load below 4. It never touches your own Chrome or `next dev`.
pkill -f schemaflow-perf 2>/dev/null
pkill -f ms-playwright 2>/dev/null
pkill -f "http.server 300[0-9]" 2>/dev/null
sleep 1
uptime
