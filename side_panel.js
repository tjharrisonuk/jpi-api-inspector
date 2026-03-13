// ─────────────────────────────────────────────────────────────────────────────
// JPI API Inspector — Side Panel Logic
// ─────────────────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

// ── JSON Tree Renderer ────────────────────────────────────────────────────────

function escapeStr(s) {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function el(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function textEl(tag, className, text) {
  const e = el(tag, className);
  e.textContent = text;
  return e;
}

// Sets the collapsed state of a single .json-collapsible node
function setNodeCollapsed(node, collapsed) {
  const toggle   = node.querySelector(':scope > .json-header > .json-toggle');
  const openBkt  = node.querySelector(':scope > .json-header > .json-open-bkt');
  const preview  = node.querySelector(':scope > .json-header > .json-preview');
  const children = node.querySelector(':scope > .json-children');
  const footer   = node.querySelector(':scope > .json-footer');

  if (collapsed) {
    toggle.textContent  = '▶';
    openBkt.hidden      = true;
    preview.hidden      = false;
    if (children) children.hidden = true;
    if (footer)   footer.hidden   = true;
  } else {
    toggle.textContent  = '▼';
    openBkt.hidden      = false;
    preview.hidden      = true;
    if (children) children.hidden = false;
    if (footer)   footer.hidden   = false;
  }
}

// Recursively builds a DOM node for any JSON value
function buildNode(value, key, isLast) {
  const isArr = Array.isArray(value);
  const isObj = value !== null && typeof value === 'object';

  // ── Primitive ──────────────────────────────────────────────────────────────
  if (!isObj) {
    const row = el('div', 'json-row');

    if (key !== null) {
      row.appendChild(textEl('span', 'json-key', `"${escapeStr(String(key))}"`));
      row.appendChild(textEl('span', 'json-punct', ': '));
    }

    if (value === null)            row.appendChild(textEl('span', 'json-null',   'null'));
    else if (typeof value === 'boolean') row.appendChild(textEl('span', 'json-bool', String(value)));
    else if (typeof value === 'number')  row.appendChild(textEl('span', 'json-number', String(value)));
    else                           row.appendChild(textEl('span', 'json-string', `"${escapeStr(value)}"`));

    if (!isLast) row.appendChild(textEl('span', 'json-punct', ','));
    return row;
  }

  // ── Object / Array ─────────────────────────────────────────────────────────
  const entries    = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
  const count      = entries.length;
  const openBracket  = isArr ? '[' : '{';
  const closeBracket = isArr ? ']' : '}';
  const previewText  = isArr
    ? `${count} item${count !== 1 ? 's' : ''}`
    : `${count} ${count !== 1 ? 'keys' : 'key'}`;

  const collapsible = el('div', 'json-collapsible');

  // Header line: [key: ] ▼ { [preview]
  const header = el('div', 'json-header');

  if (key !== null) {
    header.appendChild(textEl('span', 'json-key', `"${escapeStr(String(key))}"`));
    header.appendChild(textEl('span', 'json-punct', ': '));
  }

  header.appendChild(textEl('span', 'json-toggle', '▼'));

  const openBkt = textEl('span', 'json-open-bkt json-punct', openBracket);
  header.appendChild(openBkt);

  // Collapsed preview: { 3 keys },
  const previewFull = `${previewText} ${closeBracket}${isLast ? '' : ','}`;
  const preview = textEl('span', 'json-preview', ` ${previewFull}`);
  preview.hidden = true;
  header.appendChild(preview);

  header.addEventListener('click', (e) => {
    e.stopPropagation();
    setNodeCollapsed(collapsible, collapsible.dataset.collapsed !== 'true');
    collapsible.dataset.collapsed = collapsible.dataset.collapsed !== 'true' ? 'true' : 'false';
  });

  collapsible.appendChild(header);

  // Children
  if (count > 0) {
    const childrenEl = el('div', 'json-children');
    entries.forEach(([k, v], i) => {
      childrenEl.appendChild(buildNode(v, isArr ? null : k, i === count - 1));
    });
    collapsible.appendChild(childrenEl);
  }

  // Footer: closing bracket
  const footer = el('div', 'json-footer');
  footer.appendChild(textEl('span', 'json-punct', closeBracket));
  if (!isLast) footer.appendChild(textEl('span', 'json-punct', ','));
  collapsible.appendChild(footer);

  collapsible.dataset.collapsed = 'false';
  return collapsible;
}

function renderJsonTree(data) {
  const container = el('div', 'json-tree');
  container.appendChild(buildNode(data, null, true));
  return container;
}

// Collapse or expand every node in the tree
function setAllCollapsed(collapsed) {
  $('json-content')
    .querySelectorAll('.json-collapsible')
    .forEach((node) => {
      setNodeCollapsed(node, collapsed);
      node.dataset.collapsed = collapsed ? 'true' : 'false';
    });
}

// ── Ad Config extraction ──────────────────────────────────────────────────────

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

  const url  = `https://jpi-api-${currentEnv}.brightsites.co.uk/api/ad-config/${adConfigId}`;
  const link = $('adconfig-link');
  link.href      = url;
  link.className = `btn-adconfig ${currentEnv}`;
  link.textContent = `${currentEnv === 'prod' ? 'Prod' : 'Dev'} Ad Config →`;

  card.hidden = false;
}

// ── Publication link ──────────────────────────────────────────────────────────

function renderPublicationCard(domain, currentEnv) {
  const url  = `https://jpi-api-${currentEnv}.brightsites.co.uk/api/publications/${domain}`;
  const link = $('publication-link');
  link.href      = url;
  link.className = `btn-adconfig ${currentEnv}`;
  $('publication-domain').textContent = domain;
  $('publication-card').hidden = false;
}

// ── State helpers ─────────────────────────────────────────────────────────────

function showState(name) {
  ['empty', 'loading', 'error', 'result'].forEach((s) => {
    $(`state-${s}`).hidden = s !== name;
  });

  // Show tree controls only when displaying a result
  $('tree-controls').hidden = name !== 'result';

  if (name !== 'result') {
    $('adconfig-card').hidden     = true;
    $('publication-card').hidden  = true;
  }
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
  badge.className   = `env-badge ${env}`;
  badge.hidden      = false;

  $('meta-domain').textContent = domain;
  $('meta-path').textContent   = path;
  $('meta-section').hidden     = false;

  showState('loading');

  const startTime = performance.now();

  try {
    const response = await fetch(url);
    const elapsed  = Math.round(performance.now() - startTime);

    let data;
    let isJson = true;
    try {
      data = await response.json();
    } catch {
      isJson = false;
      data   = await response.text().catch(() => '(empty response)');
    }

    // Status badge
    const statusEl = $('status-badge');
    statusEl.textContent = response.status;
    statusEl.className   = `status-badge ${response.ok ? 'status-ok' : 'status-error'}`;
    $('response-time').textContent = `${elapsed}ms`;

    // Publication quick link
    renderPublicationCard(domain, env);

    // Ad Config quick link
    const adConfigId = isJson ? findAdConfigId(data) : null;
    renderAdConfigCard(adConfigId, env);

    // Render JSON tree
    const contentEl = $('json-content');
    contentEl.innerHTML = '';
    if (isJson) {
      contentEl.appendChild(renderJsonTree(data));
    } else {
      contentEl.textContent = String(data);
    }

    showState('result');
  } catch (err) {
    $('error-message').textContent = err.message || String(err);
    showState('error');
  }
}

// ── Tree controls (expand / collapse all) ─────────────────────────────────────

$('btn-expand-all').addEventListener('click',   () => setAllCollapsed(false));
$('btn-collapse-all').addEventListener('click', () => setAllCollapsed(true));

// ── Refresh button ────────────────────────────────────────────────────────────

$('btn-refresh').addEventListener('click', () => {
  if (currentRequest) {
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
