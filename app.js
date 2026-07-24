/**
 * JARVIS PWA — Assistant Vocal IA
 */

// =============================================
// CONFIG
// =============================================
const CFG = {
  KEYS: { SETTINGS: 'j_settings', HISTORY: 'j_history', API_KEY: 'j_apikey', ELEVEN_KEY: 'j_eleven' },
  DEFAULTS: {
    apiProvider: 'gemini',
    ttsEngine: 'browser',
    ttsVoice: 'auto',
    ttsRate: 1,
    elevenVoice: 'EXAVITQu4vr4xnSDxMaL',
    userName: 'Tom',
    wakeWord: 'JARVIS',
    wakeWordEnabled: true,
    continuousListening: false
  },
  GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  GROQ_URL: 'https://api.groq.com/openai/v1/chat/completions',
  ELEVEN_URL: 'https://api.elevenlabs.io/v1/text-to-speech'
};

const S = {
  settings: {},
  history: [],
  listening: false,
  speaking: false,
  recognition: null,
  synth: speechSynthesis
};

// =============================================
// DOM
// =============================================
const $ = id => document.getElementById(id);
const el = {
  orb: $('orb'),
  statusText: $('statusText'),
  messages: $('messages'),
  chat: $('chat'),
  typing: $('typing'),
  btnMic: $('btnMic'),
  textInput: $('textInput'),
  btnSend: $('btnSend'),
  inputHint: $('inputHint'),
  btnSettings: $('btnSettings'),
  overlay: $('overlay'),
  modal: $('modal'),
  btnClose: $('btnClose'),
  toasts: $('toasts'),
  // Settings inputs
  apiProvider: $('apiProvider'),
  apiKey: $('apiKey'),
  ttsEngine: $('ttsEngine'),
  ttsVoice: $('ttsVoice'),
  ttsRate: $('ttsRate'),
  rateVal: $('rateVal'),
  elevenKey: $('elevenKey'),
  elevenVoice: $('elevenVoice'),
  elevenLabsFields: $('elevenLabsFields'),
  userName: $('userName'),
  wakeWord: $('wakeWord'),
  wakeWordEnabled: $('wakeWordEnabled'),
  continuousListening: $('continuousListening'),
  btnClear: $('btnClear'),
  btnTestVoice: $('btnTestVoice')
};

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
  loadSettings();
  loadHistory();
  renderHistory();
  bindEvents();
  initSpeech();
  populateVoices();
  toast('JARVIS prêt', 'success');
});

// =============================================
// SETTINGS
// =============================================
function loadSettings() {
  try {
    const stored = localStorage.getItem(CFG.KEYS.SETTINGS);
    S.settings = stored ? { ...CFG.DEFAULTS, ...JSON.parse(stored) } : { ...CFG.DEFAULTS };
    const ak = localStorage.getItem(CFG.KEYS.API_KEY);
    if (ak) S.settings.apiKey = ak;
    const ek = localStorage.getItem(CFG.KEYS.ELEVEN_KEY);
    if (ek) S.settings.elevenKey = ek;
  } catch { S.settings = { ...CFG.DEFAULTS }; }
  syncSettingsUI();
}

function syncSettingsUI() {
  const s = S.settings;
  el.apiProvider.value = s.apiProvider || 'gemini';
  el.apiKey.value = s.apiKey || '';
  el.ttsEngine.value = s.ttsEngine || 'browser';
  el.ttsVoice.value = s.ttsVoice || 'auto';
  el.ttsRate.value = s.ttsRate || 1;
  el.rateVal.textContent = (s.ttsRate || 1).toFixed(1) + 'x';
  el.elevenKey.value = s.elevenKey || '';
  el.elevenVoice.value = s.elevenVoice || CFG.DEFAULTS.elevenVoice;
  el.userName.value = s.userName || 'Tom';
  el.wakeWord.value = s.wakeWord || 'JARVIS';
  el.wakeWordEnabled.checked = s.wakeWordEnabled !== false;
  el.continuousListening.checked = s.continuousListening === true;
  toggleElevenLabs(s.ttsEngine === 'elevenlabs');
}

function saveSettings() {
  const s = {
    apiProvider: el.apiProvider.value,
    ttsEngine: el.ttsEngine.value,
    ttsVoice: el.ttsVoice.value,
    ttsRate: parseFloat(el.ttsRate.value),
    elevenVoice: el.elevenVoice.value,
    userName: el.userName.value || 'Tom',
    wakeWord: el.wakeWord.value || 'JARVIS',
    wakeWordEnabled: el.wakeWordEnabled.checked,
    continuousListening: el.continuousListening.checked
  };
  if (el.apiKey.value) { localStorage.setItem(CFG.KEYS.API_KEY, el.apiKey.value); s.apiKey = el.apiKey.value; }
  if (el.elevenKey.value) { localStorage.setItem(CFG.KEYS.ELEVEN_KEY, el.elevenKey.value); s.elevenKey = el.elevenKey.value; }
  S.settings = { ...S.settings, ...s };
  localStorage.setItem(CFG.KEYS.SETTINGS, JSON.stringify(S.settings));
  toggleElevenLabs(s.ttsEngine === 'elevenlabs');
  toast('Paramètres sauvegardés', 'success');
}

function toggleElevenLabs(show) {
  el.elevenLabsFields.classList.toggle('hidden', !show);
}

// =============================================
// HISTORY
// =============================================
function loadHistory() {
  try { S.history = JSON.parse(localStorage.getItem(CFG.KEYS.HISTORY)) || []; } catch { S.history = []; }
}
function saveHistory() { localStorage.setItem(CFG.KEYS.HISTORY, JSON.stringify(S.history.slice(-100))); }
function addHistory(role, content) {
  const msg = { id: Date.now() + Math.random(), role, content, ts: Date.now() };
  S.history.push(msg);
  saveHistory();
  return msg;
}

function renderHistory() {
  el.messages.innerHTML = '';
  S.history.forEach(m => appendMsg(m.role, m.content));
  scrollBottom();
}

// =============================================
// CHAT UI
// =============================================
function appendMsg(role, content) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  const avatarClass = role === 'user' ? 'user-avatar' : 'jarvis-avatar';
  const avatarSvg = role === 'user'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

  div.innerHTML = `
    <div class="msg-avatar ${avatarClass}">${avatarSvg}</div>
    <div class="msg-body"><div class="msg-text">${formatText(content)}</div></div>
  `;

  el.messages.appendChild(div);
  scrollBottom();
  return div;
}

function formatText(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function scrollBottom() { el.chat.scrollTop = el.chat.scrollHeight; }
function showTyping(on) { el.typing.classList.toggle('hidden', !on); if(on) scrollBottom(); }

// =============================================
// SPEECH RECOGNITION
// =============================================
function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    el.btnMic.disabled = true;
    el.inputHint.textContent = 'Reconnaissance vocale non supportée';
    return;
  }
  S.recognition = new SR();
  S.recognition.lang = 'fr-FR';
  S.recognition.continuous = false;
  S.recognition.interimResults = true;
  S.recognition.maxAlternatives = 1;

  S.recognition.onstart = () => {
    S.listening = true;
    setOrbState('listening');
    setStatus("J'écoute...");
    el.btnMic.classList.add('listening');
    el.btnMic.querySelector('.ic-mic').classList.add('hidden');
    el.btnMic.querySelector('.ic-wave').classList.remove('hidden');
  };

  S.recognition.onresult = (ev) => {
    let final = '', interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const t = ev.results[i][0].transcript;
      if (ev.results[i].isFinal) final += t; else interim += t;
    }
    if (interim) { el.textInput.value = interim; }
    if (final) { el.textInput.value = ''; handleInput(final.trim()); }
  };

  S.recognition.onerror = (ev) => {
    if (ev.error !== 'no-speech' && ev.error !== 'aborted') {
      toast('Erreur microphone: ' + ev.error, 'error');
    }
  };

  S.recognition.onend = () => {
    S.listening = false;
    el.btnMic.classList.remove('listening');
    el.btnMic.querySelector('.ic-mic').classList.remove('hidden');
    el.btnMic.querySelector('.ic-wave').classList.add('hidden');
    if (!S.speaking) { setOrbState(''); setStatus('En veille'); }
    if (S.settings.continuousListening && !S.speaking) setTimeout(() => startListening(), 800);
  };
}

function startListening() {
  if (!S.recognition || S.listening || S.speaking) return;
  try { S.recognition.start(); } catch {}
}
function stopListening() { if (S.recognition && S.listening) S.recognition.stop(); }

// =============================================
// TTS — Browser + ElevenLabs
// =============================================
async function speak(text) {
  // Clean text for speech (remove markdown)
  const clean = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '').replace(/<[^>]+>/g, '');
  if (!clean.trim()) return;

  S.speaking = true;
  setOrbState('speaking');
  setStatus('JARVIS parle...');

  try {
    if (S.settings.ttsEngine === 'elevenlabs' && S.settings.elevenKey) {
      await speakElevenLabs(clean);
    } else {
      await speakBrowser(clean);
    }
  } catch (e) {
    console.warn('TTS error:', e);
    // Fallback to browser if ElevenLabs fails
    if (S.settings.ttsEngine === 'elevenlabs') {
      try { await speakBrowser(clean); } catch {}
    }
  }

  S.speaking = false;
  if (!S.listening) { setOrbState(''); setStatus('En veille'); }
}

function speakBrowser(text) {
  return new Promise((resolve) => {
    if (!S.synth) { resolve(); return; }
    S.synth.cancel();

    // Split long text into chunks (speechSynthesis has limits)
    const maxLen = 200;
    const chunks = text.length > maxLen ? splitText(text, maxLen) : [text];
    let idx = 0;

    function speakNext() {
      if (idx >= chunks.length) { resolve(); return; }
      const u = new SpeechSynthesisUtterance(chunks[idx]);
      u.lang = 'fr-FR';
      u.rate = S.settings.ttsRate || 1;
      u.pitch = 1;

      // Pick best French voice
      const voices = S.synth.getVoices();
      const userVoice = S.settings.ttsVoice;
      let voice = null;

      if (userVoice && userVoice !== 'auto') {
        const [lang, name] = userVoice.split('|');
        voice = voices.find(v => v.name === name) || voices.find(v => v.lang === lang);
      }
      if (!voice) {
        // Priority order for natural French voices
        voice = voices.find(v => v.name.includes('Thomas') && v.lang.startsWith('fr'))
             || voices.find(v => v.name.includes('Amélie'))
             || voices.find(v => v.name.includes('Hortense'))
             || voices.find(v => v.name.includes('Denise'))
             || voices.find(v => v.name.includes('Eloise'))
             || voices.find(v => v.lang === 'fr-FR' && v.localService === false)
             || voices.find(v => v.lang === 'fr-FR')
             || voices.find(v => v.lang.startsWith('fr'));
      }
      if (voice) u.voice = voice;

      u.onend = () => { idx++; speakNext(); };
      u.onerror = () => { idx++; speakNext(); };
      S.synth.speak(u);
    }
    speakNext();
  });
}

function splitText(text, maxLen) {
  const chunks = [];
  const sentences = text.replace(/\n/g, ' ').split(/(?<=[.!?])\s+/);
  let current = '';
  for (const s of sentences) {
    if ((current + ' ' + s).length > maxLen && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current = current ? current + ' ' + s : s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.substring(0, maxLen)];
}

async function speakElevenLabs(text) {
  const key = S.settings.elevenKey;
  const voiceId = S.settings.elevenVoice || CFG.DEFAULTS.elevenVoice;
  if (!key) throw new Error('Clé API ElevenLabs manquante');

  // Split long text (ElevenLabs limit ~5000 chars)
  const chunks = text.length > 4000 ? splitText(text, 4000) : [text];

  for (const chunk of chunks) {
    const resp = await fetch(`${CFG.ELEVEN_URL}/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': key
      },
      body: JSON.stringify({
        text: chunk,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true }
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail?.message || `ElevenLabs erreur ${resp.status}`);
    }

    const blob = await resp.blob();
    await playAudioBlob(blob);
  }
}

function playAudioBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    audio.play().catch(reject);
  });
}

// =============================================
// VOICES
// =============================================
function populateVoices() {
  if (!S.synth) return;
  const load = () => {
    const voices = S.synth.getVoices();
    const fr = voices.filter(v => v.lang.startsWith('fr'));
    el.ttsVoice.innerHTML = '<option value="auto">Automatique</option>';
    fr.forEach(v => {
      const o = document.createElement('option');
      o.value = v.lang + '|' + v.name;
      o.textContent = `${v.name} (${v.lang})`;
      el.ttsVoice.appendChild(o);
    });
    // Add all voices as fallback
    if (fr.length < 3) {
      voices.slice(0, 10).forEach(v => {
        const o = document.createElement('option');
        o.value = v.lang + '|' + v.name;
        o.textContent = `${v.name} (${v.lang})`;
        el.ttsVoice.appendChild(o);
      });
    }
    if (S.settings.ttsVoice) el.ttsVoice.value = S.settings.ttsVoice;
  };
  S.synth.onvoiceschanged = load;
  load();
}

// =============================================
// AI API
// =============================================
async function getAIResponse(userInput) {
  const provider = S.settings.apiProvider || 'gemini';
  const apiKey = S.settings.apiKey || localStorage.getItem(CFG.KEYS.API_KEY);
  if (!apiKey) throw new Error('Clé API manquante. Ouvrez les paramètres pour la configurer.');

  const systemMsg = `Tu es JARVIS, un assistant vocal IA personnel pour ${S.settings.userName || 'Tom'}. Tu réponds en français, de façon concise et utile (2-3 phrases max sauf si on te demande plus). Tu es intelligent, amical et efficace.`;

  if (provider === 'groq') {
    const messages = [
      { role: 'system', content: systemMsg },
      ...S.history.slice(-8).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: userInput }
    ];
    const r = await fetch(CFG.GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, temperature: 0.7, max_tokens: 1024 })
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error?.message || `Erreur ${r.status}`); }
    const d = await r.json();
    return d.choices?.[0]?.message?.content || 'Pas de réponse.';
  } else {
    const contents = [
      ...S.history.slice(-8).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      { role: 'user', parts: [{ text: systemMsg + '\n\n' + userInput }] }
    ];
    const r = await fetch(`${CFG.GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } })
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error?.message || `Erreur ${r.status}`); }
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || 'Pas de réponse.';
  }
}

// =============================================
// INPUT HANDLER
// =============================================
async function handleInput(text) {
  if (!text.trim()) return;
  addHistory('user', text);
  appendMsg('user', text);
  el.textInput.value = '';
  el.btnSend.classList.add('hidden');

  showTyping(true);
  setOrbState('thinking');
  setStatus('Réflexion...');

  try {
    const response = await getAIResponse(text);
    addHistory('assistant', response);
    appendMsg('assistant', response);
    await speak(response);
  } catch (err) {
    console.error(err);
    const msg = err.message || 'Une erreur est survenue.';
    appendMsg('assistant', '⚠️ ' + msg);
    toast(msg, 'error');
  }

  showTyping(false);
  setOrbState('');
  if (!S.speaking) setStatus('En veille');
}

// =============================================
// UI HELPERS
// =============================================
function setOrbState(state) {
  el.orb.className = 'orb';
  if (state) el.orb.classList.add(state);
}
function setStatus(text, cls) {
  el.statusText.textContent = text;
  el.statusText.className = 'status';
  if (cls) el.statusText.classList.add(cls);
}
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  el.toasts.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// =============================================
// EVENTS
// =============================================
function bindEvents() {
  // Orb click
  el.orb.addEventListener('click', () => {
    if (S.listening) stopListening();
    else if (!S.speaking) startListening();
  });

  // Mic button
  el.btnMic.addEventListener('click', (e) => {
    e.stopPropagation();
    if (S.listening) stopListening();
    else if (!S.speaking) startListening();
  });

  // Text input
  el.textInput.addEventListener('input', () => {
    el.btnSend.classList.toggle('hidden', !el.textInput.value.trim());
  });
  el.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (el.textInput.value.trim()) handleInput(el.textInput.value.trim());
    }
  });
  el.btnSend.addEventListener('click', () => {
    if (el.textInput.value.trim()) handleInput(el.textInput.value.trim());
  });

  // Settings
  el.btnSettings.addEventListener('click', () => el.overlay.classList.remove('hidden'));
  el.btnClose.addEventListener('click', () => { saveSettings(); el.overlay.classList.add('hidden'); });
  el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) { saveSettings(); el.overlay.classList.add('hidden'); } });

  // Settings live changes
  el.ttsEngine.addEventListener('change', () => toggleElevenLabs(el.ttsEngine.value === 'elevenlabs'));
  el.ttsRate.addEventListener('input', () => { el.rateVal.textContent = parseFloat(el.ttsRate.value).toFixed(1) + 'x'; });

  // Test voice
  el.btnTestVoice.addEventListener('click', async () => {
    el.btnTestVoice.classList.add('loading');
    el.btnTestVoice.textContent = 'Écoute...';
    // Temporarily apply current settings
    const testSettings = {
      ttsEngine: el.ttsEngine.value,
      ttsVoice: el.ttsVoice.value,
      ttsRate: parseFloat(el.ttsRate.value),
      elevenKey: el.elevenKey.value,
      elevenVoice: el.elevenVoice.value
    };
    const prev = { ...S.settings };
    Object.assign(S.settings, testSettings);
    try {
      await speak("Bonjour ! Je suis JARVIS, votre assistant personnel. Comment puis-je vous aider aujourd'hui ?");
    } catch {}
    Object.assign(S.settings, prev);
    el.btnTestVoice.classList.remove('loading');
    el.btnTestVoice.textContent = 'Tester la voix';
  });

  // Clear data
  el.btnClear.addEventListener('click', () => {
    if (confirm('Effacer toutes les données ?')) {
      localStorage.clear();
      S.history = [];
      S.settings = { ...CFG.DEFAULTS };
      syncSettingsUI();
      renderHistory();
      toast('Données effacées', 'success');
      el.overlay.classList.add('hidden');
    }
  });

  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.overlay.classList.contains('hidden')) {
      saveSettings();
      el.overlay.classList.add('hidden');
    }
  });

  // Visibility
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopListening(); if (S.speaking && S.synth) S.synth.cancel(); }
  });
}
