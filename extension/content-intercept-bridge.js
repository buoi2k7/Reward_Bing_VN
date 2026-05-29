// =============================================
// CONTENT INTERCEPT BRIDGE
// Runs in ISOLATED world on rewards.bing.com
// Listens for postMessage from MAIN world (content-intercept.js)
// Forwards data to background.js via chrome.runtime.sendMessage
// Also runs ban detection on getuserinfo responses
// =============================================

(function () {
  if (window.__BRA_BRIDGE_ACTIVE__) return;
  window.__BRA_BRIDGE_ACTIVE__ = true;

  window.addEventListener('message', (event) => {
    // Only accept messages from same origin
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'BRA_API_INTERCEPTED') return;

    const { key, data, url, timestamp } = event.data;

    // Forward to background.js
    try {
      chrome.runtime.sendMessage({
        action: 'intercepted_data',
        key: key,
        data: data,
        url: url,
        timestamp: timestamp
      }).catch(() => {});
    } catch (e) {
      // Extension context may not be available
    }

    // ── Ban detection on getuserinfo responses ──
    if (url && url.includes('getuserinfo') && data) {
      try {
        chrome.runtime.sendMessage({
          action: 'BAN_STATUS_UPDATE',
          apiData: data,
          url: url,
          timestamp: timestamp || Date.now()
        }).catch(() => {});
      } catch (e) {
        // Extension context may not be available
      }
    }
  });

  console.log('[BRA Bridge] ✅ Active — forwarding intercepted API data to extension');
})();