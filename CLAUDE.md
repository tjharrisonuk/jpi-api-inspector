# JPI API Inspector — Chrome Extension

A Manifest V3 Chrome extension for inspecting API responses that power JPI's 67 national newspaper titles, across both production and development environments.

## What it does

When browsing any JPI newspaper site (or a feature branch), clicking the extension icon shows the detected domain and current path, then lets you open the corresponding Prod or Dev API response in Chrome's side panel alongside the page.

## API URL pattern

```
https://jpi-api-{env}.brightsites.co.uk/api/{domain}?path={pathname}
```

- `{env}` — `prod` or `dev`
- `{domain}` — e.g. `nationalworld.com`
- `{pathname}` — the current page path, e.g. `/sport/football`

**Example:** `https://jpi-api-prod.brightsites.co.uk/api/nationalworld.com?path=/`

## Site detection

| Context | How domain is detected |
|---|---|
| Production site (e.g. `nationalworld.com`) | Extracted directly from the URL hostname |
| Feature branch (`jpi-web-dev-{branch}.brightsites.co.uk`) | Read from `window.JSGlobals.domain` via `chrome.scripting.executeScript` |

The current path is always taken from `window.location.pathname`.

## File structure

```
jpi-api-inspector/
├── manifest.json        # MV3 manifest — permissions, side panel config
├── sites.js             # The list of 67 domains (single source of truth)
├── background.js        # Service worker — minimal, configures side panel behaviour
├── popup.html           # Extension popup UI
├── popup.js             # Popup logic — site detection, button handlers
├── side_panel.html      # Side panel UI — JSON viewer
├── side_panel.js        # Side panel logic — fetch, render, storage listener
└── icons/               # PNG icons at 16, 48, 128px
```

## Adding or removing sites

Edit `sites.js` — it's the only file that needs changing. The `ALL_SITES` array is used by `popup.js` to recognise production domains.

## Key implementation details

- **Storage:** `chrome.storage.local` is used to pass the current API request from the popup to the side panel (`apiRequest` key). The side panel listens for changes via `chrome.storage.onChanged`.
- **Side panel:** Opened programmatically via `chrome.sidePanel.open({ tabId })` from the popup on button click. Requires Chrome 116+.
- **Scripting:** `chrome.scripting.executeScript` is used to read `JSGlobals.domain` on feature branch pages. Host permission `https://*.brightsites.co.uk/*` covers this.
- **JSON rendering:** Syntax highlighting is done with a lightweight inline regex replacement — no external libraries.

## Permissions used

| Permission | Reason |
|---|---|
| `activeTab` | Access the current tab's URL |
| `tabs` | Query the active tab |
| `scripting` | Read `JSGlobals.domain` on feature branch pages |
| `sidePanel` | Open and control the Chrome side panel |
| `storage` | Pass request data from popup to side panel |
| `host_permissions` | Fetch from `jpi-api-prod/dev.brightsites.co.uk` without CORS issues |
