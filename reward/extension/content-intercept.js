// =============================================
// FETCH/XHR INTERCEPT — Bing Rewards API Sniffer
// Inject vào rewards.bing.com để bắt API responses
// Không tạo request mới, chỉ "nghe" response có sẵn
// =============================================

(function () {
  if (window.__BRA_INTERCEPT_ACTIVE__) return { status: 'already_active' };
  window.__BRA_INTERCEPT_ACTIVE__ = true;

  // Storage cho intercepted data
  const intercepted = {
    userInfo: null,        // /api/getuserinfo?type=1
    userInfoFull: null,    // /api/getuserinfo?type=2
    pointsBreakdown: null, // /api/getpointsbreakdown
    orders: null,          // /api/getorders
    promotions: null,      // /api/getpromotions
    activityQuiz: null,    // /api/getactivityandquiz
    _raw: {},              // All raw responses by path
    _timestamps: {},       // Timestamps per endpoint
    _count: 0,             // Total intercepted count
  };

  // ─── ENDPOINT MAPPING ───
  const ENDPOINT_MAP = {
    '/api/getuserinfo': (params) => params.get('type') === '2' ? 'userInfoFull' : 'userInfo',
    '/api/getpointsbreakdown': () => 'pointsBreakdown',
    '/api/getorders': () => 'orders',
    '/api/getpromotions': () => 'promotions',
    '/api/getactivityandquiz': () => 'activityQuiz',
  };

  function classifyEndpoint(url) {
    try {
      const parsed = new URL(url, location.origin);
      const pathname = parsed.pathname.toLowerCase();
      for (const [path, resolver] of Object.entries(ENDPOINT_MAP)) {
        if (pathname.includes(path)) {
          return resolver(parsed.searchParams);
        }
      }
      // Unknown rewards API
      if (pathname.includes('/api/')) {
        return '_unknown_' + pathname.split('/api/')[1];
      }
    } catch (e) {}
    return null;
  }

  function isRewardsAPI(url) {
    if (!url) return false;
    const s = typeof url === 'string' ? url : url.toString();
    return s.includes('rewards.bing.com/api/') ||
           s.includes('rewards.microsoft.com/api/') ||
           (s.includes('/api/') && (s.includes('getuserinfo') || s.includes('getpoints') || s.includes('getorders') || s.includes('getpromotions') || s.includes('getactivity')));
  }

  function storeData(key, data, url) {
    if (!key || !data) return;
    intercepted[key] = data;
    intercepted._raw[key] = data;
    intercepted._timestamps[key] = Date.now();
    intercepted._count++;

    // Parse useful fields immediately
    if (key === 'userInfo' || key === 'userInfoFull') {
      parseUserInfo(key, data);
    }

    // Notify extension via postMessage (content script bridge will pick this up)
    try {
      window.postMessage({
        type: 'BRA_API_INTERCEPTED',
        key: key,
        data: data,
        url: url,
        timestamp: Date.now()
      }, '*');
    } catch (e) {}

    console.log(`[BRA Intercept] ✅ Captured: ${key} (${JSON.stringify(data).length} bytes)`);
  }

  // ─── PARSE USER INFO ───
  function parseUserInfo(key, data) {
    try {
      const dashboard = data.dashboard || data;
      const userStatus = dashboard.userStatus || {};
      const counters = userStatus.counters || {};

      intercepted._parsed = intercepted._parsed || {};
      intercepted._parsed.points = {
        available: userStatus.availablePoints,
        lifetime: userStatus.lifetimePoints,
        redeemed: userStatus.lifetimePointsRedeemed,
        level: userStatus.activeLevel,
      };

      // Parse search progress from counters
      const searchProgress = { pc: null, mobile: null, edge: null };
      for (const [cKey, counter] of Object.entries(counters)) {
        if (!counter || typeof counter !== 'object') continue;
        const name = (counter.name || counter.description || cKey || '').toLowerCase();
        const progress = counter.count || counter.pointProgress || 0;
        const max = counter.max || counter.pointProgressMax || 0;
        const complete = counter.complete || false;

        if (name.includes('pc') || name.includes('desktop')) {
          searchProgress.pc = { progress, max, complete, name: counter.name || cKey };
        } else if (name.includes('mobile')) {
          searchProgress.mobile = { progress, max, complete, name: counter.name || cKey };
        } else if (name.includes('edge')) {
          searchProgress.edge = { progress, max, complete, name: counter.name || cKey };
        }
      }
      intercepted._parsed.searchProgress = searchProgress;

      // Parse offers from full dashboard
      if (key === 'userInfoFull') {
        const dailySet = dashboard.dailySetPromotions || {};
        const morePromos = dashboard.morePromotions || [];
        let pendingPoints = 0;
        let completedOffers = 0;
        let totalOffers = 0;

        for (const [, offers] of Object.entries(dailySet)) {
          for (const offer of (offers || [])) {
            totalOffers++;
            if (offer.complete) completedOffers++;
            else pendingPoints += (offer.pointProgressMax || 0) - (offer.pointProgress || 0);
          }
        }
        for (const offer of morePromos) {
          totalOffers++;
          if (offer.complete) completedOffers++;
          else pendingPoints += (offer.pointProgressMax || 0) - (offer.pointProgress || 0);
        }

        intercepted._parsed.offers = {
          total: totalOffers,
          completed: completedOffers,
          pendingPoints: pendingPoints,
        };

        // Streak
        if (dashboard.streakPromotion) {
          intercepted._parsed.streak = {
            current: dashboard.streakPromotion.progress || 0,
            max: dashboard.streakPromotion.pointProgressMax || 0,
            complete: dashboard.streakPromotion.complete || false,
          };
        }
      }
    } catch (e) {
      console.warn('[BRA Intercept] Parse error:', e);
    }
  }

  // ═══════════════════════════════════════════════
  // 1. INTERCEPT window.fetch
  // ═══════════════════════════════════════════════
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const request = args[0];
    const url = typeof request === 'string' ? request : (request?.url || '');

    // Call original fetch first (never block the page)
    const response = await originalFetch.apply(this, args);

    // Check if this is a Rewards API call
    if (isRewardsAPI(url)) {
      try {
        const clone = response.clone();
        const contentType = clone.headers.get('content-type') || '';
        if (contentType.includes('json')) {
          const data = await clone.json();
          const key = classifyEndpoint(url);
          if (key) {
            storeData(key, data, url);
          }
        }
      } catch (e) {
        console.warn('[BRA Intercept] fetch parse error:', e.message);
      }
    }

    return response;
  };

  // ═══════════════════════════════════════════════
  // 2. INTERCEPT XMLHttpRequest
  // ═══════════════════════════════════════════════
  const origXHROpen = XMLHttpRequest.prototype.open;
  const origXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__bra_url = url;
    this.__bra_method = method;
    return origXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    const url = this.__bra_url || '';

    if (isRewardsAPI(url)) {
      this.addEventListener('load', function () {
        try {
          if (this.status >= 200 && this.status < 300) {
            const contentType = this.getResponseHeader('content-type') || '';
            if (contentType.includes('json')) {
              const data = JSON.parse(this.responseText);
              const key = classifyEndpoint(url);
              if (key) {
                storeData(key, data, url);
              }
            }
          }
        } catch (e) {
          console.warn('[BRA Intercept] XHR parse error:', e.message);
        }
      });
    }

    return origXHRSend.apply(this, args);
  };

  // ═══════════════════════════════════════════════
  // 3. PUBLIC API
  // ═══════════════════════════════════════════════

  window.__BRA_INTERCEPTED__ = intercepted;

  // Helper: get parsed summary
  window.__BRA_GET_SUMMARY__ = function () {
    const parsed = intercepted._parsed || {};
    const points = parsed.points || {};
    const sp = parsed.searchProgress || {};
    const offers = parsed.offers || {};
    const streak = parsed.streak || {};

    return {
      points: points.available || null,
      lifetime: points.lifetime || null,
      level: points.level || null,
      pc: sp.pc || null,
      mobile: sp.mobile || null,
      edge: sp.edge || null,
      offers: offers,
      streak: streak,
      interceptCount: intercepted._count,
      lastUpdate: Math.max(...Object.values(intercepted._timestamps || { _: 0 })),
      hasData: intercepted._count > 0,
    };
  };

  // Helper: wait for specific data with timeout
  window.__BRA_WAIT_FOR__ = function (key, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      if (intercepted[key]) {
        resolve(intercepted[key]);
        return;
      }

      const start = Date.now();
      const interval = setInterval(() => {
        if (intercepted[key]) {
          clearInterval(interval);
          resolve(intercepted[key]);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error(`Timeout waiting for ${key}`));
        }
      }, 300);
    });
  };

  console.log('[BRA Intercept] ✅ Active — monitoring Rewards API calls');
  return { status: 'active', version: '1.0' };
})();