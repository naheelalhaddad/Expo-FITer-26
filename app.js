const SUPABASE_URL = 'https://bpddzqbuqdmvubuzerem.supabase.co';
const SUPABASE_KEY = 'sb_publishable_76CrGMLLkhNRoTaJy1xEWg_kbp5DSxm';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const JUDGE_DIRECTORY = {
  // RoboSphere: Robotics & Autonomous Drones
  'robo1@fit.edu': 'RoboSphere: Robotics & Autonomous Drones',
  'robo2@fit.edu': 'RoboSphere: Robotics & Autonomous Drones',

  // Intelligence Frontier: AI & Machine Learning
  'ai1@fit.edu': 'Intelligence Frontier: AI & Machine Learning',
  'ai2@fit.edu': 'Intelligence Frontier: AI & Machine Learning',
  'ai3@fit.edu': 'Intelligence Frontier: AI & Machine Learning',

  // CloudVerse: Smart IoT & Cloud Technologies
  'cloud1@fit.edu': 'CloudVerse: Smart IoT & Cloud Technologies',
  'cloud2@fit.edu': 'CloudVerse: Smart IoT & Cloud Technologies',

  // CyberShield: Future of Cybersecurity
  'cyber1@fit.edu': 'CyberShield: Future of Cybersecurity',
  'cyber2@fit.edu': 'CyberShield: Future of Cybersecurity',

  // Digital Horizons: Web & Mobile Innovation
  'web1@fit.edu': 'Digital Horizons: Web & Mobile Innovation',
  'web2@fit.edu': 'Digital Horizons: Web & Mobile Innovation',
  'web3@fit.edu': 'Digital Horizons: Web & Mobile Innovation'
};

let currentProject = null;
let overallValue = 75;
let criteriaValues = {};
let activeCategory = 'All';

const projects = [
  { num:'P-001', name:'[Project Name 1]', category:'[Category 1]', supervisor:'[Supervisor Name]', members:['[Member 1]','[Member 2]','[Member 3]'], abstract:'[Project abstract placeholder]', colors:['#6b1a2a','#300a12'], voted: false },
  { num:'P-002', name:'[Project Name 2]', category:'[Category 2]', supervisor:'[Supervisor Name]', members:['[Member 1]','[Member 2]','[Member 3]'], abstract:'[Project abstract placeholder]', colors:['#4a1020','#1f040b'], voted: false },
  { num:'P-003', name:'[Project Name 3]', category:'[Category 3]', supervisor:'[Supervisor Name]', members:['[Member 1]','[Member 2]','[Member 3]'], abstract:'[Project abstract placeholder]', colors:['#8a2236','#400c19'], voted: false },
  { num:'P-004', name:'[Project Name 4]', category:'[Category 4]', supervisor:'[Supervisor Name]', members:['[Member 1]','[Member 2]','[Member 3]'], abstract:'[Project abstract placeholder]', colors:['#5c1422','#29070e'], voted: false },
  { num:'P-005', name:'[Project Name 5]', category:'[Category 5]', supervisor:'[Supervisor Name]', members:['[Member 1]','[Member 2]','[Member 3]'], abstract:'[Project abstract placeholder]', colors:['#7a1c2e','#380914'], voted: false }
];

const rangeLabels = [
  { max:20,  label:'Poor — Does not meet basic requirements' },
  { max:40,  label:'Below Average — Significant gaps in execution' },
  { max:60,  label:'Average — Meets some requirements with notable gaps' },
  { max:75,  label:'Good — Solid project with minor areas for improvement' },
  { max:90,  label:'Very Good — Exceeds expectations in most areas' },
  { max:100, label:'Excellent — Outstanding, exceptional quality' }
];

const criteria = [
  { name:'[Criterion 1]', key:'c1' },
  { name:'[Criterion 2]', key:'c2' },
  { name:'[Criterion 3]', key:'c3' }
];

window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  
  window.ACTIVE_USER_EMAIL = session ? session.user.email : 'test_judge@asu.edu.jo';
  activeCategory = JUDGE_DIRECTORY[window.ACTIVE_USER_EMAIL] || 'All';
  
  document.getElementById('judge-id-display').textContent = window.ACTIVE_USER_EMAIL.split('@')[0].toUpperCase();
  document.getElementById('search-input').placeholder = `Search ${activeCategory} projects...`;
  
  const slider = document.getElementById('category-slider');
  if (slider) slider.style.display = 'none';

  renderCards(projects.filter(p => p.category === activeCategory));
  updateProgress();
  lockPastEvaluations();

  const video = document.getElementById('bg-video-stream');
  if (video) video.playbackRate = 0.5;
});

async function submitVoteToSupabase() {
  const btn = document.getElementById('submit-btn-element');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const { error } = await supabaseClient.from('evaluations').insert([{
      judge_email:   window.ACTIVE_USER_EMAIL,
      project_num:   currentProject.num,
      criterion_1:   criteriaValues['c1'] || 75,
      criterion_2:   criteriaValues['c2'] || 75,
      criterion_3:   criteriaValues['c3'] || 75,
      overall_score: overallValue
  }]);

  if (error) {
    if (error.code === '23505') alert("Already evaluated this project!");
    else alert("Error: " + error.message);
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
  const categoryProjects = projects.filter(p => p.category === activeCategory);
  const votedCount = categoryProjects.filter(p => p.voted).length;
  document.getElementById('nav-progress').textContent = `${votedCount} / ${categoryProjects.length} EVALUATED`; 
}

function filterProjects() {
  const query = document.getElementById('search-input').value.toLowerCase();
  renderCards(projects.filter(p => 
    p.category === activeCategory && 
    (p.name.toLowerCase().includes(query) || p.num.toLowerCase().includes(query))
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
    trackElement.innerHTML = `<div style="color:var(--sub); padding:4rem; font-family:'IBM Plex Mono'; text-align:center;">No projects found for your assigned category.</div>`;
    buildDots(0);
    return;
  }

  trackElement.innerHTML = dataSet.map(p => {
    const globalIdx = projects.findIndex(orig => orig.num === p.num);
    return `<div class="proj-card" onclick="openEval(${globalIdx})">
      <div class="proj-card-bg" style="background:linear-gradient(135deg,${p.colors[0]} 0%,${p.colors[1]} 100%)"></div>
      <div class="proj-card-overlay"></div>
      <div class="proj-card-content">
        <div class="proj-card-tag">${p.category}</div>
        <div class="proj-card-num">${p.num}</div>
        <div class="proj-card-name">${p.name}</div>
        <div class="proj-card-members">${p.members.slice(0,3).join(' · ')}</div>
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
  overallValue = 75;
  criteria.forEach(c => criteriaValues[c.key] = 75);
  const p = currentProject;
  document.getElementById('exp-hero-bg').style.background = `linear-gradient(135deg,${p.colors[0]} 0%,${p.colors[1]} 100%)`;
  document.getElementById('exp-tag').textContent = p.category;
  document.getElementById('exp-num').textContent = p.num;
  document.getElementById('exp-name').textContent = p.name;
  document.getElementById('exp-abstract').textContent = p.abstract;
  document.getElementById('exp-supervisor').textContent = p.supervisor;
  document.getElementById('exp-category').textContent = p.category;
  document.getElementById('exp-members').innerHTML = p.members.map(m => `<div class="member-item"><div class="member-dot"></div>${m}</div>`).join('');
  document.getElementById('criteria-list').innerHTML = criteria.map(c => `<div class="criterion"><div class="criterion-header"><span class="criterion-name">${c.name}</span><span class="criterion-score-display" id="score-${c.key}">75 / 100</span></div><input type="range" min="0" max="100" value="75" oninput="updateCriterion('${c.key}', this.value)" ${p.voted ? 'disabled' : ''}/><div class="range-hint"><span>0</span><span>50</span><span>100</span></div><div class="range-label" id="label-${c.key}">${getRangeLabel(75)}</div></div>`).join('');
  document.getElementById('overall-num').textContent = p.voted ? 'LOCKED' : 75;
  document.getElementById('overall-slider').value = 75;
  document.getElementById('overall-slider').disabled = p.voted;
  document.getElementById('overall-range-label').textContent = getRangeLabel(75);
  document.getElementById('voting-ui').style.display = p.voted ? 'none' : 'block';
  const lockedState = document.getElementById('locked-state');
  p.voted ? lockedState.classList.add('visible') : lockedState.classList.remove('visible');
  if(p.voted) document.getElementById('locked-score-text').textContent = "Locked in Database";
  const ov = document.getElementById('expanded-overlay');
  ov.classList.add('visible');
  ov.scrollTop = 0;
}

function closeExpanded() { document.getElementById('expanded-overlay').classList.remove('visible'); }

function updateCriterion(key, val) {
  criteriaValues[key] = parseInt(val);
  document.getElementById(`score-${key}`).textContent = `${val} / 100`;
  document.getElementById(`label-${key}`).textContent = getRangeLabel(parseInt(val));
}

function updateOverall(val) {
  overallValue = parseInt(val);
  document.getElementById('overall-num').textContent = val;
  document.getElementById('overall-range-label').textContent = getRangeLabel(parseInt(val));
}

function finalizeSubmissionUI() {
  const idx = projects.indexOf(currentProject);
  if (idx !== -1) projects[idx].voted = true;
  document.getElementById('voting-ui').style.display = 'none';
  document.getElementById('locked-score-text').textContent = `Overall Score: ${overallValue} / 100`;
  document.getElementById('locked-state').classList.add('visible');
  updateProgress();
  filterProjects();
  confetti();
}

function confetti() {
  const colors = ['#6b1a2a','#4a1020','#ffffff','#c31e2d'];
  for (let i = 0; i < 60; i++) {
    setTimeout(() => {
      const c = document.createElement('div');
      c.className = 'confetti-piece';
      const size = 5 + Math.random() * 8;
      c.style.cssText = `position:fixed;z-index:1000;left:${15+Math.random()*70}%;top:30%;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};animation:confetti-fall ${1.5+Math.random()*2}s cubic-bezier(.33,.66,.66,1) forwards;`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4000);
    }, i * 25);
  }
}

window.addEventListener('resize', filterProjects);
