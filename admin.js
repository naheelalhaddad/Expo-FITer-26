const SUPABASE_URL = 'https://bpddzqbuqdmvubuzerem.supabase.co';
const SUPABASE_KEY = 'sb_publishable_76CrGMLLkhNRoTaJy1xEWg_kbp5DSxm';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let rawEvaluations = [];
let adminProjects = [];
let currentCategory = 'Overall';

// MEMORY CACHE: Prevents recalculating historical data on every new vote
let projectStats = {}; 

window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (!session || session.user.email !== 'admin@fit.edu.jo') {
    window.location.replace('index.html');
    return;
  }

  const video = document.getElementById('bg-video-stream');
  if (video) video.playbackRate = 0.5;

  // 1. Fetch Master List of Teams
  const { data: teamsData, error: teamsError } = await supabaseClient.from('teams').select('*');
  if (!teamsError && teamsData) {
    adminProjects = teamsData.map(t => ({
      num: t.team_number || 'UNKNOWN',
      name: `Team ${t.team_number || 'UNKNOWN'}`,
      category: (t.competition_track || '').trim(),
      lead: (t.students || '').split('\n').filter(s => s.trim() !== '')[0] || 'Unknown'
    }));
  }

  generateTabs();

  // 2. NETWORK OPTIMIZATION: Fetch ONLY required columns, ignoring c1-c8
  const { data: evalsData, error: evalsError } = await supabaseClient
    .from('evaluations')
    .select('project_num, total_score');
    
  if (!evalsError && evalsData) {
    rawEvaluations = evalsData;
    buildInitialCache();
    renderDashboard();
  }

  // 3. REALTIME OPTIMIZATION: Incremental state updates
  supabaseClient
    .channel('evaluations-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'evaluations' }, (payload) => {
        if (payload.new && payload.new.project_num) {
          const pNum = payload.new.project_num;
          const tScore = payload.new.total_score || 0;
          
          // O(1) Cache Update
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
    const tScore = record.total_score || 0; // Reads generated DB column directly
    
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
      <td><span class="avatar-placeholder">${item.lead.charAt(0).toUpperCase()}</span> ${item.lead}</td>
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

  champName.textContent = data[0].lead;
  champProject.textContent = data[0].num;

  runnerUpsContainer.innerHTML = data.slice(1, 4).filter(item => item.score > 0).map((item, index) => {
    return `<div class="runner-up-item">
      <div><span class="runner-up-rank">#${index + 2}</span> <span style="color:rgba(255,255,255,0.85);">${item.lead}</span></div>
      <span class="runner-up-score">${item.score}</span>
    </div>`;
  }).join('');
}
window.exportToPDF = function() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // 1. Compile current master scores from the memory cache
  const allScores = adminProjects.map(project => {
    const stats = projectStats[project.num];
    const finalScore = stats && stats.voteCount > 0 ? (stats.totalScore / stats.voteCount) : 0;
    return { ...project, score: Number(finalScore.toFixed(2)) };
  });

  // 2. Map all required categories
  const uniqueCategories = [...new Set(adminProjects.map(p => p.category))];
  const allCategories = ['Overall', ...uniqueCategories];

  let yPos = 20;

  // Title Header
  doc.setFontSize(18);
  doc.setTextColor(107, 26, 42); // Maroon branding
  doc.text("Expo FITers GP - Official Top 5 Results", 14, yPos);
  yPos += 12;

  // 3. Loop through categories, slice top 5, and generate tables
  allCategories.forEach((cat, index) => {
    // Filter and Sort
    let catProjects = cat === 'Overall' ? [...allScores] : allScores.filter(p => p.category === cat);
    catProjects.sort((a, b) => b.score - a.score);
    const top5 = catProjects.slice(0, 5);

    if (top5.length === 0) return;

    // Check pagination buffer
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    // Category Header
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(cat === 'Overall' ? 'GRAND CHAMPIONS (OVERALL)' : `TRACK: ${cat}`, 14, yPos);
    yPos += 4;

    // Compile Table Data Matrix
    const tableData = top5.map((p, i) => [
      `#${i + 1}`,
      p.num,
      p.lead,
      p.score.toString()
    ]);

    // Inject Vector Table
    doc.autoTable({
      startY: yPos,
      head: [['Rank', 'Team ID', 'Project Lead', 'Final Score']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [107, 26, 42], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 }
    });

    // Advance Y position dynamically based on the rendered table height
    yPos = doc.lastAutoTable.finalY + 15;
  });

  // 4. Force File Download
  doc.save('ExpoFITers_Top5_Results.pdf');
};
