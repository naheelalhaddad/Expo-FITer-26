const SUPABASE_URL = 'https://bpddzqbuqdmvubuzerem.supabase.co';
const SUPABASE_KEY = 'sb_publishable_76CrGMLLkhNRoTaJy1xEWg_kbp5DSxm';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const JUDGE_DIRECTORY = {
  'robo1@fit.edu.jo': 'RoboSphere: Robotics & Autonomous Drones',
  'robo2@fit.edu.jo': 'RoboSphere: Robotics & Autonomous Drones',
  'ai1@fit.edu.jo': 'Intelligence Frontier: AI & Machine Learning',
  'ai2@fit.edu.jo': 'Intelligence Frontier: AI & Machine Learning',
  'ai3@fit.edu.jo': 'Intelligence Frontier: AI & Machine Learning',
  'cloud1@fit.edu.jo': 'CloudVerse: Smart IoT & Cloud Technologies',
  'cloud2@fit.edu.jo': 'CloudVerse: Smart IoT & Cloud Technologies',
  'cyber1@fit.edu.jo': 'CyberShield: Future of Cybersecurity',
  'cyber2@fit.edu.jo': 'CyberShield: Future of Cybersecurity',
  'web1@fit.edu.jo': 'Digital Horizons: Web & Mobile Innovation',
  'web2@fit.edu.jo': 'Digital Horizons: Web & Mobile Innovation',
  'web3@fit.edu.jo': 'Digital Horizons: Web & Mobile Innovation'
};

let currentProject = null;
let criteriaValues = {};
let activeCategory = 'All';
let projects = [];

const rangeLabels = [
  { max:20,  label:'Poor — Does not meet basic requirements' },
  { max:40,  label:'Below Average — Significant gaps' },
  { max:60,  label:'Average — Meets requirements with notable gaps' },
  { max:75,  label:'Good — Solid execution with minor flaws' },
  { max:90,  label:'Very Good — Exceeds expectations' },
  { max:100, label:'Excellent — Outstanding quality' }
];

const TRACK_CRITERIA = {
  'RoboSphere: Robotics & Autonomous Drones': [
    { name: 'Presentation & Q&A Quality', sub: 'Robot design understanding, technical explanation', key: 'c1', max: 15 },
    { name: 'User Interface & Control Experience', sub: 'Control panel, monitoring, ease of use', key: 'c2', max: 15 },
    { name: 'Practical Applicability', sub: 'Industrial, medical, agricultural, educational use', key: 'c3', max: 15 },
    { name: 'Robotics Innovation Level', sub: 'Novel mechanisms, AI integration, unique solutions', key: 'c4', max: 15 },
    { name: 'System Speed & Responsiveness', sub: 'Real-time response and control accuracy', key: 'c5', max: 10 },
    { name: 'Hardware Integration & Electronics', sub: 'Sensors, actuators, embedded systems', key: 'c6', max: 10 },
    { name: 'Autonomous Capabilities', sub: 'Navigation, obstacle avoidance, decision making', key: 'c7', max: 10 },
    { name: 'Performance & Accuracy', sub: 'Stability, precision, mission success rate', key: 'c8', max: 10 }
  ],
  'Intelligence Frontier: AI & Machine Learning': [
    { name: 'Presentation and Q&A Quality', sub: 'Clear explanation, correct answers, strong understanding', key: 'c1', max: 15 },
    { name: 'User Interface & Experience', sub: 'Modern interface, cloud + database integration', key: 'c2', max: 15 },
    { name: 'Use of Modern AI/ML Technologies', sub: 'Uses latest models or explains why not', key: 'c3', max: 15 },
    { name: 'Model Accuracy & Performance', sub: 'High accuracy, reliable and correct predictions', key: 'c4', max: 15 },
    { name: 'AI Innovation Level', sub: 'Strong ensemble models or advanced ML methods, solving real limitations', key: 'c5', max: 15 },
    { name: 'Practical Applicability', sub: 'Useful real-world solution (e.g., smart pricing, industry use)', key: 'c6', max: 10 },
    { name: 'Data Quality and Processing', sub: 'Good dataset, clean, correct preprocessing, well-structured data', key: 'c7', max: 10 },
    { name: 'System Speed & Responsiveness', sub: 'Fast, real-time, optimized, smooth performance under load', key: 'c8', max: 5 }
  ],
  'CloudVerse: Smart IoT & Cloud Technologies': [
    { name: 'Use of Modern Technologies', sub: 'EEG, wearable devices, smart sensors, computer vision, edge computing, AI/ML', key: 'c1', max: 20 },
    { name: 'Presentation & Q&A Quality', sub: 'Clear explanation, correct answers, strong understanding of the complete system', key: 'c2', max: 15 },
    { name: 'User Interface & Experience', sub: 'Professional mobile/web application, dashboard quality, usability, visual design', key: 'c3', max: 15 },
    { name: 'Innovation Level', sub: 'Creative architecture, unique idea, integration of multiple technologies', key: 'c4', max: 15 },
    { name: 'Practical Applicability', sub: 'Real-world usefulness, industrial, healthcare, smart city, agriculture, education', key: 'c5', max: 10 },
    { name: 'Hardware & Device Integration', sub: 'Sensors, actuators, embedded systems, communication protocols, reliability', key: 'c6', max: 10 },
    { name: 'Cloud Infrastructure & Data Management', sub: 'Cloud services, databases, APIs, scalability, data handling', key: 'c7', max: 10 },
    { name: 'System Speed & Responsiveness', sub: 'Real-time monitoring, fast communication, smooth operation', key: 'c8', max: 5 }
  ],
  'CyberShield: Future of Cybersecurity': [
    { name: 'Presentation & Q&A Quality', sub: 'Security concepts explained clearly', key: 'c1', max: 15 },
    { name: 'User Interface & Experience', sub: 'Dashboard, monitoring, reporting tools', key: 'c2', max: 15 },
    { name: 'Practical Applicability', sub: 'Real-world cybersecurity relevance', key: 'c3', max: 15 },
    { name: 'Cybersecurity Innovation Level', sub: 'Novel defense mechanisms, advanced protection methods', key: 'c4', max: 15 },
    { name: 'System Speed & Responsiveness', sub: 'Detection and response efficiency', key: 'c5', max: 10 },
    { name: 'Security Analysis & Threat Detection', sub: 'Vulnerability assessment, attack detection', key: 'c6', max: 10 },
    { name: 'Use of Modern Cybersecurity Tech', sub: 'AI security, SIEM, Zero Trust, blockchain security', key: 'c7', max: 10 },
    { name: 'Effectiveness & Accuracy', sub: 'Detection accuracy, false-positive reduction, protection level', key: 'c8', max: 10 }
  ],
  'Digital Horizons: Web & Mobile Innovation': [
    { name: 'Presentation & Q&A Quality', sub: 'Clear explanation, system architecture understanding, strong defense of idea', key: 'c1', max: 15 },
    { name: 'UI/UX & Design Quality', sub: 'Modern mobile/web design, smooth navigation, 3D UI elements, animations', key: 'c2', max: 15 },
    { name: 'Practical Applicability', sub: 'Real-world problem solving (fashion, health, education, e-commerce, smart services)', key: 'c3', max: 15 },
    { name: 'AI System Design & Custom API', sub: 'Building AI logic/API from scratch, training/customizing models, inference pipeline', key: 'c4', max: 15 },
    { name: 'Problem-Solving Impact & Creativity', sub: 'Modern challenges like fashion AI, smart shopping, health diagnostics, real-time personalization', key: 'c5', max: 15 },
    { name: 'Backend, Database & Cloud Integration', sub: 'APIs, Firebase/Supabase, real-time databases, scalable architecture', key: 'c6', max: 10 },
    { name: 'Advanced Innovation & Tech Use', sub: '3D animations, AR/VR concepts, WebGL/Three.js, real-time analytics, smart interfaces', key: 'c7', max: 10 },
    { name: 'System Speed & Responsiveness', sub: 'Real-time updates, optimized APIs, fast loading, smooth interaction', key: 'c8', max: 5 }
  ]
};


const colorPalette = [
  ['#6b1a2a','#300a12'], ['#4a1020','#1f040b'], ['#8a2236','#400c19'],
  ['#5c1422','#29070e'], ['#7a1c2e','#380914']
];

window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (!session || session.user.email === 'admin@fit.edu.jo') {
    window.location.replace('index.html');
    return;
  }
  
  window.ACTIVE_USER_EMAIL = session.user.email;
  activeCategory = JUDGE_DIRECTORY[window.ACTIVE_USER_EMAIL] || 'All';
  
  document.getElementById('judge-id-display').textContent = window.ACTIVE_USER_EMAIL.split('@')[0].toUpperCase();
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.placeholder = `Search assigned track...`;
  
  const slider = document.getElementById('category-slider');
  if (slider) slider.style.display = 'none';

  const { data: teamsData, error } = await supabaseClient.from('teams').select('*');
  
  if (!error && teamsData) {
    projects = teamsData.map((t, index) => ({
      num: t.team_number || `P-${index}`,
      name: `Team ${t.team_number || index}`,
      category: (t.competition_track || '').trim(),
      supervisor: t.supervisor_name || 'Unknown',
      members: (t.students || '').split('\n').filter(s => s.trim() !== ''),
      abstract: 'Project details available during presentation.',
      colors: colorPalette[index % colorPalette.length],
      voted: false
    }));
  }

  const assignedProjects = activeCategory === 'All' ? projects : projects.filter(p => p.category === activeCategory);
  renderCards(assignedProjects);
  lockPastEvaluations();

  const video = document.getElementById('bg-video-stream');
  if (video) video.playbackRate = 0.5;
});

async function submitVoteToSupabase() {
  const btn = document.getElementById('submit-btn-element');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const payload = {
    judge_email: window.ACTIVE_USER_EMAIL,
    project_num: currentProject.num
  };

  const cleanCategory = currentProject.category.trim();
  const currentTrackCriteria = TRACK_CRITERIA[cleanCategory] || TRACK_CRITERIA['Digital Horizons: Web & Mobile Innovation'];
  
  currentTrackCriteria.forEach(c => {
    const rawKeyNum = c.key.replace('c', '');
    payload[`criterion_${rawKeyNum}`] = criteriaValues[c.key] !== undefined ? criteriaValues[c.key] : c.max;
  });

  const { error } = await supabaseClient.from('evaluations').insert([payload]);

  if (error) {
    if (error.code === '23505') alert("Already evaluated this project!");
    else alert("Database Error: " + error.message);
    btn.disabled = false;
    btn.textContent = 'Submit Evaluation';
  } else {
    finalizeSubmissionUI();
  }
}

async function lockPastEvaluations() {
  const { data, error } = await supabaseClient.from('evaluations').select('project_num').eq('judge_email', window.ACTIVE_USER_EMAIL);
  if (!error && data) {
    data.forEach(row => {
      const idx = projects.findIndex(p => p.num === row.project_num);
      if (idx !== -1) projects[idx].voted = true;
    });
  }
  filterProjects();
  updateProgress();
}

function getRangeLabel(val) { return rangeLabels.find(r => val <= r.max)?.label || rangeLabels[rangeLabels.length-1].label; }

function updateProgress() { 
  const categoryProjects = activeCategory === 'All' ? projects : projects.filter(p => p.category === activeCategory);
  const votedCount = categoryProjects.filter(p => p.voted).length;
  document.getElementById('nav-progress').textContent = `${votedCount} / ${categoryProjects.length} EVALUATED`; 
}

function filterProjects() {
  const query = document.getElementById('search-input').value.toLowerCase();
  renderCards(projects.filter(p => 
    (activeCategory === 'All' || p.category === activeCategory) && 
    (p.name.toLowerCase().includes(query) || p.num.toLowerCase().includes(query) || p.members.some(m => m.toLowerCase().includes(query)))
  ));
}

function renderCards(dataSet) {
  const trackElement = document.getElementById('cards-track');
  
  const isMobile = window.innerWidth <= 768;
  const cardWidth = isMobile ? (window.innerWidth * 0.8) : 350;
  const offsetCalc = (window.innerWidth / 2) - (cardWidth / 2);
  
  trackElement.style.paddingLeft = `${Math.max(20, offsetCalc)}px`;
  trackElement.style.paddingRight = `${Math.max(20, offsetCalc)}px`;

  if (dataSet.length === 0) {
    trackElement.innerHTML = `<div style="color:var(--sub); padding:4rem; font-family:'IBM Plex Mono'; text-align:center;">No projects found.</div>`;
    buildDots(0);
    return;
  }

  trackElement.innerHTML = dataSet.map(p => {
    const globalIdx = projects.findIndex(orig => orig.num === p.num);
    return `<div class="proj-card" onclick="openEval(${globalIdx})">
      <div class="proj-card-bg" style="background:linear-gradient(135deg,${p.colors[0]} 0%,${p.colors[1]} 100%)"></div>
      <div class="proj-card-overlay"></div>
      <div class="proj-card-content" style="padding: 2rem;">
        <div class="proj-card-tag">${p.category.split(':')[0]}</div>
        <div class="proj-card-name" style="font-size: 3.5rem; line-height: 1; margin-bottom: 1.25rem;">${p.num}</div>
        <div class="proj-card-members" style="flex: 1; display:flex; flex-direction:column; gap:8px; margin-bottom: 1.5rem;">
          ${p.members.map(m => `
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:6px; height:6px; border-radius:50%; background:var(--red); flex-shrink: 0;"></div>
              <span style="font-size:14px; color:rgba(255,255,255,0.95); font-weight: 500;">${m}</span>
            </div>
          `).join('')}
        </div>
        <button class="card-eval-btn">Evaluate Project</button>
        ${p.voted ? `<div class="voted-badge" style="display:block">✓ Evaluation Transmitted</div>` : ''}
      </div>
    </div>`;
  }).join('');
  buildDots(dataSet.length);
}

function buildDots(count) { document.getElementById('dots').innerHTML = Array.from({length: count}, (_, i) => `<div class="dot ${i===0?'active':''}" onclick="scrollToCard(${i})"></div>`).join(''); }

function scrollToCard(index) { const track = document.getElementById('cards-track'); if(track.children[index]) track.children[index].scrollIntoView({ behavior: 'smooth', inline: 'center' }); }

document.getElementById('cards-track').addEventListener('scroll', () => {
  const track = document.getElementById('cards-track');
  if(!track.children.length) return;
  const center = track.scrollLeft + (track.offsetWidth / 2);
  let closestIndex = 0, minDistance = Infinity;
  [...track.children].forEach((card, i) => {
    const dist = Math.abs(card.offsetLeft + (card.offsetWidth / 2) - center);
    if(dist < minDistance) { minDistance = dist; closestIndex = i; }
  });
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === closestIndex));
});

function openEval(idx) {
  currentProject = projects[idx];
  const p = currentProject;
  
  const cleanCategory = p.category.trim();
  const currentTrackCriteria = TRACK_CRITERIA[cleanCategory] || TRACK_CRITERIA['Digital Horizons: Web & Mobile Innovation'];
  
  currentTrackCriteria.forEach(c => criteriaValues[c.key] = c.max);
  
  const btn = document.getElementById('submit-btn-element');
  btn.disabled = false;
  btn.innerHTML = `Submit Evaluation <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 5l4 3-4 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  
  document.getElementById('exp-hero-bg').style.background = `linear-gradient(135deg,${p.colors[0]} 0%,${p.colors[1]} 100%)`;
  document.getElementById('exp-tag').textContent = cleanCategory.split(':')[0];
  document.getElementById('exp-num').textContent = 'TEAM';
  document.getElementById('exp-name').textContent = p.num;
  document.getElementById('exp-abstract').textContent = p.abstract;
  document.getElementById('exp-supervisor').textContent = p.supervisor;
  document.getElementById('exp-category').textContent = cleanCategory.split(':')[0];
  document.getElementById('exp-members').innerHTML = p.members.map(m => `<div class="member-item"><div class="member-dot"></div>${m}</div>`).join('');
  
  document.getElementById('criteria-list').innerHTML = currentTrackCriteria.map(c => `
    <div class="criterion">
      <div class="criterion-header" style="flex-direction: column; align-items: flex-start; gap: 4px; margin-bottom: 12px;">
        <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
          <span class="criterion-name">${c.name}</span>
          <span class="criterion-score-display" id="score-${c.key}">${c.max} / ${c.max}</span>
        </div>
        <span style="font-size: 12px; color: var(--sub); line-height: 1.4;">${c.sub}</span>
      </div>
      <input type="range" min="0" max="${c.max}" value="${c.max}" oninput="updateCriterion('${c.key}', this.value, ${c.max})" ${p.voted ? 'disabled' : ''}/>
      <div class="range-hint"><span>0</span><span>${Math.round(c.max/2)}</span><span>${c.max}</span></div>
    </div>
  `).join('');
  
  document.getElementById('voting-ui').style.display = p.voted ? 'none' : 'block';
  const lockedState = document.getElementById('locked-state');
  p.voted ? lockedState.classList.add('visible') : lockedState.classList.remove('visible');
  
  const ov = document.getElementById('expanded-overlay');
  ov.classList.add('visible');
  ov.scrollTop = 0;
}

function closeExpanded() { document.getElementById('expanded-overlay').classList.remove('visible'); }

function updateCriterion(key, val, max) {
  criteriaValues[key] = parseInt(val);
  document.getElementById(`score-${key}`).textContent = `${val} / ${max}`;
}

function finalizeSubmissionUI() {
  const idx = projects.indexOf(currentProject);
  if (idx !== -1) projects[idx].voted = true;
  document.getElementById('voting-ui').style.display = 'none';
  document.getElementById('locked-state').classList.add('visible');
  updateProgress();
  filterProjects();
  confetti();
}

function confetti() {
  const colors = ['#6b1a2a','#4a1020','#ffffff','#c31e2d'];
  const fragment = document.createDocumentFragment();
  
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    
    const size = 6 + Math.random() * 8;
    const startPos = Math.random() * 100;
    const duration = 1.5 + Math.random() * 2.5;
    const delay = Math.random() * 0.5;
    
    c.style.cssText = `
      left: ${startPos}vw;
      top: -10px;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation: confetti-fall ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}s forwards;
    `;
    
    fragment.appendChild(c);
  }
  
  document.body.appendChild(fragment);
  
  setTimeout(() => {
    document.querySelectorAll('.confetti-piece').forEach(el => el.remove());
  }, 4500);
}

window.addEventListener('resize', filterProjects);
