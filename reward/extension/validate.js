function log(msg, type = 'ok') {
  const el = document.getElementById('output');
  el.innerHTML += `<span class="${type}">${msg}</span>\n`;
}

async function runTests() {
  document.getElementById('output').innerHTML = '';
  const basePath = location.href.replace('validate.html', '');

  log('==== TESTING EXTENSION FILES ====', 'warn');
  log('');

  // 1. Test manifest.json
  log('1️⃣ Testing manifest.json...');
  try {
    const r = await fetch(basePath + 'manifest.json');
    const text = await r.text();
    const json = JSON.parse(text);

    if (json.manifest_version !== 3) throw new Error('manifest_version must be 3, got: ' + json.manifest_version);
    log('   ✅ manifest_version: 3', 'ok');

    if (!json.background?.service_worker) throw new Error('Missing background.service_worker');
    log('   ✅ service_worker: ' + json.background.service_worker, 'ok');

    if (!json.action?.default_popup) throw new Error('Missing action.default_popup');
    log('   ✅ default_popup: ' + json.action.default_popup, 'ok');

    if (!json.permissions?.includes('tabs')) throw new Error('Missing "tabs" permission');
    if (!json.permissions?.includes('scripting')) throw new Error('Missing "scripting" permission');
    log('   ✅ permissions: ' + json.permissions.join(', '), 'ok');

    // Check icons
    if (json.icons) {
      log('   ⚠️ icons defined — make sure PNG files exist!', 'warn');
    } else {
      log('   ✅ No icon requirement (will use default)', 'ok');
    }

    // Check declarativeNetRequest
    if (json.declarative_net_request) {
      const rules = json.declarative_net_request.rule_resources;
      if (rules && rules.length > 0) {
        log('   ✅ declarative_net_request: ' + rules.length + ' rule set(s)', 'ok');
        for (const rule of rules) {
          log('      - ' + rule.id + ' (enabled: ' + rule.enabled + ', path: ' + rule.path + ')');
        }
      }
    }

    log('   ✅ manifest.json is VALID!', 'ok');
  } catch (e) {
    log('   ❌ manifest.json ERROR: ' + e.message, 'err');
  }

  log('');

  // 2. Test rules_mobile_ua.json
  log('2️⃣ Testing rules_mobile_ua.json...');
  try {
    const r = await fetch(basePath + 'rules_mobile_ua.json');
    const text = await r.text();
    const json = JSON.parse(text);
    if (!Array.isArray(json)) throw new Error('Must be an array');
    log('   ✅ Valid JSON array with ' + json.length + ' rules', 'ok');
    for (const rule of json) {
      if (!rule.id) throw new Error('Rule missing id');
      if (!rule.action) throw new Error('Rule missing action');
      if (!rule.condition) throw new Error('Rule missing condition');
      log('   ✅ Rule #' + rule.id + ': ' + rule.condition.urlFilter, 'ok');
    }
  } catch (e) {
    log('   ❌ rules_mobile_ua.json ERROR: ' + e.message, 'err');
  }

  log('');

  // 3. Test background.js syntax
  log('3️⃣ Testing background.js...');
  try {
    const r = await fetch(basePath + 'background.js');
    const text = await r.text();
    // Try to parse as function
    new Function(text);
    log('   ✅ background.js syntax OK (' + text.length + ' bytes)', 'ok');
  } catch (e) {
    log('   ❌ background.js SYNTAX ERROR: ' + e.message, 'err');
    // Try to find the line
    const match = e.message.match(/line (\d+)/i);
    if (match) log('   📍 Near line: ' + match[1], 'warn');
  }

  log('');

  // 4. Test content-automation.js
  log('4️⃣ Testing content-automation.js...');
  try {
    const r = await fetch(basePath + 'content-automation.js');
    const text = await r.text();
    new Function(text);
    log('   ✅ content-automation.js syntax OK (' + text.length + ' bytes)', 'ok');
  } catch (e) {
    log('   ❌ content-automation.js SYNTAX ERROR: ' + e.message, 'err');
  }

  log('');

  // 5. Test popup.js
  log('5️⃣ Testing popup.js...');
  try {
    const r = await fetch(basePath + 'popup.js');
    const text = await r.text();
    // popup.js uses chrome.* APIs which won't work in Function() but syntax check works
    new Function(text);
    log('   ✅ popup.js syntax OK (' + text.length + ' bytes)', 'ok');
  } catch (e) {
    if (e.message.includes('chrome')) {
      log('   ✅ popup.js syntax OK (chrome API ref expected outside extension)', 'ok');
    } else {
      log('   ❌ popup.js SYNTAX ERROR: ' + e.message, 'err');
    }
  }

  log('');

  // 6. Test keywords
  log('6️⃣ Testing keywords-data.js...');
  try {
    const r = await fetch(basePath + 'keywords-data.js');
    const text = await r.text();
    new Function(text);
    // Check keyword count
    const matches = text.match(/'[^']+'/g);
    log('   ✅ keywords-data.js syntax OK (~' + (matches ? matches.length : '?') + ' keywords)', 'ok');
  } catch (e) {
    log('   ❌ keywords-data.js SYNTAX ERROR: ' + e.message, 'err');
  }

  log('');

  // 7. Test popup.html + popup.css exist
  log('7️⃣ Testing popup.html & popup.css...');
  try {
    const html = await fetch(basePath + 'popup.html');
    if (html.ok) log('   ✅ popup.html exists (' + (await html.text()).length + ' bytes)', 'ok');
    else log('   ❌ popup.html NOT FOUND', 'err');

    const css = await fetch(basePath + 'popup.css');
    if (css.ok) log('   ✅ popup.css exists (' + (await css.text()).length + ' bytes)', 'ok');
    else log('   ❌ popup.css NOT FOUND', 'err');
  } catch (e) {
    log('   ❌ Error checking files: ' + e.message, 'err');
  }

  log('');
  log('==== DONE ====', 'warn');
  log('');
  log('Nếu tất cả ✅ mà vẫn ko load được, hãy gửi screenshot lỗi từ chrome://extensions', 'warn');
}

// Add event listener instead of using inline onclick in HTML
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-run').addEventListener('click', runTests);
});
