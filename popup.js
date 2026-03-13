// ─────────────────────────────────────────────────────────────────────────────
// JPI API Inspector — Popup Logic
// ─────────────────────────────────────────────────────────────────────────────

const FEATURE_BRANCH_RE = /^jpi-web-dev-(.+)\.brightsites\.co\.uk$/;

const $ = (id) => document.getElementById(id);

function setState(name) {
  ['loading', 'unrecognised', 'detected'].forEach((s) => {
    $(`state-${s}`).hidden = s !== name;
  });
}

function buildApiUrl(env, domain, path) {
  return `https://jpi-api-${env}.brightsites.co.uk/api/${domain}?path=${encodeURIComponent(path)}`;
}

async function openJsGlobalsInPanel(tabId, domain, path) {
  let data = null;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        try { return JSON.parse(JSON.stringify(window.JSGlobals)); } catch { return null; }
      },
    });
    data = results?.[0]?.result ?? null;
  } catch {
    data = null;
  }

  // Save current request as previous BEFORE overwriting it
  const { apiRequest: current } = await chrome.storage.local.get('apiRequest');
  await chrome.storage.local.set({
    previousApiRequest: current ?? null,
    apiRequest: {
      type: 'jsglobals',
      data,
      domain,
      path,
      timestamp: Date.now(),
    },
  });

  await chrome.sidePanel.open({ tabId });
  window.close();
}

async function openApiInPanel(env, domain, path, tabId) {
  const apiUrl = buildApiUrl(env, domain, path);

  // Save current request as previous BEFORE overwriting it
  const { apiRequest: current } = await chrome.storage.local.get('apiRequest');
  await chrome.storage.local.set({
    previousApiRequest: current ?? null,
    apiRequest: {
      url: apiUrl,
      env,
      domain,
      path,
      timestamp: Date.now(),
    },
  });

  await chrome.sidePanel.open({ tabId });
  window.close();
}

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    setState('unrecognised');
    return;
  }

  let url;
  try {
    url = new URL(tab.url);
  } catch {
    setState('unrecognised');
    return;
  }

  const hostname = url.hostname.replace(/^www\./, '');
  const path = url.pathname || '/';

  let domain = null;
  let branchName = null;

  // ── Production site ──────────────────────────────────────────────────────
  if (ALL_SITES.includes(hostname)) {
    domain = hostname;
  }

  // ── Feature branch ───────────────────────────────────────────────────────
  else {
    const branchMatch = url.hostname.match(FEATURE_BRANCH_RE);
    if (branchMatch) {
      branchName = branchMatch[1];
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: () => window.JSGlobals && window.JSGlobals.domain,
        });
        domain = results?.[0]?.result || null;
      } catch {
        // scripting may fail on certain pages; leave domain as null
      }
    }
  }

  // ── Not recognised ───────────────────────────────────────────────────────
  if (!domain) {
    setState('unrecognised');
    return;
  }

  // ── Show detected state ──────────────────────────────────────────────────
  $('detected-domain').textContent = domain;
  $('detected-path').textContent = path;

  if (branchName) {
    $('branch-name').textContent = `Feature branch: ${branchName}`;
    $('branch-indicator').hidden = false;
  }

  setState('detected');

  $('btn-prod').addEventListener('click', () =>
    openApiInPanel('prod', domain, path, tab.id)
  );
  $('btn-dev').addEventListener('click', () =>
    openApiInPanel('dev', domain, path, tab.id)
  );
  $('btn-jsglobals').addEventListener('click', () =>
    openJsGlobalsInPanel(tab.id, domain, path)
  );
});
