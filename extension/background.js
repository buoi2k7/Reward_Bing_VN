// =============================================
// BING REWARDS AUTO v4.1 — BACKGROUND SERVICE WORKER
// Compact search runner:
//   - No Rewards Level / tier logic.
//   - No wave pauses.
//   - No 3-search/15-minute cooldown.
//   - Direct PC + optional Mobile counts from the popup.
// =============================================

importScripts('keywords-data.js', 'mobile-devices.js', 'api-network-handler.js', 'ban-detection.js');

// ═══════════════════════════════════════════════
// CONSTANTS & CONFIG
// ═══════════════════════════════════════════════

// Delay presets in seconds. These are the only pacing controls now.
const SPEED_PRESETS = {
  1: { name: 'Chậm',       minDelay: 35, maxDelay: 55, color: '#10b981' },
  2: { name: 'Êm',         minDelay: 24, maxDelay: 36, color: '#34d399' },
  3: { name: 'Vừa',        minDelay: 14, maxDelay: 24, color: '#00e5ff' },
  4: { name: 'Nhanh',      minDelay: 8,  maxDelay: 14, color: '#f59e0b' },
  5: { name: 'Rất nhanh',  minDelay: 5,  maxDelay: 9,  color: '#ef4444' },
  6: { name: 'Tối đa',     minDelay: 3,  maxDelay: 6,  color: '#dc2626' }
};

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════

let state = {
  status: 'idle',       // idle | running | stopped | done | error
  phase: 'pc',          // pc | mobile
  progress: '0/0',
  percent: 0,
  points: { current: null, earned: null, baseline: null },
  currentQuery: '',
};

let config = {
  searchCount: 30,
  mobileSearchCount: 20,
  speedPreset: 3,
  minDelay: 14,
  maxDelay: 24,
  mobileMode: false,
  readResult: true,
};

let dailyProgress = {
  date: '',
  earnedToday: 0,
  searchesDone: 0,
  pcDone: 0,
  mobileDone: 0,
  pointsBefore: null,
};

// Runtime vars
let searchTab = null;
let isRunning = false;
let logBuffer = [];
const MAX_LOG_ENTRIES = 150;
let runStartTime = 0;
let banStatus = {
  status: 'UNKNOWN', // UNKNOWN | OK | WARN | BAN
  reasons: [],
  signals: {},
  updatedAt: null
};

// ═══════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function gaussianDelay(min, max) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
  const mean = (min + max) / 2;
  const stddev = (max - min) / 6;
  return Math.round(Math.max(min, Math.min(max, mean + z * stddev)));
}

function getAdjustedDelay() {
  const speed = SPEED_PRESETS[config.speedPreset] || SPEED_PRESETS[3];
  return gaussianDelay(speed.minDelay, speed.maxDelay) * 1000;
}

function now() { return new Date().toLocaleTimeString('vi-VN', { hour12: false }); }

// ═══════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════

function log(text, type = 'info') {
  const entry = { text, type, time: now() };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) logBuffer.shift();
  
  // Broadcast to popup
  broadcast('log', entry);
  console.log(`[BRA ${type}] ${text}`);
}

// ═══════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════

function updateState(patch) {
  Object.assign(state, patch);
  broadcast('state_update', state);
}

function broadcast(action, data) {
  try {
    chrome.runtime.sendMessage({ action, data }).catch(() => {});
  } catch (e) {}
}

async function updateBanIndicatorUI() {
  try {
    const status = banStatus?.status || 'UNKNOWN';
    const badgeTextMap = {
      UNKNOWN: '…',
      OK: 'OK',
      WARN: '!',
      BAN: 'BAN'
    };
    const badgeColorMap = {
      UNKNOWN: '#64748b',
      OK: '#10b981',
      WARN: '#f59e0b',
      BAN: '#ef4444'
    };

    await chrome.action.setBadgeText({ text: badgeTextMap[status] || '…' });
    await chrome.action.setBadgeBackgroundColor({ color: badgeColorMap[status] || '#64748b' });

    const titleReason = (banStatus?.reasons || []).slice(0, 2).join(' | ');
    const title = titleReason
      ? `Bing Rewards Auto — ${status}: ${titleReason}`
      : `Bing Rewards Auto — ${status}`;
    await chrome.action.setTitle({ title });
  } catch (e) {
    // ignore badge/title update errors
  }
}

async function loadConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get(['config', 'dailyProgress'], result => {
      if (result.config) Object.assign(config, result.config);
      if (config.speedLevel && !config.speedPreset) config.speedPreset = config.speedLevel;
      delete config.speedLevel;
      delete config.rewardsLevel;
      delete config.waveSize;
      delete config.wavePauseMin;
      chrome.storage.local.set({ config });
      if (result.dailyProgress) {
        const today = new Date().toDateString();
        if (result.dailyProgress.date === today) {
          Object.assign(dailyProgress, result.dailyProgress);
        } else {
          // New day — reset
          dailyProgress = { date: today, earnedToday: 0, searchesDone: 0, pcDone: 0, mobileDone: 0, pointsBefore: null };
          chrome.storage.local.set({ dailyProgress });
        }
      }
      resolve();
    });
  });
}

async function saveConfig() {
  return new Promise(resolve => {
    chrome.storage.local.set({ config }, resolve);
  });
}

async function saveDailyProgress() {
  dailyProgress.date = new Date().toDateString();
  return new Promise(resolve => {
    chrome.storage.local.set({ dailyProgress }, resolve);
  });
}

function todayKey() {
  return new Date().toDateString();
}

async function getCachedSearchQuota() {
  return new Promise(resolve => {
    chrome.storage.local.get('searchQuota', ({ searchQuota }) => {
      if (!searchQuota || searchQuota.date !== todayKey()) {
        resolve(null);
        return;
      }
      resolve(searchQuota);
    });
  });
}

async function saveSearchQuota(quota) {
  return new Promise(resolve => {
    chrome.storage.local.set({
      searchQuota: {
        ...quota,
        date: todayKey(),
        updatedAt: new Date().toISOString()
      }
    }, resolve);
  });
}

async function cacheSearchQuotaFromActivities(activities) {
  const pc = activities.find(item => item.source === 'earn-breakdown' && item.key === 'bingSearch');
  const mobile = activities.find(item => item.source === 'earn-breakdown' && item.key === 'mobileSearch');
  if (!pc && !mobile) return null;

  const cached = await getCachedSearchQuota() || {};
  const quota = {
    ...cached,
    source: 'earn-breakdown'
  };

  if (pc) {
    quota.pc = pc.remaining;
    quota.pcCurrent = pc.current;
    quota.pcMax = pc.max;
  }

  if (mobile) {
    quota.mobile = mobile.remaining;
    quota.mobileCurrent = mobile.current;
    quota.mobileMax = mobile.max;
  }

  await saveSearchQuota(quota);
  return quota;
}

async function consumeSearchQuota(phase, count = 1) {
  const quota = await getCachedSearchQuota();
  if (!quota) return;

  const key = phase === 'mobile' ? 'mobile' : 'pc';
  if (Number.isFinite(Number(quota[key]))) {
    quota[key] = Math.max(0, Number(quota[key]) - count);
    await saveSearchQuota(quota);
  }
}

// ═══════════════════════════════════════════════
// MESSAGE HANDLER (Protocol matching popup.js)
// ═══════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {
    case 'command':
      handleCommand(msg.command);
      sendResponse({ ok: true });
      break;

    case 'get_state':
      sendResponse({ state, logs: logBuffer.slice(-50) });
      break;

    case 'get_config':
      sendResponse({ config });
      break;

    case 'save_config':
      if (msg.config) {
        Object.assign(config, msg.config);
        saveConfig();
      }
      sendResponse({ ok: true });
      break;

    case 'get_daily_progress':
      sendResponse({ dp: dailyProgress });
      break;

    case 'openExtractor':
      chrome.tabs.create({
        url: chrome.runtime.getURL('extract.html'),
        active: true
      });
      sendResponse({ ok: true });
      break;

    case 'intercepted_data':
      // Received intercepted API data from content-intercept.js bridge
      handleInterceptedData(msg.key, msg.data);
      sendResponse({ ok: true });
      break;

    case 'get_intercepted':
      sendResponse({ interceptedCache });
      break;

    case 'BAN_STATUS_UPDATE':
      handleBanStatusUpdate(msg.apiData, msg.timestamp);
      sendResponse({ ok: true });
      break;

    case 'get_ban_status':
      sendResponse({ banStatus });
      break;

    default:
      sendResponse({ error: 'unknown' });
  }
  return false;
});

// ═══════════════════════════════════════════════
// INTERCEPT DATA HANDLER
// ═══════════════════════════════════════════════

let interceptedCache = {
  userInfo: null,
  userInfoFull: null,
  pointsBreakdown: null,
  lastUpdate: 0,
  searchProgress: { pc: null, mobile: null, edge: null },
  points: null,
};

function handleInterceptedData(key, data) {
  if (!key || !data) return;
  interceptedCache[key] = data;
  interceptedCache.lastUpdate = Date.now();

  // Auto-parse points and search progress
  try {
    const dashboard = data?.dashboard || data;
    const userStatus = dashboard?.userStatus || {};
    const counters = userStatus.counters || {};

    if (typeof userStatus.availablePoints === 'number') {
      interceptedCache.points = userStatus.availablePoints;
      state.points.current = userStatus.availablePoints;
      if (dailyProgress.pointsBefore !== null) {
        state.points.earned = userStatus.availablePoints - dailyProgress.pointsBefore;
        dailyProgress.earnedToday = state.points.earned;
      }
      updateState({ points: state.points });
      log(`📡 Intercept: ${userStatus.availablePoints} pts`, 'info');
    }

    // Parse search counters
    for (const [cKey, counter] of Object.entries(counters)) {
      if (!counter || typeof counter !== 'object') continue;
      const name = (counter.name || counter.description || cKey || '').toLowerCase();
      const progress = counter.count ?? counter.pointProgress ?? counter.progress ?? counter.pointprogress ?? 0;
      const max = counter.max ?? counter.pointProgressMax ?? counter.target ?? counter.completionTarget ?? counter.maxValue ?? counter.goal ?? counter.pointprogressmax ?? 0;
      const complete = counter.complete || false;

      if (name.includes('pc') || name.includes('desktop')) {
        interceptedCache.searchProgress.pc = { progress, max, complete };
      } else if (name.includes('mobile')) {
        interceptedCache.searchProgress.mobile = { progress, max, complete };
      } else if (name.includes('edge')) {
        interceptedCache.searchProgress.edge = { progress, max, complete };
      }
    }
  } catch (e) {
    console.warn('[BRA] Intercept parse error:', e);
  }
}

// Inject intercept script into rewards tab and read cached data
async function injectInterceptAndRead(tabId) {
  try {
    // Try reading from the page's window.__BRA_GET_SUMMARY__
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        if (typeof window.__BRA_GET_SUMMARY__ === 'function') {
          return window.__BRA_GET_SUMMARY__();
        }
        return null;
      }
    });
    const summary = results?.[0]?.result;
    if (summary && summary.hasData) {
      log(`📡 Intercept data found: ${summary.interceptCount} API calls captured`, 'info');
      if (summary.points !== null) {
        interceptedCache.points = summary.points;
        state.points.current = summary.points;
        updateState({ points: state.points });
      }
      if (summary.pc) interceptedCache.searchProgress.pc = summary.pc;
      if (summary.mobile) interceptedCache.searchProgress.mobile = summary.mobile;
      return summary;
    }
  } catch (e) {
    // Expected if tab is not a rewards page
  }
  return null;
}

// Get points preferring intercepted data, fallback to API
async function getPointsWithIntercept() {
  // 1. Check intercepted cache (< 2 min old)
  if (interceptedCache.points !== null && (Date.now() - interceptedCache.lastUpdate) < 120000) {
    return interceptedCache.points;
  }
  // 2. Try reading from any open rewards tab
  try {
    const tabs = await chrome.tabs.query({ url: ['*://rewards.bing.com/*', '*://rewards.microsoft.com/*'] });
    for (const tab of tabs) {
      const summary = await injectInterceptAndRead(tab.id);
      if (summary?.points !== null) return summary.points;
    }
  } catch (e) {}
  // 3. Fallback to direct API
  return await scrapePointsFromAPI();
}

function handleCommand(command) {
  switch (command) {
    case 'start_search':
      startSearch();
      break;
    case 'start_max_mode':
      startSearch();
      break;
    case 'stop':
      stopSearch();
      break;
    case 'check_points':
      checkPoints();
      break;
    case 'check_ban':
      checkAccountDiagnostics();
      break;
    case 'reset_page':
      resetPage();
      break;
    case 'reset_progress':
      resetProgress();
      break;
    case 'clear_data':
      clearBingData();
      break;
    case 'open_control_window':
      openControlWindow();
      break;
  }
}

// ═══════════════════════════════════════════════
// SEARCH ENGINE — Core Logic
// ═══════════════════════════════════════════════

async function startSearch() {
  if (isRunning) {
    log('⚠️ Đang chạy rồi', 'warn');
    return;
  }

  await loadConfig();
  isRunning = true;
  runStartTime = Date.now();

  const speed = SPEED_PRESETS[config.speedPreset] || SPEED_PRESETS[3];
  let pcCount = Math.max(0, Number(config.searchCount) || 0);
  let mobileCount = config.mobileMode ? Math.max(0, Number(config.mobileSearchCount) || 0) : 0;

  const activityPlan = await getActivitySearchPlan(pcCount, mobileCount);
  pcCount = activityPlan.pcCount;
  mobileCount = activityPlan.mobileCount;

  if (pcCount <= 0 && mobileCount <= 0) {
    log(activityPlan.reason || '⚠️ Không còn lượt search cần chạy theo dữ liệu activity.', 'warn');
    updateState({ status: 'done' });
    isRunning = false;
    return;
  }

  // Snapshot baseline points
  const basePoints = await scrapePointsFromAPI();
  if (basePoints !== null) {
    dailyProgress.pointsBefore = dailyProgress.pointsBefore ?? basePoints;
    state.points.baseline = dailyProgress.pointsBefore;
    state.points.current = basePoints;
    state.points.earned = basePoints - dailyProgress.pointsBefore;
  }

  log(`🚀 Bắt đầu — PC: ${pcCount}, Mobile: ${mobileCount} | Tốc độ: ${speed.name} (${speed.minDelay}-${speed.maxDelay}s)`, 'info');
  if (pcCount > 0) {
    await runSearchPhase('pc', pcCount, speed);
  }

  if (mobileCount > 0 && isRunning) {
    log('📱 Chuyển sang Mobile search...', 'info');
    const switchDelay = randomInt(5, 15) * 1000;
    log(`⏳ Chờ ${Math.round(switchDelay/1000)}s trước khi chạy mobile...`, 'info');
    await sleep(switchDelay);
    
    if (isRunning) {
      await runSearchPhase('mobile', mobileCount, speed);
    }
  }

  if (isRunning) {
    const finalPoints = await scrapePointsFromAPI();
    let earnedStr = '';
    if (finalPoints !== null && dailyProgress.pointsBefore !== null) {
      const earned = finalPoints - dailyProgress.pointsBefore;
      dailyProgress.earnedToday = earned;
      state.points.current = finalPoints;
      state.points.earned = earned;
      earnedStr = ` | Kiếm được: +${earned} pts`;
    }
    
    log(`🎯 HOÀN THÀNH! Searches: ${dailyProgress.searchesDone}${earnedStr}`, 'success');
    updateState({ status: 'done' });
    await saveDailyProgress();
    
    // Open done page
    openDonePage();
  }

  isRunning = false;
}

async function runSearchPhase(phase, count, speed) {
  updateState({ status: 'running', phase });

  // Get keywords
  const allKeywords = self.getAllKeywords();
  const keywords = [];
  const usedSet = new Set();
  
  for (let i = 0; i < count && allKeywords.length > 0; i++) {
    let kw;
    let attempts = 0;
    do {
      kw = allKeywords[randomInt(0, allKeywords.length - 1)];
      attempts++;
    } while (usedSet.has(kw) && attempts < 50);
    usedSet.add(kw);
    keywords.push(kw);
  }

  // Setup mobile if needed
  let mobileDevice = null;
  if (phase === 'mobile') {
    mobileDevice = getRandomMobileDevice();
    await ensureSearchTab(phase);
    await enableMobileUA(mobileDevice);
    if (searchTab) {
      await chrome.tabs.update(searchTab, { url: 'https://www.bing.com/' });
      await waitForTabLoad(searchTab, 20000);
      await sleep(randomInt(800, 1500));
    }
    log(`📱 Mobile device: ${mobileDevice.name}`, 'info');
  }

  let searchesDone = 0;

  for (let i = 0; i < keywords.length && isRunning; i++) {
    const keyword = keywords[i];
    updateState({
      progress: `${searchesDone}/${count}`,
      percent: Math.round((searchesDone / count) * 100),
      currentQuery: keyword,
    });

    log(`🔍 [${searchesDone + 1}/${count}] "${keyword}"`, 'search');

    const success = await performSingleSearch(keyword, phase, mobileDevice);
    
    if (success) {
      searchesDone++;
      dailyProgress.searchesDone++;
      if (phase === 'pc') dailyProgress.pcDone++;
      else dailyProgress.mobileDone++;
      await saveDailyProgress();
      await consumeSearchQuota(phase, 1);
      broadcast('daily_progress', dailyProgress);
    }

    if (i < keywords.length - 1 && isRunning) {
      const delay = getAdjustedDelay();
      log(`⏳ Đợi ${Math.round(delay/1000)}s...`, 'delay');
      await sleep(delay);
    }
  }

  // Cleanup mobile
  if (phase === 'mobile') {
    await disableMobileUA();
  }

  // Close search tab
  await closeSearchTab();

  updateState({
    progress: `${searchesDone}/${count}`,
    percent: 100,
    currentQuery: '',
  });
}

// ═══════════════════════════════════════════════
// SINGLE SEARCH
// ═══════════════════════════════════════════════

async function performSingleSearch(keyword, phase, mobileDevice) {
  try {
    // Ensure tab exists
    await ensureSearchTab(phase);
    
    if (!searchTab) {
      log('❌ Không thể tạo tab tìm kiếm', 'error');
      return false;
    }

    // Inject automation script
    await injectContentScript(searchTab);

    // Step 1: Get search box coordinates
    const coords = await executeInTab(searchTab, () => {
      return window.__BRA__?.getSearchCoords();
    });

    if (!coords) {
      // Fallback: navigate directly via URL
      return await fallbackUrlSearch(keyword, phase);
    }

    // Step 2: Click on search input (coordinate-based)
    await executeInTab(searchTab, (x, y) => {
      return window.__BRA__?.humanClickAtCoords(x, y);
    }, [coords.inputX, coords.inputY]);
    
    await sleep(randomInt(300, 700));

    // Step 3: Clear existing text
    await executeInTab(searchTab, () => {
      const input = document.querySelector('#sb_form_q') 
        || document.querySelector('textarea[name="q"]')
        || document.querySelector('input[name="q"]');
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    
    await sleep(randomInt(200, 500));

    // Step 4: Type keyword (human-like with typos)
    const typingSpeed = config.speedPreset <= 2 ? 'slow' : config.speedPreset >= 5 ? 'fast' : 'medium';
    await executeInTab(searchTab, (kw, speed) => {
      const input = document.querySelector('#sb_form_q') 
        || document.querySelector('textarea[name="q"]')
        || document.querySelector('input[name="q"]');
      if (input) return window.__BRA__?.humanTypeString(input, kw, speed);
    }, [keyword, typingSpeed]);
    
    await sleep(randomInt(400, 1000));

    // Step 5: Submit search (click button or press Enter)
    if (coords.hasBtn && Math.random() < 0.6) {
      // 60% click button
      await executeInTab(searchTab, (x, y) => {
        return window.__BRA__?.humanClickAtCoords(x, y);
      }, [coords.btnX, coords.btnY]);
    } else {
      // 40% press Enter (or fallback)
      await executeInTab(searchTab, () => {
        const form = document.querySelector('#sb_form');
        if (form) form.submit();
        else {
          const input = document.querySelector('#sb_form_q') 
            || document.querySelector('textarea[name="q"]')
            || document.querySelector('input[name="q"]');
          if (input) {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
          }
        }
      });
    }

    // Step 6: Wait for page load
    await waitForTabLoad(searchTab, 15000);
    await sleep(randomInt(1000, 2500));

    // Step 7: Re-inject content script after navigation
    await injectContentScript(searchTab);

    // Step 8: Optional result-page interaction
    if (config.readResult) {
      await executeInTab(searchTab, () => {
        return window.__BRA__?.enhancedSearchInteraction();
      });
    } else {
      // Even without readResult, do minimal scroll (looks more natural)
      await executeInTab(searchTab, () => {
        window.scrollBy({ top: Math.random() * 300 + 100, behavior: 'smooth' });
      });
      await sleep(randomInt(1500, 4000));
    }

    // Step 9: Occasionally click a result (15% chance)
    if (config.readResult && Math.random() < 0.15) {
      await clickResultAndRead();
    }

    return true;

  } catch (error) {
    log(`⚠️ Search error: ${error.message}`, 'warn');
    // Try fallback
    return await fallbackUrlSearch(keyword, phase);
  }
}

// Fallback: navigate directly to search URL
async function fallbackUrlSearch(keyword, phase) {
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(keyword)}&form=QBLH&sp=-1&lq=0&pq=${encodeURIComponent(keyword.toLowerCase())}&sc=0-${keyword.length}&qs=n&sk=`;
    
    if (searchTab) {
      await chrome.tabs.update(searchTab, { url });
    } else {
      const tab = await chrome.tabs.create({ url, active: false });
      searchTab = tab.id;
    }
    
    await waitForTabLoad(searchTab, 20000);
    await sleep(randomInt(2000, 5000));
    
    // Inject and simulate reading
    await injectContentScript(searchTab);
    if (config.readResult) {
      await executeInTab(searchTab, () => {
        return window.__BRA__?.enhancedSearchInteraction();
      });
    }
    
    return true;
  } catch (e) {
    log(`❌ Fallback search failed: ${e.message}`, 'error');
    return false;
  }
}

// Click a search result and read briefly
async function clickResultAndRead() {
  try {
    const resultCoords = await executeInTab(searchTab, async () => {
      return await window.__BRA__?.getResultCoords();
    });

    if (resultCoords) {
      log(`📖 Click kết quả: "${resultCoords.title}"`, 'info');
      
      await executeInTab(searchTab, (x, y) => {
        return window.__BRA__?.humanClickAtCoords(x, y);
      }, [resultCoords.x, resultCoords.y]);

      // Wait on result page (simulate reading 5-12 seconds)
      const readTime = randomInt(5000, 12000);
      await sleep(readTime);

      // Go back to search results
      try {
        await chrome.tabs.goBack(searchTab);
        await waitForTabLoad(searchTab, 10000);
        await sleep(randomInt(500, 1500));
      } catch (e) {
        // If goBack fails, navigate to Bing
        await chrome.tabs.update(searchTab, { url: 'https://www.bing.com/' });
        await waitForTabLoad(searchTab, 10000);
      }
    }
  } catch (e) {
    // Non-critical — ignore
  }
}

// ═══════════════════════════════════════════════
// TAB MANAGEMENT
// ═══════════════════════════════════════════════

async function ensureSearchTab(phase) {
  // Check if tab still exists
  if (searchTab) {
    try {
      await chrome.tabs.get(searchTab);
      return; // Tab exists
    } catch (e) {
      searchTab = null;
    }
  }

  // Create new tab
  const url = 'https://www.bing.com/';
  const tab = await chrome.tabs.create({ url, active: false });
  searchTab = tab.id;
  await waitForTabLoad(searchTab, 20000);
  await sleep(randomInt(1000, 2000));
}

async function closeSearchTab() {
  if (searchTab) {
    try {
      await chrome.tabs.remove(searchTab);
    } catch (e) {}
    searchTab = null;
  }
}

function waitForTabLoad(tabId, timeout = 15000) {
  return new Promise((resolve) => {
    let settled = false;
    
    const listener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === 'complete' && !settled) {
        settled = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(true);
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
    
    // Timeout
    setTimeout(() => {
      if (!settled) {
        settled = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(false);
      }
    }, timeout);
  });
}

// Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  if (searchTab === tabId) {
    searchTab = null;
  }
});

// ═══════════════════════════════════════════════
// CONTENT SCRIPT INJECTION
// ═══════════════════════════════════════════════

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-automation.js'],
      world: 'MAIN'
    });
  } catch (e) {
    // May already be injected, or page not ready
  }
}

async function executeInTab(tabId, func, args = []) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args,
      world: 'MAIN'
    });
    return results?.[0]?.result;
  } catch (e) {
    return null;
  }
}

// Execute in ISOLATED world (for API calls — has page cookies but no page JS interference)
async function executeInTabIsolated(tabId, func, args = []) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args,
      world: 'ISOLATED'
    });
    return results?.[0]?.result;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════
// MOBILE UA — DeclarativeNetRequest + Fingerprint
// ═══════════════════════════════════════════════

async function enableMobileUA(device) {
  try {
    // Enable the static ruleset
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: ['mobile_ua_rules']
    });

    // Also add dynamic rule with the specific device UA
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [100, 101],
      addRules: [
        {
          id: 100,
          priority: 2,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [{
              header: 'User-Agent',
              operation: 'set',
              value: device.userAgent
            }]
          },
          condition: {
            urlFilter: '*://www.bing.com/*',
            resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'stylesheet', 'script', 'image']
          }
        },
        {
          id: 101,
          priority: 2,
          action: {
            type: 'modifyHeaders',
            requestHeaders: [{
              header: 'User-Agent',
              operation: 'set',
              value: device.userAgent
            }]
          },
          condition: {
            urlFilter: '*://rewards.bing.com/*',
            resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest']
          }
        }
      ]
    });

    // Register mobile-override.js content script for fingerprint spoofing
    try {
      await chrome.scripting.unregisterContentScripts({ ids: ['mobile-override'] });
    } catch (e) {}

    // Inject mobile override variables before the page loads
    if (searchTab) {
      await chrome.scripting.executeScript({
        target: { tabId: searchTab },
        func: (ua, w, h, dpr) => {
          window.__BRA_MOBILE_UA__ = ua;
          window.__BRA_SCREEN_W__ = w;
          window.__BRA_SCREEN_H__ = h;
          window.__BRA_DPR__ = dpr;
          window.__BRA_VENDOR__ = ua.includes('iPhone') ? 'Apple Computer, Inc.' : 'Google Inc.';
          window.__BRA_PLATFORM__ = ua.includes('iPhone') ? 'iPhone' : 'Linux armv8l';
          window.__BRA_MAX_TOUCH__ = 5;
        },
        args: [device.userAgent, device.width, device.height, device.deviceScaleFactor],
        world: 'MAIN'
      });
      
      await chrome.scripting.executeScript({
        target: { tabId: searchTab },
        files: ['mobile-override.js'],
        world: 'MAIN'
      });
    }

    log(`📱 Mobile UA enabled: ${device.name}`, 'info');
  } catch (e) {
    log(`⚠️ Mobile UA setup error: ${e.message}`, 'warn');
  }
}

async function disableMobileUA() {
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: ['mobile_ua_rules']
    });
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [100, 101]
    });
    try {
      await chrome.scripting.unregisterContentScripts({ ids: ['mobile-override'] });
    } catch (e) {}
    log('🖥️ Mobile UA disabled, back to PC', 'info');
  } catch (e) {}
}

// ═══════════════════════════════════════════════
// POINTS CHECK
// ═══════════════════════════════════════════════

async function scrapePointsFromAPI() {
  // Strategy 1: Find an existing rewards.bing.com tab (same-origin fetch, no CORS)
  try {
    const rewardsTabs = await chrome.tabs.query({ url: ['*://rewards.bing.com/*', '*://rewards.microsoft.com/*'] });
    for (const tab of rewardsTabs) {
      try {
        const pts = await executeInTabIsolated(tab.id, () => {
          return fetch('/api/getuserinfo?type=1', { cache: 'no-cache', credentials: 'include' })
            .then(r => r.ok ? r.json() : null)
            .then(d => d?.dashboard?.userStatus?.availablePoints ?? null)
            .catch(() => null);
        });
        if (pts !== null) return pts;
      } catch (e) {}
    }
  } catch (e) {}

  // Strategy 2: Scrape points from DOM on any Bing tab (no cross-origin fetch)
  try {
    const bingTabs = await chrome.tabs.query({ url: ['*://www.bing.com/*'] });
    for (const tab of bingTabs) {
      try {
        const pts = await executeInTabIsolated(tab.id, () => {
          const el = document.querySelector('#id_rc')
            || document.querySelector('#id_rh')
            || document.querySelector('[title*="point"]')
            || document.querySelector('.points-container span');
          if (el) {
            const num = parseInt(el.textContent.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num) && num > 0) return num;
          }
          return null;
        });
        if (pts !== null) return pts;
      } catch (e) {}
    }
  } catch (e) {}

  // Strategy 3: Open a hidden rewards.bing.com tab, fetch API (same-origin), then close
  try {
    const tempTab = await chrome.tabs.create({
      url: 'https://rewards.bing.com/',
      active: false
    });
    await waitForTabLoad(tempTab.id, 20000);
    await sleep(3000);

    // Use ISOLATED world with Promise-based fetch (not async/await) for compatibility
    const pts = await executeInTabIsolated(tempTab.id, () => {
      return fetch('/api/getuserinfo?type=1', { cache: 'no-cache', credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(d => d?.dashboard?.userStatus?.availablePoints ?? null)
        .catch(() => {
          // Fallback: scrape points from page DOM
          const el = document.querySelector('#id_rc')
            || document.querySelector('.mee-icon-AddMedium + span')
            || document.querySelector('[data-testid="points-balance"]')
            || document.querySelector('.pointsValue');
          if (el) {
            const num = parseInt(el.textContent.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num) && num > 0) return num;
          }
          return null;
        });
    });

    // Close temp tab
    try { await chrome.tabs.remove(tempTab.id); } catch (e) {}

    if (pts !== null) return pts;
  } catch (e) {}

  return null;
}

async function checkPoints() {
  log('⭐ Kiểm tra điểm...', 'info');
  const points = await scrapePointsFromAPI();
  
  if (points !== null) {
    state.points.current = points;
    if (dailyProgress.pointsBefore !== null) {
      state.points.earned = points - dailyProgress.pointsBefore;
      dailyProgress.earnedToday = state.points.earned;
    }
    updateState({ points: state.points });
    log(`⭐ Điểm hiện tại: ${points.toLocaleString()}${state.points.earned !== null ? ` (+${state.points.earned})` : ''}`, 'success');
    broadcast('daily_progress', dailyProgress);
  } else {
    log('⚠️ Không thể lấy điểm. Hãy đăng nhập tại rewards.bing.com', 'warn');
  }
}

// ═══════════════════════════════════════════════
// ACCOUNT DIAGNOSTICS
// ═══════════════════════════════════════════════

async function fetchRewardsDiagnostics() {
  let tempTab = null;
  try {
    tempTab = await chrome.tabs.create({
      url: 'https://rewards.bing.com/earn',
      active: false
    });
    await waitForTabLoad(tempTab.id, 20000);
    await sleep(3500);

    return await executeInTabIsolated(tempTab.id, () => {
      const fetchJson = (url) => fetch(url, {
        cache: 'no-cache',
        credentials: 'include'
      }).then(async (response) => ({
        ok: response.ok,
        status: response.status,
        url,
        data: response.ok ? await response.json().catch(() => null) : null
      })).catch((error) => ({
        ok: false,
        status: 0,
        url,
        error: error.message
      }));

      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      const openPointsBreakdown = async () => {
        // Try multiple text patterns (English + Vietnamese + partial)
        const patterns = [/points breakdown/i, /phân tích điểm/i, /breakdown/i, /chi tiết điểm/i];
        let clickable = null;

        for (const pattern of patterns) {
          if (clickable) break;
          const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], div, span'))
            .filter((el) => pattern.test((el.innerText || el.textContent || '').trim()));
          clickable = candidates.find((el) => {
            const tag = el.tagName?.toLowerCase();
            return tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button';
          }) || candidates[0] || null;
        }

        if (clickable) {
          clickable.click();
          await delay(1500);
          return true;
        }
        return false;
      };

      const getXPathText = (xpath) => {
        try {
          const node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          return (node?.innerText || node?.textContent || '').trim();
        } catch (e) {
          return '';
        }
      };

      const getPointsBreakdownText = () => {
        const panelTexts = [];
        // Try multiple XPath patterns (original + more generic)
        [
          "/html/body/div[4]/div/section/div/div[2]",
          "/html/body/div[3]/div/section/div/div[2]",
          "/html/body/div[5]/div/section/div/div[2]",
          "//*[starts-with(@id,'react-aria-')]/div[1]/div[1]/div[3]",
          "//*[starts-with(@id,'react-aria-')]//div[contains(@class,'overflow')]",
          "//section[.//*[contains(normalize-space(.),'Points breakdown')]]",
          "//section[.//*[contains(normalize-space(.),'breakdown')]]",
          "//section[.//*[contains(normalize-space(.),'phân tích')]]",
          "//*[contains(normalize-space(.),'Desktop Bing search') and contains(normalize-space(.),'Mobile Bing search')]",
          "//*[contains(normalize-space(.),'search') and contains(normalize-space(.),'/')]",
          "//div[@role='dialog']",
          "//div[contains(@class,'modal')]",
          "//div[contains(@class,'overlay')]//section",
          "//div[contains(@class,'panel')]"
        ].forEach((xpath) => {
          const text = getXPathText(xpath);
          if (text && text.length > 10) panelTexts.push(text);
        });

        // Also try CSS selectors for dialog/panel/overlay
        ['[role="dialog"]', '[class*="modal"]', '[class*="overlay"] section', '[class*="panel"]', 'section[class*="breakdown"]'].forEach(sel => {
          try {
            document.querySelectorAll(sel).forEach(el => {
              const text = (el.innerText || el.textContent || '').trim();
              if (text && text.length > 20 && /\d+\s*\/\s*\d+/.test(text)) panelTexts.push(text);
            });
          } catch (e) {}
        });

        return [...new Set(panelTexts)].join('\n');
      };

      const activitySpec = [
        { key: 'bingSearch', title: 'Bing', metric: 'Search', regex: /Bing.{0,160}?Search:\s*(\d+)\s*\/\s*(\d+)/i },
        { key: 'dailySet', title: 'Daily Set', metric: 'Activity', regex: /Daily Set.{0,160}?Activity:\s*(\d+)\s*\/\s*(\d+)/i },
        { key: 'edgeMinutes', title: 'Edge', metric: 'Minutes', regex: /Edge.{0,160}?Minutes:\s*(\d+)\s*\/\s*(\d+)/i },
        { key: 'mobileApp', title: 'Mobile App', metric: 'Check-in', regex: /Mobile App.{0,160}?Check-in:\s*(\d+)\s*\/\s*(\d+)/i },
        { key: 'mobileSearch', title: 'Mobile Search', metric: 'Search', regex: /Mobile Search.{0,160}?Search:\s*(\d+)\s*\/\s*(\d+)/i }
      ];

      const classifyCard = (title, metric, text) => {
        const haystack = `${title} ${metric} ${text}`.toLowerCase();
        if (/streak/.test(haystack) && /search/.test(haystack)) return 'bingSearchStreak';
        if (/mobile/.test(haystack) && /search/.test(haystack)) return 'mobileSearch';
        if (/bing/.test(haystack) && /search/.test(haystack)) return 'bingSearch';
        if (/daily/.test(haystack)) return 'dailySet';
        if (/edge|minute/.test(haystack)) return 'edgeMinutes';
        if (/mobile app|check.?in/.test(haystack)) return 'mobileApp';
        if (/\bsearch\b/.test(haystack)) return 'bingSearch';
        return null;
      };

      const titleForKey = (key, fallback) => ({
        bingSearch: 'Bing',
        mobileSearch: 'Mobile Search',
        bingSearchStreak: 'Bing Search Streak',
        dailySet: 'Daily Set',
        edgeMinutes: 'Edge',
        mobileApp: 'Mobile App'
      })[key] || fallback || key;

      const parseActivityText = (text, source = 'dashboard-text') => {
        const clean = String(text || '').replace(/\s+/g, ' ');
        return activitySpec
          .map((spec) => {
            const match = clean.match(spec.regex);
            if (!match) return null;
            return {
              source,
              key: spec.key,
              title: spec.title,
              metric: spec.metric,
              current: Number(match[1]),
              max: Number(match[2])
            };
          })
          .filter(Boolean);
      };

      const parseEarnBreakdown = (text) => {
        const clean = String(text || '').replace(/\s+/g, ' ');
        // Multiple regex patterns per key to handle different page formats/locales
        const rows = [
          { key: 'bingSearch', title: 'Desktop Bing search', metric: 'Search', regexes: [
            /Desktop Bing search\s+(\d+)\s*\/\s*(\d+)/i,
            /PC search\s+(\d+)\s*\/\s*(\d+)/i,
            /Desktop search\s+(\d+)\s*\/\s*(\d+)/i,
            /Bing search\s+(\d+)\s*\/\s*(\d+)/i,
            /Tìm kiếm (?:trên )?(?:máy tính|Bing|PC)\s+(\d+)\s*\/\s*(\d+)/i,
            /(?:Desktop|PC)\s+(?:Bing\s+)?(?:search|tìm kiếm)\s*[:\s]+(\d+)\s*\/\s*(\d+)/i,
            /(?:Desktop|PC)\s+(\d+)\s*\/\s*(\d+)/i
          ]},
          { key: 'mobileSearch', title: 'Mobile Bing search', metric: 'Search', regexes: [
            /Mobile Bing search\s+(\d+)\s*\/\s*(\d+)/i,
            /Mobile search\s+(\d+)\s*\/\s*(\d+)/i,
            /Tìm kiếm (?:trên )?(?:di động|điện thoại|mobile)\s+(\d+)\s*\/\s*(\d+)/i,
            /(?:Mobile)\s+(?:Bing\s+)?(?:search|tìm kiếm)\s*[:\s]+(\d+)\s*\/\s*(\d+)/i,
            /(?:Mobile|Di động)\s+(\d+)\s*\/\s*(\d+)/i
          ]},
          { key: 'offers', title: 'Offers', metric: 'Points', regexes: [
            /Offers\s+(\d+)(?!\s*\/)/i,
            /(?:Ưu đãi|Phần thưởng)\s+(\d+)(?!\s*\/)/i
          ]}
        ];

        const results = [];
        for (const row of rows) {
          let match = null;
          for (const regex of row.regexes) {
            match = clean.match(regex);
            if (match) break;
          }
          if (!match) continue;
          results.push({
            source: 'earn-breakdown',
            key: row.key,
            title: row.title,
            metric: row.metric,
            current: Number(match[1]),
            max: match[2] ? Number(match[2]) : Number(match[1])
          });
        }

        // Generic fallback: find N/M patterns with M >= 10 (likely search quotas)
        if (!results.some(r => r.key === 'bingSearch') || !results.some(r => r.key === 'mobileSearch')) {
          const allMatches = [...clean.matchAll(/([^\d]{2,40}?)\s+(\d+)\s*\/\s*(\d+)/gi)];
          for (const m of allMatches) {
            const label = (m[1] || '').trim().toLowerCase();
            const current = Number(m[2]);
            const max = Number(m[3]);
            if (max < 10) continue; // skip small quotas like streak 0/1
            const hasBing = /bing|search|tìm kiếm/.test(label);
            const hasMobile = /mobile|di động|điện thoại/.test(label);
            const hasDesktop = /desktop|pc|máy tính/.test(label);
            if (hasMobile && !results.some(r => r.key === 'mobileSearch') && max >= 10 && max <= 120) {
              results.push({ source: 'earn-breakdown', key: 'mobileSearch', title: 'Mobile Bing search', metric: 'Search', current, max });
            } else if ((hasDesktop || (hasBing && !hasMobile)) && !results.some(r => r.key === 'bingSearch') && max >= 10 && max <= 300) {
              results.push({ source: 'earn-breakdown', key: 'bingSearch', title: 'Desktop Bing search', metric: 'Search', current, max });
            }
          }
        }

        return results;
      };

      const parseActivityCards = () => {
        const specs = [
          "//div[contains(@class,'grid') and contains(@class,'grid-cols-2') and contains(@class,'gap-3')]//div[contains(@class,'rounded-cornerCardDefault') and contains(@class,'cursor-pointer')]",
          "//div[contains(@class,'grid-cols-2') and contains(@class,'gap-3')]//div[contains(@class,'bg-bgCardOnPrimaryDefaultRest')]"
        ];

        const cards = [];
        for (const xpath of specs) {
          const snapshot = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          for (let i = 0; i < snapshot.snapshotLength; i++) {
            const node = snapshot.snapshotItem(i);
            if (node && !cards.includes(node)) cards.push(node);
          }
        }

        if (!cards.length) {
          document.querySelectorAll('[class*="rounded-cornerCardDefault"][class*="cursor-pointer"], [class*="bg-bgCardOnPrimaryDefaultRest"]')
            .forEach((node) => cards.push(node));
        }

        return cards
          .map((card, index) => {
            const text = (card.innerText || card.textContent || '').replace(/\s+/g, ' ').trim();
            const progress = text.match(/([A-Za-z][A-Za-z -]{1,30}):\s*(\d+)\s*\/\s*(\d+)/i);
            if (!progress) return null;

            const beforeMetric = text.slice(0, progress.index).trim();
            const title = beforeMetric.split(/\s{2,}| \+/)[0] || beforeMetric || `Activity ${index + 1}`;
            const metric = progress[1].trim();
            const key = classifyCard(title, metric, text);
            if (!key) return null;

            return {
              source: 'dashboard-card',
              key,
              title: titleForKey(key, title),
              metric,
              current: Number(progress[2]),
              max: Number(progress[3]),
              text: text.slice(0, 180)
            };
          })
          .filter(Boolean);
      };

      return Promise.all([
        fetchJson('/api/getuserinfo?type=1'),
        fetchJson('/api/getuserinfo?type=2'),
        fetchJson('/api/getpointsbreakdown')
      ]).then(async ([info, fullInfo, breakdown]) => {
        await openPointsBreakdown();
        const breakdownText = getPointsBreakdownText();
        const pageText = [breakdownText, document.body?.innerText || ''].join('\n').slice(0, 12000);
        const earnActivities = parseEarnBreakdown(breakdownText || pageText);
        const cardActivities = parseActivityCards();
        const textActivities = parseActivityText(pageText);
        return {
          info,
          fullInfo,
          breakdown,
          pageText,
          breakdownText,
          activities: [...earnActivities, ...cardActivities, ...textActivities],
          href: location.href
        };
      });
    });
  } finally {
    if (tempTab?.id) {
      try { await chrome.tabs.remove(tempTab.id); } catch (e) {}
    }
  }
}

function findSearchCounters(counters) {
  const results = [];
  if (!counters || typeof counters !== 'object') return results;

  for (const [key, counter] of Object.entries(counters)) {
    if (!counter || typeof counter !== 'object') continue;
    const text = `${key} ${counter.name || ''} ${counter.description || ''}`.toLowerCase();
    if (!/(search|pc|mobile|edge|bing)/i.test(text)) continue;

    results.push({
      key,
      name: counter.name || key,
      current: counter.count ?? counter.pointProgress ?? counter.progress ?? counter.pointprogress ?? 0,
      max: counter.max ?? counter.pointProgressMax ?? counter.target ?? counter.completionTarget ?? counter.maxValue ?? counter.goal ?? counter.pointprogressmax ?? 0,
      complete: !!counter.complete
    });
  }

  return results;
}

function classifyActivity(text) {
  const normalized = String(text || '').toLowerCase();
  if (/streak/.test(normalized) && /search/.test(normalized)) return 'bingSearchStreak';
  if (/mobile/.test(normalized) && /search/.test(normalized)) return 'mobileSearch';
  if (/bing/.test(normalized) && /search/.test(normalized)) return 'bingSearch';
  if (/\bsearch\b|pc search|desktop search/.test(normalized)) return 'bingSearch';
  if (/daily/.test(normalized)) return 'dailySet';
  if (/edge|minute/.test(normalized)) return 'edgeMinutes';
  if (/mobile app|check.?in/.test(normalized)) return 'mobileApp';
  return null;
}

function collectRewardActivities(raw) {
  const activities = [];
  const seen = new Set();

  const addActivity = (activity) => {
    if (!activity || !activity.key) return;
    const current = Number(activity.current);
    const max = Number(activity.max);
    if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return;
    const id = `${activity.key}:${activity.title}:${activity.metric}:${current}/${max}`;
    if (seen.has(id)) return;
    seen.add(id);
    activities.push({ ...activity, current, max, remaining: Math.max(0, max - current) });
  };

  (raw?.activities || []).forEach(addActivity);

  const dashboard = raw?.info?.data?.dashboard || raw?.fullInfo?.data?.dashboard || raw?.info?.data || raw?.fullInfo?.data;
  const counters = dashboard?.userStatus?.counters || {};
  for (const [key, counter] of Object.entries(counters)) {
    if (!counter || typeof counter !== 'object') continue;
    const label = `${key} ${counter.name || ''} ${counter.description || ''}`;
    const kind = classifyActivity(label);
    if (!kind) continue;

    addActivity({
      source: 'api',
      key: kind,
      title: counter.name || key,
      metric: /minute|edge/i.test(label) ? 'Minutes' : /check/i.test(label) ? 'Check-in' : 'Progress',
      current: counter.count ?? counter.pointProgress ?? counter.progress ?? counter.pointprogress ?? 0,
      max: counter.max ?? counter.pointProgressMax ?? counter.target ?? counter.completionTarget ?? counter.maxValue ?? counter.goal ?? counter.pointprogressmax ?? 0
    });
  }

  const authoritativeKeys = new Set(
    activities
      .filter(activity => activity.source === 'earn-breakdown' && ['bingSearch', 'mobileSearch'].includes(activity.key))
      .map(activity => activity.key)
  );

  if (!authoritativeKeys.size) return activities;

  return activities.filter(activity => {
    if (!authoritativeKeys.has(activity.key)) return true;
    return activity.source === 'earn-breakdown';
  });
}

function logRewardActivities(activities) {
  if (!activities.length) {
    log('⚠️ Không đọc được thẻ activity trên dashboard. Tool sẽ dùng số lượt bạn nhập.', 'warn');
    return;
  }

  activities.forEach((activity) => {
    const done = activity.remaining <= 0 ? 'done' : `còn ${activity.remaining}`;
    log(`📊 ${activity.title} ${activity.metric}: ${activity.current}/${activity.max} (${done})`, activity.remaining <= 0 ? 'success' : 'info');
  });
}

function pickBestActivity(activities, key) {
  return activities
    .filter((item) => item.key === key)
    .sort((a, b) => {
      const sourceScore = (item) => item.source === 'earn-breakdown' ? 2 : item.source === 'api' ? 1 : 0;
      return sourceScore(b) - sourceScore(a) || b.max - a.max;
    })[0] || null;
}

function isLikelySearchQuotaActivity(activity, key) {
  if (!activity) return false;
  const text = `${activity.title || ''} ${activity.metric || ''} ${activity.text || ''}`.toLowerCase();

  if (/streak/.test(text)) return false;
  if (key === 'bingSearch') {
    if (/desktop bing search|pc search|desktop search/.test(text)) return true;
    return activity.max >= 10;
  }

  if (key === 'mobileSearch') {
    if (/mobile bing search|mobile search/.test(text)) return true;
    return activity.max >= 8;
  }

  return true;
}

async function scanRewardActivities({ logDetails = true } = {}) {
  let raw = null;
  try {
    raw = await fetchRewardsDiagnostics();
  } catch (e) {
    if (logDetails) log(`⚠️ Scan activity lỗi: ${e.message}`, 'warn');
    return { raw: null, activities: [] };
  }

  const activities = collectRewardActivities(raw);
  await cacheSearchQuotaFromActivities(activities);
  if (logDetails) logRewardActivities(activities);
  return { raw, activities };
}

async function getActivitySearchPlan(requestedPc, requestedMobile) {
  log('📊 Check activity trước khi search...', 'info');
  const cachedQuota = await getCachedSearchQuota();
  if (cachedQuota) {
    let pcCount = requestedPc;
    let mobileCount = requestedMobile;
    const pcRemaining = Number(cachedQuota.pc);
    const mobileRemaining = Number(cachedQuota.mobile);

    if (Number.isFinite(pcRemaining)) pcCount = Math.min(pcCount, Math.max(0, pcRemaining));
    if (Number.isFinite(mobileRemaining)) mobileCount = Math.min(mobileCount, Math.max(0, mobileRemaining));

    log(`📊 Dùng quota cache hôm nay: PC còn ${Number.isFinite(pcRemaining) ? pcRemaining : '?'}, Mobile còn ${Number.isFinite(mobileRemaining) ? mobileRemaining : '?'}.`, 'info');
    return {
      pcCount,
      mobileCount,
      reason: pcCount <= 0 && mobileCount <= 0
        ? '✅ Quota cache cho thấy search hôm nay đã đủ hoặc không còn lượt cần chạy.'
        : ''
    };
  }

  const { activities } = await scanRewardActivities({ logDetails: true });
  let pcCount = requestedPc;
  let mobileCount = requestedMobile;
  let reason = '';

  const bingSearchRaw = pickBestActivity(activities, 'bingSearch');
  const bingSearch = isLikelySearchQuotaActivity(bingSearchRaw, 'bingSearch') ? bingSearchRaw : null;
  if (bingSearchRaw && !bingSearch) {
    log(`ℹ️ Bỏ qua activity Bing Search không đáng tin (${bingSearchRaw.current}/${bingSearchRaw.max}) vì có thể là streak/card phụ.`, 'info');
  }

  if (bingSearch) {
    pcCount = Math.min(pcCount, bingSearch.remaining);
    if (bingSearch.remaining <= 0) log(`✅ PC Search đã đủ ${bingSearch.current}/${bingSearch.max}, bỏ PC search.`, 'success');
    else if (pcCount < requestedPc) log(`ℹ️ Giảm PC search từ ${requestedPc} xuống ${pcCount} theo quota PC Search còn lại.`, 'info');
  }

  const mobileSearchRaw = pickBestActivity(activities, 'mobileSearch');
  const mobileSearch = isLikelySearchQuotaActivity(mobileSearchRaw, 'mobileSearch') ? mobileSearchRaw : null;
  if (mobileSearchRaw && !mobileSearch) {
    log(`ℹ️ Bỏ qua activity Mobile Search không đáng tin (${mobileSearchRaw.current}/${mobileSearchRaw.max}).`, 'info');
  }

  if (mobileSearch) {
    mobileCount = Math.min(mobileCount, mobileSearch.remaining);
    if (mobileSearch.remaining <= 0) log(`✅ Mobile Search đã đủ ${mobileSearch.current}/${mobileSearch.max}, bỏ mobile search.`, 'success');
    else if (mobileCount < requestedMobile) log(`ℹ️ Giảm Mobile search từ ${requestedMobile} xuống ${mobileCount} theo quota Mobile Search còn lại.`, 'info');
  }

  if (!bingSearch && !mobileSearch) {
    log('ℹ️ Không thấy quota search đáng tin từ activity. Giữ số lượt đã nhập.', 'info');
  }

  if (pcCount <= 0 && mobileCount <= 0) {
    reason = '✅ Activity cho thấy search hôm nay đã đủ hoặc không còn lượt cần chạy.';
  }

  return { pcCount, mobileCount, reason };
}

function findSuspiciousSignals(value, path = '', hits = []) {
  const terms = /(suspend|ban|blocked|restrict|ineligible|eligible|violation|fraud|abuse|disabled|locked)/i;
  if (hits.length >= 20 || value === null || value === undefined) return hits;

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value);
    if (terms.test(path) || terms.test(text)) hits.push(`${path}: ${text}`.slice(0, 160));
    return hits;
  }

  if (Array.isArray(value)) {
    value.slice(0, 50).forEach((item, index) => findSuspiciousSignals(item, `${path}[${index}]`, hits));
    return hits;
  }

  if (typeof value === 'object') {
    Object.entries(value).slice(0, 120).forEach(([key, item]) => {
      const nextPath = path ? `${path}.${key}` : key;
      if (terms.test(key)) hits.push(`${nextPath}: ${String(item).slice(0, 120)}`);
      findSuspiciousSignals(item, nextPath, hits);
    });
  }

  return [...new Set(hits)].slice(0, 20);
}

function analyzeRewardsDiagnostics(raw) {
  const issues = [];
  const warnings = [];
  const good = [];

  const info = raw?.info;
  const fullInfo = raw?.fullInfo;
  const breakdown = raw?.breakdown;
  const dashboard = info?.data?.dashboard || fullInfo?.data?.dashboard || info?.data || fullInfo?.data;
  const userStatus = dashboard?.userStatus || {};
  const counters = userStatus.counters || {};
  let searchCounters = findSearchCounters(counters);
  const points = userStatus.availablePoints;

  // Fallback: if findSearchCounters got max=0 for all entries, supplement from collectRewardActivities
  const allMaxZero = searchCounters.length === 0 || searchCounters.every(sc => sc.max === 0);
  if (allMaxZero) {
    try {
      const activities = collectRewardActivities(raw);
      const pcAct = pickBestActivity(activities, 'bingSearch');
      const mobAct = pickBestActivity(activities, 'mobileSearch');
      const fallbackCounters = [];
      if (pcAct && pcAct.max > 0) {
        fallbackCounters.push({ key: 'pcSearch', name: pcAct.title || 'PC Search', current: pcAct.current, max: pcAct.max, complete: pcAct.remaining <= 0 });
      }
      if (mobAct && mobAct.max > 0) {
        fallbackCounters.push({ key: 'mobileSearch', name: mobAct.title || 'Mobile Search', current: mobAct.current, max: mobAct.max, complete: mobAct.remaining <= 0 });
      }
      if (fallbackCounters.length > 0) {
        searchCounters = fallbackCounters;
      }
    } catch (e) { /* ignore fallback errors */ }
  }

  if (!raw) {
    issues.push('Không lấy được dữ liệu Rewards.');
    return { verdict: 'unknown', issues, warnings, good, points: null, searchCounters: [] };
  }

  if (info?.ok || fullInfo?.ok) good.push('Rewards API còn phản hồi.');
  else issues.push(`Rewards API lỗi (${info?.status || 0}/${fullInfo?.status || 0}). Có thể chưa đăng nhập hoặc bị chặn phiên.`);

  if (typeof points === 'number') good.push(`Đọc được điểm hiện tại: ${points.toLocaleString()}.`);
  else warnings.push('Không đọc được availablePoints từ API.');

  if (searchCounters.length > 0) {
    good.push(`Tìm thấy ${searchCounters.length} counter liên quan search.`);
  } else if (info?.ok || fullInfo?.ok) {
    warnings.push('Không thấy search counter trong dữ liệu Rewards. Đây có thể là dấu hiệu bị giới hạn search earning hoặc API đổi format.');
  }

  if (breakdown?.ok) good.push('Points breakdown còn mở được.');
  else warnings.push(`Không lấy được points breakdown (${breakdown?.status || 0}).`);

  const suspicious = [
    ...findSuspiciousSignals(info?.data),
    ...findSuspiciousSignals(fullInfo?.data),
    ...findSuspiciousSignals(breakdown?.data)
  ];
  if (suspicious.length > 0) {
    warnings.push(`Có field nhạy cảm trong API: ${suspicious.slice(0, 4).join(' | ')}`);
  }

  const pageText = (raw.pageText || '').toLowerCase();
  if (/(suspended|restricted|not eligible|violation|blocked|locked)/i.test(pageText)) {
    issues.push('Trang Rewards có chữ liên quan suspended/restricted/not eligible.');
  }

  if ((dailyProgress.searchesDone || 0) >= 5 && (dailyProgress.earnedToday || 0) <= 0) {
    warnings.push(`Local progress hôm nay đã ghi ${dailyProgress.searchesDone} search nhưng điểm earned vẫn ${dailyProgress.earnedToday || 0}. Nếu vừa chạy xong mà vẫn vậy thì nghi ngờ bị giới hạn điểm search.`);
  }

  const verdict = issues.length > 0
    ? 'bad'
    : warnings.length >= 2
      ? 'suspicious'
      : warnings.length === 1
        ? 'watch'
        : 'ok';

  return { verdict, issues, warnings, good, points, searchCounters };
}

function handleBanStatusUpdate(apiData, timestamp) {
  try {
    if (typeof analyzeBanStatus !== 'function') {
      log('⚠️ ban-detection.js chưa sẵn sàng', 'warn');
      return;
    }

    const analyzed = analyzeBanStatus(apiData) || {};
    banStatus = {
      status: analyzed.status || 'UNKNOWN',
      reasons: Array.isArray(analyzed.reasons) ? analyzed.reasons : [],
      signals: analyzed.signals || {},
      updatedAt: timestamp || Date.now()
    };

    broadcast('ban_status', banStatus);
    updateBanIndicatorUI();

    if (banStatus.status === 'BAN') {
      log(`🚫 BAN DETECTED: ${(banStatus.reasons || []).join(' | ') || 'Unknown reason'}`, 'error');
    } else if (banStatus.status === 'WARN') {
      log(`⚠️ Ban warning: ${(banStatus.reasons || []).join(' | ') || 'Abnormal signals'}`, 'warn');
    } else if (banStatus.status === 'OK') {
      log('✅ Ban status: OK', 'success');
    } else {
      log('ℹ️ Ban status: UNKNOWN', 'info');
    }
  } catch (e) {
    log(`⚠️ Ban detection error: ${e.message}`, 'warn');
  }
}

async function checkAccountDiagnostics() {
  if (isRunning) {
    log('⚠️ Đang search, dừng xong rồi hãy Check Ban để kết quả sạch hơn.', 'warn');
    return;
  }

  log('🩺 Check tài khoản: đang đọc Rewards API...', 'info');
  let raw = null;
  try {
    raw = await fetchRewardsDiagnostics();
  } catch (e) {
    log(`❌ Check Ban lỗi: ${e.message}`, 'error');
    return;
  }

  const result = analyzeRewardsDiagnostics(raw);
  const activities = collectRewardActivities(raw);
  await cacheSearchQuotaFromActivities(activities);

  if (typeof result.points === 'number') {
    state.points.current = result.points;
    updateState({ points: state.points });
  }

  result.good.slice(0, 4).forEach(item => log(`✅ ${item}`, 'success'));

  // Diagnostic: show breakdown text snippet for debugging
  const bdt = (raw?.breakdownText || '').replace(/\s+/g, ' ').trim();
  if (bdt) {
    log(`🔬 Breakdown text (${bdt.length} chars): "${bdt.slice(0, 200)}${bdt.length > 200 ? '...' : ''}"`, 'info');
  } else {
    log('🔬 Breakdown text: (trống — panel có thể không mở được)', 'warn');
  }

  logRewardActivities(activities);
  result.warnings.slice(0, 5).forEach(item => log(`⚠️ ${item}`, 'warn'));
  result.issues.slice(0, 5).forEach(item => log(`❌ ${item}`, 'error'));

  if (result.searchCounters.length > 0) {
    result.searchCounters.slice(0, 4).forEach(counter => {
      log(`🔎 Counter: ${counter.name} = ${counter.current}/${counter.max}${counter.complete ? ' (done)' : ''}`, 'info');
    });
  }

  const verdictText = {
    ok: '✅ Kết luận: chưa thấy dấu hiệu ban/giới hạn rõ ràng.',
    watch: '⚠️ Kết luận: có 1 dấu hiệu lạ, nên chạy ít lượt test rồi check điểm lại.',
    suspicious: '⚠️ Kết luận: nghi ngờ bị giới hạn/ban ẩn search earning.',
    bad: '❌ Kết luận: có dấu hiệu mạnh tài khoản đang bị chặn/hạn chế hoặc phiên đăng nhập lỗi.',
    unknown: '⚠️ Kết luận: không đủ dữ liệu để đánh giá.'
  };
  log(verdictText[result.verdict] || verdictText.unknown, result.verdict === 'ok' ? 'success' : 'warn');
  log('ℹ️ Check này là chẩn đoán theo dấu hiệu, không phải xác nhận chính thức từ Microsoft.', 'info');
}

// ═══════════════════════════════════════════════
// STOP / RESET / CLEANUP
// ═══════════════════════════════════════════════

function stopSearch() {
  if (!isRunning) return;
  isRunning = false;
  log('🛑 Đã dừng.', 'warn');
  updateState({ status: 'stopped' });
}

async function resetPage() {
  log('🔄 Reset page & tabs...', 'info');
  await closeSearchTab();
  // Close all Bing tabs
  try {
    const tabs = await chrome.tabs.query({ url: '*://www.bing.com/*' });
    for (const tab of tabs) {
      try { await chrome.tabs.remove(tab.id); } catch (e) {}
    }
  } catch (e) {}
  await disableMobileUA();
  updateState({ status: 'idle', progress: '0/0', percent: 0, currentQuery: '' });
  log('✅ Reset hoàn tất', 'success');
}

function resetProgress() {
  dailyProgress = {
    date: new Date().toDateString(),
    earnedToday: 0,
    searchesDone: 0,
    pcDone: 0,
    mobileDone: 0,
    pointsBefore: null,
  };
  saveDailyProgress();
  state.points = { current: null, earned: null, baseline: null };
  updateState({ status: 'idle', progress: '0/0', percent: 0 });
  broadcast('daily_progress', dailyProgress);
  log('🗑️ Tiến trình đã được xóa', 'info');
}

async function clearBingData() {
  log('🧹 Xóa cache Bing...', 'info');
  try {
    await chrome.browsingData.remove(
      {
        origins: ['https://www.bing.com', 'https://bing.com'],
      },
      {
        cache: true,
        localStorage: true,
        formData: true,
        history: true,
        indexedDB: true,
        // NOT cookies — keep login session
      }
    );
    log('✅ Đã xóa cache Bing (giữ session login)', 'success');
  } catch (e) {
    log(`⚠️ Clear data error: ${e.message}`, 'warn');
  }
}

// ═══════════════════════════════════════════════
// DONE PAGE & CONTROL WINDOW
// ═══════════════════════════════════════════════

function openDonePage() {
  const params = new URLSearchParams({
    searches: dailyProgress.searchesDone,
    earned: dailyProgress.earnedToday || 0,
    duration: runStartTime ? Math.round((Date.now() - runStartTime) / 1000) : 0,
    mode: config.mobileMode ? 'both' : 'desktop',
  });
  
  chrome.tabs.create({
    url: chrome.runtime.getURL(`done.html?${params}`),
    active: true
  });
}

async function openControlWindow() {
  try {
    const stored = await new Promise(r => chrome.storage.local.get('controlWindowBounds', r));
    const bounds = stored.controlWindowBounds || { width: 380, height: 600 };
    
    await chrome.windows.create({
      url: chrome.runtime.getURL('popup.html?detached=1'),
      type: 'popup',
      width: bounds.width || 380,
      height: bounds.height || 600,
      left: bounds.left,
      top: bounds.top,
      focused: true
    });
  } catch (e) {
    log(`⚠️ Cannot open control window: ${e.message}`, 'warn');
  }
}

// ═══════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await loadConfig();
    log('⚡ Extension installed/updated — v4.1 Compact Runner', 'info');
    
    // Create context menu for data extractor
    try {
      chrome.contextMenus.create({
        id: 'open-data-extractor',
        title: '🔍 Microsoft Data Extractor',
        contexts: ['action']
      });
    } catch (e) {
      // Ignore duplicate context menu errors
    }
  } catch (e) {
    console.warn('[BRA] onInstalled error:', e);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    await loadConfig();
    await updateBanIndicatorUI();
  } catch (e) {
    console.warn('[BRA] onStartup error:', e);
  }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'open-data-extractor') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('extract.html'),
      active: true
    });
  }
});

// Load config immediately
loadConfig().then(() => updateBanIndicatorUI()).catch(e => console.warn('[BRA] init error:', e));
