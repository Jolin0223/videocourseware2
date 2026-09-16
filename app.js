(() => {
  'use strict';
  const D = window.BOBO_LESSON, M = window.BOBO_MEDIA;
  const $ = s => document.querySelector(s);
  const stage = $('#stage'), screen = $('#screen'), bg = $('#background'), video = $('#scene-video'), voice = $('#voice'), sfx = $('#sfx');
  const S = { scene: 0, phase: 'ready', muted: false, paused: false, discovered: [], count: 1, countPhase: 'add', countPassed: {}, order: 0, label: 0, selected: null, answered: false, feedback: '', tone: '', busy: false, heard: false, audioFailed: false, done: false, orders: [], tray: [], cookStep: 0, burgersMade: 0, reactionTimer: null, guide: null, labelResults: [], log: [], orderOptions: [] };
  let startPending = false, lidHintTimer = null, coverSoundPlayed = false;
  let sceneEpoch = 0, voiceSerial = 0, voiceFinish = null, activeMedia = null, drag = null, lastPointerDrag = 0;
  const icons = {
    home:'<path d="m3 11 9-8 9 8M6 10v11h12V10M10 21v-7h4v7"/>',
    sound:'<path d="M4 9h4l5-4v14l-5-4H4zM17 8c3 2 3 6 0 8M20 5c5 4 5 10 0 14"/>',
    mute:'<path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6"/>',
    play:'<path d="m8 4 13 8-13 8z"/>', pause:'<path d="M8 5v14M16 5v14"/>',
    next:'<path d="M4 12h16M13 5l7 7-7 7"/>', back:'<path d="M20 12H4m7-7-7 7 7 7"/>',
    retry:'<path d="M4 8V3m0 5h5M4 8a9 9 0 1 1-1 8"/>',
    check:'<path d="m4 12 5 5L20 6"/>', plus:'<path d="M12 4v16M4 12h16"/>',
    minus:'<path d="M4 12h16"/>', down:'<path d="M12 3v18m-7-7 7 7 7-7"/>',
    bell:'<path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4zm5 4h4M11 2h2"/>'
  };
  const icon = n => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[n] || icons.next}</svg>`;
  const button = (label, action, ic = 'next', secondary = false, disabled = false, extra = '') => `<button class="btn${secondary ? ' secondary' : ''}" data-action="${action}" ${disabled ? 'disabled' : ''} ${extra}>${icon(ic)}<span class="ink">${label}</span></button>`;
  const iconButton = (label, action, ic, cls = '', extra = '') => `<button class="icon-btn ${cls}" data-action="${action}" aria-label="${label}" ${extra}>${icon(ic)}</button>`;
  const food = (kind, n, entering = false) => `<span class="food-group" data-count="${n}">${Array.from({ length: n }, (_, i) => `<img class="food${entering && i === n - 1 ? ' new-food' : ''}" src="assets/images/${kind}.webp" alt="${kind}" draggable="false">`).join('')}</span>`;
  const word = (kind, n) => `<span class="ink">${kind}${n > 1 ? '<span class="plural">s</span>' : ''}</span>`;
  const kindNow = () => D.words[S.scene - 4];
  function log(action, detail = {}) { S.log.push({ scene: `S${String(S.scene).padStart(2, '0')}`, action, ...detail }); }
  function resize() { document.documentElement.style.setProperty('--scale', Math.min(innerWidth / 1920, innerHeight / 1080)); }
  addEventListener('resize', resize); resize();
  function stopVoice() {
    $('.voice-retry')?.remove(); delete stage.dataset.speaking; voiceSerial++; voice.pause(); voice.onended = voice.onerror = voice.ontimeupdate = null;
    if (voiceFinish) { const done = voiceFinish; voiceFinish = null; done(false); }
  }
  function stopMedia() {
    $('.media-retry')?.remove(); clearTimeout(lidHintTimer); clearTimeout(S.reactionTimer); $('.bobo-reaction')?.remove(); cancelFoodDrag(); S.keyboardPick = null;
    stopVoice(); sfx.pause(); video.pause(); video.onended = video.onerror = video.onplaying = video.ontimeupdate = null;
    video.classList.remove('visible'); video.removeAttribute('src'); video.load(); activeMedia = null; S.paused = false;
  }
  function effect(name) {
    if (S.muted) return Promise.resolve(false);
    sfx.pause(); sfx.src = window.BOBO_SFX?.[name] || `assets/audio/sfx-${name}.mp3`; sfx.volume = name === 'rattle' ? .28 : .55;
    return sfx.play().then(() => { log('effect-play', {clip:name}); return true; }).catch(() => false);
  }
  function playCoverCue() {
    if (S.scene !== 0 || coverSoundPlayed || S.muted) return;
    effect('cover').then(ok => { if (ok) coverSoundPlayed = true; });
  }
  function sayExtra(id, fallback) { return window.BOBO_AUDIO?.[id] ? say(id) : fallback ? say(fallback) : Promise.resolve(false); }
  function scheduleLidHint(delay = 2200) {
    clearTimeout(lidHintTimer);
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    lidHintTimer = setTimeout(() => {
      if (S.scene !== 2 || S.phase !== 'ready' || document.hidden) return;
      const lid = $('.discover-card.closed:not(:disabled) .lid');
      if (!lid) return;
      if (!voice.paused || drag) return scheduleLidHint(1000);
      lid.classList.remove('hint-wiggle'); void lid.offsetWidth; lid.classList.add('hint-wiggle');
      effect('rattle'); scheduleLidHint(5200);
    }, delay);
  }
  function reactBobo(correct=true) {
    clearTimeout(S.reactionTimer); $('.bobo-reaction')?.remove();
    const el=document.createElement('div');el.className='bobo-reaction '+(correct?'cheer':'encourage');el.setAttribute('role','status');
    el.setAttribute('aria-label',correct?'Bobo gives you a thumbs up':'Listen again and try another lunch');
    el.innerHTML=correct?`<div class="reward-rays"></div><img src="assets/images/play/bobo-thumbs-up.webp" alt=""><div class="reward-jewel" aria-hidden="true"></div>`:`<div class="try-bubble">${icon('sound')}<span class="ink">Listen again</span></div>`;
    stage.append(el);if(!correct)S.reactionTimer=setTimeout(()=>el.remove(),2100);
  }
  function celebrateSuccess() {
    effect('correct');reactBobo(true);$('.success-burst')?.remove();
    const burst=document.createElement('div');burst.className='success-burst';burst.setAttribute('aria-hidden','true');
    burst.innerHTML=Array.from({length:20},(_,i)=>`<i style="--angle:${i*18}deg;--distance:${180+(i%3)*45}px;--delay:${i*.018}s"></i>`).join('');
    $('.panel')?.append(burst);setTimeout(()=>burst.remove(),1800);
  }

  async function praise(ids=['nice']) {
    celebrateSuccess();const el=$('.bobo-reaction'),started=performance.now();
    await sequence(ids);
    setTimeout(()=>{el?.remove();log('reward-finished');},Math.max(1100,3800-(performance.now()-started)));
  }
  function say(id, options = {}) {
    stopVoice(); const serial = voiceSerial, epoch = sceneEpoch;
    voice.src = window.BOBO_AUDIO?.[id] || `assets/audio/${id}.mp3`; voice.muted = S.muted; voice.volume = 1;
    return new Promise(resolve => {
      voiceFinish = resolve;
      const finish = ok => {
        if (serial !== voiceSerial) return;
        voice.onended = voice.onerror = voice.ontimeupdate = null; voiceFinish = null; delete stage.dataset.speaking;
        if (!ok && epoch === sceneEpoch) { S.audioFailed = true; log('audio-unavailable', { clip: id }); }
        resolve(ok);
      };
      voice.onended = () => finish(true); voice.onerror = () => finish(false);
      voice.ontimeupdate = () => { if (epoch === sceneEpoch && options.onTime) options.onTime(voice.currentTime, voice.duration); };
      voice.play().then(() => { if (serial === voiceSerial) {stage.dataset.speaking=id;log('voice-play', { clip: id });} }).catch(error => {
        if(serial!==voiceSerial)return;
        log('voice-blocked',{clip:id,reason:error.name});finish(false);
        if(epoch===sceneEpoch&&!S.muted&&!options.quiet){const retry=document.createElement('button');retry.className='voice-retry';retry.dataset.action='word';retry.dataset.word=id;retry.innerHTML=icon('sound')+'<span>Tap to listen</span>';stage.append(retry);}
      });
    });
  }
  async function sequence(ids) { const epoch = sceneEpoch; for (const id of ids) { if (epoch !== sceneEpoch) return; if (!await say(id)) return; } }
  function toolbar() {
    $('#toolbar').innerHTML = iconButton('Home', 'home', 'home', 'home') + iconButton(S.muted ? 'Turn sound on' : 'Mute sound', 'mute', S.muted ? 'mute' : 'sound', 'sound') + (activeMedia ? iconButton(S.paused ? 'Play' : 'Pause', 'pause', S.paused ? 'play' : 'pause', 'pause') : '');
  }
  function header() {
    return `<h1 class="title">${D.titles[S.scene]}</h1><div class="section-progress" aria-label="Lesson progress">${[2, 4, 7, 8, 9].map(n => `<span class="dot ${S.scene >= n ? 'active' : ''}"></span>`).join('')}</div>`;
  }
  function progress() {
    if (S.scene === 7) return `<span class="progress"><span class="english">Orders</span>${S.order + 1}/6</span>`;
    if (S.scene === 8) return `<span class="progress">${S.label + 1}/3</span>`;
    if (S.scene === 2) return `<span class="progress">${S.discovered.length}/3</span>`;
    return '';
  }
  function canNext() {
    if (S.scene === 2) return S.discovered.length === 3;
    if (S.scene >= 4 && S.scene <= 6) return !!S.countPassed[kindNow()];
    if (S.scene === 7 || S.scene === 8) return S.answered;
    return true;
  }
  function footer(opts = {}) {
    const label = opts.label || (S.scene === 9 ? 'Done' : S.scene === 7 || S.scene === 8 ? 'Next' : 'Continue');
    return `<div class="footer"><div class="footer-side"></div><div class="footer-side">${button(label, opts.action || 'next', label === 'Done' ? 'check' : 'next', false, false)}</div></div>`;
  }
  function feedback() { return `<div class="feedback ${S.tone}" aria-live="polite">${S.feedback ? icon(S.tone === 'retry' ? 'retry' : 'check') + `<span>${S.feedback}</span>` : ''}</div>`; }
  function sparkles() { return `<div class="sparkles">${Array.from({length:10},(_,i)=>`<i style="--x:${8+(i*31)%85}%;--y:${15+(i*19)%70}%;--delay:${i*.37}s"></i>`).join('')}</div>`; }
  function confetti() { return `<div class="celebration">${Array.from({length:32},(_,i)=>`<i style="--x:${4+(i*17)%92}%;--delay:${(i%8)*.11}s;--drift:${(i%2?1:-1)*(30+i%5*20)}px;--color:${['#ee8c64','#65aba4','#f0ca75','#fdf6df'][i%4]}"></i>`).join('')}</div>`; }
  function render() {
    toolbar();
    const scene = S.scene; stage.dataset.scene = `S${String(scene).padStart(2, '0')}`; stage.dataset.phase = S.phase; stage.dataset.done = String(S.done);
    if (scene === 0) {
      bg.src = 'assets/images/motion/cover-base.webp'; screen.innerHTML = `<div class="scene-art cover-art" aria-hidden="true"><div class="art-title"><img src="assets/images/motion/cover-title.webp" alt=""></div><div class="art-hero"><img src="assets/images/motion/cover-hero.webp" alt=""></div>${sparkles()}<div class="cover-prompt">${icon('play')}<span class="ink">Start</span></div></div><button class="cover-start" data-action="start" aria-label="Start Bobo’s Magic Lunch Truck"></button><button class="cover-title-audio icon-btn" data-action="word" data-word="cover_title" aria-label="Listen to the title">${icon('sound')}</button>`; return;
    }
    if (S.phase === 'watch') {
      const key = `S${String(scene).padStart(2, '0')}`; bg.src = `assets/images/${M[key].poster}.webp`;
      const mixed = [2, 4, 9].includes(scene);
      screen.innerHTML = `<h1 class="story-title">${D.titles[scene]}</h1><div class="video-footer"><div class="caption-track"><div id="caption"><span class="ink">${D.captions[key][0]}</span></div></div>${button('Next','skip','next')}</div>`;
      return;
    }
    bg.src = (scene === 9 ? M.S09.still : scene >= 4 ? M.S04.still : M.S02.still) || `assets/images/${scene === 9 ? 'party' : 'counter'}.webp`;
    if(scene===2||scene===6)bg.src='assets/images/counter.webp';
    if(scene===7)bg.src='assets/images/motion/cover-base.webp';
    if(scene===9&&!S.done)bg.src='assets/images/party.webp';
    if (scene === 2) renderDiscover();
    else if (scene === 6) renderKitchen();
    else if (scene >= 4 && scene <= 5) renderCount();
    else if (scene === 7) renderOrders();
    else if (scene === 8) renderLabels();
    else if (scene === 9) renderSummary();
    if(S.guide)renderGuide();
  }
  function renderDiscover() {
    screen.innerHTML = `${header()}<section class="panel discover-panel">${progress()}<h2 class="instruction">What’s inside?</h2><p class="hint">Open a lid. Listen and say.</p><div class="discover-grid">${D.words.map((k,i)=>`<button class="discover-card ${S.discovered.includes(k)?'opened':'closed'}" data-action="discover" data-kind="${k}" aria-label="${S.discovered.includes(k)?'Listen to '+k:'Open lid '+(i+1)}" ${!S.discovered.includes(k)&&i>S.discovered.length?'disabled':''}><span class="dish"><img class="food" src="assets/images/${k}.webp" alt="${k}" draggable="false"><span class="lid"></span></span><span class="card-label ${S.discovered.includes(k)?'word':'clue'}"><span class="ink">${S.discovered.includes(k)?k:'?'}</span></span></button>`).join('')}</div>${feedback()}</section>${footer()}`;
  }
  function openFoodCard(el) {
    const k=el.dataset.kind;
    if(S.discovered.includes(k)) {say(k);return;}
    clearTimeout(lidHintTimer);
    S.discovered.push(k); log('discover',{kind:k}); effect('open');
    el.classList.replace('closed','opened'); el.querySelector('.lid').classList.remove('hint-wiggle');
    el.setAttribute('aria-label','Listen to '+k);
    const label=el.querySelector('.card-label'); label.classList.replace('clue','word'); label.innerHTML=`<span class="ink">${k}</span>`;
    const nextCard=$('.discover-card.closed'); if(nextCard) nextCard.disabled=false;
    $('.discover-panel>.progress').innerHTML=`<span class="ink">${S.discovered.length}/3</span>`;
    if(S.discovered.length===3) {
      S.feedback=''; $('.feedback').replaceChildren();
      praise([k,'nice']);
    } else {say(k);scheduleLidHint();}
  }
  function renderCount() {
    const kind = kindNow();
    if (S.countPhase === 'check') {
      screen.innerHTML = `${header()}${progress()}<section class="panel"><h2 class="instruction">Listen. Which plate?</h2><div class="listen-position">${iconButton('Listen to the word', 'listen', 'sound', 'core')}</div>${S.audioFailed || S.muted ? `<div class="sound-help fallback-word">${D.checks[kind]}</div>` : ''}<div class="choices check-choices">${[1, 3].map(n => `<button class="choice ${S.tone === 'retry' && S.selected === n ? 'wrong' : ''} ${S.countPassed[kind] && D.checks[kind] === kind + (n > 1 ? 's' : '') ? 'correct' : ''}" data-action="count-check" data-count="${n}" aria-label="${n} ${kind}${n > 1 ? 's' : ''}" ${S.countPassed[kind] || !S.heard ? 'disabled' : ''}>${food(kind, n)}</button>`).join('')}</div>${feedback()}</section>${footer()}`; return;
    }
    const removing = S.countPhase === 'remove';
    const instruction = S.countPassed[kind] ? 'Ready to cook!' : removing ? 'Drag them back.' : 'Drag one more.';
    const place = kind === 'egg' ? 'basket' : 'plate';
    screen.innerHTML = `${header()}${progress()}<section class="panel drag-panel"><h2 class="instruction">${instruction}</h2><p class="hint">${removing?'Make one again.':(kind==='egg'?'Put it in the basket.':'Put it on the plate.')}</p><div class="count-stage"><div id="return-zone" class="pantry-zone" role="button" tabindex="0" data-drop="remove" aria-label="Return one ${kind} here">${!removing?`<button class="food-token source-token" data-drag="add" aria-label="Drag one ${kind}" ${S.busy?'disabled':''}><img class="food" src="assets/images/${kind}.webp" alt="${kind}" draggable="false"></button>`:icon('back')}<span class="tray-label">${removing?'Put it back':'More food'}</span></div><div class="drag-direction" aria-hidden="true">${icon(removing?'back':'next')}</div><div id="drop-zone" class="count-dish dish ${kind==='egg'?'basket':''}" data-drop="add" role="button" tabindex="0" aria-label="Put one ${kind} ${kind==='egg'?'in':'on'} the ${place}"><span class="food-group" data-count="${S.count}">${Array.from({length:S.count},(_,i)=>`<button class="food-token placed-token ${S.busy&&!removing&&i===S.count-1?'new-food':''}" data-drag="remove" aria-label="Drag ${kind} ${i+1} back" ${!removing||S.busy?'disabled':''}><img class="food" src="assets/images/${kind}.webp" alt="${kind}" draggable="false"></button>`).join('')}</span></div><button class="count-word word-audio" data-action="word" data-word="${kind}${S.count>1?'s':''}" aria-label="Listen to ${kind}${S.count>1?'s':''}"><span class="word">${word(kind,S.count)}${icon('sound')}</span></button></div>${feedback()}</section>${footer()}`;
  }
  function renderKitchen() {
    const made=S.burgersMade, step=S.cookStep, complete=step===3;
    screen.innerHTML=`${header()}<section class="panel kitchen-panel"><h2 class="instruction">${complete?(made===1?'One burger!':'More burgers!'):'Build a burger!'}</h2><p class="hint">${complete?'Listen and say.':'Stack the food. Bottom to top.'}</p><div class="ingredient-rail">${[0,1,2].map(i=>`<button class="ingredient" data-action="build-part" data-part="${i}" data-piece="${i}" aria-label="${['Bottom bun','Filling','Top bun'][i]}" ${complete||S.busy?'disabled':''}><span class="burger-part part-${i}"></span>${i<step?icon('check'):''}</button>`).join('')}</div><div class="burger-build-zone" id="burger-build-zone" aria-label="Build the burger here"><div class="build-plate dish"></div>${[0,1,2].filter(i=>i<step).map(i=>`<span class="burger-part stacked part-${i} layer-${i}"></span>`).join('')}${!step?`<span class="stack-target">${icon('down')}</span>`:''}</div><div class="finished-burgers">${made===2?food('burger',2):''}</div>${complete?`<button class="kitchen-word" data-action="word" data-word="${made===1?'burger':'burgers'}">${word('burger',made)}${icon('sound')}</button>`:''}<div class="kitchen-controls">${complete&&made===1?button('One more','cook-more','plus'):''}</div></section>${footer()}`;
  }
  async function buildPart(i) {
    if(S.scene!==6||S.guide||S.busy||S.cookStep===3)return;
    if(i!==S.cookStep){effect('tap');$('.ingredient[data-part="'+S.cookStep+'"]')?.animate([{scale:1},{scale:1.12},{scale:1}],{duration:500});return;}
    const epoch=sceneEpoch;S.busy=true;S.cookStep++;effect('discover');render();
    await new Promise(r=>setTimeout(r,380));if(epoch!==sceneEpoch)return;
    if(S.cookStep===3){S.burgersMade++;S.count=S.burgersMade;S.countPassed.burger=S.burgersMade===2;render();await praise([S.burgersMade===1?'burger':'burgers','nice']);}
    if(epoch===sceneEpoch){S.busy=false;render();}
  }
  function trayAdd(kind) {
    if(S.scene!==7||S.guide||S.answered||S.busy||S.tray.length>=3)return;
    S.tray.push(kind);S.feedback='';S.tone='';effect('discover');renderOrders();log('tray-add',{kind,count:S.tray.length});
  }
  function trayRemove(i) {if(S.answered||S.busy)return;S.tray.splice(i,1);S.feedback='';S.tone='';effect('tap');renderOrders();}
  async function serveTray() {
    if(S.scene!==7||S.answered||S.busy||!S.tray.length||!S.heard)return;
    const chime=new Audio('assets/audio/sfx-discover.mp3');chime.volume=.45;chime.muted=S.muted;chime.play().catch(()=>{});const q=D.orders[S.order],kind=q.answer[0],plural=q.word.endsWith('s');
    const right=S.tray.every(k=>k===kind)&&(plural?S.tray.length>1:S.tray.length===1);
    const record=S.orders[S.order] ||= {id:q.id,attempts:0,assisted:S.muted||S.audioFailed};
    record.attempts++;record.correct=right;record.assisted ||= S.muted||S.audioFailed||record.attempts>2;
    log('order-answer',{id:q.id,contents:[...S.tray],correct:right});
    if(!right){S.feedback='Listen. Change your plate.';S.tone='retry';render();reactBobo(false);effect('tap');await sequence(['retry',q.word]);return;}
    S.answered=true;S.feedback='';S.tone='';effect('correct');render();sequence([q.word,'yum_friend']);
  }
  function orderViewOptions() {
    if (!S.orderOptions.length) {
      S.orderOptions = D.orders[S.order].options.map(a => [...a]);
      for (let i = S.orderOptions.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [S.orderOptions[i], S.orderOptions[j]] = [S.orderOptions[j], S.orderOptions[i]]; }
    }
    return S.orderOptions;
  }
  function renderOrders() {
    const q=D.orders[S.order],help=S.muted||S.audioFailed||(S.orders[S.order]?.attempts||0)>=2;
    screen.innerHTML=`${header()}<section class="panel lunch-panel">${progress()}<h2 class="instruction">Lunch for a friend!</h2><div class="order-audio">${iconButton('Listen to the order','listen','sound','core')}<span>${help?q.word:'Listen, then fill the plate.'}</span></div><div class="pantry-shelf">${D.words.map(k=>`<button class="pantry-food" data-action="tray-add" data-kind="${k}" data-order-food="${k}" aria-label="Add one ${k} to the plate" ${S.answered||S.tray.length>=3?'disabled':''}><img src="assets/images/${k}.webp" alt=""><span class="ink">${k}</span></button>`).join('')}</div><div class="order-plate dish ${S.answered?'served':''}" id="order-tray" aria-label="Lunch plate"><div class="tray-items">${S.tray.map((k,i)=>`<button class="tray-item" data-action="tray-remove" data-index="${i}" aria-label="Remove ${k}" ${S.answered?'disabled':''}><img src="assets/images/${k}.webp" alt="${k}"></button>`).join('')}</div>${!S.tray.length?'<span class="plate-hint">Your plate</span>':''}</div><p class="tray-help">${S.answered?'Yum! Thank you!':'Listen. Fill the plate. Ring the bell!'}</p><button class="serve-bell" data-action="serve-tray" aria-label="Ring the bell and serve" ${!S.tray.length||S.answered||!S.heard?'disabled':''}><img src="assets/images/play/service-bell.webp" alt=""></button>${feedback()}</section><aside class="customer-card"><div class="customer-avatar customer-${S.order%3}"></div><div class="customer-name">${['Rabbit','Turtle','Duck'][S.order%3]}</div><div class="customer-thought">${S.answered?'<span class="customer-yum">Yum!</span>':icon('sound')}</div>${S.answered?`<div class="customer-meal">${S.tray.map(k=>`<img src="assets/images/${k}.webp" alt="">`).join('')}</div>`:''}</aside>${footer()}`;
  }

  function renderLabels() {
    const q = D.labels[S.label];
    screen.innerHTML = `${header()}${progress()}<section class="panel"><h2 class="instruction">Choose a name. Then submit.</h2><div class="label-food dish">${food(q.kind, q.count)}</div><div class="label-options">${[q.kind, q.kind + 's'].map(w => `<button class="label-choice ${S.selected === w ? 'selected' : ''}" data-action="select-label" data-word="${w}" ${S.answered ? 'disabled' : ''}><span class="ink">${w}</span>${icon('sound')}</button>`).join('')}</div>${feedback()}</section><div class="footer"><div class="footer-side"></div><div class="footer-side">${!S.answered ? button('Submit', 'submit-label', 'check', true, !S.selected) : ''}${button('Next','next','next')}</div></div>`;
  }
  function enterReview() { stopVoice(); S.phase='ready'; render(); say('summary_hint'); }
  function beginReview() { enterReview(); }

  function renderSummary() {
    if (S.done) {
      bg.src = 'assets/images/motion/ending-base.webp'; screen.innerHTML = `<div class="scene-art ending-art" aria-hidden="true"><div class="art-actors"><img src="assets/images/motion/ending-actors.webp" alt=""></div><div class="art-title"><img src="assets/images/motion/ending-title.webp" alt=""></div>${sparkles()}${confetti()}</div><div class="ending-retry">${button('Play again!', 'restart', 'retry')}</div><button class="ending-listen icon-btn" data-action="word" data-word="ending_bobo" aria-label="Listen to Bobo again">${icon('sound')}</button>`; return;
    }
    screen.innerHTML = `<header class="summary-heading"><h1>Lunch is ready!</h1><p>Let’s say the words!</p></header><div class="summary-label">Summary</div><section class="panel review-board" aria-label="Summary"><div class="summary-grid">${D.words.map(k => `<div class="summary-column">${[1, 3].map(n => `<button class="summary-word" data-action="word" data-word="${k}${n > 1 ? 's' : ''}" aria-label="Listen to ${k}${n > 1 ? 's' : ''}">${food(k, n)}<span class="word">${word(k, n)}</span><span class="summary-sound" aria-hidden="true">${icon('sound')}</span></button>`).join('')}</div>`).join('')}</div></section>${footer()}`;
  }
  function startGuide(kind){stopVoice();S.guide=kind;render();log('guide',{kind});playGuideAudio();}
  function playGuideAudio(){
    const kitchen=S.guide==='kitchen',guide=$('.play-guide');if(!guide)return;
    guide.dataset.step='0';
    say(kitchen?'kitchen_intro':'orders_intro',{onTime:t=>{guide.dataset.step=String(kitchen?(t<4.5?0:t<5.8?1:t<7?2:3):(t<2.5?0:t<4.4?1:t<6.6?2:3));}});
  }
  function beginGame(){const kind=S.guide;S.guide=null;stopVoice();render();log('guide-complete',{kind});if(kind==='orders')hearTarget();else say('burger');}
  function renderGuide(){
    const kitchen=S.guide==='kitchen';const el=document.createElement('section');el.className='play-guide '+(kitchen?'cook-guide':'order-guide');el.setAttribute('aria-label',kitchen?'Help Rabbit make lunch':'How to serve a friend');
    const q=D.orders[S.order],k=q.answer[0],n=q.word.endsWith('s')?3:1;
    el.innerHTML=`<h2>${kitchen?'Rabbit is hungry!':'Our friends are hungry!'}</h2><p>${kitchen?'Let’s make a burger for Rabbit.':'Listen. Fill the plate. Ring the bell!'}<button class="guide-replay" data-action="guide-listen" aria-label="Listen to the instructions">${icon('sound')}</button></p><div class="guide-story">${kitchen?`<div class="guide-friend"><div class="customer-avatar customer-0"></div><div class="wish-burger"><img src="assets/images/burger.webp" alt="burger"></div></div><div class="guide-assembly"><div class="dish"></div>${[0,1,2].map(i=>`<span class="burger-part part-${i} demo-layer demo-${i}"></span>`).join('')}</div>`:`<div class="guide-listen">${icon('sound')}<span>Listen</span></div><div class="guide-plate dish">${food(k,n)}<span>Make</span></div><div class="guide-ring"><img src="assets/images/play/service-bell.webp" alt="Ring the bell"><span>Ding!</span></div>`}</div><div class="guide-actions">${button(kitchen?'Let’s cook!':'My turn!','begin-game','play')}</div>`;
    screen.append(el);$('.footer')?.remove();
  }
  function showMediaRetry(label){$('.media-retry')?.remove();const b=document.createElement('button');b.className='media-retry';b.dataset.action='media-retry';b.innerHTML=icon('play')+`<span>${label}</span>`;stage.append(b);}
  function resumeStory(){
    if(!activeMedia)return;$('.media-retry')?.remove();S.paused=false;toolbar();
    if(activeMedia.fallback){const epoch=sceneEpoch;say(M[activeMedia.key].audio).then(ok=>{if(ok&&epoch===sceneEpoch)finishMedia();});return;}
    video.classList.add('visible');video.play().catch(error=>{log('video-blocked',{reason:error.name});S.paused=true;toolbar();showMediaRetry('Play story');});
  }
  function finishMedia() {
    if (!activeMedia) return;
    const done = activeMedia.done; activeMedia = null; stopMedia(); done();
  }
  function playSceneMedia(scene, done) {
    const key = `S${String(scene).padStart(2, '0')}`, cfg = M[key], epoch = sceneEpoch;
    S.phase = 'watch'; activeMedia = { key, done, started: false }; render(); toolbar();
    if (cfg.still) { const tail = new Image(); tail.src = cfg.still; }
    const cues = D.captions[key];
    const update = (t, duration) => {
      if (!Number.isFinite(duration) || duration <= 0) return;
      const idx = cfg.captionTimes ? Math.max(0, Math.min(cues.length - 1, cfg.captionTimes.filter(start => t >= start).length - 1)) : Math.min(cues.length - 1, Math.floor(t / duration * cues.length));
      const caption=$('#caption .ink');if(caption&&caption.textContent!==cues[idx])caption.textContent=cues[idx];
    };
    const startAudio = () => {
      if (epoch !== sceneEpoch || !activeMedia || activeMedia.started) return;
      activeMedia.started = true;
      say(cfg.audio, { onTime: update }).then(ok => {
        if (epoch !== sceneEpoch || !activeMedia) return;
        if (!cfg.src || activeMedia.fallback || S.audioFailed) { if (ok) finishMedia(); else { S.paused = true; toolbar(); } }
      });
    };
    if (cfg.src) {
      video.src = cfg.src; video.muted = cfg.audioMode !== 'embedded' || S.muted;
      video.classList.add('visible');
      video.onplaying = () => { if (cfg.audioMode !== 'embedded') startAudio(); };
      video.ontimeupdate = () => { if (cfg.audioMode === 'embedded') update(video.currentTime, video.duration); };
      video.onended = () => { if (epoch === sceneEpoch) finishMedia(); };
      video.onerror = () => { if (epoch !== sceneEpoch || !activeMedia || activeMedia.key !== key) return; video.classList.remove('visible');activeMedia.fallback=true;log('video-unavailable',{key,code:video.error?.code});S.paused=true;toolbar();showMediaRetry('Listen to story'); };
      video.play().catch(error => {
        if(error.name==='AbortError'||epoch!==sceneEpoch||!activeMedia||activeMedia.key!==key||activeMedia.fallback)return;
        log('video-blocked',{key,reason:error.name}); S.paused=true;toolbar();showMediaRetry('Play story');
      });
    } else startAudio();
  }
  function go(scene, opts = {}) {
    sceneEpoch++; stopMedia(); S.keyboardPick=null; S.guide=null; S.scene = Math.max(0, Math.min(9, scene===8?9:scene)); scene=S.scene; S.phase = 'ready';
    S.feedback = ''; S.tone = ''; S.busy = false; S.audioFailed = false; S.heard = false; S.selected = null; S.answered = false;
    log('enter');
    const epoch = sceneEpoch;
    const ready = () => { S.phase = 'ready'; render(); };
    if (scene === 1) return playSceneMedia(1, () => go(2));
    if (scene === 2) {
      if (!opts.skipIntro) return playSceneMedia(2, () => { ready(); say('open'); scheduleLidHint(); });
      ready(); scheduleLidHint(); return;
    }
    if (scene === 3) return playSceneMedia(3, () => go(4));
    if (scene === 6) {S.cookStep=0;S.burgersMade=0;S.count=0;ready();if(!opts.skipIntro)startGuide('kitchen');else say('burger');return;}
    if (scene >= 4 && scene <= 5) {
      S.count = 1; S.countPhase = 'add'; delete S.countPassed[kindNow()];
      const begin = () => { ready(); sayExtra('drag_' + kindNow(), 'add_' + kindNow()); };
      if (scene === 4 && !opts.skipIntro) return playSceneMedia(4, begin);
      begin(); return;
    }
    if (scene === 7) { S.order=0;S.orders=[];S.tray=[];ready();if(!opts.skipIntro)startGuide('orders');else hearTarget();return; }
    if (scene === 8) { S.label = 0; S.labelResults = []; ready(); say('labels'); return; }
    if (scene === 9) {
      S.done = false;
      if (!opts.skipIntro) return playSceneMedia(9, beginReview);
    }
    ready();
  }
  function restart() { coverSoundPlayed=false; S.discovered = []; S.countPassed = {}; S.orders = []; S.labelResults = []; S.done = false; go(0); playCoverCue();say('cover_title',{quiet:true}); }
  function hearTarget() {
    const epoch = sceneEpoch;
    const target = S.scene === 7 ? D.orders[S.order].word : D.checks[kindNow()];
    S.heard = true; render();
    say(target).then(ok => { if (epoch === sceneEpoch && !ok) render(); });
  }
  async function changeCount(delta) {
    if (S.busy || S.countPhase === 'check') return;
    const epoch = sceneEpoch, kind = kindNow();
    S.count = Math.max(1, Math.min(3, S.count + delta)); S.busy = true;
    log('count-change', { kind, count: S.count }); effect('discover'); render();
    await new Promise(resolve => setTimeout(resolve, 350));
    if (epoch !== sceneEpoch) return;
    await say(kind + (S.count > 1 ? 's' : ''));
    if (epoch !== sceneEpoch) return;
    S.busy = false;
    if (S.count===3 && S.countPhase==='add') { S.countPhase='remove';S.countPassed[kind]=kind==='egg';S.feedback='';render();if(kind==='bean')sayExtra('drag_remove','remove');else praise(); }
    else if (S.count===1 && S.countPhase==='remove') { S.countPassed[kind]=true;S.countPhase='add';S.feedback='';render();praise(); }
    else {render();if(S.count===2&&S.countPhase==='add')sayExtra('add_'+kind);}
  }
  function next() {
    if(S.guide){beginGame();return;}
    if (!canNext()) log('skip-question', { order: S.scene === 7 ? S.order : null, label: S.scene === 8 ? S.label : null });
    stopVoice();
    if (S.scene === 7) {
      if (S.order === D.orders.length-1) return go(9);
      sceneEpoch++;clearTimeout(S.reactionTimer);$('.bobo-reaction')?.remove(); S.order++; S.tray=[];S.orderOptions = []; S.selected = null; S.answered = false; S.feedback = ''; S.tone = ''; S.audioFailed = false; S.heard = false;
      render(); hearTarget(); return;
    }
    if (S.scene === 8) {
      if (S.label === 2) return go(9);
      sceneEpoch++; S.label++; S.selected = null; S.answered = false; S.feedback = ''; S.tone = ''; render(); return;
    }
    if (S.scene === 9 && S.phase === 'review-intro') {enterReview();return;}
    if (S.scene === 9) { S.done = true; log('done'); render();sayExtra('ending_bobo');effect('finish');return; }
    go(S.scene + 1);
  }
  function onAction(action, el) {
    if (el?.disabled) return;
    if (!['listen','word','start','restart','confirm-home','discover','serve-tray','media-retry'].includes(action)) effect('tap');
    if(action==='start'){go(1);effect('cover');return;}
    if(action==='begin-game'){beginGame();return;}
    if(action==='guide-listen'){playGuideAudio();return;}
    if(action==='show-guide'){startGuide(S.scene===6?'kitchen':'orders');return;}
    if(action==='media-retry'){resumeStory();return;}
    if (action === 'restart') { restart(); return; }
    if (action === 'home') {
      if (S.scene === 0) return;
      if (activeMedia && !S.paused) togglePause();
      $('#modal').innerHTML = `<div class="modal-shade"><section class="modal-card" role="dialog" aria-modal="true" aria-label="Go home"><h2>Go home?</h2><p>Start your lunch adventure again.</p><div class="modal-actions">${button('Continue', 'close-modal', 'play', true)}${button('Home', 'confirm-home', 'home')}</div></section></div>`; return;
    }
    if (action === 'confirm-home') { $('#modal').innerHTML = ''; restart(); return; }
    if (action === 'close-modal') { $('#modal').innerHTML = ''; if (activeMedia && S.paused) togglePause(); return; }
    if (action === 'mute') { S.muted = !S.muted; voice.muted = S.muted; sfx.muted = S.muted; if (activeMedia) video.muted = M[activeMedia.key].audioMode !== 'embedded' || S.muted; if(S.scene===7||S.scene>=4&&S.scene<=6&&S.countPhase==='check')render();else toolbar(); return; }
    if (action === 'pause') { togglePause(); return; }
    if (action === 'skip') { log('skip-media'); finishMedia(); return; }
    if (action === 'back') { go(S.scene === 4 ? 2 : Math.max(0, S.scene - 1), { skipIntro: true }); return; }
    if (action === 'next') { next(); return; }
    if (action === 'discover') { openFoodCard(el); return; }
    if (action === 'word') { say(el.dataset.word); return; }
    if(action==='build-part'){if(performance.now()-lastPointerDrag>250)return buildPart(+el.dataset.part);return;}
    if(action==='cook-more'){S.cookStep=0;S.busy=false;render();say('add_burger');return;}
    if(action==='tray-add'){if(performance.now()-lastPointerDrag>250)trayAdd(el.dataset.kind);return;}
    if(action==='tray-remove')return trayRemove(+el.dataset.index);
    if(action==='serve-tray')return serveTray();
    if (action === 'add-one' || action === 'egg-add') { if (performance.now() - lastPointerDrag > 250) changeCount(1); return; }
    if (action === 'remove-one') { changeCount(-1); return; }
    if (action === 'count-check') {
      const k = kindNow(), response = k + (+el.dataset.count > 1 ? 's' : ''), right = response === D.checks[k];
      S.selected = +el.dataset.count;
      log('count-check', { kind: k, response, correct: right });
      if (right) { S.countPassed[k] = true; S.feedback = 'That’s right!'; S.tone = ''; effect('correct'); render(); praise([response, 'nice']); }
      else { S.feedback = 'Listen again. One or more?'; S.tone = 'retry'; render(); sequence(['retry', D.checks[k]]); } return;
    }
    if (action === 'choose-order') {
      if (S.answered || !S.heard) return;
      const i = +el.dataset.index, [k, n] = S.orderOptions[i], q = D.orders[S.order], right = k === q.answer[0] && n === q.answer[1];
      const record = S.orders[S.order] ||= { id: q.id, attempts: 0, assisted: S.muted || S.audioFailed };
      record.attempts++; record.correct = right; record.assisted ||= S.muted || S.audioFailed || record.attempts >= 2 && !right;
      S.selected = i; log('order-answer', { id: q.id, kind: k, count: n, correct: right });
      if (right) { S.answered = true; S.feedback = 'Delivered!'; S.tone = ''; effect('correct'); render(); praise([q.word, 'correct']); }
      else { S.feedback = 'Listen again. One or more?'; S.tone = 'retry'; render(); sequence(['retry', q.word]); } return;
    }
    if (action === 'select-label') { S.selected = el.dataset.word; S.feedback = ''; S.tone = ''; render(); say(S.selected); return; }
    if (action === 'submit-label') {
      if (!S.selected || S.answered) return;
      const q = D.labels[S.label], right = S.selected === q.answer;
      const record = S.labelResults[S.label] ||= { kind: q.kind, count: q.count, attempts: 0 };
      record.attempts++; record.correct = right; log('label-answer', { selected: S.selected, expected: q.answer, correct: right });
      if (right) { S.answered = true; S.feedback = 'A perfect match!'; S.tone = ''; effect('correct'); render(); praise([q.answer, 'nice']); }
      else { S.feedback = 'Look again. One or more?'; S.tone = 'retry'; render(); say('retry'); } return;
    }
    if (action === 'listen') {
      if (S.scene === 7 || S.scene >= 4 && S.scene <= 6 && S.countPhase === 'check') return hearTarget();
      if (S.scene >= 4 && S.scene <= 6) return say(kindNow() + (S.count > 1 ? 's' : ''));
      if (S.scene === 2) return say(S.discovered.at(-1) || 'open');
      if (S.scene === 9) return say('review');
    }
  }
  function togglePause() {
    if(S.paused&&$('.media-retry')){resumeStory();return;}
    if (!activeMedia) return;
    S.paused = !S.paused;
    if (S.paused) { voice.pause(); video.pause(); }
    else { if (video.getAttribute('src')) video.play().catch(() => {}); if (voice.src && (M[activeMedia.key].audioMode !== 'embedded' || activeMedia.fallback)) voice.play().catch(() => {}); }
    toolbar();
  }
  stage.addEventListener('click', e => { const el = e.target.closest('[data-action]'); if (el) onAction(el.dataset.action, el); });
  stage.addEventListener('pointermove', e => { if (S.scene !== 0 && !S.done) return; const r=stage.getBoundingClientRect(); stage.style.setProperty('--pointer-x',`${((e.clientX-r.left)/r.width-.5)*12}px`); stage.style.setProperty('--pointer-y',`${((e.clientY-r.top)/r.height-.5)*8}px`); });
  stage.addEventListener('pointerleave',()=>{stage.style.setProperty('--pointer-x','0px');stage.style.setProperty('--pointer-y','0px');});
  function cancelFoodDrag() {
    if(!drag)return;const d=drag;drag=null;
    d.el.classList.remove('is-held');d.ghost?.remove();
    document.querySelectorAll('.drop-hint').forEach(el=>el.classList.remove('drop-hint'));
  }
  stage.addEventListener('pointerdown',e=>{
    const special=e.target.closest('[data-order-food],[data-piece]');
    if(special&&!special.disabled&&!S.busy&&e.button===0){const r=stage.getBoundingClientRect(),scale=r.width/1920;const ghost=special.cloneNode(true);ghost.className='play-drag-ghost '+(special.dataset.piece!==undefined?'ingredient':'pantry-food');ghost.removeAttribute('data-action');ghost.style.left=((e.clientX-r.left)/scale-90)+'px';ghost.style.top=((e.clientY-r.top)/scale-90)+'px';stage.append(ghost);special.setPointerCapture(e.pointerId);drag={el:special,ghost,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,type:special.dataset.piece!==undefined?'piece':'order',value:special.dataset.piece??special.dataset.orderFood};e.preventDefault();return;}
    const el=e.target.closest('[data-drag]');
    if(!el||el.disabled||S.busy||e.button!==0)return;
    const r=stage.getBoundingClientRect(),scale=r.width/1920;
    const ghost=document.createElement('div');ghost.className='food-ghost';ghost.innerHTML=`<img src="assets/images/${kindNow()}.webp" alt="" draggable="false">`;
    ghost.style.left=`${(e.clientX-r.left)/scale-70}px`;ghost.style.top=`${(e.clientY-r.top)/scale-80}px`;
    stage.append(ghost);el.classList.add('is-held');el.setPointerCapture(e.pointerId);
    drag={el,ghost,id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,type:el.dataset.drag};
    $(drag.type==='add'?'#drop-zone':'#return-zone').classList.add('drop-hint');e.preventDefault();
  });
  stage.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const r=stage.getBoundingClientRect(),scale=r.width/1920;
    if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8*scale)drag.moved=true;
    drag.ghost.style.left=`${(e.clientX-r.left)/scale-70}px`;drag.ghost.style.top=`${(e.clientY-r.top)/scale-80}px`;
  });
  stage.addEventListener('pointerup',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const d=drag;
    if(['piece','order'].includes(d.type)){const z=$(d.type==='piece'?'#burger-build-zone':'#order-tray').getBoundingClientRect(),good=d.moved&&e.clientX>=z.left&&e.clientX<=z.right&&e.clientY>=z.top&&e.clientY<=z.bottom;cancelFoodDrag();if(d.moved)lastPointerDrag=performance.now();if(good){if(d.type==='piece')buildPart(+d.value);else trayAdd(d.value);}else if(!d.moved){lastPointerDrag=performance.now();if(d.type==='piece')buildPart(+d.value);else trayAdd(d.value);}return;}
    const zone=$(d.type==='add'?'#drop-zone':'#return-zone').getBoundingClientRect();
    const good=d.moved&&e.clientX>=zone.left&&e.clientX<=zone.right&&e.clientY>=zone.top&&e.clientY<=zone.bottom;
    lastPointerDrag=performance.now();
    if(good){cancelFoodDrag();changeCount(d.type==='add'?1:-1);}
    else {
      const bounds=stage.getBoundingClientRect(),scale=bounds.width/1920,origin=d.el.getBoundingClientRect();
      const dx=(origin.left+origin.width/2-e.clientX)/scale,dy=(origin.top+origin.height/2-e.clientY)/scale;
      d.el.classList.remove('is-held');document.querySelectorAll('.drop-hint').forEach(el=>el.classList.remove('drop-hint'));drag=null;
      d.ghost.animate([{transform:'translate(0,0)'},{transform:`translate(${dx}px,${dy}px)`,opacity:0}],{duration:220,easing:'ease-out'}).finished.finally(()=>d.ghost.remove());
      if(d.moved){effect('tap');log('drag-return');}
    }
  });
  stage.addEventListener('pointercancel',cancelFoodDrag);
  stage.addEventListener('keydown',e=>{
    if(!['Enter',' '].includes(e.key))return;
    const token=e.target.closest('[data-drag]'),zone=e.target.closest('[data-drop]');
    if(token&&!token.disabled&&!S.busy){e.preventDefault();S.keyboardPick=token.dataset.drag;$(S.keyboardPick==='add'?'#drop-zone':'#return-zone').focus();}
    else if(zone&&S.keyboardPick===zone.dataset.drop&&!S.busy){e.preventDefault();const delta=S.keyboardPick==='add'?1:-1;S.keyboardPick=null;changeCount(delta);}
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && activeMedia && !S.paused) togglePause(); });
  const inkCanvas = document.createElement('canvas'), inkContext = inkCanvas.getContext('2d');
  function alignInk(el) {
    const c = getComputedStyle(el); inkContext.font = `${c.fontSize} ${c.fontFamily}`;
    const m = inkContext.measureText(el.textContent);
    el.style.setProperty('--ink-shift', '0px');
    const marker = document.createElement('i'); marker.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline'; el.append(marker);
    const scale=stage.getBoundingClientRect().width/1920, baseline=marker.getBoundingClientRect().top, box=el.parentElement.getBoundingClientRect(); marker.remove();
    const inkCenter=baseline+(m.actualBoundingBoxDescent-m.actualBoundingBoxAscent)*scale/2;
    const shift=(box.top+box.height/2-inkCenter)/scale;
    el.style.setProperty('--ink-shift', `${Number.isFinite(shift) && Math.abs(shift)<70 ? shift : 0}px`);
  }
  function alignText() {
    for (const el of screen.querySelectorAll('h1,h2,.hint,.feedback>span,.progress,.round-caption,.sound-help')) {
      if (!el.querySelector('.ink') && el.textContent.trim()) { const span = document.createElement('span'); span.className='ink'; while(el.firstChild)span.append(el.firstChild); el.append(span); }
    }
    screen.querySelectorAll('.ink').forEach(alignInk);
  }
  new MutationObserver(() => { textObserver.disconnect(); alignText(); textObserver.observe(screen,{childList:true,subtree:true}); }).observe(stage,{attributes:true,attributeFilter:['data-scene','data-phase','data-done']});
  const textObserver = new MutationObserver(() => { textObserver.disconnect(); alignText(); textObserver.observe(screen,{childList:true,subtree:true}); });
  textObserver.observe(screen,{childList:true,subtree:true});
  function layoutReport() {
    const bounds = stage.getBoundingClientRect(), scale = bounds.width / 1920, items = [];
    for (const el of stage.querySelectorAll('button,h1,h2,p,.feedback,.word,.progress,.story-caption,.invite-caption')) {
      const r = el.getBoundingClientRect(), c = getComputedStyle(el); if (!r.width || !r.height || c.visibility === 'hidden') continue;
      const text = el.innerText.trim(), inStage = r.left >= bounds.left - 1 && r.top >= bounds.top - 1 && r.right <= bounds.right + 1 && r.bottom <= bounds.bottom + 1;
      items.push({ tag: el.tagName, text, action: el.dataset.action || '', font: c.fontFamily, size: parseFloat(c.fontSize), width: +(r.width / scale).toFixed(1), height: +(r.height / scale).toFixed(1), inStage, overflowing: el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2, chinese: /[\u3400-\u9fff]/.test(text) });
    }
    return { scene: S.scene, phase: S.phase, viewport: [innerWidth, innerHeight], fonts: ['Heinemann Roman','Heinemann Bold','FZ Round Bold'].map(f => ({ name: f, loaded: document.fonts.check(`40px "${f}"`) })), pageScroll: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight, items };
  }
  window.BOBO = { snapshot: () => JSON.parse(JSON.stringify(S)), layoutReport, go: (n, opts = {}) => go(n, opts) };
  document.fonts.addEventListener('loadingdone', alignText);
  Promise.all(['Heinemann Roman','Heinemann Bold','FZ Round Bold'].map(f => document.fonts.load(`40px "${f}"`))).then(alignText);
  render(); requestAnimationFrame(()=>{playCoverCue();if(S.scene===0)say('cover_title',{quiet:true});});
  document.fonts.ready.then(() => { alignText(); log('fonts-ready'); if (new URLSearchParams(location.search).has('scene')) { const n = Number(new URLSearchParams(location.search).get('scene')); if (Number.isInteger(n) && n >= 0 && n <= 9) go(n, { skipIntro: true }); } });
})();
