// ─────────────────────────────────────────────────────────────────────────────
// JPI API Inspector — Background Service Worker
// ─────────────────────────────────────────────────────────────────────────────

// Enable the side panel to be opened from the extension action
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch(() => {});
