// =============================================
// AUTOMATION SCRIPT - Injected into Bing pages
// via chrome.scripting.executeScript
// =============================================

(function () {
    if (window.__BRA_INJECTED__) return { status: 'already_injected' };
    window.__BRA_INJECTED__ = true;

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    // Human-like typing with typo simulation
    async function humanTypeString(el, text, speed = 'medium') {
        let minDelay, maxDelay;
        switch (speed) {
            case 'slow':   minDelay = 200; maxDelay = 400; break;
            case 'fast':   minDelay = 40;  maxDelay = 100; break;
            default:       minDelay = 100; maxDelay = 250; break;
        }

        let i = 0;
        while (i < text.length) {
            const char = text[i];

            // 10% typo chance
            if (Math.random() < 0.1 && i > 0 && char !== ' ') {
                const wrongChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
                el.dispatchEvent(new KeyboardEvent('keydown', { key: wrongChar, bubbles: true }));
                el.value += wrongChar;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keyup', { key: wrongChar, bubbles: true }));
                await sleep(randomInt(minDelay, maxDelay));
                await sleep(randomInt(300, 800));
                el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
                el.value = el.value.slice(0, -1);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true }));
                await sleep(randomInt(200, 500));
            }

            el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
            el.value += char;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));

            let charDelay = randomInt(minDelay, maxDelay);
            if (char === ' ') charDelay += randomInt(30, 80);
            if (Math.random() < 0.05) charDelay += randomInt(50, 150);
            await sleep(charDelay);
            i++;
        }
    }

    // Enhanced search interaction (anti-ban - Simulate Reading)
    async function enhancedSearchInteraction() {
        await sleep(randomInt(1000, 2000));
        
        // Mô phỏng lướt báo: cuộn xuống 500-1000px chia làm nhiều nhịp
        const totalScroll = randomInt(500, 1000);
        const steps = randomInt(3, 6);
        const scrollPerStep = Math.floor(totalScroll / steps);
        
        for (let i = 0; i < steps; i++) {
            window.scrollBy({ top: scrollPerStep + randomInt(-50, 50), behavior: 'smooth' });
            await sleep(randomInt(800, 1500)); // Nhịp nghỉ đọc tin
        }

        // Thi thoảng lướt ngược lên như kiểu đọc lại
        if (Math.random() > 0.5) {
            window.scrollBy({ top: -randomInt(100, 300), behavior: 'smooth' });
            await sleep(randomInt(1000, 2000));
        }
    }

    function findSearchInput() {
        const selectors = [
            '#sb_form_q', 'textarea[name="q"]', 'input[name="q"]',
            'textarea.b_searchbox', 'input.b_searchbox',
            '[aria-label*="Search" i]', 'input[type="search"]'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    }

    async function typeAndSearch(keyword) {
        window.scrollTo(0, 0);
        await sleep(300);

        // Dismiss overlays
        try {
            const langPanel = document.querySelector('#b-scopeListItem-menu, .b_scopeListItem_menu, [id*="lang"], #b_tween');
            if (langPanel && langPanel.style.display !== 'none') {
                document.body.click();
                await sleep(300);
            }
            document.querySelectorAll('[class*="overlay"][style*="display: block"], [class*="modal"][style*="display: block"], .b_overlay')
                .forEach(o => { try { o.style.display = 'none'; } catch(e) {} });
        } catch(e) {}

        const searchInput = findSearchInput();
        if (!searchInput) return { success: false, error: 'no_input' };

        searchInput.scrollIntoView({ behavior: 'instant', block: 'center' });
        await sleep(randomInt(300, 600));
        await sleep(randomInt(500, 1000));
        searchInput.focus();
        searchInput.click();
        await sleep(randomInt(200, 400));

        if (document.activeElement !== searchInput) {
            searchInput.focus();
            await sleep(200);
        }

        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(randomInt(100, 200));

        await humanTypeString(searchInput, keyword, 'medium');
        await sleep(randomInt(800, 2000));
        await sleep(randomInt(500, 1200));

        const form = searchInput.closest('form') || document.getElementById('sb_form');
        if (form) { form.submit(); }
        else {
            searchInput.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', keyCode: 13, bubbles: true
            }));
        }
        return { success: true };
    }

    // =============================================
    // SCRAPE POINTS (API + DOM selectors)
    // =============================================
    async function scrapePoints() {
        // METHOD 1: Official API (with timeout)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const r = await fetch('https://rewards.bing.com/api/getuserinfo?type=1', {
                signal: controller.signal,
                cache: 'no-cache',
                credentials: 'include'
            });
            clearTimeout(timeoutId);

            if (r.ok) {
                const data = await r.json();
                if (data?.dashboard?.userStatus?.availablePoints) {
                    return data.dashboard.userStatus.availablePoints;
                }
            }
        } catch (e) {
            // API failed, try selectors
        }

        // METHOD 2: DOM selectors
        const extractPoints = (text) => {
            if (!text) return null;
            const matches = text.match(/(\d{1,3}(?:[,.\s]\d{3})+|\d+)(?:\.\d{2})?/g);
            if (matches) {
                const numbers = matches
                    .map(m => parseInt(m.replace(/[,.\s]/g, ''), 10))
                    .filter(n => !isNaN(n) && n >= 0 && n < 1000000)
                    .sort((a, b) => b - a);
                for (const num of numbers) {
                    if (num >= 100) return num;
                }
            }
            return null;
        };

        const selectors = [
            '.text-title1.font-semibold',
            'mee-rewards-user-status-balance',
            '#balanceToolTip',
            '.pointsValue',
            '[class*="balance"]'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                const num = extractPoints(el.innerText || el.textContent);
                if (num) return num;
            }
        }

        return null;
    }

    function decodeEmbeddedJsonString(value) {
        if (typeof value !== 'string') return '';
        try {
            return JSON.parse(`"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
        } catch (e) {
            return value
                .replace(/\\u0026/g, '&')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\');
        }
    }

    function normalizeTaskUrl(url) {
        if (typeof url !== 'string' || !url.trim()) return '';
        try {
            const parsed = new URL(url, location.origin);
            parsed.hash = '';
            return parsed.toString();
        } catch (e) {
            return url.trim();
        }
    }

    function isVisibleElement(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function isInNonTaskRegion(el) {
        if (!el) return true;
        return !!el.closest('header, nav, footer, [role="tablist"], [role="navigation"], [role="menu"], [aria-label="View profile"]');
    }

    function isKnownNonTaskUrl(url) {
        const normalized = normalizeTaskUrl(url);
        if (!normalized) return true;

        try {
            const parsed = new URL(normalized);
            if (parsed.hostname === 'rewards.bing.com') {
                if (
                    parsed.pathname === '/' ||
                    parsed.pathname === '/dashboard' ||
                    parsed.pathname === '/earn' ||
                    parsed.pathname === '/redeem' ||
                    parsed.pathname.startsWith('/redeem/orderhistory') ||
                    parsed.pathname === '/about' ||
                    parsed.pathname === '/refer'
                ) {
                    return true;
                }
            }
        } catch (e) {
            return false;
        }

        return false;
    }

    function isLikelyTaskUrl(url) {
        const normalized = normalizeTaskUrl(url);
        if (!normalized || isKnownNonTaskUrl(normalized)) return false;

        try {
            const parsed = new URL(normalized);
            const href = normalized.toLowerCase();

            if (parsed.hostname === 'www.bing.com') {
                return href.includes('rnoreward=1') || href.includes('form=dset') || href.includes('publ=rewards');
            }

            if (parsed.hostname === 'rewards.bing.com') {
                return href.includes('/referandearn/') || href.includes('rnoreward=1');
            }

            return href.includes('rnoreward=1') || href.includes('form=dset');
        } catch (e) {
            return false;
        }
    }

    // =============================================
    // GET TASK DATA (OfferId + Hash + destination + completion state)
    // =============================================
    function extractTaskData() {
        const taskData = [];
        const seen = new Set();

        const addTask = (task) => {
            const offerId = (task.offerId || '').trim();
            const hash = (task.hash || '').trim();
            const destination = normalizeTaskUrl(task.destination || task.destinationUrl || '');
            const title = (task.title || '').trim();
            const isCompleted = Boolean(task.isCompleted);

            if (!offerId || !destination || isCompleted) return;

            const key = `${offerId}|${destination}`;
            if (seen.has(key)) return;
            seen.add(key);

            taskData.push({
                offerId,
                hash,
                destination,
                title,
                isCompleted,
                source: task.source || 'script_state'
            });
        };

        const parseScriptText = (text, source) => {
            if (!text || !text.includes('offerId')) return;

            const encodedPattern = /\{[^{}]*?\\"destination\\":\\"([^"]+)\\"[^{}]*?\\"hash\\":\\"([^"]*)\\"[^{}]*?\\"isCompleted\\":(true|false)[^{}]*?\\"offerId\\":\\"([^"]+)\\"[^{}]*?\\"title\\":\\"([^"]+)\\"[^{}]*?\}/g;
            const plainPattern = /\{[^{}]*?"destination":"([^"]+)"[^{}]*?"hash":"([^"]*)"[^{}]*?"isCompleted":(true|false)[^{}]*?"offerId":"([^"]+)"[^{}]*?"title":"([^"]+)"[^{}]*?\}/g;

            for (const match of text.matchAll(encodedPattern)) {
                addTask({
                    destination: decodeEmbeddedJsonString(match[1]),
                    hash: decodeEmbeddedJsonString(match[2]),
                    isCompleted: match[3] === 'true',
                    offerId: decodeEmbeddedJsonString(match[4]),
                    title: decodeEmbeddedJsonString(match[5]),
                    source
                });
            }

            for (const match of text.matchAll(plainPattern)) {
                addTask({
                    destination: match[1],
                    hash: match[2],
                    isCompleted: match[3] === 'true',
                    offerId: match[4],
                    title: match[5],
                    source
                });
            }
        };

        try {
            Array.from(document.querySelectorAll('script')).forEach((script, index) => {
                parseScriptText(script.textContent || '', `script_${index}`);
            });
        } catch (e) {}

        return taskData;
    }

    function collectDomTaskCandidates(taskData = []) {
        const candidates = [];
        const seen = new Set();
        const titleNeedles = taskData
            .map(task => (task.title || '').trim().toLowerCase())
            .filter(Boolean);
        const containers = new Set(document.querySelectorAll('#dailyset, [id*="dailyset"], [class*="dailyset"], [data-offerid]'));

        if (titleNeedles.length > 0) {
            document.querySelectorAll('a[href], button[data-react-aria-pressable="true"], [role="button"]').forEach(element => {
                if (!isVisibleElement(element) || isInNonTaskRegion(element)) return;

                const text = (element.textContent || element.innerText || '').trim().toLowerCase();
                if (!text) return;

                const titleMatch = titleNeedles.some(title => text.includes(title) || title.includes(text));
                if (!titleMatch) return;

                const card = element.closest('[data-offerid], article, [class*="card"], [class*="promo"], [class*="reward"], section, div');
                if (card) containers.add(card);
            });
        }

        for (const container of containers) {
            const elements = container.matches('a[href], button, [role="button"]')
                ? [container]
                : Array.from(container.querySelectorAll('a[href], button[data-react-aria-pressable="true"], [role="button"]'));

            for (const element of elements) {
                if (!element || !isVisibleElement(element) || isInNonTaskRegion(element)) continue;

                const ownerAnchor = element.matches('a[href]') ? element : element.closest('a[href]');
                const href = normalizeTaskUrl(ownerAnchor?.getAttribute('href') || ownerAnchor?.href || element.getAttribute('href') || '');
                const text = (element.textContent || element.innerText || '').trim();
                const card = element.closest('#dailyset, [data-offerid], article, [class*="card"], [class*="promo"], [class*="reward"]') || container;
                const offerId = card?.getAttribute?.('data-offerid') || '';
                const key = `${offerId}|${href}|${text}|${card?.id || ''}|${card?.className || ''}`;

                if (seen.has(key)) continue;
                seen.add(key);

                candidates.push({
                    element,
                    href,
                    text,
                    card,
                    offerId
                });
            }
        }

        return candidates;
    }

    function matchVisibleTasks(taskData, domCandidates) {
        const matches = [];

        for (const task of taskData) {
            const offerIdMatch = domCandidates.find(candidate => candidate.offerId && candidate.offerId === task.offerId);
            const exactHref = !offerIdMatch
                ? domCandidates.find(candidate => candidate.href && candidate.href === task.destination)
                : null;
            const titleMatch = !offerIdMatch && !exactHref
                ? domCandidates.find(candidate => candidate.text && task.title && candidate.text.toLowerCase().includes(task.title.toLowerCase()))
                : null;
            const domMatch = offerIdMatch || exactHref || titleMatch;

            if (!domMatch) continue;

            matches.push({
                ...task,
                element: domMatch.element,
                href: domMatch.href || task.destination,
                text: domMatch.text
            });
        }

        return matches;
    }

    function isTaskElementCompleted(element) {
        if (!element) return false;

        const button = element.matches('button, [role="button"]')
            ? element
            : element.querySelector('button, [role="button"]');
        if (button?.disabled || button?.getAttribute('aria-disabled') === 'true') {
            return true;
        }

        const card = element.closest('#dailyset, [data-offerid], article, [class*="card"], [class*="promo"], [class*="reward"]') || element;
        const text = (card.textContent || '').toLowerCase();
        if (text.includes('completed') || text.includes('earned')) {
            return true;
        }

        return Boolean(
            card.querySelector('[class*="completed"], [class*="checkmark"], [class*="check"], [aria-label*="completed"]')
        );
    }

    // =============================================
    // TRIGGER SERVER ACTION (Direct API)
    // =============================================
    async function triggerServerAction(offerId, hash) {
        if (!hash) return { success: false, error: 'missing_hash' };

        const ACTION_ID = "70babbc81d2724f60d29a95c03b3d739cba77cea92";
        const currentTimezone = new Date().getTimezoneOffset().toString();

        try {
            // Next.js Server Action POST
            // We use the current page URL as the destination
            const response = await fetch(window.location.href, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=UTF-8',
                    'Next-Action': ACTION_ID
                },
                // Payload format for the reportActivity Server Action: [hash, 11, { offerid, isPromotional, timezoneOffset }]
                body: JSON.stringify([
                    hash, 
                    11, 
                    { 
                        offerid: offerId, 
                        isPromotional: "true", 
                        timezoneOffset: currentTimezone 
                    }
                ])
            });

            if (response.ok) {
                const result = await response.text();
                return { success: true, result };
            }
            return { success: false, status: response.status };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // =============================================
    // CLICK DAILY TASKS (API + XPath fallback)
    // =============================================
    async function legacyClickDailyTasks() {
        await sleep(2000);

        // 🎯 STEP 1: Try Direct API Action (The "Super Hack")
        const taskMetadatas = extractTaskData();
        console.log("[BRA] Found task metadata:", taskMetadatas);
        
        let apiCompleted = 0;
        for (const meta of taskMetadatas) {
            if (meta.hash) {
                const res = await triggerServerAction(meta.offerId, meta.hash);
                if (res.success) {
                    apiCompleted++;
                    console.log(`[BRA] API Task Success: ${meta.offerId}`);
                    await sleep(1000);
                }
            }
        }

        // 🎯 STEP 2: DOM fallback for remaining tasks
        const tasks = [];

        // XPath by header text (works for both old/new UI)
        const findTasksByHeader = (headerText) => {
            const xpath = `//*[contains(text(), '${headerText}')]/ancestor::*[position() <= 4]//a`;
            const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            const found = [];
            for (let i = 0; i < result.snapshotLength; i++) {
                found.push(result.snapshotItem(i));
            }
            return found;
        };

        const headers = [
            'Nhóm mục tiêu hàng ngày',
            'Daily Set',
            'Các hoạt động khác',
            'More activities'
        ];

        for (const h of headers) {
            findTasksByHeader(h).forEach(l => tasks.push(l));
        }

        // Fallback: section-based
        if (tasks.length === 0) {
            ['#daily-sets a', '#more-activities a'].forEach(sel => {
                document.querySelectorAll(sel).forEach(l => tasks.push(l));
            });
        }

        let clickedCount = 0;
        const maxClicks = 4;
        const uniqueTasks = [...new Set(tasks)];

        for (const link of uniqueTasks) {
            if (clickedCount >= maxClicks) break;

            // Skip completed
            const card = link.closest('.c-card') || link.closest('div[class*="content"]');
            if (card?.querySelector('.sw-checkmark')) continue;

            if (!link.href || link.href.includes('#')) continue;

            try {
                link.scrollIntoView({ behavior: 'auto', block: 'center' });
                await sleep(500);
                link.click();
                clickedCount++;
                await sleep(5000);
            } catch (e) { }
        }

        return { clicked: clickedCount };
    }

    // =============================================
    // CLICK DAILY TASKS (Dashboard mode) - SMART DOM SCANNER
    // =============================================
    async function legacyBroadClickDailyTasks() {
        const delay = ms => new Promise(r => setTimeout(r, ms));
        const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        let clicked = 0;
        let skippedCompleted = 0;
        const clickedUrls = [];
        const processedElements = new Set();
        
        try {
            console.log('[clickDailyTasks] Starting SMART dashboard task discovery...');

            // Full page scroll to ensure everything loads
            for (let i = 0; i < 8; i++) {
                window.scrollBy({ top: 250, behavior: 'smooth' });
                await delay(300);
            }
            window.scrollTo(0, 0);
            await delay(800);

            // 🔥 STRATEGY 1: Find task containers by common patterns
            // Microsoft Rewards uses various container patterns
            const taskContainerSelectors = [
                '#dailyset button',                 // ⭐ MAIN: Daily Set section + buttons (HIGHEST PRIORITY)
                'section#dailyset button',
                'article',                           // Semantic task containers
                '[class*="card"]',                  // Card components
                '[class*="task"]',                  // Task components  
                '[class*="promo"]',                 // Promotion components
                '[class*="promotion"]',
                '[class*="reward"]',
                '[role="article"]',
                '[data-test*="task"]',
                '[data-test*="card"]',
                'main > div > div',                 // Main content divs
                'section',                          // Semantic sections
                'div[class*="dailyset"]',           // Daily Set specific
                'div[class*="daily-set"]',
                'div[class*="cta"]',                // CTA containers
            ];

            let taskContainers = [];
            for (const selector of taskContainerSelectors) {
                try {
                    taskContainers.push(...document.querySelectorAll(selector));
                } catch(e) {}
            }

            const dailySetCount = document.querySelectorAll('#dailyset button').length;
            console.log(`[clickDailyTasks] Found ${taskContainers.length} potential task containers`);
            console.log(`[Daily Set] Found ${dailySetCount} Daily Set buttons`);

            // 🔥 HELPER: Check if task is already completed
            function isTaskCompleted(container) {
                // For button elements (Daily Set tasks)
                if (container.tagName === 'BUTTON') {
                    if (container.hasAttribute('disabled')) {
                        console.log(`[✓ SKIPPED-COMPLETED] Task button is disabled`);
                        return true;
                    }
                    const buttonText = (container.textContent || '').toLowerCase();
                    if (buttonText.includes('completed') || buttonText.includes('earned')) {
                        return true;
                    }
                }

                // For container elements
                // Check for completion indicators
                const completionPatterns = [
                    container.querySelector('[class*="completed"]'),
                    container.querySelector('[class*="checkmark"]'),
                    container.querySelector('[class*="check"]'),
                    container.querySelector('svg[class*="check"]'),
                    container.querySelector('[aria-label*="completed"]'),
                ];

                if (completionPatterns.some(el => el)) {
                    console.log(`[✓ SKIPPED-COMPLETED] Task already completed (visual indicator)`);
                    return true;
                }

                // Check text content
                const text = (container.textContent || '').toLowerCase();
                if (text.includes('completed') || text.includes('earned') || text.includes('已完成')) {
                    // Make sure it's not just in the button text
                    const actionBtn = container.querySelector('button, a[href], [role="button"]');
                    if (!actionBtn || !actionBtn.textContent.toLowerCase().includes('view')) {
                        console.log(`[✓ SKIPPED-COMPLETED] Task text indicates completed`);
                        return true;
                    }
                }

                return false;
            }

            // 🔥 STRATEGY 2: Find action buttons/links within containers
            const actionPatterns = [
                /^(view|complete|claim|start|take|quiz|continue|read|earn|redeem|participate|search)$/i,
                /complete/i,
                /view/i,
                /start/i,
                /play/i,
                /take/i,
                /claim/i,
            ];

            let allCandidates = [];

            // Method A: From containers (WITH completion check)
            for (const container of taskContainers) {
                try {
                    // Skip if already completed
                    if (isTaskCompleted(container)) {
                        skippedCompleted++;
                        continue;
                    }

                    // Find buttons in container
                    const buttons = container.querySelectorAll('button, a[href], [role="button"]');
                    for (const btn of buttons) {
                        const text = (btn.textContent || '').trim();
                        const href = btn.getAttribute('href') || '';
                        
                        // Check if this button matches action patterns
                        if (actionPatterns.some(p => p.test(text))) {
                            allCandidates.push({
                                element: btn,
                                text,
                                href,
                                container,
                                source: 'pattern-match'
                            });
                        }
                    }
                } catch(e) {}
            }

            // Method B: All buttons on page (if pattern matching found nothing)
            if (allCandidates.length === 0) {
                console.log('[clickDailyTasks] No pattern matches, scanning all buttons...');
                const allButtons = document.querySelectorAll('button:not([disabled]), a[href], [role="button"]');
                for (const btn of allButtons) {
                    const text = (btn.textContent || '').trim();
                    const href = btn.getAttribute('href') || '';
                    
                    // Skip nav/header/footer
                    if (btn.closest('header') || btn.closest('nav') || btn.closest('footer')) continue;
                    if (btn.closest('[class*="header"]') || btn.closest('[class*="footer"]')) continue;
                    
                    // Check parent container for completion status
                    const parentContainer = btn.closest('article') || btn.closest('[class*="card"]') || btn.closest('section');
                    if (parentContainer && isTaskCompleted(parentContainer)) {
                        skippedCompleted++;
                        continue;
                    }
                    
                    // Skip common non-task buttons
                    const unwanted = ['sign in', 'sign out', 'settings', 'help', 'about', 'privacy', 'terms', 'logout', 'profile', 'account', 'language', 'feedback'];
                    if (unwanted.some(w => text.toLowerCase().includes(w))) continue;

                    // Must have reasonable text length
                    if (text.length >= 2 && text.length < 200) {
                        allCandidates.push({
                            element: btn,
                            text,
                            href,
                            source: 'generic-scan'
                        });
                    }
                }
            }

            console.log(`[clickDailyTasks] Found ${allCandidates.length} candidate actions (${skippedCompleted} skipped as completed)`);
            
            // Check how many candidates are Daily Set buttons
            const dailySetCandidates = allCandidates.filter(c => c.element.closest('#dailyset')).length;
            if (dailySetCandidates > 0) {
                console.log(`[Daily Set] ✓ ${dailySetCandidates} candidates from Daily Set section`);
            }

            // 🔥 STRATEGY 3: Deduplicate + prioritize
            const seen = new Set();
            const uniqueCandidates = [];

            // Priority: Buttons with text that looks like actions
            const actionKeywords = ['view', 'complete', 'start', 'take', 'claim', 'play', 'read', 'earn', 'join', 'search'];
            
            // Sort by priority
            allCandidates.sort((a, b) => {
                const aScore = actionKeywords.some(k => a.text.toLowerCase().includes(k)) ? 0 : 1;
                const bScore = actionKeywords.some(k => b.text.toLowerCase().includes(k)) ? 0 : 1;
                return aScore - bScore;
            });

            for (const candidate of allCandidates) {
                const key = `${candidate.href}|${candidate.text}|${candidate.element.offsetTop}`;
                if (seen.has(key)) continue;
                seen.add(key);
                
                // Check visibility
                const rect = candidate.element.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    uniqueCandidates.push(candidate);
                }
            }

            console.log(`[clickDailyTasks] After dedup: ${uniqueCandidates.length} unique actions`);

            // 🔥 STRATEGY 4: Click each one (ONLY if not completed)
            for (const candidate of uniqueCandidates) {
                try {
                    const { element, text, href, container } = candidate;

                    // Double-check completion status right before click
                    if (container && isTaskCompleted(container)) {
                        console.log(`[clickDailyTasks] Task became completed, skipping: "${text.substring(0, 40)}"`);
                        continue;
                    }

                    // Re-check visibility (DOM may have changed)
                    const rect = element.getBoundingClientRect();
                    if (rect.width <= 0 || rect.height <= 0) {
                        console.log(`[clickDailyTasks] Skipping hidden: "${text.substring(0, 40)}"`);
                        continue;
                    }

                    // Skip if already processed (element ref)
                    if (processedElements.has(element)) {
                        console.log(`[clickDailyTasks] Skipping duplicate ref: "${text.substring(0, 40)}"`);
                        continue;
                    }
                    processedElements.add(element);

                    console.log(`[clickDailyTasks] CLICKING [${clicked + 1}]: "${text.substring(0, 60)}"${href ? ' → ' + href.substring(0, 40) : ''}`);

                    // Scroll to center
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await delay(randomInt(400, 700));

                    // Click it
                    if (href && href.startsWith('http')) {
                        window.open(href, '_blank');
                        clickedUrls.push(href);
                        console.log(`✓ Opened link`);
                    } else if (element.href) {
                        window.open(element.href, '_blank');
                        clickedUrls.push(element.href);
                        console.log(`✓ Opened element.href`);
                    } else {
                        element.click();
                        console.log(`✓ Clicked button`);
                    }

                    clicked++;
                    await delay(randomInt(1200, 2800));

                    // Reasonable limit
                    if (clicked >= 20) {
                        console.log(`[clickDailyTasks] Reached max (20), stopping`);
                        break;
                    }

                } catch(e) {
                    console.error(`[clickDailyTasks] Error:`, e.message);
                }
            }

            console.log(`[✅ clickDailyTasks] COMPLETE: clicked ${clicked}/${uniqueCandidates.length} tasks (${skippedCompleted} already completed)`);
            console.log(`[URLs visited]:`, clickedUrls);
            
            return {
                clicked,
                attempted: uniqueCandidates.length,
                skipped: skippedCompleted,
                urls: clickedUrls,
                success: clicked > 0
            };

        } catch(e) {
            console.error('[❌ clickDailyTasks] Fatal error:', e.message, e.stack);
            return {
                clicked,
                skipped: skippedCompleted,
                error: e.message,
                success: false
            };
        }
    }

    async function clickDailyTasks() {
        const delay = ms => new Promise(r => setTimeout(r, ms));

        let clicked = 0;
        let attempted = 0;
        let skippedCompleted = 0;
        let serverCompleted = 0;
        const clickedUrls = [];
        const processedTaskKeys = new Set();
        const processedElements = new Set();

        try {
            console.log('[clickDailyTasks] Starting targeted dashboard task discovery...');

            for (let i = 0; i < 6; i++) {
                window.scrollBy({ top: 240, behavior: 'smooth' });
                await delay(250);
            }
            window.scrollTo(0, 0);
            await delay(900);

            const taskData = extractTaskData();
            const domCandidates = collectDomTaskCandidates(taskData);
            const matchedTasks = matchVisibleTasks(taskData, domCandidates).filter(task => {
                const key = `${task.offerId}|${task.href || task.destination}`;
                if (processedTaskKeys.has(key)) return false;
                processedTaskKeys.add(key);
                return true;
            });

            console.log('[clickDailyTasks] Pending task metadata:', taskData.map(task => ({
                offerId: task.offerId,
                title: task.title,
                destination: task.destination,
                hasHash: Boolean(task.hash),
                source: task.source
            })));
            console.log('[clickDailyTasks] Safe DOM candidates:', domCandidates.map(candidate => ({
                offerId: candidate.offerId,
                href: candidate.href,
                text: candidate.text
            })));
            console.log('[clickDailyTasks] Matched visible tasks:', matchedTasks.map(task => ({
                offerId: task.offerId,
                title: task.title,
                href: task.href || task.destination
            })));

            attempted = matchedTasks.length;

            for (const task of matchedTasks) {
                try {
                    const element = task.element;
                    const targetHref = normalizeTaskUrl(task.href || task.destination || '');
                    const label = (task.text || task.title || task.offerId || '').trim();

                    if (!element || !isVisibleElement(element) || isInNonTaskRegion(element)) {
                        console.log(`[clickDailyTasks] Skipping invisible/non-task match: "${label}"`);
                        continue;
                    }

                    if (processedElements.has(element)) {
                        console.log(`[clickDailyTasks] Skipping duplicate element: "${label}"`);
                        continue;
                    }
                    processedElements.add(element);

                    if (isTaskElementCompleted(element)) {
                        skippedCompleted++;
                        console.log(`[clickDailyTasks] Skipping already completed task: "${label}"`);
                        continue;
                    }

                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await delay(randomInt(350, 650));

                    if (task.hash) {
                        const actionResult = await triggerServerAction(task.offerId, task.hash);
                        if (actionResult.success) {
                            serverCompleted++;
                            clicked++;
                            console.log(`[clickDailyTasks] Server action success: ${task.offerId}`);
                            await delay(randomInt(900, 1400));
                            continue;
                        }
                        console.warn(`[clickDailyTasks] Server action failed for ${task.offerId}:`, actionResult);
                    }

                    if (!isLikelyTaskUrl(targetHref)) {
                        console.warn(`[clickDailyTasks] Refusing non-task URL for ${task.offerId}: ${targetHref || '(empty)'}`);
                        continue;
                    }

                    window.open(targetHref, '_blank');
                    clickedUrls.push(targetHref);
                    clicked++;
                    console.log(`[clickDailyTasks] Opened verified task URL: ${targetHref}`);
                    await delay(randomInt(1200, 2200));
                } catch (e) {
                    console.error('[clickDailyTasks] Matched task error:', e.message);
                }
            }

            if (matchedTasks.length === 0) {
                const fallbackCandidates = domCandidates
                    .filter(candidate => candidate.element.closest('#dailyset'))
                    .filter(candidate => candidate.href && isLikelyTaskUrl(candidate.href))
                    .filter(candidate => !isTaskElementCompleted(candidate.element))
                    .filter(candidate => {
                        const key = `${candidate.offerId || ''}|${candidate.href}|${candidate.text}`;
                        if (processedTaskKeys.has(key)) return false;
                        processedTaskKeys.add(key);
                        return true;
                    })
                    .slice(0, 3);

                attempted = fallbackCandidates.length;
                console.log(`[clickDailyTasks] No metadata matches. Trying ${fallbackCandidates.length} #dailyset fallback candidate(s).`);

                for (const candidate of fallbackCandidates) {
                    try {
                        const label = (candidate.text || candidate.href || '').trim();
                        candidate.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await delay(randomInt(350, 650));
                        window.open(candidate.href, '_blank');
                        clickedUrls.push(candidate.href);
                        clicked++;
                        console.log(`[clickDailyTasks] Opened #dailyset fallback task: ${label}`);
                        await delay(randomInt(1200, 2200));
                    } catch (e) {
                        console.error('[clickDailyTasks] Fallback task error:', e.message);
                    }
                }
            }

            console.log(`[clickDailyTasks] COMPLETE: clicked ${clicked}/${attempted}, skipped completed ${skippedCompleted}, server actions ${serverCompleted}`);
            console.log('[clickDailyTasks] URLs visited:', clickedUrls);

            return {
                clicked,
                attempted,
                skipped: skippedCompleted,
                urls: clickedUrls,
                success: clicked > 0 || serverCompleted > 0,
                serverCompleted
            };
        } catch (e) {
            console.error('[clickDailyTasks] Fatal error:', e.message, e.stack);
            return {
                clicked,
                attempted,
                skipped: skippedCompleted,
                urls: clickedUrls,
                error: e.message,
                success: false,
                serverCompleted
            };
        }
    }

    window.__BRA__ = {
        typeAndSearch,
        enhancedSearchInteraction,
        scrapePoints,
        clickDailyTasks,
        humanTypeString,
        findSearchInput,
        sleep,
        randomInt
    };

    return { status: 'injected', version: '3.0' };
})();
