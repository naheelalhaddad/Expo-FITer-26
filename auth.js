const SUPABASE_URL = 'https://bpddzqbuqdmvubuzerem.supabase.co';
const SUPABASE_KEY = 'sb_publishable_76CrGMLLkhNRoTaJy1xEWg_kbp5DSxm';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const btn = document.getElementById('login-btn');
  const errorMsg = document.getElementById('error-msg');

  btn.disabled = true;
  btn.textContent = 'Authenticating...';
  errorMsg.textContent = '';

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    errorMsg.textContent = "Authentication Failed. Verify credentials.";
    btn.disabled = false;
    btn.textContent = 'Secure Login';
  } else {
    if (data.session.user.email === 'admin@fit.edu') {
      window.location.replace('admin.html');
    } else {
      window.location.replace('projects.html');
    }
  }
});
