/**
 * JARVIS PWA v5 — Assistant Téléphone Complet SANS API
 * Fonctionne gratuitement sans aucune clé API
 * IA: Pollinations.ai (gratuit) + Fallback local intelligent
 * TTS: Navigateur (gratuit) | Optional: ElevenLabs
 * Météo: wttr.in (gratuit)
 */

const CFG = {
  KEYS: { S: 'j5_s', H: 'j5_h', AK: 'j5_ak', EK: 'j5_ek', R: 'j5_r', N: 'j5_n' },
  DEF: { apiProvider:'free', ttsEngine:'browser', ttsRate:1, elevenVoice:'EXAVITQu4vr4xnSDxMaL', userName:'Tom', continuousListening:false },
  FREE_AI: 'https://text.pollinations.ai/',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  GROQ: 'https://api.groq.com/openai/v1/chat/completions',
  ELEVEN: 'https://api.elevenlabs.io/v1/text-to-speech',
  WEATHER: 'https://wttr.in/{city}?format=j1&lang=fr'
};

const ST = { s:{}, h:[], reminders:[], notes:[], listening:false, speaking:false, rec:null, synth:speechSynthesis };

// DOM
const $=id=>document.getElementById(id);
const el={};
function cacheDom(){
  ['orb','statusText','messages','chat','typing','btnMic','textInput','btnSend',
   'btnSettings','overlay','modal','btnClose','toasts','apiProvider','apiKey',
   'ttsEngine','ttsVoice','ttsRate','rateVal','elevenKey','elevenVoice','elevenLabsFields',
   'userName','continuousListening','btnClear','btnTestVoice','quickActions',
   'btnReminders','reminderBadge','remindersOverlay','remindersModal','btnCloseReminders','remindersList'
  ].forEach(id=>{ el[id]=$(id); });
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded',()=>{
  cacheDom(); loadAll(); bindAll(); initSpeech(); populateVoices();
  requestNotificationPermission();
  toast('JARVIS prêt — tapez un message','success');
});

// =============================================
// PERSISTENCE
// =============================================
function loadAll(){
  try{ ST.s={...CFG.DEF,...JSON.parse(localStorage.getItem(CFG.KEYS.S))}; }catch{ ST.s={...CFG.DEF}; }
  const ak=localStorage.getItem(CFG.KEYS.AK); if(ak) ST.s.apiKey=ak;
  const ek=localStorage.getItem(CFG.KEYS.EK); if(ek) ST.s.elevenKey=ek;
  try{ ST.h=JSON.parse(localStorage.getItem(CFG.KEYS.H))||[]; }catch{ ST.h=[]; }
  try{ ST.reminders=JSON.parse(localStorage.getItem(CFG.KEYS.R))||[]; }catch{ ST.reminders=[]; }
  try{ ST.notes=JSON.parse(localStorage.getItem(CFG.KEYS.N))||[]; }catch{ ST.notes=[]; }
  syncUI(); renderReminders();
}
function saveS(){ localStorage.setItem(CFG.KEYS.S,JSON.stringify(ST.s)); }
function saveH(){ localStorage.setItem(CFG.KEYS.H,JSON.stringify(ST.h.slice(-100))); }
function saveR(){ localStorage.setItem(CFG.KEYS.R,JSON.stringify(ST.reminders)); }
function saveN(){ localStorage.setItem(CFG.KEYS.N,JSON.stringify(ST.notes)); }

function addH(role,content){
  const m={id:Date.now()+Math.random(),role,content,ts:Date.now()};
  ST.h.push(m); saveH(); return m;
}

// =============================================
// UI SYNC
// =============================================
function syncUI(){
  const s=ST.s;
  el.apiProvider.value=s.apiProvider||'free';
  el.apiKey.value=s.apiKey||'';
  el.ttsEngine.value=s.ttsEngine||'browser';
  el.ttsRate.value=s.ttsRate||1;
  el.rateVal.textContent=(s.ttsRate||1).toFixed(1)+'x';
  el.elevenKey.value=s.elevenKey||'';
  el.elevenVoice.value=s.elevenVoice||CFG.DEF.elevenVoice;
  el.userName.value=s.userName||'Tom';
  el.continuousListening.checked=!!s.continuousListening;
  toggleEleven(s.ttsEngine==='elevenlabs');
  updateBadge();
}
function toggleEleven(on){ el.elevenLabsFields.classList.toggle('hidden',!on); }

// =============================================
// CHAT UI
// =============================================
function appendMsg(role,content,actionCard){
  const d=document.createElement('div');
  d.className=`msg ${role}`;
  const avCls=role==='user'?'user-av':'jarvis-av';
  const avSvg=role==='user'
    ?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
    :'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  let html=`<div class="msg-avatar ${avCls}">${avSvg}</div><div class="msg-body"><div class="msg-text">${fmt(content)}</div>`;
  if(actionCard) html+=actionCard;
  html+='</div>';
  d.innerHTML=html;
  el.messages.appendChild(d);
  scrollBottom();
  return d;
}

function fmt(t){
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/\n/g,'<br>');
}

function scrollBottom(){ el.chat.scrollTop=el.chat.scrollHeight; }
function showTyping(on){ el.typing.classList.toggle('hidden',!on); if(on)scrollBottom(); }
function setOrb(s){ el.orb.className='orb'; if(s)el.orb.classList.add(s); }
function setStatus(t,c){ el.statusText.textContent=t; el.statusText.className='status'; if(c)el.statusText.classList.add(c); }
function toast(msg,type='info'){ const t=document.createElement('div'); t.className=`toast ${type}`; t.textContent=msg; el.toasts.appendChild(t); setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300)},3000); }

// =============================================
// REMINDERS & NOTES
// =============================================
function setReminder(text, minutes){
  const r={id:Date.now(),text,fireAt:Date.now()+minutes*60*1000,done:false};
  ST.reminders.push(r); saveR(); updateBadge();
  setTimeout(()=>fireReminder(r), minutes*60*1000);
  return r;
}
function fireReminder(r){
  r.done=true; saveR(); updateBadge();
  showNotification('🔔 Rappel JARVIS', r.text);
  toast('Rappel: '+r.text,'warn');
}
function deleteReminder(id){ ST.reminders=ST.reminders.filter(r=>r.id!==id); saveR(); updateBadge(); renderReminders(); }
function addNote(text){ const n={id:Date.now(),text,ts:Date.now()}; ST.notes.push(n); saveN(); return n; }
function deleteNote(id){ ST.notes=ST.notes.filter(n=>n.id!==id); saveN(); renderReminders(); }

function updateBadge(){
  const active=ST.reminders.filter(r=>!r.done).length;
  el.reminderBadge.textContent=active;
  el.reminderBadge.classList.toggle('hidden',active===0);
}
function renderReminders(){
  const items=[...ST.reminders.filter(r=>!r.done).map(r=>({...r,type:'reminder'})),...ST.notes.map(n=>({...n,type:'note'}))];
  items.sort((a,b)=>(b.ts||b.fireAt)-(a.ts||a.fireAt));
  if(items.length===0){ el.remindersList.innerHTML='<p class="empty-state">Aucun rappel ou note.</p>'; return; }
  el.remindersList.innerHTML=items.map(it=>{
    if(it.type==='reminder'){
      const d=new Date(it.fireAt);
      const timeStr=d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      return `<div class="reminder-item"><div class="ri-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg></div><div class="ri-text">${esc(it.text)}<div class="ri-time">${timeStr}</div></div><button class="ri-del" onclick="deleteReminder(${it.id})">✕</button></div>`;
    } else {
      const d=new Date(it.ts);
      return `<div class="reminder-item"><div class="ri-icon note-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div class="ri-text">${esc(it.text)}<div class="ri-time">${d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div></div><button class="ri-del" onclick="deleteNote(${it.id})">✕</button></div>`;
    }
  }).join('');
}
function esc(t){ const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }

// =============================================
// NOTIFICATIONS
// =============================================
function requestNotificationPermission(){
  if('Notification' in window && Notification.permission==='default'){
    Notification.requestPermission();
  }
}
function showNotification(title,body){
  if('Notification' in window && Notification.permission==='granted'){
    new Notification(title,{body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',vibrate:[200,100,200]});
  }
}

// =============================================
// SPEECH RECOGNITION
// =============================================
function initSpeech(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ el.btnMic.onclick=()=>toast('Micro non supporté','error'); return; }
  ST.rec=new SR();
  ST.rec.lang='fr-FR'; ST.rec.continuous=false; ST.rec.interimResults=true; ST.rec.maxAlternatives=1;
  ST.rec.onstart=()=>{ ST.listening=true; setOrb('listening'); setStatus("J'écoute..."); el.btnMic.classList.add('listening'); };
  ST.rec.onresult=(ev)=>{ let f='',i2=''; for(let i=ev.resultIndex;i<ev.results.length;i++){const t=ev.results[i][0].transcript;if(ev.results[i].isFinal)f+=t;else i2+=t;} if(i2)el.textInput.value=i2; if(f){el.textInput.value='';handleInput(f.trim());}};
  ST.rec.onerror=(ev)=>{ if(ev.error!=='no-speech'&&ev.error!=='aborted')toast('Micro: '+ev.error,'error'); };
  ST.rec.onend=()=>{ ST.listening=false; el.btnMic.classList.remove('listening'); if(!ST.speaking){setOrb('');setStatus('Prêt');} if(ST.s.continuousListening&&!ST.speaking)setTimeout(()=>startListening(),800); };
}
function startListening(){ if(!ST.rec||ST.listening||ST.speaking)return; try{ST.rec.start();}catch{} }
function stopListening(){ if(ST.rec&&ST.listening)ST.rec.stop(); }

// =============================================
// TTS
// =============================================
async function speak(text){
  const clean=text.replace(/\*\*/g,'').replace(/\*/g,'').replace(/`/g,'').replace(/<[^>]+>/g,'');
  if(!clean.trim())return;
  ST.speaking=true; setOrb('speaking'); setStatus('Parle...');
  try{
    if(ST.s.ttsEngine==='elevenlabs'&&ST.s.elevenKey) await ttsEleven(clean);
    else await ttsBrowser(clean);
  }catch(e){ console.warn('TTS:',e); if(ST.s.ttsEngine==='elevenlabs'){try{await ttsBrowser(clean);}catch{}} }
  ST.speaking=false; if(!ST.listening){setOrb('');setStatus('Prêt');}
}
function ttsBrowser(text){
  return new Promise(resolve=>{
    if(!ST.synth){resolve();return;}
    ST.synth.cancel();
    const chunks=text.length>200?splitText(text,200):[text];
    let idx=0;
    function next(){
      if(idx>=chunks.length){resolve();return;}
      const u=new SpeechSynthesisUtterance(chunks[idx]);
      u.lang='fr-FR'; u.rate=ST.s.ttsRate||1; u.pitch=1;
      const voices=ST.synth.getVoices();
      const v=voices.find(v2=>v2.name.includes('Thomas')&&v2.lang.startsWith('fr'))
           ||voices.find(v2=>v2.name.includes('Amélie'))
           ||voices.find(v2=>v2.name.includes('Hortense'))
           ||voices.find(v2=>v2.name.includes('Denise'))
           ||voices.find(v2=>v2.lang==='fr-FR')
           ||voices.find(v2=>v2.lang.startsWith('fr'));
      if(v)u.voice=v;
      u.onend=()=>{idx++;next();}; u.onerror=()=>{idx++;next();};
      ST.synth.speak(u);
    }
    next();
  });
}
function splitText(t,m){const c=[];const s=t.replace(/\n/g,' ').split(/(?<=[.!?])\s+/);let cur='';for(const p of s){if((cur+' '+p).length>m&&cur){c.push(cur.trim());cur=p;}else{cur=cur?cur+' '+p:p;}}if(cur.trim())c.push(cur.trim());return c.length?c:[t.substring(0,m)];}
async function ttsEleven(text){
  const key=ST.s.elevenKey; const vid=ST.s.elevenVoice||CFG.DEF.elevenVoice;
  if(!key)throw new Error('Clé ElevenLabs manquante');
  const chunks=text.length>4000?splitText(text,4000):[text];
  for(const chunk of chunks){
    const r=await fetch(`${CFG.ELEVEN}/${vid}`,{method:'POST',headers:{'Content-Type':'application/json','xi-api-key':key},body:JSON.stringify({text:chunk,model_id:'eleven_multilingual_v2',voice_settings:{stability:.5,similarity_boost:.75,style:.3,use_speaker_boost:true}})});
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail?.message||`ElevenLabs ${r.status}`);}
    const blob=await r.blob();
    await new Promise((res,rej)=>{const u=URL.createObjectURL(blob);const a=new Audio(u);a.onend=()=>{URL.revokeObjectURL(u);res();};a.onerror=e=>{URL.revokeObjectURL(u);rej(e);};a.play().catch(rej);});
  }
}
function populateVoices(){
  if(!ST.synth)return;
  const load=()=>{ST.synth.getVoices();};
  ST.synth.onvoiceschanged=load; load();
}

// =============================================
// AI API
// =============================================
const ACTION_PROMPT=`Tu es JARVIS, l'assistant personnel de {name}. Tu réponds en français, concis et utile.

CAPACITÉS — Tu peux exécuter ces actions en incluant une balise [ACTION:...] dans ta réponse :
- Appel: [ACTION:call:NUMERO:NOM] — ex: [ACTION:call:0612345678:Maman]
- SMS: [ACTION:sms:NUMERO:MESSAGE] — ex: [ACTION:sms:0612345678:Je suis en retard]
- Email: [ACTION:email:ADRESSE:OBJET] — ex: [ACTION:email:tom@email.com:Bonjour]
- Rappel: [ACTION:reminder:MINUTES:TEXTE] — ex: [ACTION:reminder:30:Prendre médocs]
- Minuterie: [ACTION:timer:MINUTES] — ex: [ACTION:timer:10]
- Note: [ACTION:note:TEXTE] — ex: [ACTION:note:Acheter du lait]
- Météo: [ACTION:weather:VILLE] — ex: [ACTION:weather:Paris]
- Carte: [ACTION:map:RECHERCHE] — ex: [ACTION:map:Pizza paris]
- Calcul: [ACTION:calc:EXPRESSION] — ex: [ACTION:calc:15*3+7]

Tu peux combiner texte + action. Réponds toujours d'abord en langage naturel, puis l'action.
Si l'utilisateur demande un rappel, calcule le nombre de minutes.
Si l'utilisateur veut appeler/sms quelqu'un que tu ne connais pas, demande le numéro.`;

// =============================================
// LOCAL INTELLIGENCE — works without any API
// =============================================
function localReply(input){
  const t=input.toLowerCase().trim();
  const name=ST.s.userName||'Tom';

  // Date & time
  if(/heure|temps|quelle heure|date|aujourd.hui|jour/.test(t)){
    const now=new Date();
    if(/date|aujourd|jour/.test(t)){
      return `Aujourd'hui nous sommes le ${now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}.`;
    }
    return `Il est ${now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}.`;
  }

  // Calculator
  if(/^calcule?|^calcul|^combien\s+(fait|vaut|donne)|^[\d\s\+\-\*\/\.\(\)%]+$/.test(t)){
    const expr=t.replace(/^[a-zàâäéèêëïîôùûüÿçœæ\s]+/i,'').replace(/[^0-9\+\-\*\/\.\(\)%]/g,'');
    if(expr&&/^[\d\+\-\*\/\.\(\)%\s]+$/.test(expr)){
      try{const r=Function('"use strict";return ('+expr+')')();return `${expr} = **${r}**`;}
      catch{return 'Impossible de calculer cette expression.';}
    }
    const expr2=t.replace(/[^\d\+\-\*\/\.\(\)%]/g,'').trim();
    if(expr2){
      try{const r=Function('"use strict";return ('+expr2+')')();return `${expr2} = **${r}**`;}
      catch{return 'Impossible de calculer cette expression.';}
    }
  }

  // Reminders
  if(/rappelle?[- ]?moi|rappel|minuterie|alarme/.test(t)){
    const mins=parseInt(t.match(/(\d+)\s*(min|minute)/)?.[1]||'');
    const what=t.replace(/.*?(rappelle?-?moi\s*(de\s*)?|rappel\s*:?\s*|alarme\s*:?\s*|minuterie\s*:?\s*)/i,'').trim();
    if(mins>0){
      return `[ACTION:reminder:${mins}:${what||'Rappel'}] J'编程e un rappel dans ${mins} minute(s).`;
    }
    return 'Pour programmer un rappel, dis-moi : "Rappelle-moi dans X minutes de faire truc".';
  }

  // Timer
  if(/minuterie|timer/.test(t)){
    const mins=parseInt(t.match(/(\d+)/)?.[1]||'1');
    return `[ACTION:timer:${mins}] Minuterie lancée pour ${mins} minute(s).`;
  }

  // Notes
  if(/note|prends? note|enregistre|sauvegarde/.test(t)){
    const what=t.replace(/.*?(note|prends?\s*note|enregistre|sauvegarde)\s*:?\s*/i,'').trim();
    if(what)return `[ACTION:note:${what}] Note enregistrée : "${what}".`;
    return 'Pour prendre une note, dis-moi : "Note : ton texte".';
  }

  // Weather
  if(/m[eé]t[eé]o|temp[eé]rature|qu.il fait/.test(t)){
    const city=t.replace(/.*?(m[eé]t[eé]o|temp[eé]rature)\s*(à|a|de|sur|pour)?\s*/i,'').trim().replace(/\s*\?$/,'');
    if(city)return `[ACTION:weather:${city}]`;
    return 'Dis-moi la ville : "Météo à Paris" par exemple.';
  }

  // Call
  if(/appelle?|appeler|compose|num[eé]ro|t[ée]l[eé]phone/.test(t)){
    const num=t.match(/([\d\s\-\+\.]{7,})/)?.[1]?.trim()||'';
    const what=t.replace(/.*?(appelle?|appeler|compose)\s*/i,'').trim();
    if(num)return `[ACTION:call:${num}:${what||num}] J'ouvre le拨号 pour ${what||num}.`;
    return 'Dis-moi le numéro ou le contact : "Appelle le 06 12 34 56 78".';
  }

  // SMS
  if(/sms|message|texte|envoie.*message/.test(t)){
    const num=t.match(/([\d\s\-\+\.]{7,})/)?.[1]?.trim()||'';
    const msg=t.replace(/.*?(sms|message|texte)\s*(à|a|pour)?\s*[\d\s\-\+\.]*\s*/i,'').replace(/.*?envoie.*message\s*/i,'').trim();
    if(num)return `[ACTION:sms:${num}:${msg||'Bonjour !'}] Message envoyé à ${num}.`;
    return 'Dis-moi le numéro et le message : "SMS au 06 12 34 56 78 : Bonjour".';
  }

  // Email
  if(/email|mail|courriel/.test(t)){
    const addr=t.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0]||'';
    const what=t.replace(/.*?(email|mail|courriel)\s*(à|a|pour)?\s*/i,'').replace(/[\w.-]+@[\w.-]+\.\w+/,'').trim();
    if(addr)return `[ACTION:email:${addr}:${what||'Sans objet'}]`;
    return 'Dis-moi l\'adresse email : "Email à contact@example.com : objet"';
  }

  // Map
  if(/carte|maps?|plan|localise|o[ù] se trouve|adresse|comment aller/.test(t)){
    const where=t.replace(/.*?(carte?|maps?|plan|localise|o[ù]\s*se\s*trouve|adresse|comment\s*aller)\s*:?\s*/i,'').trim();
    if(where)return `[ACTION:map:${where}]`;
    return 'Dis-moi où : "Ouvre Maps gare de Lyon"';
  }

  // Who am I / identity
  if(/qui (es-tu|est tu|es vous)|ton nom|je m'appelle|comment tu t'appelles/.test(t)){
    if(/je m'appelle|mon nom/.test(t)){
      const newName=t.replace(/.*?(je m'appelle|mon nom (est|c'est)?)\s*/i,'').trim();
      if(newName){ST.s.userName=newName;saveSettings();return `Enchanté ${newName} ! Je me souviendrai de ton nom.`;}
    }
    return `Je suis JARVIS, ton assistant personnel. Et toi tu t'appelles ${name} !`;
  }

  // Greetings
  if(/^(bonjour|salut|coucou|hey|hello|bonsoir|yo)\b/.test(t)){
    const h=new Date().getHours();
    const greet=h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir';
    return `${greet} ${name} ! Comment puis-je t'aider ?`;
  }

  // How are you
  if(/comment (va|tu vas|ça va)|ca va|ça roule/.test(t)){
    return `Je vais très bien ${name}, merci ! Prêt à t'aider. 😊`;
  }

  // Thanks
  if(/merci|thanks|thx/.test(t)){
    return `De rien ${name} ! Je suis toujours là si tu as besoin.`;
  }

  // Jokes
  if(/blague|plaisanterie|rigole|amusant|dr[ôo]le/.test(t)){
    const jokes=[
      'Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tomberaient dans le bateau ! 😄',
      'Qu\'est-ce qu\'un canif ? Un petit couteau. Un gros canif ? Un gros petit couteau ! 😂',
      'Que fait une fraise sur un cheval ? Tagada ! 🍓',
      'Pourquoi les maths sont tristes ? Parce qu\'ils ont trop de problèmes ! 📐',
      'Qu\'est-ce qui est orange et qui monte ? Une orange qui monte ! 🍊'
    ];
    return jokes[Math.floor(Math.random()*jokes.length)];
  }

  // Motivation
  if(/motivation|motivant|inspir[ae]|citation|phrase du jour/.test(t)){
    const quotes=[
      '"Le succès est la somme de petits efforts répétés jour après jour." — Robert Collier',
      '"La唯一的 façon de faire du bon travail est d\'aimer ce que tu fais." — Steve Jobs',
      '"Ce n\'est pas la destination mais le voyage qui compte."',
      '"Chaque expert était autrefois un débutant." — Helen Hayes',
      '"Le meilleur moment pour planter un arbre était il y a 20 ans. Le deuxième meilleur moment, c\'est maintenant."'
    ];
    return quotes[Math.floor(Math.random()*quotes.length)];
  }

  // Help
  if(/aide|help|que sais|que peux|commande/.test(t)){
    return `Je peux t'aider avec :\n\n📞 **Appels** — "Appelle le 06..."\n💬 **SMS** — "SMS au 06..."\n📧 **Email** — "Email à machin..."\n⏰ **Rappels** — "Rappelle-moi dans 30 min"\n📝 **Notes** — "Note : truc à faire"\n🌤️ **Météo** — "Météo à Paris"\n🗺️ **Carte** — "Ouvre Maps..."\n🧮 **Calcul** — "Calcule 15*3+7"\n😂 **Blagues** — "Raconte une blague"\n💪 **Motivation** — "Phrase motivante"\n\nTout est gratuit, aucune clé API nécessaire !`;
  }

  // Default: no local match → will try online AI
  return null;
}

// =============================================
// AI — Free (Pollinations.ai) or Premium (Gemini/Groq)
// =============================================
async function getAI(input){
  const prov=ST.s.apiProvider||'free';
  const key=ST.s.apiKey||localStorage.getItem(CFG.KEYS.AK);
  const sys=ACTION_PROMPT.replace('{name}',ST.s.userName||'Tom');

  // 1. Try local intelligence first (instant, no network)
  const local=localReply(input);
  if(local)return local;

  // 2. Free AI — Pollinations.ai (no key needed)
  if(prov==='free'||(!key&&prov!=='gemini'&&prov!=='groq')){
    try{
      const msgs=[{role:'system',content:sys},...ST.h.slice(-8).map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content})),{role:'user',content:input}];
      const r=await fetch(CFG.FREE_AI,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:msgs,seed:Math.floor(Math.random()*10000),jsonMode:false})});
      if(r.ok){
        const txt=await r.text();
        if(txt&&txt.length>2)return txt.trim();
      }
    }catch(e){console.warn('Pollinations failed, trying fallback',e);}
    // If Pollinations fails, give a helpful local response
    return `Je suis en mode hors-ligne pour cette question. Je peux t'aider avec les commandes de base ! Tape "aide" pour voir tout ce que je peux faire.`;
  }

  // 3. Premium — Gemini
  if(prov==='gemini'&&key){
    const contents=[...ST.h.slice(-8).map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),{role:'user',parts:[{text:sys+'\n\n'+input}]}];
    const r=await fetch(`${CFG.GEMINI}?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents,generationConfig:{temperature:.7,maxOutputTokens:1024}})});
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||`Erreur ${r.status}`);}
    const d=await r.json(); return d.candidates?.[0]?.content?.parts?.[0]?.text||'Pas de réponse.';
  }

  // 4. Premium — Groq
  if(prov==='groq'&&key){
    const msgs=[{role:'system',content:sys},...ST.h.slice(-8).map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content})),{role:'user',content:input}];
    const r=await fetch(CFG.GROQ,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:msgs,temperature:.7,max_tokens:1024})});
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||`Erreur ${r.status}`);}
    const d=await r.json(); return d.choices?.[0]?.message?.content||'Pas de réponse.';
  }

  // Fallback
  return 'Je ne peux pas traiter cette demande. Tape "aide" pour voir les commandes disponibles.';
}

// =============================================
// ACTION EXECUTOR
// =============================================
function parseAndExec(text){
  const actionRegex=/\[ACTION:(\w+):([^\]]*)\]/g;
  let match; let cleanText=text;
  const actions=[];

  while((match=actionRegex.exec(text))!==null){
    const type=match[1];
    const parts=match[2].split(':');
    actions.push({type,parts});
    cleanText=cleanText.replace(match[0],'').trim();
  }

  // Execute actions
  for(const act of actions){
    execAction(act);
  }

  return {text:cleanText, actions};
}

function execAction(act){
  switch(act.type){
    case 'call': {
      const num=act.parts[0]||'';
      const name=act.parts[1]||num;
      if(num){
        const card=makeActionCard('call',`Appeler ${name}`,num,`tel:${num}`);
        appendMsg('assistant','',card);
        // Also open directly
        window.location.href=`tel:${num}`;
      }
      break;
    }
    case 'sms': {
      const num=act.parts[0]||'';
      const msg=act.parts.slice(1).join(':')||'';
      if(num){
        const card=makeActionCard('sms',`SMS à ${num}`,msg,`sms:${num}&body=${encodeURIComponent(msg)}`);
        appendMsg('assistant','',card);
        window.location.href=`sms:${num}&body=${encodeURIComponent(msg)}`;
      }
      break;
    }
    case 'email': {
      const addr=act.parts[0]||'';
      const subj=act.parts.slice(1).join(':')||'';
      if(addr){
        const card=makeActionCard('email',`Email à ${addr}`,subj,`mailto:${addr}?subject=${encodeURIComponent(subj)}`);
        appendMsg('assistant','',card);
        window.location.href=`mailto:${addr}?subject=${encodeURIComponent(subj)}`;
      }
      break;
    }
    case 'reminder': {
      const mins=parseInt(act.parts[0])||5;
      const text=act.parts.slice(1).join(':')||'Rappel';
      const r=setReminder(text,mins);
      const d=new Date(r.fireAt);
      const timeStr=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      const card=makeActionCard('reminder',`Rappel dans ${mins} min`,`${timeStr} — ${text}`);
      appendMsg('assistant','',card);
      showNotification('⏰ Rappel programmé',`Dans ${mins} min: ${text}`);
      break;
    }
    case 'timer': {
      const mins=parseInt(act.parts[0])||1;
      setTimeout(()=>{
        showNotification('⏱️ Minuterie terminée!',`${mins} minute(s) écoulée(s)`);
        toast(`⏱️ Minuterie: ${mins} min écoulées!`,'warn');
      },mins*60*1000);
      const card=makeActionCard('timer',`Minuterie: ${mins} min`,`${mins} minute(s)`);
      appendMsg('assistant','',card);
      break;
    }
    case 'note': {
      const text=act.parts.join(':')||'Note vide';
      addNote(text);
      const card=makeActionCard('note','Note sauvegardée',text);
      appendMsg('assistant','',card);
      break;
    }
    case 'weather': {
      const city=act.parts.join(':')||'Paris';
      fetchWeather(city);
      break;
    }
    case 'map': {
      const q=act.parts.join(':')||'';
      if(q){
        const url=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
        const card=makeActionCard('map',`Carte: ${q}`,q,url);
        appendMsg('assistant','',card);
        window.open(url,'_blank');
      }
      break;
    }
    case 'calc': {
      const expr=act.parts.join(':')||'0';
      try{const result=eval(expr.replace(/[^0-9+\-*/().% ]/g,''));toast(`📐 ${expr} = ${result}`,'success');}catch{toast('Calcule erreur','error');}
      break;
    }
  }
}

function makeActionCard(type,title,sub,url){
  const icons={
    call:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    sms:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    email:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    reminder:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    map:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
    note:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    timer:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
  };
  const arrow= url ? `<a class="action-card ${type}" href="${url}" target="_blank" rel="noopener"><div class="ac-icon ${type}">${icons[type]||''}</div><div class="ac-text"><div class="ac-title">${title}</div><div class="ac-sub">${esc(sub)}</div></div><div class="ac-arrow">›</div></a>` : '';
  return arrow;
}

async function fetchWeather(city){
  try{
    const r=await fetch(CFG.WEATHER.replace('{city}',encodeURIComponent(city)));
    const d=await r.json();
    const c=d.current_condition?.[0];
    if(!c){appendMsg('assistant',`Météo non disponible pour ${city}`);return;}
    const temp=c.temp_C;
    const desc=c.weatherDesc?.[0]?.value||'';
    const humidity=c.humidity;
    const wind=c.windspeedKmph;
    const emoji=desc.includes('sun')||desc.includes('clair')?'☀️':desc.includes('cloud')||desc.includes('nuage')?'☁️':desc.includes('rain')||desc.includes('pluie')?'🌧️':desc.includes('snow')||desc.includes('neige')?'❄️':'🌤️';
    const card=makeActionCard('map',`${emoji} ${city}`,`${temp}°C — ${desc}`);
    appendMsg('assistant',`**Météo à ${city}** : ${temp}°C, ${desc}. Humidité: ${humidity}%, Vent: ${wind} km/h`,card);
  }catch{
    appendMsg('assistant',`Impossible de récupérer la météo pour ${city}.`);
  }
}

// =============================================
// INPUT HANDLER
// =============================================
async function handleInput(text){
  if(!text.trim())return;
  addH('user',text);
  appendMsg('user',text);
  el.textInput.value=''; el.btnSend.classList.add('hidden');
  showTyping(true); setOrb('thinking'); setStatus('Réfléchit...');

  try{
    const response=await getAI(text);
    const{actions}=parseAndExec(response);
    addH('assistant',response);
    // Only append text message if there's actual text and not just an action
    const cleanText=response.replace(/\[ACTION:[^\]]*\]/g,'').trim();
    if(cleanText){
      appendMsg('assistant',cleanText);
    }
    await speak(cleanText||'Voilà, c\'est fait !');
  }catch(err){
    console.error(err);
    appendMsg('assistant','⚠️ '+(err.message||'Erreur'));
    toast(err.message||'Erreur','error');
  }

  showTyping(false); setOrb('');
  if(!ST.speaking)setStatus('Prêt');
}

// =============================================
// EVENT BINDINGS
// =============================================
function bindAll(){
  // Orb
  el.orb.addEventListener('click',()=>{ if(ST.listening)stopListening(); else if(!ST.speaking)startListening(); });
  // Mic
  el.btnMic.addEventListener('click',e=>{e.stopPropagation();if(ST.listening)stopListening();else if(!ST.speaking)startListening();});
  // Text input
  el.textInput.addEventListener('input',()=>{el.btnSend.classList.toggle('hidden',!el.textInput.value.trim());});
  el.textInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(el.textInput.value.trim())handleInput(el.textInput.value.trim());}});
  el.btnSend.addEventListener('click',()=>{if(el.textInput.value.trim())handleInput(el.textInput.value.trim());});

  // Quick actions
  el.quickActions.addEventListener('click',e=>{
    const btn=e.target.closest('.qa-btn');
    if(!btn)return;
    const action=btn.dataset.action;
    const prompts={
      call:'Appelle le numéro suivant : ',
      sms:'Envoie un SMS au numéro suivant : ',
      reminder:'Rappelle-moi dans ',
      note:'Note : ',
      weather:'Quelle météo à '
    };
    el.textInput.focus();
    el.textInput.value=prompts[action]||'';
    el.textInput.dispatchEvent(new Event('input'));
  });

  // Settings
  el.btnSettings.addEventListener('click',()=>{syncUI();el.overlay.classList.remove('hidden');});
  el.btnClose.addEventListener('click',()=>{saveSettings();el.overlay.classList.add('hidden');});
  el.overlay.addEventListener('click',e=>{if(e.target===el.overlay){saveSettings();el.overlay.classList.add('hidden');}});

  // Reminders panel
  el.btnReminders.addEventListener('click',()=>{renderReminders();el.remindersOverlay.classList.remove('hidden');});
  el.btnCloseReminders.addEventListener('click',()=>el.remindersOverlay.classList.add('hidden'));
  el.remindersOverlay.addEventListener('click',e=>{if(e.target===el.remindersOverlay)el.remindersOverlay.classList.add('hidden');});

  // Settings live
  el.ttsEngine.addEventListener('change',()=>toggleEleven(el.ttsEngine.value==='elevenlabs'));
  el.ttsRate.addEventListener('input',()=>{el.rateVal.textContent=parseFloat(el.ttsRate.value).toFixed(1)+'x';});

  // Test voice
  el.btnTestVoice.addEventListener('click',async()=>{
    el.btnTestVoice.textContent='Écoute...';
    el.btnTestVoice.classList.add('loading');
    const prev={ttsEngine:ST.s.ttsEngine,ttsRate:ST.s.ttsRate,ttsVoice:ST.s.ttsVoice};
    ST.s.ttsEngine=el.ttsEngine.value; ST.s.ttsRate=parseFloat(el.ttsRate.value); ST.s.ttsVoice=el.ttsVoice?.value;
    try{await speak("Bonjour ! Je suis JARVIS, votre assistant. Comment puis-je vous aider ?");}catch{}
    Object.assign(ST.s,prev);
    el.btnTestVoice.textContent='Tester la voix';
    el.btnTestVoice.classList.remove('loading');
  });

  // Clear data
  el.btnClear.addEventListener('click',()=>{
    if(confirm('Tout effacer ?')){
      localStorage.clear(); ST.h=[]; ST.reminders=[]; ST.notes=[]; ST.s={...CFG.DEF};
      syncUI(); el.messages.innerHTML=''; renderReminders();
      toast('Données effacées','success'); el.overlay.classList.add('hidden');
    }
  });

  // Escape
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(!el.overlay.classList.contains('hidden')){saveSettings();el.overlay.classList.add('hidden');}
      if(!el.remindersOverlay.classList.contains('hidden'))el.remindersOverlay.classList.add('hidden');
    }
  });

  // Visibility
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){stopListening();if(ST.speaking&&ST.synth)ST.synth.cancel();}
  });

  // Restore reminders on load (re-schedule)
  ST.reminders.filter(r=>!r.done).forEach(r=>{
    const delay=r.fireAt-Date.now();
    if(delay>0)setTimeout(()=>fireReminder(r),delay);
    else fireReminder(r);
  });

  // Focus input on load
  setTimeout(()=>el.textInput.focus(),500);
}

function saveSettings(){
  ST.s.apiProvider=el.apiProvider.value;
  ST.s.ttsEngine=el.ttsEngine.value;
  ST.s.ttsRate=parseFloat(el.ttsRate.value);
  ST.s.elevenVoice=el.elevenVoice?.value;
  ST.s.userName=el.userName.value||'Tom';
  ST.s.continuousListening=el.continuousListening.checked;
  if(el.apiKey.value){localStorage.setItem(CFG.KEYS.AK,el.apiKey.value);ST.s.apiKey=el.apiKey.value;}
  if(el.elevenKey.value){localStorage.setItem(CFG.KEYS.EK,el.elevenKey.value);ST.s.elevenKey=el.elevenKey.value;}
  saveS(); toast('Paramètres sauvegardés','success');
}
