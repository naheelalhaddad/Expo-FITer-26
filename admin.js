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
      return {
        num: t.team_number || 'UNKNOWN',
        name: `Team ${t.team_number || 'UNKNOWN'}`,
        category: (t.competition_track || '').trim(),
        supervisor: t.supervisor_name || 'Unknown',
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
      category: project.category, 
      supervisor: project.supervisor,
      membersInline: project.membersInline,
      membersList: project.membersList,
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

window.exportToPDF = function() {
  const btn = document.querySelector('.btn-export');
  const originalText = btn.textContent;
  btn.textContent = "GENERATING PDF...";
  btn.disabled = true;

  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    top: -9999px;
    left: -9999px;
    width: 794px;
    background-color: #ffffff;
    padding: 40px;
    box-sizing: border-box;
    font-family: Arial, sans-serif;
  `;

  const allScores = adminProjects.map(project => {
    const stats = projectStats[project.num];
    const finalScore = stats && stats.voteCount > 0 ? (stats.totalScore / stats.voteCount) : 0;
    return { ...project, score: Number(finalScore.toFixed(2)) };
  });

  const uniqueCategories = [...new Set(adminProjects.map(p => p.category))];
  const allCategories = ['Overall', ...uniqueCategories];

  let htmlContent = `
    <h1 style="
      text-align: center;
      color: #6b1a2a;
      margin: 0 0 30px 0;
      font-size: 24px;
      text-transform: uppercase;
      font-family: Arial, sans-serif;
    ">Expo FITers GP — Official Top 3 Results</h1>
  `;

  allCategories.forEach((cat) => {
    let catProjects = cat === 'Overall' ? [...allScores] : allScores.filter(p => p.category === cat);
    catProjects.sort((a, b) => b.score - a.score);
    const top3 = catProjects.slice(0, 3).filter(p => p.score > 0);

    if (top3.length === 0) return;

    const title = cat === 'Overall' ? 'GRAND CHAMPIONS (OVERALL)' : `TRACK: ${cat}`;

    htmlContent += `
      <div style="margin-bottom: 36px; page-break-inside: avoid;">
        <h2 style="
          color: #222;
          border-bottom: 3px solid #6b1a2a;
          padding-bottom: 5px;
          margin: 0 0 14px 0;
          font-size: 16px;
          font-family: Arial, sans-serif;
        ">${title}</h2>
        <table style="
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        ">
          <colgroup>
            <col style="width: 7%;" />
            <col style="width: 10%;" />
            <col style="width: 48%;" />
            <col style="width: 22%;" />
            <col style="width: 13%;" />
          </colgroup>
          <thead>
            <tr>
              <th style="${thStyle()}text-align: center;">Rank</th>
              <th style="${thStyle()}text-align: center;">Team ID</th>
              <th style="${thStyle()}text-align: center;">Team Members</th>
              <th style="${thStyle()}text-align: center;">Supervisor</th>
              <th style="${thStyle()}text-align: center;">Score</th>
            </tr>
          </thead>
          <tbody>
    `;

    top3.forEach((p, i) => {
      const bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
      const members = (p.students || p.membersInline || '')
        .split('،')
        .map(s => s.trim())
        .filter(Boolean);

      const membersCellContent = members.length > 0
        ? members.map(m => `
            <div style="
              direction: rtl;
              unicode-bidi: bidi-override;
              text-align: right;
              font-family: Arial, sans-serif;
              font-size: 12px;
              line-height: 1.7;
              color: #000;
            ">${m}</div>
          `).join('')
        : `<div style="direction:rtl;text-align:right;font-family:Arial,sans-serif;font-size:12px;">${p.membersInline}</div>`;

      const supervisorContent = `
        <div style="
          direction: rtl;
          unicode-bidi: bidi-override;
          text-align: center;
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #000;
        ">${p.supervisor}</div>
      `;

      htmlContent += `
        <tr style="background-color: ${bg};">
          <td style="${tdStyle()}text-align:center; font-weight:bold; color:#6b1a2a; font-size:14px;">#${i + 1}</td>
          <td style="${tdStyle()}text-align:center; color:#000;">${p.num}</td>
          <td style="${tdStyle()}padding:8px 10px;">${membersCellContent}</td>
          <td style="${tdStyle()}padding:8px 6px;">${supervisorContent}</td>
          <td style="${tdStyle()}text-align:center; font-weight:bold; color:#6b1a2a; font-size:14px;">${p.score}</td>
        </tr>
      `;
    });

    htmlContent += `</tbody></table></div>`;
  });

  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  const opt = {
    margin:      0,
    filename:    'ExpoFITers_Top3_Results.pdf',
    image:       { type: 'jpeg', quality: 1 },
    html2canvas: { scale: 2, useCORS: true, width: 794, windowWidth: 794, logging: false },
    jsPDF:       { unit: 'px', format: [794, 1123], orientation: 'portrait' }
  };

  html2pdf().set(opt).from(container).save().then(() => {
    document.body.removeChild(container);
    btn.textContent = originalText;
    btn.disabled = false;
  }).catch(err => {
    console.error("PDF Export Error:", err);
    document.body.removeChild(container);
    btn.textContent = "ERROR - TRY AGAIN";
    setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 3000);
  });
};

function thStyle() {
  return `
    background-color: #6b1a2a;
    color: white;
    padding: 9px 8px;
    border: 1px solid #ccc;
    font-family: Arial, sans-serif;
    font-size: 13px;
    font-weight: bold;
  `;
}

function tdStyle() {
  return `
    padding: 8px;
    border: 1px solid #ddd;
    overflow-wrap: break-word;
    word-break: break-word;
    vertical-align: top;
  `;
}

