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
  if (data.length === 0) return tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--sub); padding:3rem;">No projects found.</td></tr>`;

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

  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.top = '0';
  wrapper.style.left = '0';
  wrapper.style.width = '1px';
  wrapper.style.height = '1px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.zIndex = '-9999';

  const container = document.createElement('div');
  container.style.width = '794px'; 
  container.style.backgroundColor = '#ffffff';
  container.style.padding = '40px'; 
  container.style.boxSizing = 'border-box';
  container.style.fontFamily = 'Arial, sans-serif';

  let htmlContent = `
    <h1 style="text-align:center; color:#6b1a2a; margin-bottom:30px; font-size:26px; text-transform:uppercase;">
      Expo FITers GP - Official Top 5 Results
    </h1>
  `;

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
      <div style="margin-bottom: 40px; page-break-inside: avoid;">
        <h2 style="color:#222; border-bottom:3px solid #6b1a2a; padding-bottom:5px; margin-bottom:15px; font-size:18px;">${title}</h2>
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <thead>
            <tr>
              <th style="width: 10%; background-color: #6b1a2a; color: white; padding: 10px; border: 1px solid #ddd; text-align: center;">Rank</th>
              <th style="width: 15%; background-color: #6b1a2a; color: white; padding: 10px; border: 1px solid #ddd; text-align: center;">Team ID</th>
              <th style="width: 55%; background-color: #6b1a2a; color: white; padding: 10px; border: 1px solid #ddd; text-align: right;">Team Members</th>
              <th style="width: 20%; background-color: #6b1a2a; color: white; padding: 10px; border: 1px solid #ddd; text-align: center;">Score</th>
            </tr>
          </thead>
          <tbody>
    `;

    top5.forEach((p, i) => {
      const bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
      
      htmlContent += `
        <tr style="background-color: ${bg};">
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #000; font-weight: bold; overflow-wrap: break-word;">#${i + 1}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #000; overflow-wrap: break-word;">${p.num}</td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: right; color: #000; font-weight: bold; line-height: 1.6; overflow-wrap: break-word;">
            ${p.membersList}
          </td>
          <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #6b1a2a; font-weight: bold; overflow-wrap: break-word;">${p.score}</td>
        </tr>
      `;
    });

    htmlContent += `</tbody></table></div>`;
  });

  container.innerHTML = htmlContent;
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  const opt = {
    margin:       0, 
    filename:     'ExpoFITers_Top5_Results.pdf',
    image:        { type: 'jpeg', quality: 1 },
    html2canvas:  { scale: 2, useCORS: true, width: 794, windowWidth: 794 },
    jsPDF:        { unit: 'px', format: [794, 1123], orientation: 'portrait' } 
  };

  html2pdf().set(opt).from(container).save().then(() => {
    document.body.removeChild(wrapper);
    btn.textContent = originalText;
    btn.disabled = false;
  }).catch(err => {
    console.error("PDF Export Error: ", err);
    btn.textContent = "ERROR - TRY AGAIN";
    document.body.removeChild(wrapper);
    setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 3000);
  });
};
