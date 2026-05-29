// Parse URL params
const params = new URLSearchParams(location.search);
const searches  = parseInt(params.get('searches')) || 0;
const earned    = parseInt(params.get('earned'))   || 0;
const duration  = parseInt(params.get('duration')) || 0;
const mode      = params.get('mode') || 'desktop';
const timePrf   = params.get('timeProfile') || '';

// Fill values
document.getElementById('val-searches').textContent  = searches || '—';
document.getElementById('val-points').textContent    = earned > 0 ? `+${earned}` : '—';
document.getElementById('val-duration').textContent  = duration > 60
  ? `${Math.floor(duration/60)}m ${duration%60}s`
  : `${duration}s`;

const modeMap = { desktop: 'PC', mobile: 'Mobile', both: 'PC + Mobile' };
document.getElementById('val-mode').textContent = modeMap[mode] || mode;

const timeMap = {
  morning: '🌅 Buổi sáng (chậm)',
  afternoon: '☀️ Buổi chiều (bình thường)',
  evening: '🌆 Buổi tối (nhanh hơn)',
  night: '🌙 Ban đêm (rất chậm)'
};
const tpEl = document.getElementById('val-time-profile');
if (timePrf && timeMap[timePrf]) {
  tpEl.textContent = timeMap[timePrf];
} else {
  tpEl.style.display = 'none';
}

// Close button
document.getElementById('btn-close').addEventListener('click', () => window.close());

// Particles
const pContainer = document.getElementById('particles');
const colors = ['#00e5ff', '#7c3aed', '#10b981', '#f59e0b', '#ec4899'];
for (let i = 0; i < 18; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  const size = Math.random() * 4 + 2;
  p.style.cssText = `
    width:${size}px; height:${size}px;
    left:${Math.random()*100}%;
    background:${colors[Math.floor(Math.random()*colors.length)]};
    animation-duration:${6 + Math.random()*8}s;
    animation-delay:${Math.random()*5}s;
  `;
  pContainer.appendChild(p);
}
