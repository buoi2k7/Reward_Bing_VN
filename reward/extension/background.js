// =============================================
// BING REWARDS AUTO - BACKGROUND SERVICE WORKER
// Extension-native: No server, no CDP ports
// Uses chrome.tabs + chrome.scripting APIs
// =============================================

// Load network handler for robust API calls
try {
  importScripts('api-network-handler.js');
} catch (e) {
  console.error('Failed to load api-network-handler:', e);
}

// Load mobile device pool (40+ real devices)
try {
  importScripts('mobile-devices.js');
} catch (e) {
  console.error('Failed to load mobile-devices:', e);
}

// Load daily tasks module (runDailyTasks + runMobileDailyTasks)
try {
  importScripts('daily_tasks_new.js');
} catch (e) {
  console.error('Failed to load daily_tasks_new:', e);
}

// ---- STATE ----
let state = {
  status: 'idle',        // idle | running | stopped | done | error | cooldown
  progress: '0/0',
  percent: 0,
  points: {
    current: null,     // null = chưa check, number = đã có data thật
    earned: 0,         // chỉ từ verified API checks
    baseline: null,    // điểm trước khi bắt đầu search
    lastCheck: null,   // timestamp lần check cuối
    history: []        // [{ time, points, wave, delta }]
  },
  currentSearch: 0,
  totalSearches: 0,
  wave: { current: 0, total: 0 },
  logs: [],
  mobileRuleEnabled: false
};

const DEFAULT_CONFIG = {
  rewardsLevel: 'gold',
  searchCount: 30,
  mobileSearchCount: 20,
  speedLevel: 3,
  minDelay: 20,
  maxDelay: 40,
  mobileMode: false,
  maxRetries: 2,
  waveSize: 5,
  wavePauseMin: 8,   // minutes — reduced from 15
  readResult: true,  // click 1 kết quả sau search để simulate đọc thật
  maxMode: false     // chạy đến đủ điểm trong ngày
};

// Giới hạn PC search và Mobile search theo hạng (2026)
const TIER_LIMITS = {
  'member': { pcSearch: 10,  mobileSearch: 0,  dailyPointCap: 15  },
  'silver': { pcSearch: 15,  mobileSearch: 10, dailyPointCap: 30  },
  'gold':   { pcSearch: 30,  mobileSearch: 20, dailyPointCap: 100 }
};

// Speed level presets (matches popup.js SPEED_LEVELS)
const SPEED_PRESETS = {
  1: { minDelay: 50, maxDelay: 90,  waveSize: 2, wavePause: 20 },
  2: { minDelay: 35, maxDelay: 60,  waveSize: 3, wavePause: 12 },
  3: { minDelay: 20, maxDelay: 40,  waveSize: 5, wavePause: 8  },
  4: { minDelay: 12, maxDelay: 25,  waveSize: 6, wavePause: 4  },
  5: { minDelay: 8,  maxDelay: 15,  waveSize: 7, wavePause: 3  },
  6: { minDelay: 5,  maxDelay: 10,  waveSize: 8, wavePause: 2  }
};

// ---- HELPERS ----
function sleep(ms) { 
  const checkInterval = 100;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (state.status === 'stopped' || state.status === 'error') {
        clearInterval(timer);
        reject(new Error('USER_STOPPED'));
      } else if (Date.now() - start >= ms) {
        clearInterval(timer);
        resolve(true);
      }
    }, checkInterval);
  });
}
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomDelay(minS, maxS) { return randomInt(minS * 1000, maxS * 1000); }

// ---- ENHANCED LOGGING ----
function log(text, type = 'info', metadata = {}) {
  const timestamp = new Date();
  const timeString = timestamp.toLocaleTimeString();
  
  // Structured log entry
  const entry = {
    text,
    type, // 'info', 'success', 'warning', 'error'
    time: timeString,
    timestamp: timestamp.getTime(),
    ...metadata // Add context like { endpoint: '/api/...', attempt: 2, duration: 1500 }
  };
  
  // Keep last 200 logs
  state.logs.unshift(entry);
  if (state.logs.length > 200) state.logs.length = 200;
  
  // Broadcast to UI
  broadcast({ action: 'log', data: entry });
  
  // Also console.log for debugging
  const logColor = {
    'info': '\x1b[36m',    // cyan
    'success': '\x1b[32m', // green
    'warning': '\x1b[33m', // yellow
    'error': '\x1b[31m'    // red
  }[type] || '\x1b[0m';
  
  console.log(`${logColor}[${timeString}] ${text}\x1b[0m`, metadata);
}

function broadcast(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

function broadcastState() {
  broadcast({ action: 'state_update', data: getPublicState() });
}

function getPublicState() {
  return {
    ...state,
    logs: undefined,
    points: {
      current: state.points.current,
      earned: state.points.earned,
      baseline: state.points.baseline,
      lastCheck: state.points.lastCheck,
      historyCount: state.points.history.length
    }
  };
}

// ---- CONFIG ----
async function getConfig() {
  const result = await chrome.storage.local.get('config');
  return { ...DEFAULT_CONFIG, ...(result.config || {}) };
}

async function saveConfig(config) {
  await chrome.storage.local.set({ config });
}

// ---- KEYWORDS ----
// Loaded from keywords-data.js via importScripts
let KEYWORDS = [];
try {
  importScripts('keywords-data.js');
  KEYWORDS = self.KEYWORD_LIST || [];
} catch (e) {
  console.error('Failed to load keywords:', e);
}

function getRandomKeyword() {
  return KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)] || 'tin tức hôm nay';
}

// ---- TIME-OF-DAY SPEED PROFILE (từ ReFree Pro) ----
// Điều chỉnh tốc độ theo giờ trong ngày để hành vi giống người thật hơn
function getTimeOfDayProfile() {
  const hour = new Date().getHours();
  if (hour >= 6  && hour < 11) return { name: 'morning',   label: '🌅 Sáng',   activityMult: 0.7 };
  if (hour >= 11 && hour < 17) return { name: 'afternoon', label: '☀️ Chiều',  activityMult: 1.0 };
  if (hour >= 17 && hour < 22) return { name: 'evening',   label: '🌆 Tối',    activityMult: 1.2 };
  // 22h-6h sáng: chạy chậm hẳn — người thật ít search ban đêm
  return { name: 'night', label: '🌙 Khuya', activityMult: 0.4 };
}

// Áp dụng time profile vào delay config
function applyTimeProfile(config) {
  const profile = getTimeOfDayProfile();
  const mult = profile.activityMult;
  // Ban đêm: tăng delay, giảm wave size
  if (profile.name === 'night') {
    return {
      ...config,
      minDelay: Math.round(config.minDelay / mult),   // delay dài hơn
      maxDelay: Math.round(config.maxDelay / mult),
      waveSize: Math.max(2, Math.floor((config.waveSize || 5) * mult)),
    };
  }
  // Tối: hơi nhanh hơn bình thường
  if (profile.name === 'evening') {
    return {
      ...config,
      minDelay: Math.round(config.minDelay * 0.85),
      maxDelay: Math.round(config.maxDelay * 0.85),
    };
  }
  return config;
}

// ---- COFFEE BREAK (từ AutoRewarder) ----
// Dừng dài sau mỗi N search để giống người thật uống nước
function getNextCoffeeBreak() {
  // 80% nghỉ sau 4-9 searches, 20% nghỉ sau 10-15 searches
  return Math.random() < 0.8
    ? randomInt(4, 9)
    : randomInt(10, 15);
}

// ---- BING TAB CATEGORY SWITCH (từ AutoRewarder) ----
// Sau khi search xong, 30% chance chuyển sang tab Images/Videos/News
async function performTabCategorySwitch(tabId) {
  const CATEGORIES = [
    { name: 'All',    selector: null,                   weight: 70 },
    { name: 'Images', selector: '#b-scopeListItem-images a', weight: 10 },
    { name: 'Videos', selector: '#b-scopeListItem-video a',  weight: 10 },
    { name: 'News',   selector: '#b-scopeListItem-news a',   weight: 10 },
  ];

  // Weighted random pick
  const total = CATEGORIES.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * total;
  let chosen = CATEGORIES[0];
  for (const cat of CATEGORIES) {
    r -= cat.weight;
    if (r <= 0) { chosen = cat; break; }
  }

  if (chosen.name === 'All' || !chosen.selector) return; // 70% không làm gì

  try {
    await injectScript(tabId, (sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        setTimeout(() => el.click(), 200 + Math.floor(Math.random() * 400));
        return true;
      }
      return false;
    }, [chosen.selector]);
    log(`🗂 Tab switch: ${chosen.name}`);
    await sleep(randomInt(2000, 4500));
  } catch (e) {
    // Không quan trọng nếu fail, tiếp tục bình thường
  }
}

// ---- TAB HELPERS ----
async function createTab(url, active = false) {
  return chrome.tabs.create({ url, active });
}

async function waitForTabLoad(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    let resolved = false;

    function listener(tid, info) {
      if (tid === tabId && info.status === 'complete') {
        if (!resolved) {
          resolved = true;
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
    }
    chrome.tabs.onUpdated.addListener(listener);

    const start = Date.now();
    const watcher = setInterval(() => {
      if (resolved) {
        clearInterval(watcher);
        return;
      }
      if (state.status === 'stopped' || state.status === 'error') {
        resolved = true;
        clearInterval(watcher);
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('USER_STOPPED'));
      } else if (Date.now() - start >= timeout) {
        resolved = true;
        clearInterval(watcher);
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab load timeout'));
      }
    }, 100);
  });
}

async function injectScript(tabId, func, args = []) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args,
      world: 'MAIN'  // Access page's JS context
    });
    return results?.[0]?.result;
  } catch (e) {
    console.error('Inject error:', e);
    return null;
  }
}

async function injectFile(tabId, file) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: [file],
      world: 'MAIN'
    });
    return results?.[0]?.result;
  } catch (e) {
    console.error('Inject file error:', e);
    return null;
  }
}

async function closeTab(tabId) {
  try { await chrome.tabs.remove(tabId); } catch (e) {}
}

function isRewardsPageUrl(url) {
  try {
    return new URL(url).hostname === 'rewards.bing.com';
  } catch (e) {
    return false;
  }
}

async function getRewardsTab(url = 'https://rewards.bing.com/dashboard', active = false) {
  const existingTabs = await chrome.tabs.query({ url: ['https://rewards.bing.com/*'] });
  const reusableTab = existingTabs.find(t => t.active) || existingTabs[0];
  if (reusableTab) {
    return { tab: reusableTab, created: false };
  }

  const tab = await createTab(url, active);
  return { tab, created: true };
}

async function fetchRewardsUserInfoQuiet() {
  let tab = null;
  let created = false;
  const startTime = Date.now();
  
  try {
    const rewardsTab = await getRewardsTab();
    tab = rewardsTab.tab;
    created = rewardsTab.created;
    
    // For new tabs, reload to ensure cookies are loaded
    if (created) {
      log('[API] New tab created, reloading to load cookies...', 'info');
      await chrome.tabs.reload(tab.id);
      await waitForTabLoad(tab.id).catch(() => {});
    }
    
    await waitForTabLoad(tab.id).catch(() => {});
    // 🔥 FIX: Increased wait time for nav/auth to fully load
    // New tab: 6000ms (was 4000ms) → Allow cookies & session to load
    // Existing tab: 2000ms (was 1000ms) → Allow any navigation to complete
    await sleep(created ? 6000 : 2000);

    const currentTab = await chrome.tabs.get(tab.id);
    if (!isRewardsPageUrl(currentTab?.url)) {
      if (created) await closeTab(tab.id);
      log(`[API] ❌ Not on rewards.bing.com: ${currentTab?.url}`, 'warning', { 
        endpoint: '/api/getuserinfo',
        duration: Date.now() - startTime 
      });
      return {
        ok: false,
        reason: 'signin_required',
        url: currentTab?.url || null
      };
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        try {
          if (location.hostname !== 'rewards.bing.com') {
            return {
              ok: false,
              reason: 'signin_required',
              url: location.href
            };
          }

          // ✅ NEW: Retry-enabled fetch with dynamic timeout
          let lastError;
          const maxRetries = 3;
          
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const timeout = 12000 + (attempt * 3000); // Start at 12s, increase per retry
              const controller = new AbortController();
              const tid = setTimeout(() => controller.abort(), timeout);
              
              const apiUrl = new URL('/api/getuserinfo?type=1', location.origin).toString();
              const attemptStartTime = Date.now();
              console.log(`[API] Attempt ${attempt + 1}/${maxRetries + 1} (timeout: ${timeout}ms): ${apiUrl}`);
              
              const response = await fetch(apiUrl, {
                signal: controller.signal,
                cache: 'no-cache',
                credentials: 'include',
                headers: {
                  'Accept': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest',
                  // Force fresh request, ignore any cached auth
                  'Pragma': 'no-cache'
                }
              });
              clearTimeout(tid);
              const duration = Date.now() - attemptStartTime;

              if (!response.ok) {
                // Don't retry auth errors on first attempt - allow retries after that
                if ((response.status === 401 || response.status === 403) && attempt === 0) {
                  // 🔥 FIX: For 401 on first attempt, try again after short wait
                  // (page might still be loading session)
                  if (attempt < maxRetries) {
                    console.warn(`[API] Auth error on first attempt, retrying after delay...`);
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                  } else {
                    // After retries, this is a real auth error
                    console.error(`[API] Auth error ${response.status} on attempt ${attempt + 1} (after retries)`);
                    return {
                      ok: false,
                      reason: 'auth_error',
                      status: response.status,
                      url: apiUrl,
                      duration
                    };
                  }
                } else if (response.status === 401 || response.status === 403) {
                  // Genuine auth failure
                  console.error(`[API] Auth error ${response.status} on attempt ${attempt + 1}`);
                  return {
                    ok: false,
                    reason: 'auth_error',
                    status: response.status,
                    url: apiUrl,
                    duration
                  };
                }
                
                // Retry-able errors
                if ((response.status >= 500 || response.status === 429) && attempt < maxRetries) {
                  lastError = new Error(`HTTP_${response.status}`);
                  const backoff = (attempt + 1) * 1500;
                  console.warn(`[API] Retrying due to HTTP ${response.status}... (backoff: ${backoff}ms)`);
                  await new Promise(r => setTimeout(r, backoff));
                  continue;
                }
                
                return {
                  ok: false,
                  reason: 'http_error',
                  status: response.status,
                  url: apiUrl,
                  duration
                };
              }

              const data = await response.json();
              const totalDuration = Date.now() - startTime;
              console.log(`[API] ✅ Success on attempt ${attempt + 1} (${duration}ms, total ${totalDuration}ms)`);
              return { ok: true, data, url: apiUrl, duration, attempt: attempt + 1 };
              
            } catch (e) {
              lastError = e;
              const isTimeout = e.name === 'AbortError' || e.message.includes('timeout');
              const duration = Date.now() - startTime;
              
              if (isTimeout && attempt < maxRetries) {
                const backoff = (attempt + 1) * 2000;
                console.warn(`[API] Timeout on attempt ${attempt + 1} (${duration}ms total), waiting ${backoff}ms before retry...`);
                await new Promise(r => setTimeout(r, backoff));
                continue;
              }
              
              console.error(`[API] Error on attempt ${attempt + 1}: ${e.message}`);
              if (attempt >= maxRetries) {
                break;
              }
            }
          }
          
          // All retries failed
          return {
            ok: false,
            reason: 'fetch_failed',
            error: lastError?.message || 'ALL_RETRIES_EXHAUSTED',
            url: location.href,
            attempts: maxRetries + 1,
            duration: Date.now() - startTime
          };
          
        } catch (e) {
          return {
            ok: false,
            reason: 'script_error',
            error: e?.message || String(e),
            url: location.href,
            duration: Date.now() - startTime
          };
        }
      }
    });

    const result = results?.[0]?.result;
    
    if (result?.ok) {
      log(`[API] ✅ getuserinfo success (attempt ${result.attempt}, ${result.duration}ms)`, 'success', {
        endpoint: '/api/getuserinfo',
        duration: result.duration,
        attempt: result.attempt,
        totalTime: Date.now() - startTime,
        status: 'OK',
        tasksFound: result?.data?.dashboard?.dailySetPromotions ? 'yes' : 'unknown'
      });
    } else {
      const reason = result?.reason || 'unknown';
      const status = result?.status || '';
      const error = result?.error || '';
      const isCriticalAuth = reason === 'auth_error' && status === '401';
      
      log(`[API] ❌ getuserinfo failed: ${reason} ${status} ${error}`.trim(), isCriticalAuth ? 'warning' : 'error', {
        endpoint: '/api/getuserinfo',
        reason,
        status,
        attempts: result?.attempts || 1,
        duration: Date.now() - startTime,
        details: isCriticalAuth ? 'Session may not be loaded' : 'Check network/permissions'
      });
    }
    
    if (created) await closeTab(tab.id);
    return result || { ok: false, reason: 'empty_result' };
  } catch (e) {
    if (created && tab) await closeTab(tab.id);
    log(`[API] ❌ Exception in fetchRewardsUserInfoQuiet: ${e.message}`, 'error', {
      endpoint: '/api/getuserinfo',
      error: e.message,
      duration: Date.now() - startTime
    });
    return {
      ok: false,
      reason: 'fetch_failed',
      error: e?.message || String(e)
    };
  }
}

// ---- MOBILE MODE ----
// Bật mobile mode: chọn random 1 device, cập nhật declarativeNetRequest + inject mobile-override.js
const MOBILE_OVERRIDE_SCRIPT_ID = 'bra-mobile-override';

async function setMobileMode(enabled) {
  try {
    if (enabled) {
      // Chọn device ngẫu nhiên từ pool
      const device = (typeof getRandomMobileDevice === 'function')
        ? getRandomMobileDevice()
        : { name: 'iPhone 16 Pro Max', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', screenWidth: 393, screenHeight: 852, devicePixelRatio: 3 };

      state.currentMobileDevice = device;
      log(`📱 Mobile UA: ${device.name}`);

      // Cập nhật header UA qua declarativeNetRequest
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1001, 1002],
        addRules: [
          {
            id: 1001, priority: 2,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'User-Agent', operation: 'set', value: device.userAgent },
                { header: 'Sec-CH-UA-Mobile', operation: 'set', value: '?1' },
                { header: 'Sec-CH-UA-Platform', operation: 'set', value: '"iOS"' },
                { header: 'Sec-CH-UA', operation: 'remove' },
                { header: 'Sec-CH-UA-Full-Version-List', operation: 'remove' }
              ]
            },
            condition: {
              urlFilter: '*://www.bing.com/*',
              resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest']
            }
          },
          {
            id: 1002, priority: 2,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'User-Agent', operation: 'set', value: device.userAgent }
              ]
            },
            condition: {
              urlFilter: '*://rewards.bing.com/*',
              resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest']
            }
          }
        ]
      });

      // Inject mobile-override.js với device info cụ thể của device này
      // Inject vào MAIN world để override navigator/screen/matchMedia
      try {
        await chrome.scripting.unregisterContentScripts({ ids: [MOBILE_OVERRIDE_SCRIPT_ID] });
      } catch {} // Ignore nếu chưa có

      // Inject device metadata trước khi chạy mobile-override.js
      await chrome.scripting.registerContentScripts([{
        id: MOBILE_OVERRIDE_SCRIPT_ID,
        matches: ['*://*.bing.com/*'],
        js: ['mobile-override.js'],
        runAt: 'document_start',
        world: 'MAIN',
      }]);

      // Fallback: enable static ruleset nếu có
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ['mobile_ua_rules']
      }).catch(() => {});

      state.mobileRuleEnabled = true;
      log(`📱 Full fingerprint spoofing active (${device.name})`, 'success');
    } else {
      // Xóa dynamic rules
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1001, 1002]
      });
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ['mobile_ua_rules']
      }).catch(() => {});

      // Unregister content script
      try {
        await chrome.scripting.unregisterContentScripts({ ids: [MOBILE_OVERRIDE_SCRIPT_ID] });
      } catch {}

      state.mobileRuleEnabled = false;
      state.currentMobileDevice = null;
    }
  } catch (e) {
    console.error('Mobile mode toggle error:', e);
  }
}

// ---- DAILY PROGRESS ----
// Lưu tiến độ trong ngày vào chrome.storage để có thể track giữa các session
async function getDailyProgress() {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const result = await chrome.storage.local.get('dailyProgress');
  const dp = result.dailyProgress;
  // Reset nếu khác ngày
  if (!dp || dp.date !== today) {
    return { date: today, startPoints: null, currentPoints: null, earnedToday: 0, searchesDone: 0, cappedAt: null };
  }
  return dp;
}

async function saveDailyProgress(updates) {
  const today = new Date().toISOString().slice(0, 10);
  const current = await getDailyProgress();
  const merged = { ...current, ...updates, date: today };
  await chrome.storage.local.set({ dailyProgress: merged });
  // Broadcast to UI
  broadcast({ action: 'daily_progress', data: merged });
  return merged;
}

async function updateDailyProgressAfterPoints(currentPoints) {
  if (currentPoints === null) return;
  const dp = await getDailyProgress();
  const updates = { currentPoints };
  // Set startPoints nếu chưa có (đầu ngày)
  if (dp.startPoints === null) {
    updates.startPoints = currentPoints;
    updates.earnedToday = 0;
  } else {
    updates.earnedToday = Math.max(0, currentPoints - dp.startPoints);
    updates.searchesDone = Math.round(updates.earnedToday / 5); // 5pts per search
  }
  return await saveDailyProgress(updates);
}

// ---- AUTOMATION: SEARCH ----
async function performSearch(keyword, readResult = true) {
  let tab = null;
  let resultTab = null;
  try {
    // 1. Create tab → bing.com
    tab = await createTab('https://www.bing.com', false);
    await waitForTabLoad(tab.id);
    await sleep(2000);

    // 2. Inject automation script
    await injectFile(tab.id, 'content-automation.js');
    await sleep(500);

    // 3. Type and search
    const searchResult = await injectScript(tab.id, (kw) => {
      return window.__BRA__?.typeAndSearch(kw);
    }, [keyword]);

    if (!searchResult?.success) {
      await closeTab(tab.id);
      return { success: false, error: 'search_failed' };
    }

    // 4. Wait for results page
    await waitForTabLoad(tab.id).catch(() => {});
    await sleep(1500);

    // 5. Search interaction (scroll, hover — anti-ban)
    await injectFile(tab.id, 'content-automation.js');
    await sleep(300);
    await injectScript(tab.id, () => {
      return window.__BRA__?.enhancedSearchInteraction();
    });

    // 6. Tab category switch (30% chance: Images / Videos / News)
    await performTabCategorySwitch(tab.id);

    // 7. Click vào 1 kết quả để simulate đọc thật (nếu được bật)
    if (readResult) {
      const resultUrl = await injectScript(tab.id, () => {
        // Lấy link organic đầu tiên (không phải ad, không phải bing internal)
        const candidates = Array.from(document.querySelectorAll('#b_results .b_algo h2 a[href], #b_results li.b_algo a[href]'))
          .filter(a => {
            try {
              const url = new URL(a.href);
              return url.hostname !== 'www.bing.com' && !a.href.includes('bing.com') && a.href.startsWith('http');
            } catch { return false; }
          });
        return candidates.length > 0 ? candidates[Math.floor(Math.random() * Math.min(3, candidates.length))].href : null;
      });

      if (resultUrl) {
        try {
          resultTab = await createTab(resultUrl, false);
          // Đọc bài trong 5-12 giây (random)
          const readTime = randomInt(5000, 12000);
          await sleep(readTime);
          await closeTab(resultTab.id);
          resultTab = null;
        } catch (e) {
          if (resultTab) { await closeTab(resultTab.id).catch(() => {}); resultTab = null; }
        }
      }
    }

    await closeTab(tab.id);
    return { success: true, keyword };

  } catch (e) {
    if (resultTab) await closeTab(resultTab.id).catch(() => {});
    if (tab) await closeTab(tab.id);
    if (e.message === 'USER_STOPPED') throw e;
    return { success: false, error: e.message };
  }
}

// ---- AUTOMATION: MOBILE SEARCH PHASE ----
// Chạy mobile search sau khi PC search xong (dùng dynamic UA spoofing)
async function runMobileSearchPhase(count, config) {
  if (count <= 0) return { done: 0 };

  log(`📱 Mobile search phase: ${count} searches...`);
  await setMobileMode(true); // Random pick device + apply dynamic rule
  await sleep(1000);

  const deviceName = state.currentMobileDevice?.name || 'Unknown';
  log(`📱 Device: ${deviceName}`);

  let mobileDone = 0;
  for (let i = 0; i < count && state.status === 'running'; i++) {
    const keyword = getRandomKeyword();
    log(`📱 Mobile ${i + 1}/${count}: ${keyword}`);

    let tab = null;
    try {
      tab = await createTab('https://www.bing.com', false);
      await waitForTabLoad(tab.id);
      await sleep(1500);

      await injectFile(tab.id, 'content-automation.js');
      await sleep(400);

      const res = await injectScript(tab.id, (kw) => window.__BRA__?.typeAndSearch(kw), [keyword]);
      if (res?.success) {
        await waitForTabLoad(tab.id).catch(() => {});
        await sleep(1500);
        mobileDone++;
      }
      await closeTab(tab.id);
    } catch (e) {
      if (tab) await closeTab(tab.id).catch(() => {});
      if (e.message === 'USER_STOPPED') { await setMobileMode(false); throw e; }
    }

    if (i < count - 1 && state.status === 'running') {
      const delay = randomDelay(
        Math.floor(config.minDelay * 0.6),
        Math.floor(config.maxDelay * 0.6)
      );
      log(`📱 ⏳ ${Math.round(delay / 1000)}s...`);
      await sleep(delay);
    }
  }

  await setMobileMode(false);
  log(`📱 Mobile done (${deviceName}): ${mobileDone}/${count}`, 'success');
  return { done: mobileDone };
}

// ---- SILENT POINT CHECK (no tab open, just fetch) ----
async function fetchPointsQuiet() {
  let tab = null;
  try {
    tab = await createTab('https://rewards.bing.com/', false);
    await waitForTabLoad(tab.id).catch(() => {});
    await sleep(4000);

    const result = await injectScript(tab.id, () => {
      return (async function() {
        // METHOD 1: API (nhanh, chính xác) - WITH RETRY
        try {
          let lastError;
          for (let attempt = 0; attempt <= 2; attempt++) {
            try {
              const timeout = 12000 + (attempt * 3000); // 12s, 15s, 18s
              const controller = new AbortController();
              const tid = setTimeout(() => controller.abort(), timeout);
              const r = await fetch('https://rewards.bing.com/api/getuserinfo?type=1', {
                signal: controller.signal, 
                cache: 'no-cache', 
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              });
              clearTimeout(tid);
              
              if (r.ok) {
                const data = await r.json();
                const pts = data?.dashboard?.userStatus?.availablePoints;
                if (typeof pts === 'number') return { points: pts, source: 'api' };
              } else if (r.status >= 500 && attempt < 2) {
                lastError = new Error(`HTTP ${r.status}`);
                await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1500));
                continue;
              }
            } catch (e) {
              lastError = e;
              if ((e.name === 'AbortError' || e.message.includes('timeout')) && attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
                continue;
              }
            }
          }
        } catch (e) {}

        // METHOD 2: DOM selectors (fallback)
        const extractNum = (text) => {
          if (!text) return null;
          const m = text.match(/(\d{1,3}(?:[,.\s]\d{3})+|\d+)/g);
          if (m) {
            const nums = m.map(x => parseInt(x.replace(/[,.\s]/g, ''), 10))
              .filter(n => !isNaN(n) && n >= 0 && n < 1000000)
              .sort((a, b) => b - a);
            for (const n of nums) { if (n >= 100) return n; }
          }
          return null;
        };
        const sels = [
          '.text-title1.font-semibold', 'p.text-title1.font-semibold',
          '.flex.items-center.gap-2 > p', '[class*="text-title1"]',
          'mee-rewards-user-status-balance', '#balanceToolTip',
          '.pointsValue', '[class*="balance"]'
        ];
        for (const sel of sels) {
          try {
            const el = document.querySelector(sel);
            if (el) {
              const n = extractNum(el.innerText || el.textContent);
              if (n !== null) return { points: n, source: 'dom' };
            }
          } catch(e) {}
        }
        return { points: null, source: 'none' };
      })();
    });

    await closeTab(tab.id);
    return result || { points: null, source: 'error' };

  } catch (e) {
    if (tab) await closeTab(tab.id);
    if (e.message === 'USER_STOPPED') throw e;
    return { points: null, source: 'error', error: e.message };
  }
}

// Record a point snapshot into history
function recordPointSnapshot(points, wave, label) {
  if (points === null) return;
  const prevPoints = state.points.history.length > 0
    ? state.points.history[state.points.history.length - 1].points
    : state.points.baseline;
  const delta = (prevPoints !== null && points !== null) ? points - prevPoints : null;

  state.points.history.push({
    time: new Date().toLocaleTimeString(),
    points,
    wave,
    delta,
    label
  });

  // Keep max 50 entries
  if (state.points.history.length > 50) {
    state.points.history = state.points.history.slice(-50);
  }

  state.points.current = points;
  state.points.lastCheck = Date.now();

  // Recalculate real earned from baseline
  if (state.points.baseline !== null) {
    state.points.earned = points - state.points.baseline;
  }
}

// ---- AUTOMATION: SEARCH ALL (Wave System) ----
async function startSearchAutomation(maxModeOverride = false) {
  const config = await getConfig();
  const tier = TIER_LIMITS[config.rewardsLevel] || TIER_LIMITS['gold'];

  // Apply speed preset nếu có speedLevel
  if (config.speedLevel && SPEED_PRESETS[config.speedLevel]) {
    const preset = SPEED_PRESETS[config.speedLevel];
    config.minDelay = preset.minDelay;
    config.maxDelay = preset.maxDelay;
    config.waveSize = preset.waveSize;
    config.wavePauseMin = preset.wavePause;
  }

  const isMaxMode = maxModeOverride || config.maxMode;
  const readResult = config.readResult !== false; // default true

  // Tính số search cần chạy
  let targetCount = Math.min(config.searchCount, tier.pcSearch);

  // Max Mode: tính dựa trên điểm còn thiếu trong ngày
  if (isMaxMode) {
    const dp = await getDailyProgress();
    if (dp.earnedToday >= tier.dailyPointCap) {
      log(`🏆 Max Mode: Đã đủ điểm hôm nay! (${dp.earnedToday}/${tier.dailyPointCap} pts)`, 'success');
      broadcast({ action: 'daily_progress', data: dp });
      return;
    }
    const ptsLeft = tier.dailyPointCap - dp.earnedToday;
    const searchesLeft = Math.ceil(ptsLeft / 5); // 5pts/search
    targetCount = Math.min(searchesLeft, tier.pcSearch);
    log(`⚡ Max Mode: Cần thêm ~${ptsLeft} pts → chạy ${targetCount} searches`);
  }

  const waveSize = config.waveSize || 5;
  const totalWaves = Math.ceil(targetCount / waveSize);

  state.status = 'running';
  state._startTime = Date.now(); // Để tính duration
  state.currentSearch = 0;
  state.totalSearches = targetCount;
  state.progress = `0/${targetCount}`;
  state.percent = 0;
  state.wave = { current: 1, total: totalWaves };
  broadcastState();

  const modeLabel = isMaxMode ? 'MAX MODE' : config.rewardsLevel.toUpperCase();
  log(`▶️ Started (${modeLabel} — ${targetCount} PC searches, ${totalWaves} waves${readResult ? ' + read' : ''})`);

  // ====== BASELINE: Check points BEFORE starting ======
  log('📊 Checking points before starting...');
  const baseline = await fetchPointsQuiet();
  if (baseline.points !== null) {
    state.points.baseline = baseline.points;
    state.points.current = baseline.points;
    state.points.earned = 0;
    state.points.history = [];
    recordPointSnapshot(baseline.points, 0, 'baseline');
    log(`📊 Baseline: ${baseline.points.toLocaleString()} pts`, 'success');
    // Cập nhật daily progress
    await updateDailyProgressAfterPoints(baseline.points);
  } else {
    log('⚠️ Could not read baseline points', 'warning');
    state.points.baseline = null;
    state.points.earned = 0;
  }
  broadcastState();

  // ---- TIME-OF-DAY PROFILE ----
  const timeProfile = getTimeOfDayProfile();
  const timedConfig  = applyTimeProfile(config);
  log(`🕐 Time profile: ${timeProfile.label} (delay ×${timeProfile.activityMult})`);

  // ---- COFFEE BREAK SETUP ----
  let coffeeBreakAt      = getNextCoffeeBreak();
  let searchesSinceBreak = 0;
  log(`☕ Coffee break mỗi ${coffeeBreakAt} search`);

  let completed = 0;
  let consecutiveZeroWaves = 0; // đếm wave 0 điểm liên tiếp → phát hiện daily cap

  for (let wave = 1; wave <= totalWaves && state.status === 'running'; wave++) {
    state.wave.current = wave;
    const waveStart = completed;
    const waveEnd = Math.min(completed + waveSize, targetCount);

    log(`🌊 Wave ${wave}/${totalWaves} (${waveStart + 1}-${waveEnd}/${targetCount})`);
    broadcastState();

    for (let i = waveStart; i < waveEnd && state.status === 'running'; i++) {
      const keyword = getRandomKeyword();
      log(`🔍 Search ${i + 1}/${targetCount}: ${keyword}`);

      let result = await performSearch(keyword, readResult);

      // Retry if failed
      if (!result.success) {
        for (let retry = 0; retry < (config.maxRetries || 2) && !result.success; retry++) {
          const retryKeyword = getRandomKeyword();
          log(`🔄 Retry ${retry + 1}: ${retryKeyword}`, 'warning');
          await sleep(5000);
          result = await performSearch(retryKeyword, false); // retry không cần readResult
        }
      }

      if (result.success) {
        completed++;
        state.currentSearch = completed;
        state.progress = `${completed}/${targetCount}`;
        state.percent = Math.floor((completed / targetCount) * 100);
        broadcastState();
      } else {
        log(`❌ Search failed: ${result.error}`, 'error');
      }

      searchesSinceBreak++;

      // ---- COFFEE BREAK ----
      if (searchesSinceBreak >= coffeeBreakAt && state.status === 'running') {
        const isLongBreak  = coffeeBreakAt > 9;
        const breakSec     = isLongBreak
          ? randomInt(45, 90)
          : randomInt(15, 30);
        log(`☕ ${isLongBreak ? 'Nghỉ dài' : 'Nghỉ ngắn'}: ${breakSec}s...`, 'info');
        await sleep(breakSec * 1000);
        coffeeBreakAt      = getNextCoffeeBreak();
        searchesSinceBreak = 0;
        log(`☕ Tiếp tục — break tiếp theo sau ${coffeeBreakAt} search`);
      }

      // Delay giữa searches (không delay sau search cuối trong wave)
      if (state.status === 'running' && i < waveEnd - 1) {
        const delay = randomDelay(timedConfig.minDelay, timedConfig.maxDelay);
        log(`⏳ ${Math.round(delay / 1000)}s...`);
        await sleep(delay);
      }
    }

    // ====== AFTER WAVE: Verify points ======
    if (state.status === 'running' || state.status === 'cooldown') {
      log(`📊 Wave ${wave} done — checking points...`);
      await sleep(2500);
      const afterWave = await fetchPointsQuiet();
      if (afterWave.points !== null) {
        const prevPoints = state.points.current;
        recordPointSnapshot(afterWave.points, wave, `after_wave_${wave}`);
        await updateDailyProgressAfterPoints(afterWave.points);
        const waveDelta = (prevPoints !== null) ? afterWave.points - prevPoints : null;

        if (waveDelta !== null && waveDelta > 0) {
          consecutiveZeroWaves = 0;
          log(`📊 Wave ${wave}: +${waveDelta} pts ✅ (hôm nay: +${state.points.earned})`, 'success');
        } else if (waveDelta === 0) {
          consecutiveZeroWaves++;
          log(`⚠️ Wave ${wave}: 0 pts — ${consecutiveZeroWaves} wave liên tiếp không lên điểm`, 'warning');
          // Dừng sớm nếu 2 wave liên tiếp không lên — đã đạt daily cap
          if (isMaxMode && consecutiveZeroWaves >= 2) {
            log('🏆 Đã đạt giới hạn điểm hôm nay! Dừng an toàn.', 'success');
            break;
          }
        } else {
          log(`📊 Wave ${wave}: ${afterWave.points.toLocaleString()} pts`);
        }
      } else {
        log(`⚠️ Wave ${wave}: Không check được điểm`, 'warning');
      }
      broadcastState();
    }

    // Wave pause (trừ wave cuối)
    if (wave < totalWaves && state.status === 'running') {
      const pauseMin = config.wavePauseMin || 8;
      // Thêm jitter nhỏ (±30s) thay vì cố định
      const jitter = randomInt(-30000, 30000);
      const pauseMs = pauseMin * 60 * 1000 + jitter;
      state.status = 'cooldown';
      log(`😴 Wave pause ${pauseMin}min... (wave ${wave + 1}/${totalWaves} sắp bắt đầu)`, 'warning');
      broadcastState();
      await sleep(pauseMs);
      if (state.status === 'cooldown') state.status = 'running';
    }
  }

  // ====== MOBILE SEARCH PHASE ======
  if (state.status === 'running' && config.mobileMode && tier.mobileSearch > 0) {
    log(`📱 Bắt đầu Mobile search phase...`);
    let mobileTarget = tier.mobileSearch;

    if (isMaxMode) {
      const dp = await getDailyProgress();
      if (dp.earnedToday >= tier.dailyPointCap) {
        log('🏆 Max Mode: Đã đủ điểm — bỏ qua mobile phase', 'success');
        mobileTarget = 0;
      } else {
        const ptsLeft = tier.dailyPointCap - dp.earnedToday;
        mobileTarget = Math.min(Math.ceil(ptsLeft / 5), tier.mobileSearch);
        log(`📱 Max Mode mobile: cần ${mobileTarget} searches`);
      }
    }

    if (mobileTarget > 0) {
      const mobileDone = await runMobileSearchPhase(mobileTarget, config);

      // Update daily progress sau mobile
      await sleep(3000);
      const afterMobile = await fetchPointsQuiet();
      if (afterMobile.points !== null) {
        recordPointSnapshot(afterMobile.points, totalWaves + 1, 'after_mobile');
        await updateDailyProgressAfterPoints(afterMobile.points);
        log(`📱 Mobile done: +${afterMobile.points - (state.points.current || afterMobile.points)} pts`, 'success');
      }
    }
  }

  // ====== FINAL: Summary ======
  if (state.status === 'running' || state.status === 'cooldown') {
    state.status = 'done';
    state.percent = 100;

    log('📊 Final check...');
    const final = await fetchPointsQuiet();
    let totalEarned = null;

    if (final.points !== null) {
      recordPointSnapshot(final.points, totalWaves + 1, 'final');
      await updateDailyProgressAfterPoints(final.points);
      totalEarned = state.points.baseline !== null ? final.points - state.points.baseline : null;

      if (totalEarned !== null) {
        state.points.earned = totalEarned;
        log(`✅ Done! ${completed}/${targetCount} searches — +${totalEarned} pts earned`, 'success');
        if (totalEarned === 0) log('⚠️ 0 điểm — có thể đã đạt giới hạn ngày hoặc search không được tính', 'warning');
      } else {
        log(`✅ Done! ${completed}/${targetCount} searches`, 'success');
      }
    } else {
      log(`✅ Done! ${completed}/${targetCount} searches`, 'success');
    }

    // ====== OPEN done.html ======
    try {
      const durationSec = Math.round((Date.now() - (state._startTime || Date.now())) / 1000);
      const searchMode  = config.mobileMode ? 'both' : 'desktop';
      const doneUrl = chrome.runtime.getURL(
        `done.html?searches=${completed}&earned=${totalEarned || 0}&duration=${durationSec}&mode=${searchMode}&timeProfile=${timeProfile.name}`
      );
      await chrome.tabs.create({ url: doneUrl, active: true });
    } catch (e) {
      log('⚠️ Không mở được done.html', 'warning');
    }
  }
  broadcastState();
}

// ---- AUTOMATION: CHECK POINTS (manual button) ----
async function checkPoints() {
  let tab = null;
  try {
    log('⭐ Checking points...');
    tab = await createTab('https://rewards.bing.com/', false);
    await waitForTabLoad(tab.id);
    await sleep(5000);

    const result = await injectScript(tab.id, () => {
      return (async function() {
        let result = { points: null, status: 'UNKNOWN', breakdown: null };

        // BAN DETECTION
        const bodyText = document.body?.innerText || '';
        if (bodyText.match(/suspended|tạm ngưng|bị khóa|vi phạm/i)) {
          result.status = 'BANNED';
          return result;
        }

        // METHOD 1: Full API (lấy cả breakdown) - WITH RETRY
        try {
          let lastError;
          for (let attempt = 0; attempt <= 2; attempt++) {
            try {
              const timeout = 12000 + (attempt * 3000);
              const controller = new AbortController();
              const tid = setTimeout(() => controller.abort(), timeout);
              const r = await fetch('https://rewards.bing.com/api/getuserinfo?type=1', {
                signal: controller.signal,
                cache: 'no-cache',
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              });
              clearTimeout(tid);
              
              if (r.ok) {
                const data = await r.json();
                const us = data?.dashboard?.userStatus;
                if (us) {
                  result.points = us.availablePoints;
                  result.status = 'OK';
                  // Lấy thêm thông tin breakdown nếu có
                  result.breakdown = {
                    available: us.availablePoints,
                    lifetime: us.lifetimePoints || null,
                    redeemable: us.redeemablePoints || null,
                    level: us.levelInfo?.activeLevel || null
                  };
                  // Lấy counters (PC search, mobile search, edge bonus)
                  const counters = data?.dashboard?.userStatus?.counters;
                  if (counters) {
                    result.breakdown.counters = {};
                    for (const [key, val] of Object.entries(counters)) {
                      if (val?.complete !== undefined && val?.pointProgress !== undefined) {
                        result.breakdown.counters[key] = {
                          progress: val.pointProgress,
                          max: val.pointProgressMax,
                          complete: val.complete
                        };
                      }
                    }
                  }
                  return result;
                }
              } else if (r.status >= 500 && attempt < 2) {
                lastError = new Error(`HTTP ${r.status}`);
                await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1500));
                continue;
              }
            } catch (e) {
              lastError = e;
              if ((e.name === 'AbortError' || e.message.includes('timeout')) && attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
                continue;
              }
            }
          }
        } catch (e) {}

        // METHOD 2: DOM selectors (fallback)
        const extractPoints = (text) => {
          if (!text) return null;
          const matches = text.match(/(\d{1,3}(?:[,.\s]\d{3})+|\d+)/g);
          if (matches) {
            const nums = matches.map(m => parseInt(m.replace(/[,.\s]/g, ''), 10))
              .filter(n => !isNaN(n) && n >= 0 && n < 1000000)
              .sort((a, b) => b - a);
            for (const n of nums) { if (n >= 100) return n; }
          }
          return null;
        };

        const selectors = [
          '.text-title1.font-semibold',
          'p.text-title1.font-semibold',
          '.flex.items-center.gap-2 > p',
          '[class*="text-title1"]',
          'mee-rewards-user-status-balance',
          '#balanceToolTip',
          '.pointsValue',
          '[class*="balance"]'
        ];

        for (const sel of selectors) {
          try {
            const el = document.querySelector(sel);
            if (el) {
              const num = extractPoints(el.innerText || el.textContent);
              if (num !== null) {
                result.points = num;
                result.status = 'OK';
                return result;
              }
            }
          } catch(e) {}
        }

        return result;
      })();
    });

    await closeTab(tab.id);

    if (result?.status === 'BANNED') {
      state.status = 'error';
      log('🚫 ACCOUNT BANNED / SUSPENDED!', 'error');
    } else if (result?.status === 'OK' && result.points !== null) {
      // Update state with real data
      const prevPoints = state.points.current;
      state.points.current = result.points;
      state.points.lastCheck = Date.now();

      // If we have a baseline, show real earned
      if (state.points.baseline !== null) {
        state.points.earned = result.points - state.points.baseline;
        log(`⭐ Points: ${result.points.toLocaleString()} (earned: +${state.points.earned} since baseline)`, 'success');
      } else {
        // No baseline yet — set this as baseline
        state.points.baseline = result.points;
        state.points.earned = 0;
        log(`⭐ Points: ${result.points.toLocaleString()} (set as baseline)`, 'success');
      }

      // Show delta since last check
      if (prevPoints !== null && prevPoints !== result.points) {
        const delta = result.points - prevPoints;
        log(`   Δ ${delta > 0 ? '+' : ''}${delta} since last check`);
      }

      // Show breakdown if available
      if (result.breakdown?.counters) {
        for (const [key, val] of Object.entries(result.breakdown.counters)) {
          const name = key.replace(/([A-Z])/g, ' $1').trim();
          const pct = val.max > 0 ? Math.round((val.progress / val.max) * 100) : 0;
          log(`   📈 ${name}: ${val.progress}/${val.max} (${pct}%) ${val.complete ? '✅' : ''}`);
        }
      }

      recordPointSnapshot(result.points, state.wave.current, 'manual_check');
    } else {
      log('⚠️ Could not read points (API + DOM both failed)', 'warning');
    }
    broadcastState();

  } catch (e) {
    if (tab) await closeTab(tab.id);
    log(`❌ Points check failed: ${e.message}`, 'error');
  }
}

// ---- AUTOMATION: DAILY TASKS ----
function normalizeRewardsTaskUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;

  try {
    const parsed = new URL(url, 'https://rewards.bing.com');
    parsed.hash = '';
    return parsed.toString();
  } catch (e) {
    return url.trim();
  }
}

function buildRewardsTaskKey(task) {
  if (!task || typeof task !== 'object') return null;

  const offerId = task.offerId || task.offerid || task.promotionId || task.id || '';
  const destinationUrl = normalizeRewardsTaskUrl(task.destinationUrl) || '';

  if (!offerId && !destinationUrl) return null;
  return `offer:${offerId}|url:${destinationUrl}`;
}

function extractPendingRewardsTasks(apiData) {
  const pending = new Map();
  const dashboard = apiData?.dashboard || {};

  const addTask = (task, section) => {
    if (!task || typeof task !== 'object' || task.activity) return;

    const destinationUrl = normalizeRewardsTaskUrl(task.destinationUrl);
    if (!destinationUrl || destinationUrl.includes('referandearn')) return;
    if (task.complete || task.pointProgressMax) return;

    const key = buildRewardsTaskKey(task);
    if (!key || pending.has(key)) return;

    pending.set(key, {
      key,
      section,
      title: task.title || task.name || task.description || destinationUrl,
      destinationUrl,
      offerId: task.offerId || task.offerid || task.promotionId || task.id || null
    });
  };

  const addFromArray = (tasks, section) => {
    if (!Array.isArray(tasks)) return;
    for (const task of tasks) addTask(task, section);
  };

  const addFromSection = (section, sectionName) => {
    if (!section || typeof section !== 'object') return;

    if (Array.isArray(section)) {
      addFromArray(section, sectionName);
      return;
    }

    for (const [key, value] of Object.entries(section)) {
      if (Array.isArray(value)) {
        addFromArray(value, `${sectionName}.${key}`);
        continue;
      }

      if (!value || typeof value !== 'object') continue;

      if (Array.isArray(value.default)) {
        addFromArray(value.default, `${sectionName}.${key}.default`);
      }

      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (Array.isArray(nestedValue)) {
          addFromArray(nestedValue, `${sectionName}.${key}.${nestedKey}`);
        }
      }
    }
  };

  addFromSection(dashboard.dailySetPromotions, 'dailySetPromotions');
  addFromSection(dashboard.morePromotions, 'morePromotions');

  if (Array.isArray(dashboard.punchCards)) {
    dashboard.punchCards.forEach((punchCard, index) => {
      addFromArray(punchCard?.activities, `punchCards.${index}.activities`);
      addFromArray(punchCard?.parentPromotion, `punchCards.${index}.parentPromotion`);
      addFromArray(punchCard?.parentPromotion?.promotions, `punchCards.${index}.parentPromotion.promotions`);
    });
  }

  return {
    pending,
    pendingCount: pending.size,
    urls: [...new Set([...pending.values()].map(task => task.destinationUrl).filter(Boolean))]
  };
}

function compareRewardsTaskSnapshots(beforeSnapshot, afterSnapshot) {
  const beforePending = beforeSnapshot?.pending || new Map();
  const afterPending = afterSnapshot?.pending || new Map();
  const completed = [];
  const remaining = [];

  for (const [key, task] of beforePending.entries()) {
    if (!afterPending.has(key)) completed.push(task);
  }

  for (const [key, task] of afterPending.entries()) {
    if (beforePending.has(key)) remaining.push(task);
  }

  return {
    completed,
    completedCount: completed.length,
    remaining,
    remainingCount: remaining.length,
    beforeCount: beforePending.size,
    afterCount: afterPending.size
  };
}

async function verifyDailyTaskCompletion(initialSnapshot, options = {}) {
  const { maxAttempts = 4, delayMs = 4000 } = options;
  let bestResult = null;

  if (!initialSnapshot?.pending) {
    return { ok: false, reason: 'initial_snapshot_missing' };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      await sleep(delayMs);
    }

    const apiResult = await fetchRewardsUserInfoQuiet();
    if (!apiResult?.ok) {
      if (!bestResult) {
        bestResult = {
          ok: false,
          reason: apiResult?.reason || 'api_unavailable'
        };
      }
      continue;
    }

    const afterSnapshot = extractPendingRewardsTasks(apiResult.data);
    const diff = compareRewardsTaskSnapshots(initialSnapshot, afterSnapshot);
    const currentResult = {
      ok: true,
      attempt,
      snapshot: afterSnapshot,
      ...diff
    };

    if (
      !bestResult ||
      !bestResult.ok ||
      currentResult.completedCount > bestResult.completedCount ||
      currentResult.afterCount < bestResult.afterCount
    ) {
      bestResult = currentResult;
    }

    if (currentResult.completedCount > 0 || currentResult.afterCount === 0) {
      break;
    }
  }

  return bestResult || { ok: false, reason: 'api_unavailable' };
}

async function runDailyTasks() {
  log(`[Daily Tasks] Bắt đầu tự động làm nhiệm vụ hàng ngày...`);
  let dashTab = null;
  let dashTabOwned = false;
  let totalCompleted = 0;
  let apiUrls = [];
  let initialTaskSnapshot = null;
  let dashboardClickAttempts = 0;
  let externalUrlsProcessed = 0;

  try {
    // 🔥 TẢI DỮ LIỆU SUPER ACCURATE JSON QUA API
    log('🤖 [API] Đang tải Database JSON cực kỳ chính xác từ Microsoft Server...');
    const apiResult = await fetchRewardsUserInfoQuiet();
    if (apiResult?.ok) {
      initialTaskSnapshot = extractPendingRewardsTasks(apiResult.data);
      apiUrls = initialTaskSnapshot.urls;
      log(`[API] Pending Rewards tasks from getuserinfo: ${initialTaskSnapshot.pendingCount}`, 'info', {
        pending: initialTaskSnapshot.pendingCount,
        urls: apiUrls.length
      });

      if (initialTaskSnapshot.pendingCount === 0) {
        log('[API] No pending Rewards tasks found. Skipping dashboard clicks to avoid false positives.', 'info');
        return { success: true, completed: 0 };
      }

      const dbData = apiResult.data;
      const dashboard = dbData.dashboard || {};

      const isValidTask = (task) => {
        if (!task || typeof task !== 'object') return false;
        if (task.activity) return false; // skip meta wrappers
        return task.destinationUrl && !task.destinationUrl.includes('referandearn');
      };

      const extractFromArray = (arr) => {
        if (!Array.isArray(arr)) return;
        for (const task of arr) {
          if (isValidTask(task) && !task.complete && !task.pointProgressMax) {
            apiUrls.push(task.destinationUrl);
          }
        }
      };

      // Extract tasks from API object structures (dailySetPromotions is {date: {default: [...]}}, etc.)
      const extractFromSection = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          // some sections are direct arrays
          extractFromArray(obj);
          return;
        }
        for (const val of Object.values(obj)) {
          if (Array.isArray(val)) {
            extractFromArray(val);
          } else if (typeof val === 'object' && val !== null) {
            // drill one level deeper (e.g. { "default": [...] })
            extractFromArray(val.default || val);
          }
        }
      };

      // 1. Quét Daily Set (keyed: {dateKey: {default: [tasks]}})
      if (dashboard.dailySetPromotions) {
        extractFromSection(dashboard.dailySetPromotions);
      }
      // 2. Quét More Promotions
      if (dashboard.morePromotions) {
        extractFromSection(dashboard.morePromotions);
      }
      // 3. Quét PunchCards
      if (dashboard.punchCards && Array.isArray(dashboard.punchCards)) {
        for (const pc of dashboard.punchCards) {
          if (pc.activities && Array.isArray(pc.activities)) {
            extractFromArray(pc.activities);
          }
          if (pc.parentPromotion) {
            if (Array.isArray(pc.parentPromotion)) {
              extractFromArray(pc.parentPromotion);
            } else if (Array.isArray(pc.parentPromotion.promotions)) {
              extractFromArray(pc.parentPromotion.promotions);
            }
          }
        }
      }

      // Khử trùng lặp URL
      apiUrls = [...new Set(apiUrls)];
      log(`🔥 [API] Thành công! Tìm thấy chính xác ${apiUrls.length} nhiệm vụ cần làm.`);
    } else if (apiResult?.reason === 'signin_required') {
      log('Rewards is not signed in. Open rewards.bing.com, sign in, then run Daily Tasks again.', 'warning');
      return { success: false, completed: totalCompleted, error: 'signin_required' };
    } else {
      const detail = apiResult?.status || apiResult?.error || apiResult?.reason || 'unknown_error';
      log(`[API] Rewards JSON unavailable (${detail}). Continuing with dashboard mode only.`, 'warning');
    }
  } catch (e) {
    log(`[API Error] Lỗi khi kéo Database: ${e.message}`, 'error');
  }

  try {
    // 🔥 PHASE 1: DIRECT API / SERVER ACTIONS (Super Fast)
    log('🤖 [API] Đang thực hiện nhiệm vụ bằng Server Actions (Direct)...');
    const rewardsTab = await getRewardsTab();
    dashTab = rewardsTab.tab;
    dashTabOwned = rewardsTab.created;
    await waitForTabLoad(dashTab.id).catch(() => {});
    await sleep(dashTabOwned ? 5000 : 1000);

    const dashTabInfo = await chrome.tabs.get(dashTab.id);
    if (!isRewardsPageUrl(dashTabInfo?.url)) {
      if (dashTabOwned) await closeTab(dashTab.id);
      log('Rewards dashboard redirected away from rewards.bing.com. Sign in first, then retry.', 'warning');
      return { success: false, completed: totalCompleted, error: 'signin_required' };
    }

    // Inject automation script
    await injectFile(dashTab.id, 'content-automation.js');
    await sleep(500);

    // 🔥 DEBUG: Verify script was injected
    const injectionTest = await injectScript(dashTab.id, () => {
      return typeof window.__BRA__?.clickDailyTasks === 'function' ? 'injected' : 'missing';
    });
    log(`[DEBUG] Dashboard automation injected: ${injectionTest}`, 'info');

    // Run the hybrid clicker (Direct API + DOM Fallback)
    const result = await injectScript(dashTab.id, () => {
      return window.__BRA__?.clickDailyTasks?.();
    });

    // 🔥 FIX: Better validation of result
    const clickedCount = result?.clicked || 0;
    const attemptedCount = result?.attempted || 0;
    const clickedUrls = result?.urls || [];
    dashboardClickAttempts = clickedCount;
    const clickSuccess = false; // Raw clicks are attempts only; API snapshot decides completion.

    if (clickSuccess) {
      // Real success - actually clicked tasks
      log(`🔥 ✅ Thành công! Đã click ${clickedCount}/${attemptedCount} task(s)`, 'success', {
        clicked: clickedCount,
        attempted: attemptedCount,
        urls: clickedUrls.slice(0, 3) // Log first 3 URLs as proof
      });
      totalCompleted += clickedCount;
    } else if (clickedCount > 0 && !clickSuccess) {
      // Dashboard clicks are only attempts until API snapshot confirms task completion.
      log(`⚠️ Click result unclear: reported ${clickedCount} clicked but success=${result?.success}`, 'warning', {
        clicked: clickedCount,
        attempted: attemptedCount,
        urls: clickedUrls.slice(0, 3)
      });
    } else {
      // No tasks clicked
      const reason = result?.error ? `(${result.error})` : '(không tìm thấy tasks hoặc đã làm xong)';
      log(`⚠️ Không click được nhiệm vụ nào trên Dashboard ${reason}`, 'warning', {
        attemptedCount,
        error: result?.error
      });
    }
    
    // Log raw result for debugging
    console.log('[Dashboard Tasks Result]', result);
    
    await sleep(2000);
    if (dashTabOwned) {
      await closeTab(dashTab.id);
      dashTab = null;
      dashTabOwned = false;
    }

    // 🔥 PHASE 2: FALLBACK TO EXTERNAL URLS (from getuserinfo API)
    if (apiUrls.length > 0) {
      log(`[API Fallback] Attempting ${apiUrls.length} external URL tasks...`, 'info');
      let urlsProcessed = 0;
      
      for (const url of apiUrls) {
        let taskTab = null;
        try {
          if (url.includes('microsoft.com/en-us/edge') || url.includes('bing.com/explore')) {
            log(`[API Fallback] Skipping edge redirect: ${url.substring(0, 40)}...`, 'info');
            continue;
          }

          log(`[API Fallback] Opening external task (${urlsProcessed + 1}/${apiUrls.length}): ${url.substring(0, 50)}...`, 'info');
          taskTab = await createTab(url, false);
          await waitForTabLoad(taskTab.id).catch(() => {});
          await sleep(4000);

          // Try to dismiss popups
          await injectScript(taskTab.id, () => {
            window.alert = () => { }; 
            window.confirm = () => false; 
            window.prompt = () => null;
            const cancels = document.querySelectorAll('button[class*="cancel"], button[class*="close"]');
            cancels.forEach(c => { try { c.click(); } catch (e) { } });
          }).catch(() => {});

          await sleep(1500);
          await closeTab(taskTab.id);
          urlsProcessed++;
          externalUrlsProcessed++;
          // Note: Not incrementing totalCompleted here - we don't know if task was actually completed
          log(`[API Fallback] Task tab processed (${urlsProcessed}/${apiUrls.length})`, 'info');
          
        } catch (e) {
          log(`[API Fallback] Error on task: ${e.message}`, 'warning');
          if (taskTab) await closeTab(taskTab.id).catch(() => {});
        }
      }
      
      // Only log fallback as completed if we processed URLs
      if (urlsProcessed > 0) {
        log(`[API Fallback] Processed ${urlsProcessed} external task URLs (may or may not result in points)`, 'info', {
          processed: urlsProcessed,
          total: apiUrls.length
        });
        // Don't add to totalCompleted - we can't verify these actually completed
      }
    }

    if (dashTabOwned && dashTab) {
      const remaining = await chrome.tabs.query({ windowType: 'normal' });
      if (remaining.length > 1) await closeTab(dashTab.id);
    }
    dashTab = null;
    dashTabOwned = false;

    const attemptedAnyTask = dashboardClickAttempts > 0 || externalUrlsProcessed > 0;
    if (initialTaskSnapshot) {
      const verification = await verifyDailyTaskCompletion(initialTaskSnapshot, {
        maxAttempts: attemptedAnyTask ? 4 : 1,
        delayMs: 4000
      });

      if (verification?.ok) {
        totalCompleted = verification.completedCount;
        log(`[Verify] API snapshot: ${verification.beforeCount} pending before, ${verification.afterCount} pending after, ${verification.completedCount} newly completed.`, verification.completedCount > 0 ? 'success' : 'warning', {
          beforePending: verification.beforeCount,
          afterPending: verification.afterCount,
          completed: verification.completedCount,
          dashboardClicksAttempted: dashboardClickAttempts,
          externalUrlsProcessed
        });
      } else if (attemptedAnyTask) {
        log(`[Verify] Task attempts finished, but API verification was unavailable. Completed count remains 0.`, 'warning', {
          reason: verification?.reason || 'api_unavailable',
          dashboardClicksAttempted: dashboardClickAttempts,
          externalUrlsProcessed
        });
      }
    } else if (attemptedAnyTask) {
      log(`[Verify] API baseline was unavailable, so dashboard clicks were not counted as completed.`, 'warning', {
        dashboardClicksAttempted: dashboardClickAttempts,
        externalUrlsProcessed
      });
    }

    // 🔥 Final summary with clarity
    if (totalCompleted > 0) {
      log(`✅ Daily tasks complete! Verified clicked/completed: ${totalCompleted}`, 'success', {
        completed: totalCompleted,
        note: 'Verified by API snapshot, not by raw click count'
      });
    } else {
      log(`⚠️ Daily tasks complete but no verified completions detected. Tasks may have been already done or failed.`, 'warning');
    }
    
    return { success: true, completed: totalCompleted };

  } catch (e) {
    if (dashTabOwned && dashTab) await closeTab(dashTab.id);
    if (e.message === 'USER_STOPPED') throw e;
    log(`❌ Daily tasks failed: ${e.message}`, 'error');
    return { success: false, completed: totalCompleted, error: e.message };
  }
}

// ---- AUTOMATION: MOBILE DAILY TASKS ----
async function runMobileDailyTasks() {
  let tab = null;
  let totalCompleted = 0;

  try {
    log('📱 Enabling mobile mode...');
    await setMobileMode(true);
    await sleep(500);

    // Open Bing in mobile mode
    log('📱 Opening Bing in mobile mode...');
    tab = await createTab('https://www.bing.com/', false);
    await waitForTabLoad(tab.id);
    await sleep(3000);

    log('🔍 Looking for mobile tasks...');
    const mobileResult = await injectScript(tab.id, () => {
      return (async function() {
        const results = { found: 0, clicked: 0, taskNames: [], readArticleUrls: [] };
        const delay = ms => new Promise(r => setTimeout(r, ms));

        const clickElement = async (el) => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await delay(500);
          if (el.href) { window.open(el.href, '_blank'); } else { el.click(); }
          await delay(1000);
        };

        // Scroll down
        for (let i = 0; i < 8; i++) {
          window.scrollBy({ top: 300, behavior: 'smooth' });
          await delay(600);
        }
        window.scrollTo(0, 0);
        await delay(1000);

        // MOBILE TASK 1: Rewards/Check-in
        const rewardsSelectors = [
          '[class*="rewards"]', '[id*="rewards"]', '[class*="checkin"]',
          '[class*="check-in"]', '[class*="streak"]', '#id_rc',
          '.rewards_flyout', '#rewardsApp'
        ];
        for (const sel of rewardsSelectors) {
          try {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
              const rect = el.getBoundingClientRect();
              if (rect.width < 20 || rect.height < 20) continue;
              const text = el.textContent || '';
              if (text.length > 200) continue;
              const isClickable = el.tagName === 'A' || el.tagName === 'BUTTON' ||
                el.style.cursor === 'pointer' || el.getAttribute('role') === 'button';
              if (isClickable) {
                results.found++;
                results.taskNames.push('Rewards: ' + text.substring(0, 40).trim());
                await clickElement(el);
                results.clicked++;
                await delay(3000);
              }
            }
          } catch(e) {}
        }

        // MOBILE TASK 2: Read to Earn
        const newsSelectors = [
          '.news-card a', '[class*="news"] a[href]', '.infopane a[href]',
          'a.story-card', '[class*="feed"] a[href]', '.content-card a',
          'article a[href]', '.card a[href*="msn.com"]'
        ];
        for (const sel of newsSelectors) {
          try {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
              const rect = el.getBoundingClientRect();
              if (rect.width < 50 || rect.height < 30) continue;
              if (el.href && !results.readArticleUrls.includes(el.href)) {
                results.readArticleUrls.push(el.href);
                if (results.readArticleUrls.length >= 5) break;
              }
            }
          } catch(e) {}
          if (results.readArticleUrls.length >= 5) break;
        }
        for (let i = 0; i < Math.min(3, results.readArticleUrls.length); i++) {
          results.found++;
          results.taskNames.push('Read: article ' + (i + 1));
        }

        // MOBILE TASK 3: Point-earning elements
        const allClickable = document.querySelectorAll('a[href], button, [role="button"]');
        for (const el of allClickable) {
          if (results.clicked >= 10) break;
          const text = el.textContent || '';
          const rect = el.getBoundingClientRect();
          if (rect.width < 40 || rect.height < 30) continue;
          if (el.closest('header') || el.closest('nav')) continue;
          const hasPoints = text.match(/[+]\s*\d+\s*(pts|points|điểm)?/i);
          const hasTask = text.match(/(quiz|poll|trivia|daily|check.?in|earn|reward|complete|claim)/i);
          if (hasPoints || hasTask) {
            if (text.includes('Sign') || text.includes('Settings')) continue;
            results.found++;
            results.taskNames.push('Task: ' + text.substring(0, 40).trim());
            await clickElement(el);
            results.clicked++;
            await delay(3000);
          }
        }
        return { ...results, readArticleUrls: results.readArticleUrls.slice(0, 3) };
      })();
    });

    const mobileData = mobileResult || { found: 0, clicked: 0, taskNames: [], readArticleUrls: [] };
    totalCompleted += mobileData.clicked;
    if (mobileData.taskNames?.length > 0) {
      mobileData.taskNames.forEach(name => log(`   📱 ${name}`));
    }

    // Read articles (dwell time)
    const articleUrls = mobileData.readArticleUrls || [];
    if (articleUrls.length > 0) {
      log(`📰 Read to Earn: Opening ${articleUrls.length} articles...`);
      for (const url of articleUrls) {
        try {
          await chrome.tabs.update(tab.id, { url });
          await waitForTabLoad(tab.id).catch(() => {});
          await sleep(2000);

          await injectScript(tab.id, () => {
            return (async function() {
              const delay = ms => new Promise(r => setTimeout(r, ms));
              const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
              const scrollCount = randomInt(15, 25);
              for (let i = 0; i < scrollCount; i++) {
                window.scrollBy({ top: randomInt(150, 400), behavior: 'smooth' });
                await delay(randomInt(1000, 3000));
                if (Math.random() < 0.2) {
                  window.scrollBy({ top: -randomInt(50, 150), behavior: 'smooth' });
                  await delay(randomInt(500, 1500));
                }
              }
            })();
          });

          totalCompleted++;
          log(`   📰 Read article: ${url.substring(0, 60)}...`);
          await sleep(1000);
        } catch (e) {
          log(`   ⚠️ Article read failed: ${e.message}`, 'warning');
        }
      }
    }

    // Mobile rewards dashboard
    log('📱 Checking mobile rewards dashboard...');
    await chrome.tabs.update(tab.id, { url: 'https://rewards.bing.com/' });
    await waitForTabLoad(tab.id).catch(() => {});
    await sleep(4000);

    const mobileDashResult = await injectScript(tab.id, () => {
      return (async function() {
        const results = { found: 0, clicked: 0, taskNames: [] };
        const delay = ms => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 5; i++) {
          window.scrollBy({ top: 300, behavior: 'smooth' });
          await delay(500);
        }
        window.scrollTo(0, 0);
        await delay(500);
        const allClickable = document.querySelectorAll('a[href], button, [role="button"]');
        for (const el of allClickable) {
          if (results.clicked >= 8) break;
          const text = el.textContent || '';
          const rect = el.getBoundingClientRect();
          if (rect.width < 40 || rect.height < 25) continue;
          if (el.closest('header') || el.closest('nav')) continue;
          if (text.includes('Sign in') || text.includes('Redeem') || text.includes('About')) continue;
          const hasPoints = text.match(/[+•]\s*\d+/);
          const hasCheck = el.querySelector('[class*="check"]');
          if (hasPoints && !hasCheck) {
            results.found++;
            results.taskNames.push(text.substring(0, 40).trim());
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(400);
            if (el.href) { window.open(el.href, '_blank'); } else { el.click(); }
            results.clicked++;
            await delay(4000);
          }
        }
        return results;
      })();
    });

    const mobileDash = mobileDashResult || { found: 0, clicked: 0, taskNames: [] };
    totalCompleted += mobileDash.clicked;
    if (mobileDash.taskNames?.length > 0) {
      mobileDash.taskNames.forEach(n => log(`   📱 Mobile dash: ${n}`));
    }

    // Disable mobile and cleanup
    await setMobileMode(false);
    await sleep(2000);
    const allTabs = await chrome.tabs.query({});
    for (const t of allTabs) {
      if (t.id !== tab.id && (t.url?.includes('bing.com') || t.url?.includes('msn.com'))) {
        await closeTab(t.id);
      }
    }
    await closeTab(tab.id);

    log(`✅ Mobile tasks completed: ${totalCompleted}`, 'success');
    return { success: true, completed: totalCompleted };

  } catch (e) {
    await setMobileMode(false);
    if (tab) await closeTab(tab.id);
    if (e.message === 'USER_STOPPED') throw e;
    log(`❌ Mobile tasks failed: ${e.message}`, 'error');
    return { success: false, completed: 0, error: e.message };
  }
}

// ---- AUTOMATION: RESET PAGE ----
async function resetPage() {
  try {
    log('🔄 Resetting & cleaning tabs...');
    const allTabs = await chrome.tabs.query({});
    let closedCount = 0;

    // Find or create rewards tab
    let rewardsTab = allTabs.find(t => t.url?.includes('rewards.bing.com'));
    if (!rewardsTab) {
      rewardsTab = await createTab('https://rewards.bing.com/', true);
      await waitForTabLoad(rewardsTab.id).catch(() => {});
    }

    // Close non-essential tabs
    for (const t of allTabs) {
      if (t.id === rewardsTab.id) continue;
      if (t.url?.includes('bing.com') || t.url?.includes('msn.com')) {
        await closeTab(t.id);
        closedCount++;
      }
    }

    if (closedCount > 0) log(`🗑️ Closed ${closedCount} tabs`);

    // Reload rewards tab
    await chrome.tabs.reload(rewardsTab.id);
    log('✅ Rewards page reloaded', 'success');
    return { success: true };

  } catch (e) {
    log(`❌ Reset failed: ${e.message}`, 'error');
    return { success: false, error: e.message };
  }
}

// ---- MESSAGE HANDLER ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'get_state') {
    sendResponse({ state: getPublicState(), logs: state.logs.slice(0, 50) });
    return true;
  }

  if (msg.action === 'get_config') {
    getConfig().then(config => sendResponse({ config }));
    return true;
  }

  if (msg.action === 'save_config') {
    // Silent save — không log ra terminal (auto-save liên tục)
    saveConfig(msg.config).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.action === 'get_daily_progress') {
    getDailyProgress().then(dp => sendResponse({ dp }));
    return true;
  }

  if (msg.action === 'command') {
    handleCommand(msg.command);
    sendResponse({ received: true });
    return true;
  }

  return false;
});

async function handleCommand(command) {
  switch (command) {
    case 'start_search':
      if (state.status === 'running') { log('⚠️ Already running!', 'warning'); return; }
      startSearchAutomation(false).catch(e => {
        if (e.message !== 'USER_STOPPED') log(`❌ Search Error: ${e.message}`, 'error');
      });
      break;

    case 'start_max_mode':
      if (state.status === 'running') { log('⚠️ Already running!', 'warning'); return; }
      log('⚡ Max Mode: Tự động tính số search còn thiếu hôm nay...');
      startSearchAutomation(true).catch(e => {
        if (e.message !== 'USER_STOPPED') log(`❌ Max Mode Error: ${e.message}`, 'error');
      });
      break;

    case 'stop':
      state.status = 'stopped';
      // Đảm bảo mobile UA được tắt khi stop
      await setMobileMode(false).catch(() => {});
      log('⏹️ Stopped!', 'warning');
      broadcastState();
      break;

    case 'check_points':
      checkPoints().catch(e => {
        if (e.message !== 'USER_STOPPED') log(`❌ Point Check Error: ${e.message}`, 'error');
      });
      break;

    case 'daily_tasks':
      if (state.status === 'running') { log('⚠️ Already running!', 'warning'); return; }
      state.status = 'running';
      broadcastState();

      (async () => {
        await runDailyTasks();
        const config = await getConfig();
        if (config.mobileMode && state.status === 'running') {
          await runMobileDailyTasks();
        }
        if (state.status === 'running') state.status = 'idle';
        broadcastState();
      })().catch(e => {
        if (e.message !== 'USER_STOPPED') log(`❌ Task Error: ${e.message}`, 'error');
      });
      break;

    case 'reset_page':
      resetPage().catch(e => {
        if (e.message !== 'USER_STOPPED') log(`❌ Reset Error: ${e.message}`, 'error');
      });
      break;

    case 'reset_progress':
      state.status = 'idle';
      state.progress = '0/0';
      state.percent = 0;
      state.currentSearch = 0;
      state.points = { current: null, earned: 0, baseline: null, lastCheck: null, history: [] };
      state.wave = { current: 0, total: 0 };
      log('🔄 Progress + points reset', 'success');
      broadcastState();
      break;
  }
}

// ---- KEEP-ALIVE ----
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive' && (state.status === 'running' || state.status === 'cooldown')) {
    // Service worker stays alive while automation is active
  }
});

// ---- INIT ----
log('⚡ Extension loaded', 'success');
