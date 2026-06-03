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
  const allScores = adminProjects.map(project => {
    const stats = projectStats[project.num];
    const finalScore = stats && stats.voteCount > 0 ? (stats.totalScore / stats.voteCount) : 0;
    return { ...project, score: Number(finalScore.toFixed(2)) };
  });

  const uniqueCategories = [...new Set(adminProjects.map(p => p.category))];
  const allCategories = ['Overall', ...uniqueCategories];

  let tablesHTML = '';

  allCategories.forEach((cat) => {
    let catProjects = cat === 'Overall' ? [...allScores] : allScores.filter(p => p.category === cat);
    catProjects.sort((a, b) => b.score - a.score);
    const top3 = catProjects.slice(0, 3).filter(p => p.score > 0);
    if (top3.length === 0) return;

    const title = cat === 'Overall' ? 'GRAND CHAMPIONS — OVERALL' : `TRACK: ${cat}`;

    const rows = top3.map((p, i) => {
      const members = p.membersInline
        .split('،')
        .map(s => s.trim())
        .filter(Boolean)
        .map(m => `<div class="member-name">${m}</div>`)
        .join('');

      return `
        <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td class="cell-center rank-cell">#${i + 1}</td>
          <td class="cell-center">${p.num}</td>
          <td class="cell-rtl members-cell">${members}</td>
          <td class="cell-rtl">${p.supervisor}</td>
          <td class="cell-center score-cell">${p.score}</td>
        </tr>
      `;
    }).join('');

    tablesHTML += `
      <div class="section">
        <h2 class="section-title">${title}</h2>
        <table>
          <thead>
            <tr>
              <th style="width:7%">Rank</th>
              <th style="width:10%">Team ID</th>
              <th style="width:48%">Team Members</th>
              <th style="width:22%">Supervisor</th>
              <th style="width:13%">Score</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  });

  const printWindow = window.open('', '_blank', 'width=900,height=700');

  printWindow.document.write(`<!DOCTYPE html>
<html lang="ar" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <title>Expo FITers GP — Top 3 Results</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Cairo', Arial, sans-serif;
      background: #fff;
      color: #111;
      padding: 40px;
    }

    h1 {
      text-align: center;
      color: #6b1a2a;
      font-size: 22px;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 32px;
      padding-bottom: 12px;
      border-bottom: 3px solid #6b1a2a;
    }

    .section {
      margin-bottom: 36px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #6b1a2a;
      border-bottom: 2px solid #6b1a2a;
      padding-bottom: 4px;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead tr {
      background-color: #6b1a2a;
      color: #fff;
    }

    th {
      padding: 9px 8px;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      border: 1px solid #a03040;
    }

    td {
      padding: 8px;
      border: 1px solid #ddd;
      font-size: 12px;
      vertical-align: middle;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    .row-even { background: #f9f9f9; }
    .row-odd  { background: #ffffff; }

    .cell-center { text-align: center; }

    .cell-rtl {
      text-align: right;
      direction: rtl;
    }

    .rank-cell {
      font-weight: 700;
      color: #6b1a2a;
      font-size: 15px;
    }

    .score-cell {
      font-weight: 700;
      color: #6b1a2a;
      font-size: 14px;
    }

    .members-cell { vertical-align: top; padding: 8px 10px; }

    .member-name {
      direction: rtl;
      text-align: right;
      line-height: 1.8;
      font-size: 12px;
    }

    .print-btn {
      display: block;
      margin: 0 auto 30px auto;
      padding: 10px 32px;
      background: #6b1a2a;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-family: 'Cairo', Arial, sans-serif;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 1px;
    }

    .print-btn:hover { background: #8b2a3a; }

    @media print {
      .print-btn { display: none; }
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <h1>Expo FITers GP — Official Top 3 Results</h1>
  ${tablesHTML}
</body>
</html>`);

  printWindow.document.close();
};
