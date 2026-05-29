// =============================================
// BAN DETECTION MODULE — BRC Extension
// Phân tích response từ getuserinfo API
// Trả về trạng thái: OK / WARN / BAN
// =============================================

(function () {
  // Make analyzeBanStatus available globally for content scripts
  // and also for importScripts in service worker

  function analyzeBanStatus(apiData) {
    const result = {
      status: 'OK',
      reasons: [],
      signals: {
        isSuspended: null,
        isRewardsUser: null,
        pcSearchMax: null,
        mobileSearchMax: null,
        availablePoints: null,
        pointsNotCounting: null
      }
    };

    if (!apiData) {
      result.status = 'BAN';
      result.reasons.push('Không có dữ liệu API');
      return result;
    }

    const dashboard = apiData.dashboard || apiData;
    const userStatus = dashboard.userStatus || apiData.userStatus || {};
    const counters = userStatus.counters || {};

    // ── Signal: isSuspended ──
    if (userStatus.isSuspended !== undefined) {
      result.signals.isSuspended = !!userStatus.isSuspended;
      if (userStatus.isSuspended) {
        result.status = 'BAN';
        result.reasons.push('Tài khoản bị suspended');
      }
    }

    // ── Signal: isRewardsUser ──
    if (userStatus.isRewardsUser !== undefined) {
      result.signals.isRewardsUser = !!userStatus.isRewardsUser;
      if (!userStatus.isRewardsUser) {
        result.status = 'BAN';
        result.reasons.push('Không phải Rewards user');
      }
    }

    // ── Signal: availablePoints ──
    if (typeof userStatus.availablePoints === 'number') {
      result.signals.availablePoints = userStatus.availablePoints;
    }

    // ── Parse search counters ──
    let pcMax = null;
    let mobileMax = null;

    for (const [key, counter] of Object.entries(counters)) {
      if (!counter || typeof counter !== 'object') continue;
      const name = (counter.name || counter.description || key || '').toLowerCase();
      const max = counter.max || counter.pointProgressMax || 0;

      if (name.includes('pc') || name.includes('desktop') || key === 'pcSearch') {
        pcMax = max;
      } else if (name.includes('mobile') || key === 'mobileSearch') {
        mobileMax = max;
      }
    }

    // Fallback: try flyoutResult / pointsBreakdown structure
    if (pcMax === null && apiData.flyoutResult) {
      const flyout = apiData.flyoutResult;
      if (flyout.userStatus?.counters) {
        for (const [key, counter] of Object.entries(flyout.userStatus.counters)) {
          if (!counter) continue;
          const name = (counter.name || key || '').toLowerCase();
          const max = counter.max || counter.pointProgressMax || 0;
          if (name.includes('pc') || name.includes('desktop')) pcMax = max;
          else if (name.includes('mobile')) mobileMax = max;
        }
      }
    }

    result.signals.pcSearchMax = pcMax;
    result.signals.mobileSearchMax = mobileMax;

    // ── Evaluate search limits ──
    if (pcMax !== null) {
      if (pcMax === 0) {
        result.status = 'BAN';
        result.reasons.push('PC search max = 0 (bị chặn hoàn toàn)');
      } else if (pcMax < 30) {
        if (result.status !== 'BAN') result.status = 'WARN';
        result.reasons.push(`PC search max thấp bất thường: ${pcMax} (bình thường 90-150)`);
      }
    }

    if (mobileMax !== null) {
      if (mobileMax === 0) {
        result.status = 'BAN';
        result.reasons.push('Mobile search max = 0 (bị chặn hoàn toàn)');
      } else if (mobileMax < 20) {
        if (result.status !== 'BAN') result.status = 'WARN';
        result.reasons.push(`Mobile search max thấp bất thường: ${mobileMax} (bình thường 60-100)`);
      }
    }

    // ── Signal: availablePoints = 0 with all counters = 0 ──
    if (result.signals.availablePoints === 0 && pcMax === 0 && mobileMax === 0) {
      result.status = 'BAN';
      result.reasons.push('Points = 0 và tất cả search max = 0');
    }

    return result;
  }

  // Export for different contexts
  if (typeof self !== 'undefined' && typeof importScripts === 'function') {
    // Service worker context
    self.analyzeBanStatus = analyzeBanStatus;
  } else if (typeof window !== 'undefined') {
    // Window context (content script or page)
    window.analyzeBanStatus = analyzeBanStatus;
  }

  // Also support module-style if available
  if (typeof globalThis !== 'undefined') {
    globalThis.analyzeBanStatus = analyzeBanStatus;
  }
})();