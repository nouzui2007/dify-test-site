/* ── Markdown setup ── */
marked.setOptions({
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  langPrefix: 'hljs language-',
  breaks: true,
});

/* ── Cookie helpers ── */
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name) {
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function isLoggedIn() {
  return getCookie('dify_tester_auth') === 'true';
}

/* ── iframe の src を書き換えて inputs を反映 ── */
function updateDifyEmbed() {
  const iframe = document.getElementById('dify-chatbot-bubble-window');
  if (!iframe) return;

  const inputs = window.difyChatbotConfig?.inputs || {};
  const params = new URLSearchParams();
  Object.entries(inputs).forEach(([key, value]) => {
    params.set(key, btoa(unescape(encodeURIComponent(String(value)))));
  });

  iframe.src = `https://udify.app/chatbot/zjGMPbx4WpS2RhER?${params.toString()}`;
}

/* ── Dify embed 要素削除 ── */
function removeDifyEmbed() {
  ['dify-chatbot-bubble-button', 'dify-chatbot-bubble-window'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  const old = document.getElementById('zjGMPbx4WpS2RhER');
  if (old) old.remove();
}

/* ── 会話リセット：user_id にタイムスタンプを付与して別会話として扱わせる ── */
function resetConversation() {
  const baseUserId = getCookie('dify_tester_user_id') || '';
  const sessionUserId = (baseUserId || 'user') + '-' + Date.now();
  const currentInputs = window.difyChatbotConfig ? { ...window.difyChatbotConfig.inputs } : {};
  setupDifyConfig({ inputs: currentInputs, userId: sessionUserId });
  updateDifyEmbed();
  if (typeof resetChat === 'function') resetChat();
}

/* ── Apply config ── */
function applyConfig() {
  const textarea = document.getElementById('cfg-inputs');
  const errEl    = document.getElementById('cfg-error');
  const userId   = document.getElementById('cfg-user-id').value.trim();

  let inputs;
  try {
    inputs = JSON.parse(textarea.value);
    if (typeof inputs !== 'object' || Array.isArray(inputs)) throw new Error();
  } catch (e) {
    textarea.classList.add('error');
    errEl.classList.add('visible');
    return;
  }
  textarea.classList.remove('error');
  errEl.classList.remove('visible');

  localStorage.setItem('dify_inputs', JSON.stringify(inputs));
  if (userId) {
    setCookie('dify_tester_user_id', userId, 7);
  } else {
    deleteCookie('dify_tester_user_id');
  }

  const apiKey = document.getElementById('cfg-api-key').value.trim();
  if (apiKey) localStorage.setItem('dify_api_key', apiKey);

  if (typeof resetChat === 'function') resetChat();
  setupDifyConfig({ inputs, userId });
  updateDifyEmbed();
}

/* ── UI update ── */
function updateUI() {
  const loggedIn = isLoggedIn();
  const userId   = getCookie('dify_tester_user_id') || '';

  const badge      = document.getElementById('status-badge');
  const btn        = document.getElementById('auth-btn');
  const stateLogin = document.getElementById('state-login');
  const stateUser  = document.getElementById('state-user');

  badge.textContent = loggedIn ? 'ログイン済み' : '未ログイン';
  badge.className   = `status-badge ${loggedIn ? 'logged-in' : 'logged-out'}`;
  btn.textContent   = loggedIn ? 'ログアウト' : 'ログイン';
  btn.className     = `btn ${loggedIn ? 'btn-logout' : 'btn-login'}`;

  stateLogin.textContent = loggedIn ? 'ログイン済み' : '未ログイン';
  stateLogin.className   = `state-value ${loggedIn ? 'is-logged-in' : 'is-logged-out'}`;

  if (userId) {
    stateUser.textContent = `"${userId}"`;
    stateUser.className   = 'state-value is-user';
  } else {
    stateUser.textContent = 'なし（未送信）';
    stateUser.className   = 'state-value is-none';
  }

  let inputs = { is_logged_in: 'False', hoge: 'fuga' };
  try {
    const saved = JSON.parse(localStorage.getItem('dify_inputs'));
    if (saved && typeof saved === 'object') inputs = saved;
  } catch (e) {}
  document.getElementById('cfg-inputs').value = JSON.stringify(inputs, null, 2);
  document.getElementById('cfg-user-id').value = userId;
  document.getElementById('cfg-api-key').value =
    window.__ENV__?.DIFY_API_KEY || localStorage.getItem('dify_api_key') || '';
}

/* ── Login / Logout ── */
function toggleLogin() {
  if (isLoggedIn()) {
    deleteCookie('dify_tester_auth');
  } else {
    setCookie('dify_tester_auth', 'true', 7);
  }
  location.reload();
}

updateUI();

/* ── Chat state ── */
const DIFY_CHAT_API_DIRECT = 'https://api.dify.ai/v1/chat-messages';
let conversationId         = '';
let isStreaming             = false;
let currentAbortController = null;

/* ── Input auto-resize ── */
function autoResizeChatInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleChatKey(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
}

/* ── Scroll ── */
function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  container.scrollTop = container.scrollHeight;
}

/* ── Markdown render ── */
function renderMarkdown(text) {
  try {
    return marked.parse(text);
  } catch (e) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }
}

/* ── Message DOM helpers ── */
function appendUserMessage(text) {
  const container = document.getElementById('chat-messages');
  const bubble    = document.createElement('div');
  bubble.className   = 'chat-bubble user';
  bubble.textContent = text;
  container.appendChild(bubble);
  scrollToBottom();
}

function appendAssistantBubble() {
  const container = document.getElementById('chat-messages');
  const bubble    = document.createElement('div');
  bubble.className   = 'chat-bubble assistant';
  bubble.dataset.raw = '';
  container.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function updateAssistantBubble(bubble, rawText) {
  bubble.dataset.raw = rawText;
  bubble.innerHTML   = renderMarkdown(rawText);
  bubble.querySelectorAll('pre code').forEach(block => {
    if (!block.dataset.highlighted) {
      hljs.highlightElement(block);
      block.dataset.highlighted = 'yes';
    }
  });
  scrollToBottom();
}

/* ── Streaming state ── */
function setStreamingState(active) {
  isStreaming = active;
  document.getElementById('chat-thinking').style.display = active ? 'flex' : 'none';
  document.getElementById('chat-send-btn').disabled      = active;
  document.getElementById('chat-input').disabled         = active;
}

/* ── Send message ── */
async function sendMessage() {
  if (isStreaming) return;

  const inputEl = document.getElementById('chat-input');
  const query   = inputEl.value.trim();
  if (!query) return;

  const proxyEndpoint = window.__ENV__?.DIFY_CHAT_ENDPOINT;
  const apiKey        = window.__ENV__?.DIFY_API_KEY || localStorage.getItem('dify_api_key') || '';
  if (!proxyEndpoint && !apiKey) {
    alert('Chat API Key が設定されていません。Dify Config カードで入力して「適用」してください。');
    return;
  }

  const endpoint = proxyEndpoint || DIFY_CHAT_API_DIRECT;
  const headers  = { 'Content-Type': 'application/json' };
  if (!proxyEndpoint && apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const inputs = window.difyChatbotConfig?.inputs || {};
  const user   = window.difyChatbotConfig?.systemVariables?.user_id
                   || getCookie('dify_tester_user_id')
                   || 'anonymous';

  inputEl.value = '';
  autoResizeChatInput(inputEl);

  appendUserMessage(query);
  setStreamingState(true);

  const assistantBubble = appendAssistantBubble();
  let   accumulated     = '';

  currentAbortController = new AbortController();

  try {
    const response = await fetch(endpoint, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        query,
        response_mode:   'streaming',
        user,
        conversation_id: conversationId,
        inputs,
      }),
      signal: currentAbortController.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errText}`);
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        let evt;
        try { evt = JSON.parse(jsonStr); } catch { continue; }

        if (evt.event === 'message' && evt.answer != null) {
          accumulated += evt.answer;
          updateAssistantBubble(assistantBubble, accumulated);
        }

        if (evt.event === 'message_end') {
          if (evt.conversation_id) {
            conversationId = evt.conversation_id;
            document.getElementById('chat-conv-id').textContent =
              'conv: ' + conversationId;
          }
          updateAssistantBubble(assistantBubble, accumulated);
        }

        if (evt.event === 'error') {
          throw new Error(evt.message || 'Dify API error');
        }
      }
    }

  } catch (err) {
    if (err.name !== 'AbortError') {
      assistantBubble.innerHTML =
        `<span style="color:#ef4444">エラー: ${err.message}</span>`;
      console.error('[DifyChat]', err);
    }
  } finally {
    setStreamingState(false);
    currentAbortController = null;
  }
}

/* ── Reset chat ── */
function resetChat() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  conversationId = '';
  isStreaming    = false;
  document.getElementById('chat-messages').innerHTML  = '';
  document.getElementById('chat-conv-id').textContent = '';
  document.getElementById('chat-thinking').style.display = 'none';
  document.getElementById('chat-send-btn').disabled      = false;
  document.getElementById('chat-input').disabled         = false;
}
