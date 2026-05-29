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

    // =============================================
    // COORDINATE-BASED CLICKING (ported from BingAutoSearch)
    // Dispatches real MouseEvent chain at exact DOM coords
    // =============================================

    /**
     * Simulate a human-like click at exact (x, y) coordinates.
     * Dispatches full event chain: mousemove → mouseenter → mouseover → mousedown → focus → mouseup → click
     * This is the core anti-detection technique from BingAutoSearch.
     */
    function humanClickAtCoords(x, y) {
        const target = document.elementFromPoint(x, y);
        if (!target) return { success: false, error: 'no_element_at_coords' };

        const baseOpts = {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            screenX: x + window.screenX,
            screenY: y + window.screenY,
            button: 0,
            buttons: 1
        };

        // Full event chain mimicking real browser mouse behavior
        target.dispatchEvent(new MouseEvent('mousemove', baseOpts));
        target.dispatchEvent(new MouseEvent('mouseenter', { ...baseOpts, bubbles: false }));
        target.dispatchEvent(new MouseEvent('mouseover', baseOpts));
        target.dispatchEvent(new MouseEvent('mousedown', baseOpts));

        // Focus if focusable (input, textarea, button, a)
        if (typeof target.focus === 'function') {
            target.focus();
        }

        target.dispatchEvent(new MouseEvent('mouseup', baseOpts));
        target.dispatchEvent(new MouseEvent('click', baseOpts));

        return {
            success: true,
            tagName: target.tagName,
            text: (target.textContent || '').substring(0, 60)
        };
    }

    /**
     * Get precise coordinates of the search input box and search button.
     * Returns coords with random human-like jitter (±10px X, ±3px Y).
     * Ported from BingAutoSearch GET_SEARCH_COORDS action.
     */
    function getSearchCoords() {
        const input = document.querySelector('#sb_form_q')
            || document.querySelector('textarea[name="q"]')
            || document.querySelector('input[name="q"]')
            || document.querySelector('textarea.b_searchbox')
            || document.querySelector('input.b_searchbox');

        if (!input) return null;

        const rect = input.getBoundingClientRect();
        const btn = document.querySelector('#search_icon')
            || document.querySelector('#sb_form_go')
            || document.querySelector('button[type="submit"]');
        const btnRect = btn ? btn.getBoundingClientRect() : null;

        return {
            isHidden: document.hidden,
            w: window.innerWidth || 1024,
            h: window.innerHeight || 768,
            // Center of input + human jitter ±10px X, ±3px Y
            inputX: rect.left + rect.width / 2 + (Math.random() * 20 - 10),
            inputY: rect.top + rect.height / 2 + (Math.random() * 6 - 3),
            hasBtn: !!btnRect,
            btnX: btnRect ? btnRect.left + btnRect.width / 2 + (Math.random() * 10 - 5) : 0,
            btnY: btnRect ? btnRect.top + btnRect.height / 2 + (Math.random() * 6 - 3) : 0
        };
    }

    /**
     * Get coordinates of a random organic search result (from top 3).
     * Scrolls result into view, waits 400ms, then returns center coords.
     * Ported from BingAutoSearch GET_RESULT_COORDS action.
     */
    async function getResultCoords() {
        const results = document.querySelectorAll('#b_results > li.b_algo, .b_algo, #b_results .b_algo');
        const candidates = [];
        const seen = new Set();

        for (let i = 0; i < results.length && candidates.length < 3; i++) {
            const link = results[i].querySelector('h2 a')
                || results[i].querySelector('.b_title a')
                || results[i].querySelector('a[href]');
            if (link && link.href && !seen.has(link.href)) {
                seen.add(link.href);
                candidates.push(link);
            }
        }

        if (candidates.length === 0) return null;

        // Pick random from top 3
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        chosen.scrollIntoView({ behavior: 'instant', block: 'center' });

        // Wait for scroll to settle (same as BingAutoSearch's 400ms timeout)
        await sleep(400);

        const rect = chosen.getBoundingClientRect();
        return {
            title: (chosen.textContent || '').substring(0, 60),
            href: chosen.href,
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2)
        };
    }

    /**
     * Submit a search via hidden form (bypasses SPA routing).
     * Creates a hidden <form method="GET" action="/search"> and submits it.
     * Ported from BingAutoSearch SUBMIT_FAKE_FORM action.
     */
    function submitFakeForm(url) {
        try {
            const form = document.createElement('form');
            form.action = '/search';
            form.method = 'GET';
            form.style.display = 'none';

            const parsed = new URL(url);
            parsed.searchParams.forEach((value, name) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = name;
                input.value = value;
                form.appendChild(input);
            });

            document.body.appendChild(form);
            form.submit();
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    window.__BRA__ = {
        enhancedSearchInteraction,
        scrapePoints,
        humanTypeString,
        sleep,
        randomInt,
        humanClickAtCoords,
        getSearchCoords,
        getResultCoords,
        submitFakeForm
    };

    return { status: 'injected', version: '4.0' };
})();
