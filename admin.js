const SUPABASE_URL = 'https://bpddzqbuqdmvubuzerem.supabase.co';
const SUPABASE_KEY = 'sb_publishable_76CrGMLLkhNRoTaJy1xEWg_kbp5DSxm';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let rawEvaluations = [];
let adminProjects = [];
let currentCategory = 'Overall';
let projectStats = {}; 

window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (!session || session.user.email !== 'admin@fit.edu.jo') {
    window.location.replace('index.html');
    return;
  }

  const video = document.getElementById('bg-video-stream');
  if (video) video.playbackRate = 0.5;

  const { data: teamsData, error: teamsError } = await supabaseClient.from('teams').select('*');
  if (!teamsError && teamsData) {
    adminProjects = teamsData.map(t => {
      const studentList = (t.students || '').split(/\r?\n/).filter(s => s.trim() !== '');
      
      // THE INTERCEPTION LOGIC (With Strict Trimming)
      let trackCategory = (t.competition_track || '').trim();
      if (t.is_innovation === true) {
        trackCategory = 'Entrepreneurship and Innovation';
      }

      return {
        num: (t.team_number || 'UNKNOWN').trim(),
        name: `Team ${(t.team_number || 'UNKNOWN').trim()}`,
        category: trackCategory.trim(), // تم إضافة .trim() هنا لضمان عدم وجود مسافات وهمية
        supervisor: (t.supervisor_name || 'Unknown').trim(),
        membersInline: studentList.join('، ') || 'Unknown',
        membersList: studentList.map(s => `• ${s}`).join('<br>') || 'Unknown' 
      };
    });
  }

  generateTabs();

  const { data: evalsData, error: evalsError } = await supabaseClient
    .from('evaluations')
    .select('project_num, total_score');
    
  if (!evalsError && evalsData) {
    rawEvaluations = evalsData;
    buildInitialCache();
    renderDashboard();
  }

  supabaseClient
    .channel('evaluations-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'evaluations' }, (payload) => {
        if (payload.new && payload.new.project_num) {
          const pNum = payload.new.project_num;
          const tScore = payload.new.total_score || 0;
          
          if (!projectStats[pNum]) projectStats[pNum] = { totalScore: 0, voteCount: 0 };
          projectStats[pNum].totalScore += tScore;
          projectStats[pNum].voteCount += 1;
          
          renderDashboard();
        }
      }
    )
    .subscribe();
});

function buildInitialCache() {
  projectStats = {};
  rawEvaluations.forEach(record => {
    const pNum = record.project_num;
    const tScore = record.total_score || 0; 
    
    if (!projectStats[pNum]) projectStats[pNum] = { totalScore: 0, voteCount: 0 };
    projectStats[pNum].totalScore += tScore;
    projectStats[pNum].voteCount += 1;
  });
}

function generateTabs() {
  const tabsContainer = document.getElementById('category-tabs');
  if (!tabsContainer) return;
  
  // استخراج الفئات الفريدة مع ضمان تنظيف المسافات الزائدة مرة أخرى كإجراء احترازي
  const uniqueCategories = [...new Set(adminProjects.map(p => p.category.trim()))];
  const allTabs = ['Overall', ...uniqueCategories];
  
  tabsContainer.innerHTML = allTabs.map(cat => {
    const shortName = cat.split(':')[0].trim();
    return `<div class="tab ${cat === 'Overall' ? 'active' : ''}" onclick="setTab('${cat}', this)">${shortName}</div>`;
  }).join('');
}

window.setTab = function(category, element) {
  currentCategory = category;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  element.classList.add('active');
  
  const label = document.getElementById('champion-category-label');
  const shortName = category.split(':')[0].trim();
  if(label) label.innerHTML = category === 'Overall' ? 'Overall Ranking<br>Grand Champion' : `${shortName} Ranking<br>Category Leader`;
  
  renderDashboard();
};

function renderDashboard() {
  let leaderboardData = adminProjects.map(project => {
    const stats = projectStats[project.num];
    const finalScore = stats && stats.voteCount > 0 ? (stats.totalScore / stats.voteCount) : 0;

    return { 
      num: project.num, 
      category: project.category, 
      supervisor: project.supervisor,
      membersInline: project.membersInline,
      membersList: project.membersList,
      score: Number(finalScore.toFixed(2)) 
    };
  });

  if (currentCategory !== 'Overall') {
    // مطابقة المسار بدقة مع تجاهل المسافات
    leaderboardData = leaderboardData.filter(p => p.category.trim() === currentCategory.trim());
  }

  leaderboardData.sort((a, b) => b.score - a.score);

  renderTable(leaderboardData);
  renderChampionCard(leaderboardData);
}

function renderTable(data) {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  if (data.length === 0) return tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--sub); padding:3rem;">No projects found.</td></tr>`;

  tbody.innerHTML = data.map((item, index) => {
    return `<tr>
      <td class="rank">#${index + 1}</td>
      <td>
        <div style="display:flex; align-items:flex-start; gap: 1rem;">
          <span class="avatar-placeholder" style="flex-shrink:0; margin-top: 4px;">${item.membersInline.charAt(0).toUpperCase()}</span> 
          <div style="line-height:1.7; direction: rtl; text-align: right; width: 100%; color: rgba(255,255,255,0.95); font-size: 14px;">
            ${item.membersList}
          </div>
        </div>
      </td>
      <td>${item.num}</td>
      <td style="color: rgba(255,255,255,0.8); font-size: 13px; direction: rtl;">${item.supervisor}</td>
      <td>${item.category.split(':')[0].trim()}</td>
      <td class="score-cell">${item.score}</td>
    </tr>`;
  }).join('');
}

function renderChampionCard(data) {
  const champName = document.getElementById('champ-name');
  const champProject = document.getElementById('champ-project');
  const runnerUpsContainer = document.getElementById('runner-ups-list');

  if (!champName || !champProject || !runnerUpsContainer) return;

  if (data.length === 0 || data[0].score === 0) {
    champName.textContent = "Awaiting Data";
    champProject.textContent = "...";
    runnerUpsContainer.innerHTML = "";
    return;
  }

  champName.textContent = data[0].membersInline; 
  champName.style.fontSize = data[0].membersInline.length > 40 ? '1.4rem' : '2rem'; 
  champProject.textContent = data[0].num;

  runnerUpsContainer.innerHTML = data.slice(1, 4).filter(item => item.score > 0).map((item, index) => {
    return `<div class="runner-up-item" style="display: flex; gap: 10px; align-items: center;">
      <div style="display:flex; align-items:center; overflow:hidden;">
        <span class="runner-up-rank" style="flex-shrink:0;">#${index + 2}</span> 
        <span style="color:rgba(255,255,255,0.85); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:left; direction:rtl;" title="${item.membersInline}">
          ${item.membersInline}
        </span>
      </div>
      <span class="runner-up-score" style="flex-shrink:0;">${item.score}</span>
    </div>`;
  }).join('');
}

window.showTopResultsModal = function() {
  const existingOverlay = document.getElementById('results-overlay');
  if (existingOverlay) existingOverlay.remove();

  const allScores = adminProjects.map(project => {
    const stats = projectStats[project.num];
    const finalScore = stats && stats.voteCount > 0 ? (stats.totalScore / stats.voteCount) : 0;
    return { ...project, score: Number(finalScore.toFixed(2)) };
  });

  const uniqueCategories = [...new Set(adminProjects.map(p => p.category.trim()))];
  const allCategories = ['Overall', ...uniqueCategories];

  let modalContent = `
    <style id="modal-mobile-styles">
      .modal-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(10,6,8,0.95); backdrop-filter: blur(16px); overflow-y: auto; padding: 2rem; display: flex; flex-direction: column; align-items: center; font-family: 'Inter', sans-serif; }
      .modal-container { width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 3rem; padding-bottom: 4rem; }
      .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem; }
      .modal-title { font-family: 'Barlow Condensed', sans-serif; font-size: 2.5rem; text-transform: uppercase; color: #fff; margin: 0; }
      .modal-close-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-family: 'IBM Plex Mono', monospace; font-size: 12px; text-transform: uppercase; transition: all 0.2s ease; }
      .modal-close-btn:hover { background: rgba(255,255,255,0.1); }
      .track-container { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
      .track-title { font-family: 'IBM Plex Mono', monospace; font-size: 14px; color: var(--maroon, #c31e2d); text-transform: uppercase; letter-spacing: 1px; margin: 0; }
      
      /* Desktop Grid Layout */
      .result-card { border-radius: 12px; padding: 1.25rem; display: grid; grid-template-columns: 60px 1fr 80px; gap: 1.5rem; align-items: center; }
      .result-rank { font-family: 'Barlow Condensed', sans-serif; font-size: 2.5rem; font-weight: 900; text-align: center; line-height: 1; }
      .result-score { font-family: 'Barlow Condensed', sans-serif; font-size: 2.2rem; font-weight: 700; color: #fff; text-align: right; }
      .result-meta { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
      .result-team-id { font-family: 'IBM Plex Mono', monospace; font-size: 14px; color: #fff; flex-shrink: 0; }
      .result-supervisor { font-size: 12px; color: rgba(255,255,255,0.5); direction: rtl; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .result-members { font-size: 15px; color: rgba(255,255,255,0.9); direction: rtl; text-align: right; line-height: 1.5; }

      /* Mobile Layout Overrides */
      @media (max-width: 768px) {
        .modal-overlay { padding: 1rem; }
        .modal-container { gap: 1.5rem; padding-bottom: 2rem; }
        .modal-title { font-size: 1.8rem; }
        .track-container { padding: 1rem; }
        .track-title { font-size: 12px; }
        .result-card { grid-template-columns: 35px 1fr 60px; gap: 1rem; padding: 1rem; }
        .result-rank { font-size: 1.6rem; }
        .result-score { font-size: 1.6rem; }
        
        .result-meta { flex-direction: column; align-items: flex-end; gap: 4px; }
        .result-team-id { font-size: 12px; order: 2; }
        .result-supervisor { font-size: 11px; order: 1; white-space: normal; text-align: right;}
        .result-members { font-size: 13px; line-height: 1.4; }
      }
    </style>
    
    <div id="results-overlay" class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h1 class="modal-title">Official Top 3 Results</h1>
          <button onclick="document.getElementById('results-overlay').remove()" class="modal-close-btn">Close</button>
        </div>
  `;

  allCategories.forEach((cat) => {
    let catProjects = cat === 'Overall' ? [...allScores] : allScores.filter(p => p.category.trim() === cat.trim());
    catProjects.sort((a, b) => b.score - a.score);
    const top3 = catProjects.slice(0, 3).filter(p => p.score > 0);
    
    if (top3.length === 0) return;

    const title = cat === 'Overall' ? 'GRAND CHAMPIONS — OVERALL' : `TRACK: ${cat}`;

    modalContent += `
      <div class="track-container">
        <h2 class="track-title">${title}</h2>
        <div style="display: flex; flex-direction: column; gap: 10px;">
    `;

    top3.forEach((p, i) => {
      const isGold = i === 0;
      const bg = isGold ? 'linear-gradient(90deg, rgba(107,26,42,0.6) 0%, rgba(255,255,255,0.02) 100%)' : 'rgba(255,255,255,0.03)';
      const border = isGold ? '1px solid rgba(195,30,45,0.4)' : '1px solid rgba(255,255,255,0.05)';
      const rankColor = isGold ? '#fff' : 'rgba(255,255,255,0.5)';

      modalContent += `
          <div class="result-card" style="background: ${bg}; border: ${border};">
            <div class="result-rank" style="color: ${rankColor};">#${i + 1}</div>
            <div style="display: flex; flex-direction: column; gap: 8px; min-width: 0;">
              <div class="result-meta">
                <span class="result-team-id">${p.num}</span>
                <span class="result-supervisor">${p.supervisor}</span>
              </div>
              <div class="result-members">${p.membersInline}</div>
            </div>
            <div class="result-score">${p.score}</div>
          </div>
      `;
    });

    modalContent += `
        </div>
      </div>
    `;
  });

  modalContent += `
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalContent);
};
