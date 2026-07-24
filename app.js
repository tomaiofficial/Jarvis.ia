/**
 * JARVIS PWA v6 — Text-Only Assistant (no voice)
 * Fonctionne gratuitement sans aucune clé API
 * IA: Pollinations.ai (gratuit) + Fallback local intelligent
 * Météo: wttr.in (gratuit)
 */

const CFG = {
  KEYS: { S: 'j6_s', H: 'j6_h', AK: 'j6_ak', R: 'j6_r', N: 'j6_n' },
  DEF: { apiProvider:'free', userName:'Tom' },
  FREE_AI: 'https://text.pollinations.ai/',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  GROQ: 'https://api.groq.com/openai/v1/chat/completions',
  WEATHER: 'https://wttr.in/{city}?format=j1&lang=fr'
};

const ST = { s:{}, h:[], reminders:[], notes:[] };

// DOM
const $=id=>document.getElementById(id);
const el={};
function cacheDom(){
  ['statusText','messages','chat','typing','textInput','btnSend',
   'btnSettings','overlay','modal','btnClose','toasts','apiProvider','apiKey',
   'userName','btnClear','quickActions',
   'btnReminders','reminderBadge','remindersOverlay','remindersModal','btnCloseReminders','remindersList'
  ].forEach(id=>{ el[id]=$(id); });
}

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded',()=>{
  cacheDom(); loadAll(); bindAll();
  requestNotificationPermission();
  showWelcome();
});

function showWelcome(){
  if(ST.h.length===0){
    const hour=new Date().getHours();
    const greet=hour<12?'Bonjour':hour<18?'Bon après-midi':'Bonsoir';
    appendMsg('assistant',`${greet} ${ST.s.userName||'Tom'} ! 👋\n\nJe suis **JARVIS**, ton assistant personnel.\n\nTape-moi un message ou utilise les boutons ci-dessous.\nTape **aide** pour voir tout ce que je peux faire.`);
  } else {
    // Re-render last few messages
    const recent=ST.h.slice(-6);
    recent.forEach(m=>appendMsg(m.role,m.content));
  }
}

// =============================================
// PERSISTENCE
// =============================================
function loadAll(){
  try{ ST.s=Object.assign({},CFG.DEF,JSON.parse(localStorage.getItem(CFG.KEYS.S))); }catch(e){ ST.s=Object.assign({},CFG.DEF); }
  var ak=localStorage.getItem(CFG.KEYS.AK); if(ak) ST.s.apiKey=ak;
  try{ ST.h=JSON.parse(localStorage.getItem(CFG.KEYS.H))||[]; }catch(e){ ST.h=[]; }
  try{ ST.reminders=JSON.parse(localStorage.getItem(CFG.KEYS.R))||[]; }catch(e){ ST.reminders=[]; }
  try{ ST.notes=JSON.parse(localStorage.getItem(CFG.KEYS.N))||[]; }catch(e){ ST.notes=[]; }
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
  el.userName.value=s.userName||'Tom';
  updateBadge();
}

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
  showNotification('Rappel JARVIS', r.text);
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
  try{
    if('Notification' in window && Notification.permission==='default'){
      Notification.requestPermission();
    }
  }catch(e){}
}
function showNotification(title,body){
  try{
    if('Notification' in window && Notification.permission==='granted'){
      new Notification(title,{body:body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',vibrate:[200,100,200]});
    }
  }catch(e){}
}

// =============================================
// AI API
// =============================================
const ACTION_PROMPT=`Tu es JARVIS, l'assistant personnel de {name}. Tu réponds en français, concis et utile.

CAPACITÉS — Tu peux exécuter ces actions en incluant une balise [ACTION:...] dans ta réponse :
- Appel: [ACTION:call:NUMERO:NOM]
- SMS: [ACTION:sms:NUMERO:MESSAGE]
- Email: [ACTION:email:ADRESSE:OBJET]
- Rappel: [ACTION:reminder:MINUTES:TEXTE]
- Minuterie: [ACTION:timer:MINUTES]
- Note: [ACTION:note:TEXTE]
- Météo: [ACTION:weather:VILLE]
- Carte: [ACTION:map:RECHERCHE]
- Calcul: [ACTION:calc:EXPRESSION]

Tu peux combiner texte + action. Réponds toujours en langage naturel, puis l'action.
Si l'utilisateur demande un rappel, calcule le nombre de minutes.
Si l'utilisateur veut appeler/sms quelqu'un que tu ne connais pas, demande le numéro.`;

// =============================================
// LOCAL INTELLIGENCE
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
  if(/^calcule?|^calcul|^combien\s+(fait|vaut|donne)/.test(t)){
    const expr=t.replace(/^[a-zàâäéèêëïîôùûüÿçœæ\s]+/i,'').replace(/[^0-9\+\-\*\/\.\(\)%]/g,'');
    if(expr&&/^[\d\+\-\*\/\.\(\)%\s]+$/.test(expr)){
      try{var r=Function('"use strict";return ('+expr+')')();return expr+' = **'+r+'**';}
      catch(e){return 'Impossible de calculer cette expression.';}
    }
  }

  // Reminders
  if(/rappelle?[- ]?moi|rappel|minuterie|alarme/.test(t)){
    const mins=parseInt(t.match(/(\d+)\s*(min|minute)/)?.[1]||'');
    const what=t.replace(/.*?(rappelle?-?moi\s*(de\s*)?|rappel\s*:?\s*|alarme\s*:?\s*|minuterie\s*:?\s*)/i,'').trim();
    if(mins>0){
      return `[ACTION:reminder:${mins}:${what||'Rappel'}] Rappel programmé dans ${mins} minute(s).`;
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
    if(num)return `[ACTION:call:${num}:${what||num}]`;
    return 'Dis-moi le numéro ou le contact : "Appelle le 06 12 34 56 78".';
  }

  // SMS
  if(/sms|message|texte|envoie.*message/.test(t)){
    const num=t.match(/([\d\s\-\+\.]{7,})/)?.[1]?.trim()||'';
    const msg=t.replace(/.*?(sms|message|texte)\s*(à|a|pour)?\s*[\d\s\-\+\.]*\s*/i,'').replace(/.*?envoie.*message\s*/i,'').trim();
    if(num)return `[ACTION:sms:${num}:${msg||'Bonjour !'}]`;
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

  // Identity
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
    return `Je vais très bien ${name}, merci ! Prêt à t'aider.`;
  }

  // Thanks
  if(/merci|thanks|thx/.test(t)){
    return `De rien ${name} ! Je suis toujours là si tu as besoin.`;
  }

  // Jokes
  if(/blague|plaisanterie|rigole|amusant|dr[ôo]le/.test(t)){
    const jokes=[
      'Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tomberaient dans le bateau !',
      'Qu\'est-ce qu\'un canif ? Un petit couteau. Un gros canif ? Un gros petit couteau !',
      'Que fait une fraise sur un cheval ? Tagada !',
      'Pourquoi les maths sont tristes ? Parce qu\'ils ont trop de problèmes !',
      'Qu\'est-ce qui est orange et qui monte ? Une orange qui monte !'
    ];
    return jokes[Math.floor(Math.random()*jokes.length)];
  }

  // Motivation
  if(/motivation|motivant|inspir[ae]|citation|phrase du jour/.test(t)){
    const quotes=[
      '"Le succès est la somme de petits efforts répétés jour après jour." — Robert Collier',
      '"La seule façon de faire du bon travail est d\'aimer ce que tu fais." — Steve Jobs',
      '"Ce n\'est pas la destination mais le voyage qui compte."',
      '"Chaque expert était autrefois un débutant." — Helen Hayes',
      '"Le meilleur moment pour planter un arbre était il y a 20 ans. Le deuxième meilleur moment, c\'est maintenant."'
    ];
    return quotes[Math.floor(Math.random()*quotes.length)];
  }

  // Help
  if(/aide|help|que sais|que peux|commande/.test(t)){
    return `Je peux t'aider avec :\n\n**Appels** — "Appelle le 06..."\n**SMS** — "SMS au 06..."\n**Email** — "Email à machin..."\n**Rappels** — "Rappelle-moi dans 30 min"\n**Notes** — "Note : truc à faire"\n**Météo** — "Météo à Paris"\n**Carte** — "Ouvre Maps..."\n**Calcul** — "Calcule 15*3+7"\n**Blagues** — "Raconte une blague"\n**Motivation** — "Phrase motivante"\n\nTout est gratuit, aucune clé API nécessaire !`;
  }

  return null;
}

// =============================================
// AI — Free or Premium
// =============================================
async function getAI(input){
  const prov=ST.s.apiProvider||'free';
  const key=ST.s.apiKey||localStorage.getItem(CFG.KEYS.AK);
  const sys=ACTION_PROMPT.replace('{name}',ST.s.userName||'Tom');

  // 1. Local intelligence
  const local=localReply(input);
  if(local)return local;

  // 2. Free AI — Pollinations.ai
  if(prov==='free'||(!key&&prov!=='gemini'&&prov!=='groq')){
    try{
      const msgs=[{role:'system',content:sys},...ST.h.slice(-8).map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content})),{role:'user',content:input}];
      const r=await fetch(CFG.FREE_AI,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:msgs,seed:Math.floor(Math.random()*10000),jsonMode:false})});
      if(r.ok){
        const txt=await r.text();
        if(txt&&txt.length>2)return txt.trim();
      }
    }catch(e){console.warn('Pollinations failed',e);}
    return 'Mode hors-ligne. Je peux t\'aider avec les commandes de base ! Tape "aide" pour voir tout.';
  }

  // 3. Gemini
  if(prov==='gemini'&&key){
    const contents=[...ST.h.slice(-8).map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]})),{role:'user',parts:[{text:sys+'\n\n'+input}]}];
    const r=await fetch(`${CFG.GEMINI}?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents,generationConfig:{temperature:.7,maxOutputTokens:1024}})});
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||`Erreur ${r.status}`);}
    const d=await r.json(); return d.candidates?.[0]?.content?.parts?.[0]?.text||'Pas de réponse.';
  }

  // 4. Groq
  if(prov==='groq'&&key){
    const msgs=[{role:'system',content:sys},...ST.h.slice(-8).map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content})),{role:'user',content:input}];
    const r=await fetch(CFG.GROQ,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:msgs,temperature:.7,max_tokens:1024})});
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error?.message||`Erreur ${r.status}`);}
    const d=await r.json(); return d.choices?.[0]?.message?.content||'Pas de réponse.';
  }

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
    actions.push({type:match[1],parts:match[2].split(':')});
    cleanText=cleanText.replace(match[0],'').trim();
  }
  for(const act of actions) execAction(act);
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
      showNotification('Rappel programmé',`Dans ${mins} min: ${text}`);
      break;
    }
    case 'timer': {
      const mins=parseInt(act.parts[0])||1;
      setTimeout(()=>{
        showNotification('Minuterie terminée!',`${mins} minute(s) écoulée(s)`);
        toast(`Minuterie: ${mins} min écoulées!`,'warn');
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
      try{var result=Function('"use strict";return ('+expr.replace(/[^0-9+\-*/().% ]/g,'')+')')();toast(expr+' = '+result,'success');}catch(e){toast('Erreur de calcul','error');}
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
  if(!url)return '';
  return `<a class="action-card ${type}" href="${url}" target="_blank" rel="noopener"><div class="ac-icon ${type}">${icons[type]||''}</div><div class="ac-text"><div class="ac-title">${title}</div><div class="ac-sub">${esc(sub)}</div></div><div class="ac-arrow">›</div></a>`;
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
  }catch(e){
    appendMsg('assistant','Impossible de récupérer la météo pour '+city+'.');
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
  showTyping(true); setStatus('Réfléchit...');

  try{
    const response=await getAI(text);
    const{actions}=parseAndExec(response);
    addH('assistant',response);
    const cleanText=response.replace(/\[ACTION:[^\]]*\]/g,'').trim();
    if(cleanText) appendMsg('assistant',cleanText);
  }catch(err){
    console.error(err);
    appendMsg('assistant','⚠️ '+(err.message||'Erreur'));
    toast(err.message||'Erreur','error');
  }

  showTyping(false); setStatus('Prêt');
}

// =============================================
// EVENT BINDINGS
// =============================================
function bindAll(){
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
      weather:'Quelle météo à ',
      map:'Ouvre Maps '
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

  // Restore reminders on load
  ST.reminders.filter(r=>!r.done).forEach(r=>{
    const delay=r.fireAt-Date.now();
    if(delay>0)setTimeout(()=>fireReminder(r),delay);
    else fireReminder(r);
  });

  // Focus input
  setTimeout(()=>el.textInput.focus(),500);
}

function saveSettings(){
  ST.s.apiProvider=el.apiProvider.value;
  ST.s.userName=el.userName.value||'Tom';
  if(el.apiKey.value){localStorage.setItem(CFG.KEYS.AK,el.apiKey.value);ST.s.apiKey=el.apiKey.value;}
  saveS(); toast('Paramètres sauvegardés','success');
}
