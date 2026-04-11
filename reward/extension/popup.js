// =============================================
// BING REWARDS AUTO - POPUP UI CONTROLLER
// Handles compact/expanded toggle, commands,
// and real-time state updates from background.js
// =============================================

// ---- DOM ELEMENTS ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  // Header
  pointsValue: $('#points-value'),
  pointsEarned: $('#points-earned'),
  btnToggleSize: $('#btn-toggle-size'),
  
  // Status
  statusBadge: $('#status-badge'),
  statusDot: $('#status-dot'),
  statusText: $('#status-text'),
  waveInfo: $('#wave-info'),
  progressBar: $('#progress-bar'),
  progressText: $('#progress-text'),
  
  // Buttons
  btnSearch: $('#btn-search'),
  btnStop: $('#btn-stop'),
  btnMaxMode: $('#btn-max-mode'),
  btnTasks: $('#btn-tasks'),
  btnPoints: $('#btn-points'),
  btnResetPage: $('#btn-reset-page'),
  btnResetProgress: $('#btn-reset-progress'),
  btnClearLogs: $('#btn-clear-logs'),
  
  // Config
  cfgLevel: $('#cfg-level'),
  cfgSearch: $('#cfg-search'),
  cfgSpeed: $('#cfg-speed'),
  speedBadge: $('#speed-badge'),
  speedDetail: $('#speed-detail'),
  cfgMobile: $('#cfg-mobile'),
  cfgMobileCount: $('#cfg-mobile-count'),
  cfgReadResult: $('#cfg-read-result'),
  mobileCountRow: $('#mobile-count-row'),
  autoSaveIndicator: $('#auto-save-indicator'),

  // Daily Progress
  dailyEarned: $('#daily-earned'),
  dailySearches: $('#daily-searches'),
  dailyCap: $('#daily-cap'),
  dailyCapFill: $('#daily-cap-fill'),
  dailyCapText: $('#daily-cap-text'),

  // Sections
  expandedSection: $('#expanded-section'),
  logWindow: $('#log-window')
};

// ---- SIZE TOGGLE ----
let isExpanded = false;

// Load saved size preference
chrome.storage.local.get('uiExpanded', (result) => {
  if (result.uiExpanded) {
    isExpanded = true;
    document.body.classList.replace('compact', 'expanded');
  }
});

DOM.btnToggleSize.addEventListener('click', () => {
  isExpanded = !isExpanded;
  if (isExpanded) {
    document.body.classList.replace('compact', 'expanded');
  } else {
    document.body.classList.replace('expanded', 'compact');
  }
  chrome.storage.local.set({ uiExpanded: isExpanded });
});

// ---- INIT: Load state & config ----
async function init() {
  try {
    // Get current state
    const response = await chrome.runtime.sendMessage({ action: 'get_state' });
    if (response?.state) updateUI(response.state);
    if (response?.logs) {
      DOM.logWindow.innerHTML = '';
      response.logs.forEach(entry => addLogEntry(entry));
    }
    
    // Get config
    const configResponse = await chrome.runtime.sendMessage({ action: 'get_config' });
    if (configResponse?.config) loadConfig(configResponse.config);
    
  } catch (e) {
    addLogEntry({ text: '⚡ Extension ready', type: 'info', time: new Date().toLocaleTimeString() });
  }
}

// ---- UI UPDATE ----
function updateUI(state) {
  // Points — show '---' if never checked, real number otherwise
  const pts = state.points?.current;
  DOM.pointsValue.textContent = (pts !== null && pts !== undefined)
    ? pts.toLocaleString()
    : '---';

  // Earned badge — only show if we have real data
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
  
  // Status badge
  const status = state.status || 'idle';
  DOM.statusBadge.className = `status-badge ${status}`;
  
  const statusLabels = {
    idle: 'Idle',
    running: 'Running',
    cooldown: 'Wave Pause',
    stopped: 'Stopped',
    done: 'Completed',
    error: 'Error'
  };
  DOM.statusText.textContent = statusLabels[status] || status;
  
  // Wave info
  if (state.wave?.current > 0 && state.wave?.total > 0) {
    DOM.waveInfo.textContent = `Wave ${state.wave.current}/${state.wave.total}`;
  } else {
    DOM.waveInfo.textContent = '';
  }
  
  // Progress
  DOM.progressBar.style.width = `${state.percent || 0}%`;
  DOM.progressText.textContent = state.progress || '0/0';
  
  // Button states
  const isRunning = status === 'running' || status === 'cooldown';
  DOM.btnSearch.disabled = isRunning;
  DOM.btnTasks.disabled = isRunning;
  DOM.btnSearch.style.opacity = isRunning ? '0.5' : '1';
  DOM.btnTasks.style.opacity = isRunning ? '0.5' : '1';
}

// ---- SPEED LEVELS ----
const SPEED_LEVELS = {
  1: { name: 'Siêu an toàn',  minDelay: 50, maxDelay: 90,  waveSize: 2, wavePause: 20, color: '#10b981' },
  2: { name: 'An toàn',       minDelay: 35, maxDelay: 60,  waveSize: 3, wavePause: 12, color: '#34d399' },
  3: { name: 'Bình thường',   minDelay: 20, maxDelay: 40,  waveSize: 5, wavePause: 8,  color: '#00e5ff' },
  4: { name: 'Nhanh',         minDelay: 12, maxDelay: 25,  waveSize: 6, wavePause: 4,  color: '#f59e0b' },
  5: { name: 'Rất nhanh',     minDelay: 8,  maxDelay: 15,  waveSize: 7, wavePause: 3,  color: '#ef4444' },
  6: { name: 'Tốc biến ⚠️',   minDelay: 5,  maxDelay: 10,  waveSize: 8, wavePause: 2,  color: '#dc2626' }
};

// Daily point caps by tier (must match background.js TIER_LIMITS)
const TIER_CAPS = {
  member: { pcSearch: 10,  mobileSearch: 0,  dailyPointCap: 15  },
  silver: { pcSearch: 15,  mobileSearch: 10, dailyPointCap: 30  },
  gold:   { pcSearch: 30,  mobileSearch: 20, dailyPointCap: 100 }
};

function updateSpeedDisplay(level) {
  const s = SPEED_LEVELS[level];
  if (!s) return;
  DOM.speedBadge.textContent = `Lv.${level} — ${s.name}`;
  DOM.speedBadge.style.color = s.color;
  DOM.speedDetail.textContent = `Delay ${s.minDelay}-${s.maxDelay}s · Wave ${s.waveSize} · Pause ${s.wavePause}p`;
}

// Live slider preview
DOM.cfgSpeed.addEventListener('input', () => {
  updateSpeedDisplay(parseInt(DOM.cfgSpeed.value));
  scheduleAutoSave();
});

// ---- DAILY PROGRESS ----
let currentDailyCap = 100;

function updateDailyProgressUI(dp) {
  if (!dp) return;
  const tier = DOM.cfgLevel?.value || 'gold';
  currentDailyCap = TIER_CAPS[tier]?.dailyPointCap || 100;

  const earned = dp.earnedToday || 0;
  const searches = dp.searchesDone || 0;
  const pct = Math.min(100, Math.round((earned / currentDailyCap) * 100));

  DOM.dailyEarned.textContent = `+${earned} pts`;
  DOM.dailyEarned.style.color = earned > 0 ? '#10b981' : 'var(--text-secondary)';
  DOM.dailySearches.textContent = `~${searches} lần`;
  DOM.dailyCap.textContent = `${earned}/${currentDailyCap}`;
  DOM.dailyCapFill.style.width = `${pct}%`;
  DOM.dailyCapFill.style.background = pct >= 100
    ? 'linear-gradient(90deg, #10b981, #34d399)'
    : pct >= 75
      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
      : 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))';
  DOM.dailyCapText.textContent = `${pct}%${pct >= 100 ? ' ✅' : ''}`;
}

async function loadDailyProgress() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get_daily_progress' });
    if (response?.dp) updateDailyProgressUI(response.dp);
  } catch (e) {}
}

// ---- TIER SYNC HELPERS ----
// Cập nhật max attr + giá trị search count theo tier
function syncSearchCountToTier(tierKey) {
  const tier = TIER_CAPS[tierKey];
  if (!tier) return;

  // Cập nhật max của input
  DOM.cfgSearch.max = tier.pcSearch;
  DOM.cfgMobileCount.max = tier.mobileSearch || 20;

  // Nếu giá trị hiện tại vượt giới hạn mới → reset về max
  const currentPC = parseInt(DOM.cfgSearch.value) || 0;
  if (currentPC > tier.pcSearch || currentPC === 0) {
    DOM.cfgSearch.value = tier.pcSearch;
  }

  const currentMobile = parseInt(DOM.cfgMobileCount?.value) || 0;
  if (currentMobile > (tier.mobileSearch || 20) || currentMobile === 0) {
    if (DOM.cfgMobileCount) DOM.cfgMobileCount.value = tier.mobileSearch || 20;
  }

  // Cập nhật daily cap hiển thị
  currentDailyCap = tier.dailyPointCap || 100;
}

// ---- CONFIG ----
function loadConfig(config) {
  if (config.rewardsLevel) {
    DOM.cfgLevel.value = config.rewardsLevel;
    currentDailyCap = TIER_CAPS[config.rewardsLevel]?.dailyPointCap || 100;
    syncSearchCountToTier(config.rewardsLevel);
  }
  // Sau khi sync, áp dụng saved values (sẽ không vượt max)
  if (config.searchCount) DOM.cfgSearch.value = Math.min(config.searchCount, parseInt(DOM.cfgSearch.max) || 30);
  if (config.speedLevel) {
    DOM.cfgSpeed.value = config.speedLevel;
    updateSpeedDisplay(config.speedLevel);
  } else {
    DOM.cfgSpeed.value = 3;
    updateSpeedDisplay(3);
  }
  if (config.mobileMode !== undefined) {
    DOM.cfgMobile.checked = config.mobileMode;
    DOM.mobileCountRow.style.display = config.mobileMode ? 'block' : 'none';
  }
  if (config.mobileSearchCount && DOM.cfgMobileCount) {
    DOM.cfgMobileCount.value = Math.min(config.mobileSearchCount, parseInt(DOM.cfgMobileCount.max) || 20);
  }
  if (config.readResult !== undefined) DOM.cfgReadResult.checked = config.readResult;
}

function getConfigFromUI() {
  const speedLevel = parseInt(DOM.cfgSpeed.value) || 3;
  const s = SPEED_LEVELS[speedLevel];
  return {
    rewardsLevel: DOM.cfgLevel.value,
    searchCount: parseInt(DOM.cfgSearch.value) || 30,
    mobileSearchCount: parseInt(DOM.cfgMobileCount?.value) || 20,
    speedLevel: speedLevel,
    minDelay: s.minDelay,
    maxDelay: s.maxDelay,
    waveSize: s.waveSize,
    wavePauseMin: s.wavePause,
    mobileMode: DOM.cfgMobile.checked,
    readResult: DOM.cfgReadResult?.checked !== false
  };
}

// ---- AUTO-SAVE ----
let autoSaveTimer = null;

function showSavedIndicator() {
  const ind = DOM.autoSaveIndicator;
  if (!ind) return;
  ind.classList.add('visible');
  setTimeout(() => ind.classList.remove('visible'), 1800);
}

// Khi đổi Tier → tự động sync số search về đúng giới hạn tier mới
DOM.cfgLevel.addEventListener('change', () => {
  syncSearchCountToTier(DOM.cfgLevel.value);
  scheduleAutoSave();
});

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    const config = getConfigFromUI();
    try {
      await chrome.runtime.sendMessage({ action: 'save_config', config });
      showSavedIndicator();
      // Cập nhật daily cap display khi đổi level
      currentDailyCap = TIER_CAPS[config.rewardsLevel]?.dailyPointCap || 100;
      await loadDailyProgress();
    } catch (e) {}
  }, 800);
}

// Gán auto-save cho tất cả inputs cấu hình
['change', 'input'].forEach(ev => {
  [DOM.cfgLevel, DOM.cfgSearch, DOM.cfgMobile, DOM.cfgReadResult].forEach(el => {
    el?.addEventListener(ev, scheduleAutoSave);
  });
});

// ---- LOGGING ----
function addLogEntry(entry) {
  const div = document.createElement('div');
  div.className = `log-entry ${entry.type || 'info'}`;
  div.innerHTML = `<span class="log-time">[${entry.time || '--:--:--'}]</span> ${escapeHtml(entry.text)}`;
  
  // Append (newest at bottom — terminal style)
  DOM.logWindow.appendChild(div);
  
  // Auto-scroll to bottom (luôn thấy log mới nhất)
  DOM.logWindow.scrollTop = DOM.logWindow.scrollHeight;
  
  // Limit entries (xóa cũ nhất ở trên)
  while (DOM.logWindow.children.length > 100) {
    DOM.logWindow.removeChild(DOM.logWindow.firstChild);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---- MESSAGE LISTENER ----
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'state_update') updateUI(msg.data);
  if (msg.action === 'log') addLogEntry(msg.data);
  if (msg.action === 'daily_progress') updateDailyProgressUI(msg.data);
});

// ---- EVENT HANDLERS ----
function sendCommand(command) {
  chrome.runtime.sendMessage({ action: 'command', command });
}

DOM.btnSearch.addEventListener('click', () => sendCommand('start_search'));
DOM.btnStop.addEventListener('click', () => sendCommand('stop'));
DOM.btnMaxMode.addEventListener('click', () => {
  sendCommand('start_max_mode');
});
DOM.btnTasks.addEventListener('click', () => sendCommand('daily_tasks'));
DOM.btnPoints.addEventListener('click', () => sendCommand('check_points'));
DOM.btnResetPage.addEventListener('click', () => sendCommand('reset_page'));

DOM.btnResetProgress.addEventListener('click', () => {
  if (confirm('Xóa tiến trình hiện tại?')) sendCommand('reset_progress');
});

// Mobile toggle → hiện/ẩn mobile count
DOM.cfgMobile.addEventListener('change', () => {
  DOM.mobileCountRow.style.display = DOM.cfgMobile.checked ? 'block' : 'none';
  scheduleAutoSave();
});

// Mobile count auto-save
DOM.cfgMobileCount?.addEventListener('input', scheduleAutoSave);

DOM.btnClearLogs.addEventListener('click', () => {
  DOM.logWindow.innerHTML = '';
  addLogEntry({ text: 'Log cleared', type: 'info', time: new Date().toLocaleTimeString() });
});

// Max Mode — disable/enable khi đang chạy
DOM.btnMaxMode.addEventListener('mouseenter', () => {
  const tier = TIER_CAPS[DOM.cfgLevel.value] || TIER_CAPS.gold;
  DOM.btnMaxMode.title = `Max Mode: chạy đến hết ${tier.dailyPointCap} pts/ngày`;
});

// ---- POLL STATE (backup for when popup was closed) ----
setInterval(async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get_state' });
    if (response?.state) updateUI(response.state);
  } catch(e) {}
}, 3000);

// ---- INIT ----
async function init() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'get_state' });
    if (response?.state) updateUI(response.state);
    if (response?.logs) {
      DOM.logWindow.innerHTML = '';
      response.logs.forEach(entry => addLogEntry(entry));
    }
    const configResponse = await chrome.runtime.sendMessage({ action: 'get_config' });
    if (configResponse?.config) loadConfig(configResponse.config);
    // Load daily progress khi mở popup
    await loadDailyProgress();
  } catch (e) {
    addLogEntry({ text: '⚡ Extension ready', type: 'info', time: new Date().toLocaleTimeString() });
  }
}

init();
