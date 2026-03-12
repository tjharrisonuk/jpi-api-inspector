// ─────────────────────────────────────────────────────────────────────────────
// JPI API Inspector — Side Panel Logic
// ─────────────────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

// ── JSON syntax highlighter ───────────────────────────────────────────────────

function syntaxHighlight(json) {
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\],:])/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          // Key (strip trailing colon for colouring, then re-add)
          const key = match.slice(0, -1);
          return `<span class="json-key">${key}</span><span class="json-punct">:</span>`;
        }
        return `<span class="json-string">${match}</span>`;
      }
      if (/true|false/.test(match)) {
        return `<span class="json-bool">${match}</span>`;
      }
      if (/null/.test(match)) {
        return `<span class="json-null">${match}</span>`;
      }
      if (/[{}\[\],]/.test(match)) {
        return `<span class="json-punct">${match}</span>`;
      }
      return `<span class="json-number">${match}</span>`;
    }
  );
}

// ── Ad Config extraction ──────────────────────────────────────────────────────

// Recursively searches obj for a key named "adConfig" whose value is a number
// or numeric string (i.e. the ID itself, not a nested object).
function findAdConfigId(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 10) return null;

  if ('adConfig' in obj) {
    const val = obj.adConfig;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string' && /^\d+$/.test(val)) return val;
  }

  for (const val of Object.values(obj)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        const found = findAdConfigId(item, depth + 1);
        if (found) return found;
      }
    } else if (val && typeof val === 'object') {
      const found = findAdConfigId(val, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

function renderAdConfigCard(adConfigId, currentEnv) {
  const card = $('adconfig-card');
  if (!adConfigId) {
    card.hidden = true;
    return;
  }

  $('adconfig-id').textContent = `#${adConfigId}`;
  $('adconfig-link-prod').href =
    `https://jpi-api-prod.brightsites.co.uk/api/ad-config/${adConfigId}`;
  $('adconfig-link-dev').href =
    `https://jpi-api-dev.brightsites.co.uk/api/ad-config/${adConfigId}`;
  card.hidden = false;
}

// ── State helpers ─────────────────────────────────────────────────────────────

function showState(name) {
  ['empty', 'loading', 'error', 'result'].forEach((s) => {
    $(`state-${s}`).hidden = s !== name;
  });
  // Hide adConfig card whenever we're not showing a result
  if (name !== 'result') $('adconfig-card').hidden = true;
}

// ── Main fetch & render ───────────────────────────────────────────────────────

let currentRequest = null;

async function loadApiResponse(request) {
  if (!request) return;
  currentRequest = request;

  const { url, env, domain, path } = request;

  // Update header
  const badge = $('env-badge');
  badge.textContent = env.toUpperCase();
  badge.className = `env-badge ${env}`;
  badge.hidden = false;

  $('meta-domain').textContent = domain;
  $('meta-path').textContent = path;
  $('meta-section').hidden = false;

  showState('loading');

  const startTime = performance.now();

  try {
    const response = await fetch(url);
    const elapsed = Math.round(performance.now() - startTime);

    let data;
    let isJson = true;
    try {
      data = await response.json();
    } catch {
      isJson = false;
      data = await response.text().catch(() => '(empty response)');
    }

    // Status badge
    const statusEl = $('status-badge');
    statusEl.textContent = response.status;
    statusEl.className = `status-badge ${response.ok ? 'status-ok' : 'status-error'}`;
    $('response-time').textContent = `${elapsed}ms`;

    // Ad Config quick link
    const adConfigId = isJson ? findAdConfigId(data) : null;
    renderAdConfigCard(adConfigId, env);

    // Render JSON
    if (isJson) {
      $('json-content').innerHTML = syntaxHighlight(JSON.stringify(data, null, 2));
    } else {
      $('json-content').textContent = String(data);
    }

    showState('result');
  } catch (err) {
    $('error-message').textContent = err.message || String(err);
    showState('error');
  }
}

// ── Refresh button ────────────────────────────────────────────────────────────

$('btn-refresh').addEventListener('click', () => {
  if (currentRequest) {
    // Bump timestamp so storage change listener also fires correctly
    loadApiResponse({ ...currentRequest, timestamp: Date.now() });
  }
});

// ── Storage listener (new request from popup) ─────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.apiRequest) {
    loadApiResponse(changes.apiRequest.newValue);
  }
});

// ── Initial load ──────────────────────────────────────────────────────────────

chrome.storage.local.get('apiRequest', ({ apiRequest }) => {
  if (apiRequest) {
    loadApiResponse(apiRequest);
  } else {
    showState('empty');
  }
});
