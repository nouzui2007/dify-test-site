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

