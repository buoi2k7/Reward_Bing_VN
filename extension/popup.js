// =============================================
// BING REWARDS AUTO - POPUP UI CONTROLLER
// Compact controller for direct-count search runs.
// =============================================

const $ = (sel) => document.querySelector(sel);
const isDetachedWindow = new URLSearchParams(location.search).get('detached') === '1';

if (isDetachedWindow) {
  document.body.classList.add('detached');
}

const SPEED_PRESETS = {
  1: { name: 'Chậm',      minDelay: 35, maxDelay: 55, color: '#10b981' },
  2: { name: 'Êm',        minDelay: 24, maxDelay: 36, color: '#34d399' },
  3: { name: 'Vừa',       minDelay: 14, maxDelay: 24, color: '#00e5ff' },
  4: { name: 'Nhanh',     minDelay: 8,  maxDelay: 14, color: '#f59e0b' },
  5: { name: 'Rất nhanh', minDelay: 5,  maxDelay: 9,  color: '#ef4444' },
  6: { name: 'Tối đa',    minDelay: 3,  maxDelay: 6,  color: '#dc2626' }
};

const DOM = {
  pointsValue: $('#points-value'),
  pointsEarned: $('#points-earned'),
  btnToggleSize: $('#btn-toggle-size'),
  statusBadge: $('#status-badge'),
  statusText: $('#status-text'),
  phaseInfo: $('#phase-info'),
  banChip: $('#ban-chip'),
  progressBar: $('#progress-bar'),
  progressText: $('#progress-text'),
  btnSearch: $('#btn-search'),
  btnStop: $('#btn-stop'),
  btnPoints: $('#btn-points'),
  btnCheckBan: $('#btn-check-ban'),
  btnResetPage: $('#btn-reset-page'),
  btnResetProgress: $('#btn-reset-progress'),
  btnClearData: $('#btn-clear-data'),
  btnClearLogs: $('#btn-clear-logs'),
  btnDetachWindow: $('#btn-detach-window'),
  cfgSearch: $('#cfg-search'),
  cfgSpeed: $('#cfg-speed'),
  speedBadge: $('#speed-badge'),
  speedDetail: $('#speed-detail'),
  cfgMobile: $('#cfg-mobile'),
  cfgMobileCount: $('#cfg-mobile-count'),
  cfgReadResult: $('#cfg-read-result'),
  mobileCountRow: $('#mobile-count-row'),
  autoSaveIndicator: $('#auto-save-indicator'),
  dailyEarned: $('#daily-earned'),
  dailySearches: $('#daily-searches'),
  dailySplit: $('#daily-split'),
  logWindow: $('#log-window')
};

let isExpanded = false;
let autoSaveTimer = null;

chrome.storage.local.get('uiExpanded', (result) => {
  if (!result.uiExpanded) return;
  isExpanded = true;
  document.body.classList.replace('compact', 'expanded');
});

DOM.btnToggleSize?.addEventListener('click', () => {
  isExpanded = !isExpanded;
  document.body.classList.toggle('expanded', isExpanded);
  document.body.classList.toggle('compact', !isExpanded);
  chrome.storage.local.set({ uiExpanded: isExpanded });
  resizeDetachedWindow();
});

DOM.btnDetachWindow?.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'command', command: 'open_control_window' });
  window.close();
});

if (DOM.btnDetachWindow) {
  DOM.btnDetachWindow.style.display = isDetachedWindow ? 'none' : '';
}

async function resizeDetachedWindow() {
  if (!isDetachedWindow || !chrome.windows) return;
  try {
    const win = await chrome.windows.getCurrent();
    await chrome.windows.update(win.id, {
      width: isExpanded ? 720 : 380,
      height: isExpanded ? 640 : 600
    });
  } catch (e) {}
}

async function saveDetachedBounds() {
  if (!isDetachedWindow || !chrome.windows) return;
  try {
    const win = await chrome.windows.getCurrent();
    await chrome.storage.local.set({
      controlWindowBounds: {
        left: win.left,
        top: win.top,
        width: win.width,
        height: win.height
      }
    });
  } catch (e) {}
}

function initDetachedDrag() {
  if (!isDetachedWindow || !chrome.windows) return;
  const header = $('#header');
  if (!header) return;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let windowId = null;

  header.addEventListener('mousedown', async (event) => {
    if (event.button !== 0 || event.target.closest('button, input, select, a')) return;
    try {
      const win = await chrome.windows.getCurrent();
      windowId = win.id;
      startX = event.screenX;
      startY = event.screenY;
      startLeft = win.left || 0;
      startTop = win.top || 0;
      dragging = true;
      document.body.classList.add('dragging');
      event.preventDefault();
    } catch (e) {}
  });

  window.addEventListener('mousemove', (event) => {
    if (!dragging || windowId === null) return;
    chrome.windows.update(windowId, {
      left: Math.round(startLeft + event.screenX - startX),
      top: Math.round(startTop + event.screenY - startY)
    });
  });

  window.addEventListener('mouseup', async () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('dragging');
    await saveDetachedBounds();
  });

  window.addEventListener('beforeunload', saveDetachedBounds);
}

function updateUI(state) {
  const pts = state.points?.current;
  DOM.pointsValue.textContent = pts !== null && pts !== undefined ? pts.toLocaleString() : '---';

  const earned = state.points?.earned;
  if (earned !== null && earned !== undefined && earned !== 0) {
    DOM.pointsEarned.textContent = `${earned > 0 ? '+' : ''}${earned}`;
    DOM.pointsEarned.style.color = earned > 0 ? '#10b981' : '#ef4444';
  } else if (pts !== null && earned === 0 && state.points?.baseline !== null) {
    DOM.pointsEarned.textContent = '±0';
    DOM.pointsEarned.style.color = '#6b7280';
  } else {
    DOM.pointsEarned.textContent = '';
    DOM.pointsEarned.style.color = '';
  }

  const status = state.status || 'idle';
  DOM.statusBadge.className = `status-badge ${status}`;
  DOM.statusText.textContent = ({
    idle: 'Idle',
    running: 'Running',
    stopped: 'Stopped',
    done: 'Completed',
    error: 'Error'
  })[status] || status;

  const phase = state.phase === 'mobile' ? 'Mobile' : 'PC';
  DOM.phaseInfo.textContent = status === 'running'
    ? `${phase}${state.currentQuery ? ` · ${state.currentQuery}` : ''}`
    : '';

  DOM.progressBar.style.width = `${state.percent || 0}%`;
  DOM.progressText.textContent = state.progress || '0/0';

  const running = status === 'running';
  DOM.btnSearch.disabled = running;
  DOM.btnCheckBan.disabled = running;
  DOM.btnStop.disabled = !running;
}

function renderBanStatus(banState) {
  if (!DOM.banChip) return;

  const status = (banState?.status || 'UNKNOWN').toUpperCase();
  const className = {
    OK: 'ok',
    WARN: 'warn',
    BAN: 'ban',
    UNKNOWN: 'unknown'
  }[status] || 'unknown';

  const label = {
    OK: 'BAN: OK',
    WARN: 'BAN: WARN',
    BAN: 'BAN: DETECT',
    UNKNOWN: 'BAN: --'
  }[status] || `BAN: ${status}`;

  const reasons = Array.isArray(banState?.reasons) ? banState.reasons : [];
  const updatedAt = banState?.updatedAt ? new Date(banState.updatedAt).toLocaleString() : '';

  DOM.banChip.className = `ban-chip ${className}`;
  DOM.banChip.textContent = label;
  DOM.banChip.title = reasons.length
    ? `${label}\n${reasons.slice(0, 3).join(' | ')}${updatedAt ? `\nUpdated: ${updatedAt}` : ''}`
    : `${label}${updatedAt ? `\nUpdated: ${updatedAt}` : ''}`;
}

function updateSpeedDisplay(level) {
  const preset = SPEED_PRESETS[level] || SPEED_PRESETS[3];
  DOM.speedBadge.textContent = preset.name;
  DOM.speedBadge.style.color = preset.color;
  DOM.speedDetail.textContent = `Delay ${preset.minDelay}-${preset.maxDelay}s · Không wave pause`;
}

function updateDailyProgressUI(dp) {
  if (!dp) return;
  DOM.dailyEarned.textContent = `+${dp.earnedToday || 0} pts`;
  DOM.dailyEarned.style.color = dp.earnedToday > 0 ? '#10b981' : 'var(--text-secondary)';
  DOM.dailySearches.textContent = `~${dp.searchesDone || 0} lần`;
  DOM.dailySplit.textContent = `${dp.pcDone || 0}/${dp.mobileDone || 0}`;
}

async function loadDailyProgress() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get_daily_progress' });
    if (response?.dp) updateDailyProgressUI(response.dp);
  } catch (e) {}
}

function loadConfig(config) {
  DOM.cfgSearch.value = Math.max(0, Number(config.searchCount) || 30);
  DOM.cfgSpeed.value = Number(config.speedPreset || config.speedLevel) || 3;
  updateSpeedDisplay(Number(DOM.cfgSpeed.value));
  DOM.cfgMobile.checked = !!config.mobileMode;
  DOM.mobileCountRow.style.display = DOM.cfgMobile.checked ? 'block' : 'none';
  DOM.cfgMobileCount.value = Math.max(0, Number(config.mobileSearchCount) || 20);
  DOM.cfgReadResult.checked = config.readResult !== false;
}

function getConfigFromUI() {
  const speedPreset = Number(DOM.cfgSpeed.value) || 3;
  const preset = SPEED_PRESETS[speedPreset] || SPEED_PRESETS[3];
  return {
    searchCount: Math.max(0, Number(DOM.cfgSearch.value) || 0),
    mobileSearchCount: Math.max(0, Number(DOM.cfgMobileCount.value) || 0),
    speedPreset,
    minDelay: preset.minDelay,
    maxDelay: preset.maxDelay,
    mobileMode: DOM.cfgMobile.checked,
    readResult: DOM.cfgReadResult.checked
  };
}

function showSavedIndicator() {
  if (!DOM.autoSaveIndicator) return;
  DOM.autoSaveIndicator.classList.add('visible');
  setTimeout(() => DOM.autoSaveIndicator.classList.remove('visible'), 1800);
}

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'save_config', config: getConfigFromUI() });
      showSavedIndicator();
      await loadDailyProgress();
    } catch (e) {}
  }, 500);
}

function addLogEntry(entry) {
  const div = document.createElement('div');
  div.className = `log-entry ${entry.type || 'info'}`;
  div.innerHTML = `<span class="log-time">[${entry.time || '--:--:--'}]</span> ${escapeHtml(entry.text || '')}`;
  DOM.logWindow.appendChild(div);
  DOM.logWindow.scrollTop = DOM.logWindow.scrollHeight;
  while (DOM.logWindow.children.length > 100) {
    DOM.logWindow.removeChild(DOM.logWindow.firstChild);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sendCommand(command) {
  chrome.runtime.sendMessage({ action: 'command', command });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'state_update') updateUI(msg.data);
  if (msg.action === 'log') addLogEntry(msg.data);
  if (msg.action === 'daily_progress') updateDailyProgressUI(msg.data);
  if (msg.action === 'ban_status') renderBanStatus(msg.data);
});

DOM.btnSearch?.addEventListener('click', () => sendCommand('start_search'));
DOM.btnStop?.addEventListener('click', () => sendCommand('stop'));
DOM.btnPoints?.addEventListener('click', () => sendCommand('check_points'));
DOM.btnCheckBan?.addEventListener('click', () => sendCommand('check_ban'));
DOM.btnResetPage?.addEventListener('click', () => sendCommand('reset_page'));
DOM.btnResetProgress?.addEventListener('click', () => {
  if (confirm('Xóa tiến trình hiện tại?')) sendCommand('reset_progress');
});
DOM.btnClearData?.addEventListener('click', () => {
  if (confirm('Xóa cache Bing, lịch sử từ khóa/search URL, autocomplete và site storage?\n\nSession đăng nhập MS/Bing sẽ được giữ nguyên.')) {
    sendCommand('clear_data');
  }
});
DOM.btnClearLogs?.addEventListener('click', () => {
  DOM.logWindow.innerHTML = '';
  addLogEntry({ text: 'Log cleared', type: 'info', time: new Date().toLocaleTimeString() });
});

DOM.cfgSpeed?.addEventListener('input', () => {
  updateSpeedDisplay(Number(DOM.cfgSpeed.value));
  scheduleAutoSave();
});

[DOM.cfgSearch, DOM.cfgMobileCount, DOM.cfgMobile, DOM.cfgReadResult].forEach((el) => {
  el?.addEventListener('input', scheduleAutoSave);
  el?.addEventListener('change', scheduleAutoSave);
});

DOM.cfgMobile?.addEventListener('change', () => {
  DOM.mobileCountRow.style.display = DOM.cfgMobile.checked ? 'block' : 'none';
});

setInterval(async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get_state' });
    if (response?.state) updateUI(response.state);
  } catch (e) {}
}, 3000);

async function init() {
  initDetachedDrag();
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get_state' });
    if (response?.state) updateUI(response.state);
    if (response?.logs) {
      DOM.logWindow.innerHTML = '';
      response.logs.forEach(addLogEntry);
    }

    const configResponse = await chrome.runtime.sendMessage({ action: 'get_config' });
    if (configResponse?.config) loadConfig(configResponse.config);

    const banResponse = await chrome.runtime.sendMessage({ action: 'get_ban_status' });
    if (banResponse?.banStatus) renderBanStatus(banResponse.banStatus);

    await loadDailyProgress();
  } catch (e) {
    addLogEntry({ text: '⚡ Extension ready', type: 'info', time: new Date().toLocaleTimeString() });
  }
}

init();
