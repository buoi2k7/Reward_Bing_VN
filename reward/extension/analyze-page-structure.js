// 🔍 SMART DOM ANALYSIS SCRIPT
// Run this in DevTools Console on rewards.bing.com/earn to analyze page structure

console.log(`
╔════════════════════════════════════════════════════════════════╗
║  REWARD PAGE STRUCTURE ANALYZER                                ║
║  Use this to understand what tasks exist on the page           ║
╚════════════════════════════════════════════════════════════════╝
`);

// 1️⃣ FIND ALL TASK CONTAINERS
console.log('\n📦 TASK CONTAINERS:');
const containers = document.querySelectorAll('article, [class*="card"], [class*="task"], [class*="promo"], section');
console.log(`Found ${containers.length} containers`);
containers.forEach((c, i) => {
  if (i < 10) {
    console.log(`  [${i}]`, c.tagName, c.className.substring(0, 80), c.innerText?.substring(0, 50));
  }
});

// 2️⃣ FIND ALL ACTION BUTTONS (View, Complete, Start, etc)
console.log('\n🔘 ACTION BUTTONS:');
const buttons = document.querySelectorAll('button, a[href], [role="button"]');
const actionButtons = Array.from(buttons).filter(btn => {
  const text = (btn.textContent || '').trim().toLowerCase();
  const patterns = ['view', 'complete', 'start', 'take', 'claim', 'play', 'read', 'earn', 'join', 'quiz'];
  return patterns.some(p => text.includes(p)) && text.length > 2;
});
console.log(`Found ${actionButtons.length} action buttons:`);
actionButtons.forEach((btn, i) => {
  if (i < 20) {
    const rect = btn.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0 ? '✓' : '✗';
    console.log(`  [${i}] ${visible} "${btn.textContent?.trim().substring(0, 50)}" (${btn.tagName})`);
  }
});

// 3️⃣ FIND BY SPECIFIC KEYWORDS
console.log('\n🎯 TASKS BY KEYWORD:');
const keywords = {
  'Daily': [],
  'Quiz': [],
  'Puzzle': [],
  'PC Search': [],
  'Mobile': [],
  'Edge': [],
  'Video': [],
  'Other': []
};

buttons.forEach(btn => {
  const text = (btn.textContent || '').trim();
  if (text.length > 3 && text.length < 200) {
    if (text.toLowerCase().includes('daily')) keywords['Daily'].push(text);
    else if (text.toLowerCase().includes('quiz')) keywords['Quiz'].push(text);
    else if (text.toLowerCase().includes('puzzle')) keywords['Puzzle'].push(text);
    else if (text.toLowerCase().includes('search') || text.toLowerCase().includes('pc')) keywords['PC Search'].push(text);
    else if (text.toLowerCase().includes('mobile')) keywords['Mobile'].push(text);
    else if (text.toLowerCase().includes('edge')) keywords['Edge'].push(text);
    else if (text.toLowerCase().includes('video')) keywords['Video'].push(text);
    else if (['view', 'complete', 'start', 'take', 'claim', 'play', 'read', 'earn', 'join'].some(p => text.toLowerCase().includes(p))) {
      keywords['Other'].push(text);
    }
  }
});

Object.entries(keywords).forEach(([key, items]) => {
  if (items.length > 0) {
    console.log(`  ${key}: ${items.length} items`);
    items.slice(0, 5).forEach(item => console.log(`    - ${item.substring(0, 60)}`));
    if (items.length > 5) console.log(`    ... and ${items.length - 5} more`);
  }
});

// 4️⃣ ANALYZE SPECIFIC ELEMENTS
console.log('\n🔗 ELEMENT DETAILS (first 5 action buttons):');
actionButtons.slice(0, 5).forEach((btn, i) => {
  console.log(`\n  [${i}] "${btn.textContent?.trim().substring(0, 50)}"`);
  console.log(`      Tag: ${btn.tagName}`);
  console.log(`      Class: ${btn.className?.substring(0, 100)}`);
  console.log(`      ID: ${btn.id || '(none)'}`);
  if (btn.href) console.log(`      Href: ${btn.href?.substring(0, 80)}`);
  const rect = btn.getBoundingClientRect();
  console.log(`      Position: (${Math.round(rect.top)}, ${Math.round(rect.left)}) Size: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
  console.log(`      Parent: ${btn.parentElement?.tagName} ${btn.parentElement?.className?.substring(0, 60)}`);
});

// 5️⃣ SIMULATE CLICKS (VERBOSE LOG)
console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  TO TEST CLICKING, RUN:                                        ║');
console.log('║  (copy below and paste in console)                             ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const testCode = `
// Test clicking first button
const btn = document.querySelector('button, a[href], [role="button"]');
if (btn) {
  console.log('Testing click on:', btn.textContent?.trim().substring(0, 50));
  btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    btn.click();
    console.log('✓ Clicked!');
  }, 500);
}
`;

console.log(testCode);

console.log('\n✅ Analysis complete! Check the logs above to understand page structure.');
console.log('📝 Copy the console output and share it if tasks aren\'t being found.');
