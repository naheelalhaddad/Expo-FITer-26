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

  // 1. Fetch Master List & Extract ALL Members
  const { data: teamsData, error: teamsError } = await supabaseClient.from('teams').select('*');
  if (!teamsError && teamsData) {
    adminProjects = teamsData.map(t => {
      const studentList = (t.students || '').split('\n').filter(s => s.trim() !== '');
      return {
        num: t.team_number || 'UNKNOWN',
        name: `Team ${t.team_number || 'UNKNOWN'}`,
        category: (t.competition_track || '').trim(),
        lead: studentList[0] || 'Unknown',
        members: studentList.join('، ') || 'Unknown' // Arabic comma integration
      };
    });
  }

  generateTabs();

  // 2. Fetch Cached Data
  const { data: evalsData, error: evalsError } = await supabaseClient
    .from('evaluations')
    .select('project_num, total_score');
    
  if (!evalsError && evalsData) {
    rawEvaluations = evalsData;
    buildInitialCache();
    renderDashboard();
  }

  // 3. Realtime Updates
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
  
  const uniqueCategories = [...new Set(adminProjects.map(p => p.category))];
  const allTabs = ['Overall', ...uniqueCategories];
  
  tabsContainer.innerHTML = allTabs.map(cat => {
    const shortName = cat.split(':')[0];
    return `<div class="tab ${cat === 'Overall' ? 'active' : ''}" onclick="setTab('${cat}', this)">${shortName}</div>`;
  }).join('');
}

window.setTab = function(category, element) {
  currentCategory = category;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  element.classList.add('active');
  
  const label = document.getElementById('champion-category-label');
  const shortName = category.split(':')[0];
  if(label) label.innerHTML = category === 'Overall' ? 'Overall Ranking<br>Grand Champion' : `${shortName} Ranking<br>Category Leader`;
  
  renderDashboard();
};

function renderDashboard() {
  let leaderboardData = adminProjects.map(project => {
    const stats = projectStats[project.num];
    const finalScore = stats && stats.voteCount > 0 ? (stats.totalScore / stats.voteCount) : 0;

    return { 
      num: project.num, 
      name: project.name, 
      category: project.category, 
      lead: project.lead, 
      members: project.members,
      score: Number(finalScore.toFixed(2)) 
    };
  });

  if (currentCategory !== 'Overall') {
    leaderboardData = leaderboardData.filter(p => p.category === currentCategory);
  }

  leaderboardData.sort((a, b) => b.score - a.score);

  renderTable(leaderboardData);
  renderChampionCard(leaderboardData);
}

function renderTable(data) {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  if (data.length === 0) return tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--sub); padding:3rem;">No projects found.</td></tr>`;

  tbody.innerHTML = data.map((item, index) => {
    return `<tr>
      <td class="rank">#${index + 1}</td>
      <td>
        <div style="display:flex; align-items:center;">
          <span class="avatar-placeholder" style="flex-shrink:0;">${item.lead.charAt(0).toUpperCase()}</span> 
          <span style="white-space:normal; line-height:1.4; padding-right:1rem;">${item.members}</span>
        </div>
      </td>
      <td>${item.num}</td>
      <td>${item.category.split(':')[0]}</td>
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

  // Uses lead strictly for the clean champion card visual, all members in table/PDF
  champName.textContent = data[0].lead; 
  champProject.textContent = data[0].num;

  runnerUpsContainer.innerHTML = data.slice(1, 4).filter(item => item.score > 0).map((item, index) => {
    return `<div class="runner-up-item">
      <div><span class="runner-up-rank">#${index + 2}</span> <span style="color:rgba(255,255,255,0.85);">${item.lead}</span></div>
      <span class="runner-up-score">${item.score}</span>
    </div>`;
  }).join('');
}

// === CANVAS HTML-TO-PDF ENGINE (ARABIC COMPATIBLE) ===
window.exportToPDF = function() {
  const container = document.createElement('div');
  container.style.padding = '40px';
  container.style.fontFamily = "'Inter', sans-serif, Arial";
  container.style.background = '#ffffff';
  container.style.color = '#000000';
  container.style.width = '1000px'; 
  
  let htmlContent = `<h1 style="text-align:center; color:#6b1a2a; margin-bottom:40px; font-size:32px;">Expo FITers GP - Official Top 5 Results</h1>`;

  const allScores = adminProjects.map(project => {
    const stats = projectStats[project.num];
    const finalScore = stats && stats.voteCount > 0 ? (stats.totalScore / stats.voteCount) : 0;
    return { ...project, score: Number(finalScore.toFixed(2)) };
  });

  const uniqueCategories = [...new Set(adminProjects.map(p => p.category))];
  const allCategories = ['Overall', ...uniqueCategories];

  allCategories.forEach((cat) => {
    let catProjects = cat === 'Overall' ? [...allScores] : allScores.filter(p => p.category === cat);
    catProjects.sort((a, b) => b.score - a.score);
    const top5 = catProjects.slice(0, 5);

    if (top5.length === 0) return;

    const title = cat === 'Overall' ? 'GRAND CHAMPIONS (OVERALL)' : `TRACK: ${cat}`;

    htmlContent += `
      <div style="page-break-inside: avoid; margin-bottom: 50px;">
        <h2 style="color:#222; border-bottom:3px solid #6b1a2a; padding-bottom:8px; margin-bottom:20px; font-size:24px;">${title}</h2>
        <table style="width:100%; border-collapse: collapse; text-align: left; font-size: 16px;">
          <thead>
            <tr style="background-color: #6b1a2a; color: #fff;">
              <th style="padding: 14px; border: 1px solid #ddd; width: 8%;">Rank</th>
              <th style="padding: 14px; border: 1px solid #ddd; width: 12%;">Team ID</th>
              <th style="padding: 14px; border: 1px solid #ddd; width: 68%; text-align: right;">Team Members</th>
              <th style="padding: 14px; border: 1px solid #ddd; width: 12%;">Score</th>
            </tr>
          </thead>
          <tbody>
            ${top5.map((p, i) => `
              <tr style="background-color: ${i % 2 === 0 ? '#fcfcfc' : '#ffffff'};">
                <td style="padding: 14px; border: 1px solid #ddd; font-weight:bold;">#${i + 1}</td>
                <td style="padding: 14px; border: 1px solid #ddd;">${p.num}</td>
                <td style="padding: 14px; border: 1px solid #ddd; direction: rtl; text-align: right; font-weight: 600;">${p.members}</td>
                <td style="padding: 14px; border: 1px solid #ddd; font-weight:bold; color: #6b1a2a;">${p.score}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  });

  container.innerHTML = htmlContent;
  
  // Hide off-screen during Canvas generation
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  const btn = document.querySelector('.btn-export');
  const originalText = btn.textContent;
  btn.textContent = "GENERATING PDF...";
  btn.disabled = true;

  const opt = {
    margin:       [15, 15, 15, 15],
    filename:     'ExpoFITers_Top5_Results.pdf',
    image:        { type: 'jpeg', quality: 1 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(container).save().then(() => {
    document.body.removeChild(container);
    btn.textContent = originalText;
    btn.disabled = false;
  });
};
