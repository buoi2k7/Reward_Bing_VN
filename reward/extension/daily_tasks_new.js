// =============================================
// DAILY TASKS MODULE v2
// Fix: Tab active=true để auth JS chạy đầy đủ
// Reuse existing rewards tab nếu user đang mở sẵn
// =============================================

// ---- FETCH REWARDS DATA FOR TASKS ----
// Khác với fetchRewardsUserInfoQuiet (background tab) —
// Hàm này ưu tiên dùng tab rewards đang mở, nếu không có thì mở ACTIVE tab
async function fetchRewardsDataForTasks() {
  let tab = null;
  let created = false;

  try {
    // 1. Tìm tab rewards.bing.com đang mở sẵn (user đã login)
    const existingTabs = await chrome.tabs.query({ url: ['https://rewards.bing.com/*'] });
    if (existingTabs.length > 0) {
      // Ưu tiên tab đang active, rồi mới lấy bất kỳ tab nào
      tab = existingTabs.find(t => t.active) || existingTabs[0];
      created = false;
      log(`🔗 [API] Tái dùng tab rewards đang mở (id:${tab.id})`, 'info');
    } else {
      // Không có sẵn: mở tab MỚI dạng ACTIVE để auth JS chạy đầy đủ
      log('🆕 [API] Mở rewards tab (active) để auth...', 'info');
      tab = await chrome.tabs.create({ url: 'https://rewards.bing.com/dashboard', active: true });
      created = true;
      await waitForTabLoad(tab.id).catch(() => {});
      // Cho Microsoft auth JS đủ thời gian chạy và thiết lập session
      await sleep(8000);
    }

    // Wait ngắn cho tab hiện có
    if (!created) await sleep(1500);

    // 2. Kiểm tra vẫn đang ở rewards.bing.com (không bị redirect ra login)
    const tabInfo = await chrome.tabs.get(tab.id).catch(() => null);
    if (!tabInfo?.url?.includes('rewards.bing.com')) {
      if (created) await chrome.tabs.remove(tab.id).catch(() => {});
      log('⚠️ [API] Rewards redirect về login — chưa đăng nhập', 'warning');
      return { ok: false, reason: 'signin_required', url: tabInfo?.url };
    }

    // 3. Fetch getuserinfo API từ trong page context (có cookies đầy đủ)
    const result = await injectScript(tab.id, () => {
      return (async () => {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 15000);
          const r = await fetch('/api/getuserinfo?type=1', {
            signal: ctrl.signal,
            cache: 'no-cache',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          clearTimeout(tid);

          if (!r.ok) {
            return { ok: false, reason: 'http_error', status: r.status };
          }
          const data = await r.json();
          return { ok: true, data };
        } catch (e) {
          return { ok: false, reason: 'fetch_error', error: e.message };
        }
      })();
    });

    if (created) await chrome.tabs.remove(tab.id).catch(() => {});
    return result || { ok: false, reason: 'empty_result' };

  } catch (e) {
    if (created && tab) await chrome.tabs.remove(tab.id).catch(() => {});
    return { ok: false, reason: 'exception', error: e.message };
  }
}

// ---- EXTRACT TASK URLs FROM DASHBOARD DATA ----
function extractTaskUrls(dashboard) {
  const urls = [];

  const extractFromList = (promoList) => {
    if (!Array.isArray(promoList)) return;
    for (const task of promoList) {
      if (task.complete) continue;
      if (!task.destinationUrl) continue;
      if (task.destinationUrl.includes('referandearn')) continue;
      if (task.destinationUrl.includes('microsoft.com/en-us/edge')) continue;
      urls.push(task.destinationUrl);
    }
  };

  // 1. Daily Set (quiz, poll, video)
  extractFromList(dashboard.dailySetPromotions);
  // 2. More Promotions / Keep Earning
  extractFromList(dashboard.morePromotions);
  // 3. PunchCards / Quests đa bước
  if (Array.isArray(dashboard.punchCards)) {
    for (const pc of dashboard.punchCards) {
      if (pc.parentPromotion?.promotions) extractFromList(pc.parentPromotion.promotions);
      if (Array.isArray(pc.promotions)) extractFromList(pc.promotions);
    }
  }

  return [...new Set(urls)]; // Khử trùng
}

// ---- OPEN TASK URL AND SOLVE ----
async function openTaskUrl(url) {
  let taskTab = null;
  try {
    log(`🎯 Task: ${url.substring(0, 60)}...`);
    taskTab = await createTab(url, false);
    await waitForTabLoad(taskTab.id).catch(() => {});
    
    log('🤖 [Auto-Solver] Đang phân tích và giải quyết nhiệm vụ...', 'info');
    
    // Inject luồng Auto-Solver trực tiếp vào trang nhiệm vụ
    const solveResult = await injectScript(taskTab.id, () => {
      return (async () => {
        const delay = ms => new Promise(r => setTimeout(r, ms));
        
        // Cố gắng chặn các thẻ popup phiền nhiễu của Edge
        try {
          window.alert = () => {};
          window.confirm = () => false;
          window.prompt = () => null;
          document.querySelectorAll('button[class*="cancel"], button[class*="close"], [aria-label="Close"]').forEach(el => { try { el.click(); } catch {} });
        } catch {}

        let attempt = 0;
        let interacted = false;

        // Vòng lặp giải quyết, tối đa chạy khoảng ~45 giây cho Quiz dài
        while (attempt < 20) {
          attempt++;
          
          // 1. Nhấn nút "Start Quiz" nếu có (Thường gặp ở Trivia/Test)
          const startQuizBtn = document.querySelector('#rqStartQuiz');
          if (startQuizBtn) {
            startQuizBtn.click();
            interacted = true;
            await delay(2500);
            continue;
          }

          // 2. Tìm tất cả các lựa chọn khả thi (Đây là Polls, Quizzes, This or That)
          // Includes selectors for: Lightning Quizzes, This or That, Daily Polls
          const options = document.querySelectorAll(
            '.rqOption, .wk_Option, .b_cards[iscorrectoption], .b_cards.btOption, .wk_button, #Option_1, #Option_2, .btOptions, .poll-option, [class*="b_choice"]'
          );

          if (options.length > 0) {
            interacted = true;
            // Cố gắng tìm câu trả lời đúng nếu nó lộ meta (iscorrectoption="True")
            let targetOpts = Array.from(options).filter(opt => 
              opt.getAttribute('iscorrectoption') === 'True' || opt.getAttribute('iscorrectoption') === 'true'
            );
            
            // Nếu không có đánh dấu sẵn, chọn ngẫu nhiên
            let target = targetOpts.length > 0 ? targetOpts[0] : options[Math.floor(Math.random() * options.length)];
            
            try { target.click(); } catch {}
            
            // Chờ hiệu ứng chuyển câu của Bing
            await delay(3000);
            
            continue; // Quay lại vòng lặp đánh tiếp cho đến khi hết câu
          }

          // 3. Kiểm tra xem màn hình hoàn thành xuất hiện chưa
          if (document.querySelector('.quizCompleteContainer') || document.querySelector('.wk_complete') || document.querySelector('#quizWelcomeContainer > div.header:contains("completed")')) {
            break;
          }

          // 4. Nếu không phải quiz - có thể chỉ là dạng "Xem bài rinh điểm" (UrlReward)
          // Cuộn trang mượt mà để dính Track Điểm
          window.scrollTo({
             top: document.body.scrollHeight / (Math.random() * 2 + 1),
             behavior: 'smooth'
          });
          
          await delay(1500);

          // Nếu không tương tác gì với bài (tức là UrlReward thuần) thì chờ thêm chút rồi thoát
          if (!interacted && attempt > 4) {
            break;
          }
        }
        
        // Cuộn lên lại đầu trang
        window.scrollTo(0, 0);
        return true;
      })();
    });

    if (solveResult) {
      log('✅ [Auto-Solver] Nhiệm vụ đã giải quyết xong.', 'success');
    } else {
      log('⚠️ [Auto-Solver] Lỗi bất ngờ hoặc tab đã đóng sớm.', 'warning');
    }

    // Đợi 2s để Bing xác nhận điểm
    await sleep(2000);
    await closeTab(taskTab.id);
    return true;
  } catch (e) {
    if (taskTab) await closeTab(taskTab.id).catch(() => {});
    return false;
  }
}

// ---- MAIN: PC DAILY TASKS ----
async function runDailyTasks() {
  log('📋 [Daily Tasks] Bắt đầu làm nhiệm vụ hàng ngày...');
  let totalCompleted = 0;
  let taskUrls = [];

  // PHASE 1: Lấy danh sách task qua API (dùng active tab)
  try {
    log('🔄 [API] Đang tải danh sách nhiệm vụ...');
    const apiResult = await fetchRewardsDataForTasks();

    if (apiResult?.ok) {
      const dashboard = apiResult.data?.dashboard || {};
      taskUrls = extractTaskUrls(dashboard);

      if (taskUrls.length > 0) {
        log(`✅ [API] Tìm thấy ${taskUrls.length} nhiệm vụ chưa làm`, 'success');
      } else {
        log('📦 [API] Không còn nhiệm vụ nào hôm nay.', 'info');
      }
    } else if (apiResult?.reason === 'signin_required') {
      log('⚠️ Chưa đăng nhập Rewards. Vào rewards.bing.com đăng nhập trước.', 'warning');
      return;
    } else {
      const detail = apiResult?.reason || apiResult?.error || 'unknown';
      log(`❌ [API] Không lấy được dữ liệu: ${detail}`, 'error');
    }
  } catch (e) {
    log(`❌ [API Error] ${e.message}`, 'error');
  }

  // PHASE 2: Mở từng task URL
  if (taskUrls.length > 0) {
    log(`▶️ Xử lý ${taskUrls.length} nhiệm vụ...`);
    for (let i = 0; i < taskUrls.length; i++) {
      if (state.status === 'stopped') break;
      const ok = await openTaskUrl(taskUrls[i]);
      if (ok) {
        totalCompleted++;
        log(`✅ Task ${i + 1}/${taskUrls.length} xong`, 'success');
      } else {
        log(`⚠️ Task ${i + 1}/${taskUrls.length} lỗi — bỏ qua`, 'warning');
      }
      if (i < taskUrls.length - 1 && state.status !== 'stopped') {
        await sleep(randomInt(3000, 6000));
      }
    }
  }

  // PHASE 3: Dashboard scroll (kích hoạt thêm điểm view)
  log('📋 [Phase 3] Kiểm tra dashboard...');
  let dashTab = null;
  try {
    // Tìm tab rewards đang mở thay vì mở thêm tab mới
    const existing = await chrome.tabs.query({ url: ['https://rewards.bing.com/*'] });
    if (existing.length > 0) {
      dashTab = existing[0];
    } else {
      dashTab = await createTab('https://rewards.bing.com/', false);
      await waitForTabLoad(dashTab.id).catch(() => {});
      await sleep(5000);
    }

    const dashInfo = await chrome.tabs.get(dashTab.id).catch(() => null);
    if (!dashInfo?.url?.includes('rewards.bing.com')) {
      log('⚠️ Dashboard redirect — bỏ qua phase 3', 'warning');
      return;
    }

    const clicked = await injectScript(dashTab.id, () => {
      return (async () => {
        const delay = ms => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 3; i++) {
          window.scrollBy({ top: 300, behavior: 'smooth' });
          await delay(500);
        }
        window.scrollTo(0, 0);
        await delay(1000);

        let count = 0;
        const btns = document.querySelectorAll(
          '[class*="hero"] button, [class*="hero"] a, carousel button, carousel a'
        );
        for (const btn of btns) {
          const txt = (btn.textContent || '').trim().toLowerCase();
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 &&
              ['view', 'xem', 'nhận', 'claim'].includes(txt)) {
            try { btn.click(); count++; await delay(2000); } catch {}
          }
        }
        return count;
      })();
    }).catch(() => 0);

    if (clicked > 0) log(`✅ Dashboard: click thêm ${clicked} actions`, 'success');
    else log('📦 Dashboard: Không có action nào thêm.', 'info');

    // Chỉ đóng nếu chúng ta mở tab này
    if (existing?.length === 0 && dashTab) await closeTab(dashTab.id).catch(() => {});
    else await sleep(1000);

  } catch (e) {
    // Ignore phase 3 errors — không critical
  }

  log(`✅ Daily Tasks xong! Hoàn thành ${totalCompleted}/${taskUrls.length} nhiệm vụ.`, 'success');
}

// ---- MOBILE DAILY TASKS ----
async function runMobileDailyTasks() {
  log('📱 [Mobile Tasks] Bắt đầu tasks qua Mobile UA...');
  let taskUrls = [];

  try {
    const apiResult = await fetchRewardsDataForTasks();
    if (apiResult?.ok) {
      taskUrls = extractTaskUrls(apiResult.data?.dashboard || {});
      log(`📱 [Mobile] ${taskUrls.length} nhiệm vụ.`);
    } else {
      log(`📱 [Mobile] Không lấy được task list (${apiResult?.reason}) — bỏ qua.`, 'warning');
      return;
    }
  } catch (e) {
    log(`📱 [Mobile] Error: ${e.message}`, 'error');
    return;
  }

  if (taskUrls.length === 0) {
    log('📱 [Mobile] Không có nhiệm vụ mobile nào.', 'info');
    return;
  }

  await setMobileMode(true);
  await sleep(1000);
  const deviceName = state.currentMobileDevice?.name || 'Unknown';
  log(`📱 Device: ${deviceName}`);

  let mobileDone = 0;
  for (let i = 0; i < taskUrls.length; i++) {
    if (state.status === 'stopped') break;
    const ok = await openTaskUrl(taskUrls[i]);
    if (ok) {
      mobileDone++;
      log(`📱 Mobile task ${i + 1}/${taskUrls.length} ✅`, 'success');
    }
    if (i < taskUrls.length - 1 && state.status !== 'stopped') {
      await sleep(randomInt(2000, 5000));
    }
  }

  await setMobileMode(false);
  log(`📱 Mobile Tasks xong: ${mobileDone}/${taskUrls.length}`, 'success');
}
