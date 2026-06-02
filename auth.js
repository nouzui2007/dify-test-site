/* ── Cookie helpers ── */
function getCookie(name) {
  const key = encodeURIComponent(name) + '=';
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(key)) return decodeURIComponent(part.slice(key.length));
  }
  return null;
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name) {
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function isLoggedIn() {
  return getCookie('ckan') !== null;
}

/* ── UI ── */
function updateUI() {
  const loggedIn = isLoggedIn();

  const badge      = document.getElementById('status-badge');
  const btn        = document.getElementById('auth-btn');
  const stateLogin = document.getElementById('state-login');

  badge.textContent = loggedIn ? 'ログイン済み' : '未ログイン';
  badge.className   = `status-badge ${loggedIn ? 'logged-in' : 'logged-out'}`;
  btn.textContent   = loggedIn ? 'ログアウト' : 'ログイン';
  btn.className     = `btn ${loggedIn ? 'btn-logout' : 'btn-login'}`;

  stateLogin.textContent = loggedIn ? 'ログイン済み' : '未ログイン';
  stateLogin.className   = `state-value ${loggedIn ? 'is-logged-in' : 'is-logged-out'}`;
}

updateUI();
