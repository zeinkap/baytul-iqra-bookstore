# Browser Testing with `/expect`

The `expect` MCP (Model Context Protocol) server enables the Cursor AI agent to open a real browser, interact with the app, take screenshots, and verify behaviour — all without writing any test code.

## What it does

`/expect` launches a headed Chromium browser, navigates to the running dev server (`http://localhost:3000`), and lets the agent perform actions and visual checks just like a human tester would. It is ideal for:

- Quickly verifying a feature works after making a change
- Smoke testing the full app before a PR
- Catching visual regressions that automated tests might miss
- Checking that toast messages, modals, and UI states render correctly

## Prerequisites

- The dev server must be running (`npm run dev`)
- Cursor must have the `user-expect` MCP server enabled (already configured in this project)

## Slash commands

Tell the agent any of the following in the Cursor chat:

```
Run /expect to test my changes in the browser
Run /expect to smoke test the app end to end
Run /expect to check for regressions after my changes
```

The agent will decide which pages and flows to exercise based on what you recently changed.

## What the agent checks during a smoke test

| Area | What is verified |
|------|-----------------|
| Homepage | Page renders, new arrivals carousel loads |
| Book detail | Book info, stock badge, Add to Cart button |
| Cart | Item added correctly, quantity/price shown in Order Summary |
| Remove from cart | Item removed, empty state ("Your cart is empty") shown |
| Search | Results return for a keyword, category filters render |
| Contact | Form fields and contact info panel render |

## Available tools (used automatically by the agent)

| Tool | Purpose |
|------|---------|
| `open` | Navigate to a URL, optionally in headed mode |
| `screenshot` | Capture a screenshot, annotated view, or ARIA snapshot |
| `playwright` | Run arbitrary Playwright code (clicks, fills, assertions) |
| `console_logs` | Read browser console output |
| `network_requests` | Inspect HTTP requests made by the page |
| `performance_metrics` | Measure page load and runtime performance |
| `accessibility_audit` | Run an accessibility audit on the current page |
| `close` | Close the browser when done |

## How the agent interacts with elements

The agent uses ARIA snapshots to get element references (e.g. `e7`) and then acts on them:

```
# Take a snapshot to get refs
screenshot mode=snapshot

# Use a ref to click a button
playwright: await ref('e7').click()

# Or use Playwright locators directly
playwright: await page.fill('input[placeholder*="Search"]', 'quran')
```

## Running the Playwright test suite (automated)

For the full automated test suite use:

```bash
# Run all 17 tests
PLAYWRIGHT_HTML_OPEN=never npx playwright test

# Run a single spec file
PLAYWRIGHT_HTML_OPEN=never npx playwright test tests/e2e/cart-management.spec.ts

# Debug a failing test (pauses at start, attach playwright-cli to inspect)
PLAYWRIGHT_HTML_OPEN=never npx playwright test --debug=cli
```

See [README.md](../README.md#testing) for the full test documentation.
