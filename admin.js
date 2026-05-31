const SUPABASE_URL = 'https://bpddzqbuqdmvubuzerem.supabase.co';
const SUPABASE_KEY = 'sb_publishable_76CrGMLLkhNRoTaJy1xEWg_kbp5DSxm';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const projects = [
  { num:'P-001', name:'[Project Name 1]', category:'[Category 1]', members:['[Member 1]'] },
  { num:'P-002', name:'[Project Name 2]', category:'[Category 2]', members:['[Member 1]'] },
  { num:'P-003', name:'[Project Name 3]', category:'[Category 3]', members:['[Member 1]'] },
  { num:'P-004', name:'[Project Name 4]', category:'[Category 4]', members:['[Member 1]'] },
  { num:'P-005', name:'[Project Name 5]', category:'[Category 5]', members:['[Member 1]'] }
];

let rawEvaluations = [];
let currentCategory = 'Overall';

window.addEventListener('DOMContentLoaded', async () => {
  const video = document.getElementById('bg-video-stream');
  if (video) video.playbackRate = 0.5;

  generateTabs();

  const { data, error } = await supabaseClient.from('evaluations').select('*');
  if (!error) {
    rawEvaluations = data;
    processAndRender();
  }

  supabaseClient
    .channel('evaluations-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'evaluations' }, (payload) => {
        if (Object.keys(payload.new).length > 0) {
          rawEvaluations.push(payload.new);
          processAndRender();
        }
      }
    )
    .subscribe();
});

function generateTabs() {
  const tabsContainer = document.getElementById('category-tabs');
  if (!tabsContainer) return;
  const uniqueCategories = [...new Set(projects.map(p => p.category))];
  const allTabs = ['Overall', ...uniqueCategories];
  
  tabsContainer.innerHTML = allTabs.map(cat => 
    `<div class="tab ${cat === 'Overall' ? 'active' : ''}" onclick="setTab('${cat}', this)">${cat}</div>`
  ).join('');
}

window.setTab = function(category, element) {
  currentCategory = category;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  element.classList.add('active');
  
  const label = document.getElementById('champion-category-label');
  if(label) label.innerHTML = category === 'Overall' ? 'Overall Ranking<br>Grand Champion' : `${category} Ranking<br>Category Leader`;
  processAndRender();
};

function processAndRender() {
  const projectStats = {};
  
  rawEvaluations.forEach(record => {
    const c1 = record.criterion_1 || 0;
    const c2 = record.criterion_2 || 0;
    const c3 = record.criterion_3 || 0;
    const overall = record.overall_score || 0;

    const evaluationFinalScore = (((c1 + c2 + c3) / 3) + overall) / 2;

    if (!projectStats[record.project_num]) projectStats[record.project_num] = { totalScore: 0, voteCount: 0 };
    projectStats[record.project_num].totalScore += evaluationFinalScore;
    projectStats[record.project_num].voteCount += 1;
  });

  let leaderboardData = projects.map(project => {
    const stats = projectStats[project.num];
    const finalScore = stats && stats.voteCount > 0 ? (stats.totalScore / stats.voteCount) : 0;
    return { num: project.num, name: project.name, category: project.category, lead: project.members[0] || 'Unknown', score: Number(finalScore.toFixed(2)) };
  });

  if (currentCategory !== 'Overall') leaderboardData = leaderboardData.filter(p => p.category === currentCategory);
  leaderboardData.sort((a, b) => b.score - a.score);

  renderTable(leaderboardData);
  renderChampionCard(leaderboardData);
}

function renderTable(data) {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  if (data.length === 0) return tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--sub); padding:3rem;">No projects found for this category.</td></tr>`;

  tbody.innerHTML = data.map((item, index) => {
    return `<tr>
      <td class="rank">#${index + 1}</td>
      <td><span class="avatar-placeholder">${item.lead.charAt(0).toUpperCase()}</span> ${item.lead}</td>
      <td>${item.name}</td>
      <td>${item.category}</td>
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
  champProject.textContent = data[0].name;

  runnerUpsContainer.innerHTML = data.slice(1, 4).filter(item => item.score > 0).map((item, index) => {
    return `<div class="runner-up-item">
      <div><span class="runner-up-rank">#${index + 2}</span> <span style="color:rgba(255,255,255,0.85);">${item.lead}</span></div>
      <span class="runner-up-score">${item.score}</span>
    </div>`;
  }).join('');
}
