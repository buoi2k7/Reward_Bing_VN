// =============================================
// MICROSOFT DATA EXTRACTOR v1.0
// Extracts all available Microsoft Rewards & Account data
// Uses official Microsoft/Bing APIs with proper authentication
// =============================================

const MSDataExtractor = {

  // All known Microsoft Rewards / Bing API endpoints
  ENDPOINTS: {
    // Rewards Dashboard (main data source)
    rewardsDashboard: 'https://rewards.bing.com/api/getuserinfo?type=1',
    rewardsDashboardFull: 'https://rewards.bing.com/api/getuserinfo?type=2',
    
    // Points breakdown
    pointsBreakdown: 'https://rewards.bing.com/api/getpointsbreakdown',
    
    // Activities & Offers
    activities: 'https://rewards.bing.com/api/getuserinfo?type=1&channel=bingflyout',
    promotions: 'https://rewards.bing.com/api/getpromotions',
    
    // Search history from Bing
    searchHistory: 'https://www.bing.com/profile/history?q=&first=0&count=100',
    
    // Bing user profile
    bingProfile: 'https://www.bing.com/fd/auth/signin?action=interactive',
    
    // Account info
    accountProfile: 'https://account.microsoft.com/profile',
    
    // Rewards status page (HTML scrape)
    rewardsStatus: 'https://rewards.bing.com/pointsbreakdown',
    
    // Order/Redeem history 
    redeemHistory: 'https://rewards.bing.com/api/getorders',
    
    // Streak info
    streakInfo: 'https://rewards.bing.com/api/getactivityandquiz',
  },

  // Store extracted data
  extractedData: {},
  errors: [],
  startTime: null,

  // ─── MAIN EXTRACT FUNCTION ───
  async extractAll(progressCallback) {
    this.extractedData = {};
    this.errors = [];
    this.startTime = Date.now();
    
    const tasks = [
      { name: 'Rewards Dashboard', fn: () => this.getRewardsDashboard() },
      { name: 'Full Dashboard', fn: () => this.getFullDashboard() },
      { name: 'Points Breakdown', fn: () => this.getPointsBreakdown() },
      { name: 'Activities & Offers', fn: () => this.getActivities() },
      { name: 'Redeem History', fn: () => this.getRedeemHistory() },
      { name: 'Search Progress', fn: () => this.getSearchProgress() },
      { name: 'Streak Data', fn: () => this.getStreakData() },
      { name: 'Bing Search History', fn: () => this.getBingSearchHistory() },
      { name: 'Account Summary', fn: () => this.getAccountSummary() },
    ];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: tasks.length,
          taskName: task.name,
          percent: Math.round(((i + 1) / tasks.length) * 100)
        });
      }

      try {
        await task.fn();
      } catch (e) {
        this.errors.push({ task: task.name, error: e.message });
        console.error(`[Extractor] ${task.name} failed:`, e);
      }

      // Small delay between API calls (avoid rate limiting)
      await this._sleep(500 + Math.random() * 500);
    }

    // Build final report
    this.extractedData._meta = {
      extractedAt: new Date().toISOString(),
      duration: `${((Date.now() - this.startTime) / 1000).toFixed(1)}s`,
      errors: this.errors,
      version: '1.0'
    };

    return this.extractedData;
  },

  // ─── REWARDS DASHBOARD ───
  async getRewardsDashboard() {
    const data = await this._fetchJSON(this.ENDPOINTS.rewardsDashboard);
    if (!data) return;

    const dashboard = data.dashboard || data;
    const userStatus = dashboard.userStatus || {};

    this.extractedData.rewards = {
      // Points
      availablePoints: userStatus.availablePoints,
      lifetimePoints: userStatus.lifetimePoints,
      lifetimePointsRedeemed: userStatus.lifetimePointsRedeemed,
      
      // Level
      levelInfo: {
        activeLevel: userStatus.activeLevel,
        levelName: this._getLevelName(userStatus.activeLevel),
        progressToNextLevel: userStatus.levelProgress,
      },

      // Counters
      counters: userStatus.counters || {},
      
      // Status flags
      isLevelTwoAvailable: userStatus.isLevelTwoAvailable,
      isMuidTrialUser: userStatus.isMuidTrialUser,
      
      // Daily search limits
      searchLimits: this._extractSearchLimits(userStatus.counters),
    };
  },

  // ─── FULL DASHBOARD (type=2) ───
  async getFullDashboard() {
    const data = await this._fetchJSON(this.ENDPOINTS.rewardsDashboardFull);
    if (!data) return;

    const dashboard = data.dashboard || data;
    
    // Extract daily offers/activities
    const dailySet = dashboard.dailySetPromotions || {};
    const morePromotions = dashboard.morePromotions || [];
    const punchCards = dashboard.punchCards || [];
    
    const dailyOffers = [];
    for (const [date, offers] of Object.entries(dailySet)) {
      for (const offer of (offers || [])) {
        dailyOffers.push({
          date,
          name: offer.name || offer.title,
          description: offer.description,
          points: offer.pointProgressMax || offer.points,
          pointsEarned: offer.pointProgress || 0,
          completed: offer.complete || false,
          promotionType: offer.promotionType,
          destinationUrl: offer.destinationUrl,
          hash: offer.hash,
        });
      }
    }

    const moreOffers = morePromotions.map(offer => ({
      name: offer.name || offer.title,
      description: offer.description,
      points: offer.pointProgressMax || offer.points,
      pointsEarned: offer.pointProgress || 0,
      completed: offer.complete || false,
      promotionType: offer.promotionType,
      destinationUrl: offer.destinationUrl,
    }));

    const punchCardData = punchCards.map(card => ({
      name: card.name || card.title,
      description: card.description,
      parentPromotion: card.parentPromotion,
      childPromotions: (card.childPromotions || []).map(c => ({
        name: c.name,
        complete: c.complete,
        points: c.pointProgressMax,
      })),
      completed: card.complete || false,
    }));

    this.extractedData.offers = {
      dailyOffers,
      moreOffers,
      punchCards: punchCardData,
      totalPendingPoints: dailyOffers
        .filter(o => !o.completed)
        .reduce((sum, o) => sum + (o.points - o.pointsEarned), 0)
        + moreOffers
        .filter(o => !o.completed)
        .reduce((sum, o) => sum + (o.points - o.pointsEarned), 0),
    };

    // Extract streak info from dashboard
    if (dashboard.streakPromotion) {
      this.extractedData.streak = {
        currentStreak: dashboard.streakPromotion.progress,
        maxStreak: dashboard.streakPromotion.pointProgressMax,
        streakTitle: dashboard.streakPromotion.title || dashboard.streakPromotion.name,
        completed: dashboard.streakPromotion.complete,
      };
    }
  },

  // ─── POINTS BREAKDOWN ───
  async getPointsBreakdown() {
    const data = await this._fetchJSON(this.ENDPOINTS.pointsBreakdown);
    if (!data) return;

    this.extractedData.pointsBreakdown = {
      breakdown: data.breakdown || data,
      summary: {
        totalEarned: data.totalEarned || 0,
        searchPoints: data.searchPoints || 0,
        activityPoints: data.activityPoints || 0,
        otherPoints: data.otherPoints || 0,
      }
    };
  },

  // ─── ACTIVITIES ───
  async getActivities() {
    const data = await this._fetchJSON(this.ENDPOINTS.activities);
    if (!data) return;

    const dashboard = data.dashboard || data;
    const flyout = dashboard.flyoutResult || {};

    this.extractedData.flyoutActivities = {
      userPoints: flyout.userPoints,
      activities: (flyout.promotionalItems || []).map(item => ({
        title: item.title || item.name,
        description: item.description,
        points: item.pointProgressMax,
        earned: item.pointProgress,
        complete: item.complete,
        type: item.promotionType,
        url: item.destinationUrl,
      }))
    };
  },

  // ─── REDEEM HISTORY ───
  async getRedeemHistory() {
    const data = await this._fetchJSON(this.ENDPOINTS.redeemHistory);
    if (!data) return;

    this.extractedData.redeemHistory = {
      orders: (data.orders || data || []).map(order => ({
        orderId: order.orderId,
        orderDate: order.orderDate,
        status: order.status,
        title: order.title || order.name,
        points: order.points || order.price,
        type: order.type,
      })),
    };
  },

  // ─── SEARCH PROGRESS ───
  async getSearchProgress() {
    // This is extracted from the main dashboard counters
    const data = await this._fetchJSON(this.ENDPOINTS.rewardsDashboard);
    if (!data) return;

    const dashboard = data.dashboard || data;
    const counters = dashboard.userStatus?.counters || {};

    const searchProgress = {};
    
    // Parse all counters
    for (const [key, counter] of Object.entries(counters)) {
      if (counter && typeof counter === 'object') {
        searchProgress[key] = {
          name: counter.name || key,
          current: counter.count || counter.pointProgress || 0,
          max: counter.max || counter.pointProgressMax || 0,
          complete: counter.complete || false,
          description: counter.description || '',
        };
      }
    }

    this.extractedData.searchProgress = searchProgress;
  },

  // ─── STREAK DATA ───
  async getStreakData() {
    const data = await this._fetchJSON(this.ENDPOINTS.streakInfo);
    if (!data) return;

    this.extractedData.streakDetails = data;
  },

  // ─── BING SEARCH HISTORY ───
  async getBingSearchHistory() {
    try {
      const response = await fetch(this.ENDPOINTS.searchHistory, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json, text/html',
        }
      });
      
      if (!response.ok) {
        this.errors.push({ task: 'Search History', error: `HTTP ${response.status}` });
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('json')) {
        const data = await response.json();
        this.extractedData.searchHistory = {
          source: 'api',
          entries: (data.items || data.value || data || []).slice(0, 100).map(item => ({
            query: item.query || item.displayText || item.text,
            timestamp: item.dateTime || item.timestamp,
            url: item.url,
          }))
        };
      } else {
        // HTML response — try to parse
        const html = await response.text();
        const queries = [];
        const regex = /class="[^"]*sh_item[^"]*"[^>]*>.*?<a[^>]*>(.*?)<\/a>/gs;
        let match;
        while ((match = regex.exec(html)) !== null) {
          queries.push(match[1].replace(/<[^>]+>/g, '').trim());
        }
        this.extractedData.searchHistory = {
          source: 'html_parse',
          queries: queries.slice(0, 100),
          note: 'Parsed from HTML, may be incomplete'
        };
      }
    } catch (e) {
      this.errors.push({ task: 'Search History', error: e.message });
    }
  },

  // ─── ACCOUNT SUMMARY ───
  async getAccountSummary() {
    // Compile a summary from all collected data
    const rewards = this.extractedData.rewards || {};
    const offers = this.extractedData.offers || {};
    const streak = this.extractedData.streak || {};

    this.extractedData.accountSummary = {
      currentPoints: rewards.availablePoints || 'N/A',
      lifetimePoints: rewards.lifetimePoints || 'N/A',
      lifetimeRedeemed: rewards.lifetimePointsRedeemed || 'N/A',
      level: rewards.levelInfo?.levelName || 'N/A',
      searchLimits: rewards.searchLimits || {},
      streakDays: streak.currentStreak || 0,
      pendingOfferPoints: offers.totalPendingPoints || 0,
      dailyOffersCount: (offers.dailyOffers || []).length,
      completedOffers: (offers.dailyOffers || []).filter(o => o.completed).length,
      punchCardsActive: (offers.punchCards || []).length,
    };
  },

  // ─── HELPER: Extract search limits from counters ───
  _extractSearchLimits(counters) {
    if (!counters) return {};
    const limits = {};
    
    for (const [key, val] of Object.entries(counters)) {
      if (val && typeof val === 'object') {
        const name = (val.name || key).toLowerCase();
        if (name.includes('search') || name.includes('pc') || name.includes('mobile') || name.includes('edge')) {
          limits[key] = {
            name: val.name || key,
            progress: val.count || val.pointProgress || 0,
            max: val.max || val.pointProgressMax || 0,
            complete: val.complete || false,
          };
        }
      }
    }
    return limits;
  },

  _getLevelName(level) {
    const names = { 1: 'Member', 2: 'Level 2 (Gold/Silver)' };
    return names[level] || `Level ${level}`;
  },

  // ─── HELPER: Fetch JSON with error handling ───
  async _fetchJSON(url) {
    try {
      const response = await fetch(url, {
        cache: 'no-cache',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        this.errors.push({ url, status: response.status });
        return null;
      }

      return await response.json();
    } catch (e) {
      this.errors.push({ url, error: e.message });
      return null;
    }
  },

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  // ─── EXPORT ───
  exportAsJSON() {
    return JSON.stringify(this.extractedData, null, 2);
  },

  downloadAsFile(filename) {
    const json = this.exportAsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `ms-rewards-data-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// Export
if (typeof window !== 'undefined') {
  window.MSDataExtractor = MSDataExtractor;
}