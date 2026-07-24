/**
 * JARVIS - Assistant Vocal Intelligent
 * Application principale
 */

// ============================================
// CONFIGURATION & ÉTAT GLOBAL
// ============================================
const CONFIG = {
  STORAGE_KEYS: {
    SETTINGS: 'jarvis_settings',
    HISTORY: 'jarvis_history',
    API_KEY: 'jarvis_api_key'
  },
  DEFAULT_SETTINGS: {
    apiProvider: 'gemini',
    ttsVoice: 'auto',
    wakeWordEnabled: true,
    continuousListening: false,
    userName: 'Tom',
    wakeWord: 'JARVIS'
  },
  API_ENDPOINTS: {
    gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
    groq: 'https://api.groq.com/openai/v1/chat/completions'
  }
};

let state = {
  settings: {},
  history: [],
  isListening: false,
  isSpeaking: false,
  recognition: null,
  synth: window.speechSynthesis,
  mediaRecorder: null,
  audioChunks: [],
  wakeWordDetector: null
};

// ============================================
// ÉLÉMENTS DOM
// ============================================
const elements = {
  // Orb & Status
  orb: document.getElementById('orb'),
  orbRing: document.getElementById('orbRing'),
  orbCore: document.getElementById('orbCore'),
  statusText: document.getElementById('statusText'),
  statusIndicator: document.getElementById('statusIndicator'),

  // Chat
  chatMessages: document.getElementById('chatMessages'),
  typingIndicator: document.getElementById('typingIndicator'),

  // Input
  btnMic: document.getElementById('btnMic'),
  micIcon: document.querySelector('.mic-icon'),
  micListening: document.querySelector('.mic-listening'),
  textInput: document.getElementById('textInput'),
  btnSend: document.getElementById('btnSend'),
  inputHint: document.getElementById('inputHint'),

  // Settings
  settingsBtn: document.getElementById('btnSettings'),
  settingsModal: document.getElementById('settingsModal'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  btnCloseModal: document.getElementById('btnCloseModal'),

  // Settings inputs
  apiProvider: document.getElementById('apiProvider'),
  apiKey: document.getElementById('apiKey'),
  ttsVoice: document.getElementById('ttsVoice'),
  wakeWordEnabled: document.getElementById('wakeWordEnabled'),
  continuousListening: document.getElementById('continuousListening'),
  userName: document.getElementById('userName'),
  wakeWord: document.getElementById('wakeWord'),
  btnClearData: document.getElementById('btnClearData'),

  // Toast
  toastContainer: document.getElementById('toastContainer')
};

// ============================================
// INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadHistory();
  initEventListeners();
  initSpeechRecognition();
  initWakeWordDetection();
  renderHistory();
  updateUI();
  showToast('JARVIS prêt', 'success');
});

// ============================================
// GESTION DES PARAMÈTRES
// ============================================
async function loadSettings() {
  try {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
    state.settings = stored ? { ...CONFIG.DEFAULT_SETTINGS, ...JSON.parse(stored) } : { ...CONFIG.DEFAULT_SETTINGS };

    // Charger la clé API séparément (plus sécurisé)
    const apiKey = localStorage.getItem(CONFIG.STORAGE_KEYS.API_KEY);
    if (apiKey) state.settings.apiKey = apiKey;

    // Appliquer aux inputs
    applySettingsToInputs();
  } catch (e) {
    console.error('Erreur chargement settings:', e);
    state.settings = { ...CONFIG.DEFAULT_SETTINGS };
  }
}

function applySettingsToInputs() {
  const s = state.settings;
  elements.apiProvider.value = s.apiProvider || 'gemini';
  elements.apiKey.value = s.apiKey || '';
  elements.ttsVoice.value = s.ttsVoice || 'auto';
  elements.wakeWordEnabled.checked = s.wakeWordEnabled !== false;
  elements.continuousListening.checked = s.continuousListening === true;
  elements.userName.value = s.userName || 'Tom';
  elements.wakeWord.value = s.wakeWord || 'JARVIS';
}

async function saveSettings() {
  try {
    const newSettings = {
      apiProvider: elements.apiProvider.value,
      ttsVoice: elements.ttsVoice.value,
      wakeWordEnabled: elements.wakeWordEnabled.checked,
      continuousListening: elements.continuousListening.checked,
      userName: elements.userName.value || 'Tom',
      wakeWord: elements.wakeWord.value || 'JARVIS'
    };

    // Sauvegarder la clé API séparément
    if (elements.apiKey.value) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.API_KEY, elements.apiKey.value);
      newSettings.apiKey = elements.apiKey.value;
    }

    state.settings = { ...state.settings, ...newSettings };
    localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));

    // Réinitialiser la détection wake word si changé
    if (newSettings.wakeWord !== state.settings.wakeWord || newSettings.wakeWordEnabled !== state.settings.wakeWordEnabled) {
      initWakeWordDetection();
    }

    showToast('Paramètres sauvegardés', 'success');
    closeModal();
  } catch (e) {
    console.error('Erreur sauvegarde settings:', e);
    showToast('Erreur lors de la sauvegarde', 'error');
  }
}

// ============================================
// HISTORIQUE DES CONVERSATIONS
// ============================================
async function loadHistory() {
  try {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.HISTORY);
    state.history = stored ? JSON.parse(stored) : [];
  } catch (e) {
    state.history = [];
  }
}

function saveHistory() {
  try {
    // Garder seulement les 100 derniers messages
    const toSave = state.history.slice(-100);
    localStorage.setItem(CONFIG.STORAGE_KEYS.HISTORY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Erreur sauvegarde history:', e);
  }
}

function addToHistory(role, content, metadata = {}) {
  const message = {
    id: Date.now() + Math.random(),
    role,
    content,
    timestamp: new Date().toISOString(),
    ...metadata
  };
  state.history.push(message);
  saveHistory();
  return message;
}

function renderHistory() {
  // Garder le message de bienvenue
  const welcomeMsg = elements.chatMessages.querySelector('.message.welcome');
  elements.chatMessages.innerHTML = '';
  if (welcomeMsg) elements.chatMessages.appendChild(welcomeMsg);

  state.history.forEach(msg => {
    appendMessage(msg.role, msg.content, msg.metadata);
  });
  scrollToBottom();
}

function appendMessage(role, content, metadata = {}) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.dataset.id = metadata.id || Date.now();

  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (role === 'user') {
    div.innerHTML = `
      <div class="message-avatar user">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      <div class="message-content">${escapeHtml(content)}</div>
      <div class="message-time">${time}</div>
    `;
  } else {
    div.innerHTML = `
      <div class="message-avatar jarvis">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </div>
      <div class="message-content">${formatMessage(content)}</div>
      <div class="message-time">${time}</div>
    `;
  }

  elements.chatMessages.appendChild(div);
  scrollToBottom();
  return div;
}

function formatMessage(text) {
  // Convertir markdown basique
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// ============================================
// RECONNAISSANCE VOCALE
// ============================================
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('SpeechRecognition non supporté');
    elements.btnMic.disabled = true;
    elements.inputHint.textContent = 'Reconnaissance vocale non supportée sur ce navigateur';
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.lang = 'fr-FR';
  state.recognition.continuous = false;
  state.recognition.interimResults = true;
  state.recognition.maxAlternatives = 1;

  state.recognition.onstart = () => {
    state.isListening = true;
    updateListeningUI(true);
    elements.statusText.textContent = 'J\'écoute...';
    elements.orb.classList.add('listening');
  };

  state.recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (interimTranscript) {
      elements.textInput.value = interimTranscript;
      elements.textInput.style.color = 'var(--text-muted)';
    }

    if (finalTranscript) {
      elements.textInput.value = finalTranscript;
      elements.textInput.style.color = '';
      handleUserInput(finalTranscript.trim());
    }
  };

  state.recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    handleRecognitionError(event.error);
  };

  state.recognition.onend = () => {
    state.isListening = false;
    updateListeningUI(false);
    elements.orb.classList.remove('listening');

    // Redémarrer si écoute continue activée
    if (state.settings.continuousListening && !state.isSpeaking) {
      setTimeout(() => startListening(), 500);
    }
  };
}

function startListening() {
  if (!state.recognition || state.isListening || state.isSpeaking) return;

  try {
    state.recognition.start();
  } catch (e) {
    console.error('Erreur démarrage reconnaissance:', e);
    showToast('Erreur microphone', 'error');
  }
}

function stopListening() {
  if (state.recognition && state.isListening) {
    state.recognition.stop();
  }
}

function handleRecognitionError(error) {
  const messages = {
    'no-speech': 'Aucune parole détectée',
    'audio-capture': 'Erreur microphone',
    'not-allowed': 'Permission microphone refusée',
    'network': 'Erreur réseau'
  };
  showToast(messages[error] || `Erreur: ${error}`, 'warning');
}

function updateListeningUI(listening) {
  elements.btnMic.classList.toggle('listening', listening);
  elements.micIcon.classList.toggle('hidden', listening);
  elements.micListening.classList.toggle('hidden', !listening);
  elements.inputHint.textContent = listening ? 'Parlez maintenant...' : 'Appuyez sur l\'orbe ou le micro pour parler';
}

// ============================================
// DÉTECTION WAKE WORD
// ============================================
function initWakeWordDetection() {
  if (!state.settings.wakeWordEnabled) return;

  // Utiliser l'API Web Speech pour la détection continue en arrière-plan
  // Note: Pour une vraie détection wake word, il faudrait Porcupine ou similaire
  // Ici on utilise une approche simplifiée
  console.log('Wake word detection activé pour:', state.settings.wakeWord);
}

// ============================================
// SYNTHÈSE VOCALE (TTS)
// ============================================
function speak(text, options = {}) {
  return new Promise((resolve) => {
    if (!state.synth) {
      resolve();
      return;
    }

    // Arrêter toute synthèse en cours
    state.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = state.settings.ttsVoice || 'fr-FR';
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;

    // Sélectionner la voix
    const voices = state.synth.getVoices();
    const preferredVoice = voices.find(v =>
      v.lang.startsWith('fr') || v.lang.startsWith('fr-FR')
    );
    if (preferredVoice) utterance.voice = preferredVoice;

    state.isSpeaking = true;
    elements.orb.classList.add('speaking');
    elements.statusText.textContent = 'JARVIS parle...';

    utterance.onend = () => {
      state.isSpeaking = false;
      elements.orb.classList.remove('speaking');
      updateStatusIdle();
      resolve();
    };

    utterance.onerror = (e) => {
      console.error('TTS error:', e);
      state.isSpeaking = false;
      elements.orb.classList.remove('speaking');
      updateStatusIdle();
      resolve();
    };

    state.synth.speak(utterance);
  });
}

function updateStatusIdle() {
  if (!state.isListening && !state.isSpeaking) {
    elements.statusText.textContent = 'En veille';
    elements.orb.classList.remove('listening', 'speaking', 'thinking');
  }
}

// ============================================
// GESTION DES ENTRÉES UTILISATEUR
// ============================================
async function handleUserInput(input) {
  if (!input.trim()) return;

  // Ajouter à l'historique
  addToHistory('user', input);
  appendMessage('user', input);

  // Vider l'input
  elements.textInput.value = '';
  elements.btnSend.classList.add('hidden');

  // Afficher indicateur de réflexion
  showTypingIndicator(true);
  elements.orb.classList.add('thinking');
  elements.statusText.textContent = 'Réflexion...';

  try {
    // Obtenir la réponse de l'IA
    const response = await getAIResponse(input);

    // Ajouter à l'historique
    addToHistory('assistant', response);
    appendMessage('assistant', response);

    // Parler la réponse
    await speak(response);

  } catch (error) {
    console.error('Erreur traitement:', error);
    const errorMsg = 'Désolé, une erreur est survenue. Veuillez réessayer.';
    appendMessage('assistant', errorMsg);
    await speak(errorMsg);
    showToast('Erreur de traitement', 'error');
  } finally {
    showTypingIndicator(false);
    elements.orb.classList.remove('thinking');
    updateStatusIdle();
  }
}

function showTypingIndicator(show) {
  elements.typingIndicator.classList.toggle('hidden', !show);
  if (show) scrollToBottom();
}

// ============================================
// API IA
// ============================================
async function getAIResponse(userInput) {
  const provider = state.settings.apiProvider || 'gemini';
  const apiKey = state.settings.apiKey || localStorage.getItem(CONFIG.STORAGE_KEYS.API_KEY);

  if (!apiKey) {
    throw new Error('Clé API manquante. Configurez-la dans les paramètres.');
  }

  // Construire le contexte de conversation
  const systemPrompt = `Tu es JARVIS, un assistant vocal intelligent personnel. 
Tu réponds de manière concise, naturelle et utile en français.
L'utilisateur s'appelle ${state.settings.userName || 'Tom'}.
Tu as accès à des informations en temps réel via des outils si nécessaire.
Réponds brièvement (2-3 phrases max) sauf demande contraire.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...state.history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userInput }
  ];

  if (provider === 'groq') {
    return await callGroqAPI(messages, apiKey);
  } else {
    return await callGeminiAPI(messages, apiKey);
  }
}

async function callGeminiAPI(messages, apiKey) {
  // Convertir au format Gemini
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  // Ajouter le system prompt au premier message utilisateur
  if (contents.length > 0 && contents[0].role === 'user') {
    contents[0].parts.unshift({ text: messages[0].content + '\n\n' });
  }

  const response = await fetch(`${CONFIG.API_ENDPOINTS.gemini}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Erreur API: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Pas de réponse';
}

async function callGroqAPI(messages, apiKey) {
  const response = await fetch(CONFIG.API_ENDPOINTS.groq, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Erreur API: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Pas de réponse';
}

// ============================================
// INTERFACE UTILISATEUR
// ============================================
function updateUI() {
  const s = state.settings;
  elements.userName.value = s.userName || 'Tom';
  elements.wakeWord.value = s.wakeWord || 'JARVIS';
}

function updateOrbState(stateClass) {
  elements.orb.className = 'orb';
  if (stateClass) elements.orb.classList.add(stateClass);
}

// ============================================
// MODAL PARAMÈTRES
// ============================================
function openModal() {
  elements.settingsModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  // Focus sur le premier input
  setTimeout(() => elements.apiKey.focus(), 100);
}

function closeModal() {
  elements.settingsModal.classList.add('hidden');
  document.body.style.overflow = '';
}

function clearAllData() {
  if (confirm('Êtes-vous sûr de vouloir effacer toutes les données (historique, paramètres, clés API) ?')) {
    localStorage.clear();
    state.history = [];
    state.settings = { ...CONFIG.DEFAULT_SETTINGS };
    applySettingsToInputs();
    renderHistory();
    showToast('Toutes les données effacées', 'success');
    closeModal();
  }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Fermer">×</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());

  elements.toastContainer.appendChild(toast);

  // Animation d'entrée
  requestAnimationFrame(() => toast.classList.add('show'));

  // Auto-suppression
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================
// EVENT LISTENERS
// ============================================
function initEventListeners() {
  // Orb principal - click pour écouter
  elements.orb.addEventListener('click', () => {
    if (state.isListening) {
      stopListening();
    } else if (!state.isSpeaking) {
      startListening();
    }
  });

  // Bouton micro
  elements.btnMic.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.isListening) {
      stopListening();
    } else if (!state.isSpeaking) {
      startListening();
    }
  });

  // Input texte
  elements.textInput.addEventListener('input', () => {
    const hasText = elements.textInput.value.trim().length > 0;
    elements.btnSend.classList.toggle('hidden', !hasText);
  });

  elements.textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = elements.textInput.value.trim();
      if (text) handleUserInput(text);
    }
  });

  elements.btnSend.addEventListener('click', () => {
    const text = elements.textInput.value.trim();
    if (text) handleUserInput(text);
  });

  // Paramètres
  elements.settingsBtn.addEventListener('click', openModal);
  elements.btnCloseModal.addEventListener('click', closeModal);
  elements.modalBackdrop.addEventListener('click', closeModal);

  // Sauvegarde paramètres
  [elements.apiProvider, elements.apiKey, elements.ttsVoice,
   elements.wakeWordEnabled, elements.continuousListening,
   elements.userName, elements.wakeWord].forEach(el => {
    el.addEventListener('change', saveSettings);
  });

  elements.btnClearData.addEventListener('click', clearAllData);

  // Fermer modal avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.settingsModal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Chargement des voix TTS
  if (state.synth) {
    state.synth.onvoiceschanged = () => {
      populateVoiceList();
    };
    populateVoiceList();
  }
}

function populateVoiceList() {
  if (!state.synth) return;
  const voices = state.synth.getVoices();
  const frenchVoices = voices.filter(v => v.lang.startsWith('fr'));

  elements.ttsVoice.innerHTML = '<option value="auto">Auto (navigateur)</option>';
  frenchVoices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.lang;
    opt.textContent = `${v.name} (${v.lang})`;
    elements.ttsVoice.appendChild(opt);
  });

  // Restaurer la sélection
  if (state.settings.ttsVoice) {
    elements.ttsVoice.value = state.settings.ttsVoice;
  }
}

// ============================================
// GESTION DU CYCLE DE VIE
// ============================================
// Gérer la visibilité de la page
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopListening();
    if (state.isSpeaking) state.synth.cancel();
  } else if (state.settings.continuousListening && !state.isSpeaking) {
    setTimeout(() => startListening(), 1000);
  }
});

// Gérer les erreurs globales
window.addEventListener('error', (e) => {
  console.error('Erreur globale:', e.error);
  showToast('Une erreur est survenue', 'error');
});

// Nettoyage à la fermeture
window.addEventListener('beforeunload', () => {
  stopListening();
  if (state.synth) state.synth.cancel();
});

console.log('JARVIS initialisé avec succès');