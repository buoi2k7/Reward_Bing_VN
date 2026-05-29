/**
 * mobile-override.js — Inject into Bing pages during mobile phase
 * Full fingerprint spoofing: navigator + screen + window + matchMedia
 * Runs at document_start (MAIN world) via chrome.scripting.registerContentScripts
 * 
 * Lấy UA từ state.currentMobileDevice được inject trước khi chạy script này
 * Fallback về iPhone 16 nếu không có.
 */
(function () {
  'use strict';

  // UA và device info sẽ được inject động từ background.js qua args
  // Nếu không có thì fallback về iPhone 16 Pro Max
  const UA = window.__BRA_MOBILE_UA__
    || 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

  const SCREEN_W  = window.__BRA_SCREEN_W__  || 393;
  const SCREEN_H  = window.__BRA_SCREEN_H__  || 852;
  const DPR       = window.__BRA_DPR__       || 3;
  const VENDOR    = window.__BRA_VENDOR__    || 'Apple Computer, Inc.';
  const PLATFORM  = window.__BRA_PLATFORM__  || 'iPhone';
  const MAX_TOUCH = window.__BRA_MAX_TOUCH__ || 5;

  // ---- 1. Navigator overrides ----
  const navigatorOverrides = {
    userAgent:           UA,
    appVersion:          UA.replace('Mozilla/', ''),
    platform:            PLATFORM,
    vendor:              VENDOR,
    maxTouchPoints:      MAX_TOUCH,
    hardwareConcurrency: 6,
  };

  for (const [key, value] of Object.entries(navigatorOverrides)) {
    try {
      Object.defineProperty(Navigator.prototype, key, {
        get: () => value,
        configurable: true,
      });
    } catch {
      try {
        Object.defineProperty(navigator, key, {
          get: () => value,
          configurable: true,
        });
      } catch {}
    }
  }

  // Hide userAgentData (Client Hints) — iOS Safari không có cái này
  try {
    Object.defineProperty(Navigator.prototype, 'userAgentData', {
      get: () => undefined,
      configurable: true,
    });
  } catch {}

  // ---- 2. Screen overrides ----
  const screenOverrides = {
    width:       SCREEN_W,
    height:      SCREEN_H,
    availWidth:  SCREEN_W,
    availHeight: SCREEN_H - 44, // safe area
    colorDepth:  32,
    pixelDepth:  32,
  };

  for (const [key, value] of Object.entries(screenOverrides)) {
    try {
      Object.defineProperty(Screen.prototype, key, {
        get: () => value,
        configurable: true,
      });
    } catch {}
  }

  // ---- 3. Window dimension overrides ----
  try {
    Object.defineProperty(window, 'devicePixelRatio', { get: () => DPR, configurable: true });
    Object.defineProperty(window, 'innerWidth',  { get: () => SCREEN_W, configurable: true });
    Object.defineProperty(window, 'innerHeight', { get: () => Math.round(SCREEN_H * 0.78), configurable: true });
    Object.defineProperty(window, 'outerWidth',  { get: () => SCREEN_W, configurable: true });
    Object.defineProperty(window, 'outerHeight', { get: () => SCREEN_H, configurable: true });
  } catch {}

  // ---- 4. Touch support ----
  try {
    if (!('ontouchstart' in window)) {
      window.ontouchstart = null;
    }
    // Ensure TouchEvent exists
    if (typeof TouchEvent === 'undefined') {
      window.TouchEvent = function () {};
    }
  } catch {}

  // ---- 5. matchMedia override (most important for mobile detection) ----
  // Bing uses matchMedia to detect mobile vs desktop layout
  try {
    const _origMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = function (query) {
      // Touch device
      if (query.includes('pointer: fine') || query.includes('pointer:fine')) {
        return Object.assign(_origMatchMedia(query), { matches: false });
      }
      if (query.includes('pointer: coarse') || query.includes('pointer:coarse')) {
        return Object.assign(_origMatchMedia(query), { matches: true });
      }
      // Hover
      if (query.includes('hover: hover') || query.includes('hover:hover')) {
        return Object.assign(_origMatchMedia(query), { matches: false });
      }
      if (query.includes('hover: none') || query.includes('hover:none')) {
        return Object.assign(_origMatchMedia(query), { matches: true });
      }
      // Max-width / min-width: mobile breakpoints
      const maxWidthMatch = query.match(/max-width:\s*(\d+)px/);
      if (maxWidthMatch) {
        const breakpoint = parseInt(maxWidthMatch[1]);
        return Object.assign(_origMatchMedia(query), { matches: SCREEN_W <= breakpoint });
      }
      const minWidthMatch = query.match(/min-width:\s*(\d+)px/);
      if (minWidthMatch) {
        const breakpoint = parseInt(minWidthMatch[1]);
        return Object.assign(_origMatchMedia(query), { matches: SCREEN_W >= breakpoint });
      }
      return _origMatchMedia(query);
    };
  } catch {}

  // ---- 6. Connection API (mobile thường dùng 4g) ----
  try {
    if (navigator.connection) {
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          downlink: 10,
          rtt: 50,
          saveData: false,
        }),
        configurable: true,
      });
    }
  } catch {}

  console.log('[BRA] Mobile override active — UA:', UA.substring(0, 60) + '...');
})();
