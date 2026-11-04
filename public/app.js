const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const qs=new URLSearchParams(location.search);
const pathCode=(location.pathname.match(/^\/join\/([A-Za-z0-9]+)\/?$/)||[])[1]||'';
let sessionCode=normalizeCode(pathCode||qs.get('session')||'');
let state=null,playerId='',source=null,endSequenceShown=false;
const LETTERS=['B','I','N','G','O'];

function normalizeCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,15)}
async function api(url,options={}){const r=await fetch(url,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function show(id){$$('.screen').forEach(x=>x.classList.toggle('active',x.id===id));document.body.classList.toggle('live-play',id==='play');if(id==='play')requestGameplayFit()}
function sponsor(el,s){if(!el||!s)return;const name=String(s.sponsorName||'').trim(),logo=String(s.sponsorLogoUrl||'').trim();if(!name&&!logo){el.classList.add('hidden');el.innerHTML='';return;}el.classList.remove('hidden');el.innerHTML=`THIS ROUND'S GAME IS SPONSORED BY${name?`<b>${escapeHtml(name)}</b>`:''}${logo?`<img src="${escapeHtml(logo)}" alt="Sponsor logo">`:''}`} 
function gameplaySponsor(el,s){if(!el||!s)return;const name=String(s.sponsorName||'').trim(),logo=String(s.sponsorLogoUrl||'').trim();if(!name&&!logo){el.classList.add('hidden');el.innerHTML='';return;}el.classList.remove('hidden');el.innerHTML=`<span>THIS ROUND’S GAME IS SPONSORED BY</span><div class="gameplay-sponsor-brand">${logo?`<img src="${escapeHtml(logo)}" alt="Sponsor logo">`:''}${name?`<b>${escapeHtml(name)}</b>`:''}</div>`}

function fmtSecs(s){s=Math.max(0,Math.floor(s||0));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function remainingMs(){if(!state)return 0;if(state.winCondition!=='timed')return 0;if(state.phase==='paused')return state.pausedRemaining||0;if(!state.endsAt)return (state.roundDuration||0)*1000;return Math.max(0,state.endsAt-Date.now())}
function elapsedMs(){if(!state?.startedAt)return 0;const end=state.phase==='ended'?(state.endedAt||Date.now()):Date.now();return Math.max(0,end-state.startedAt)}
function canJoinFromState(s){if(!s||s.phase==='ended')return false;if(['waiting','starting'].includes(s.phase))return true;if(!['running','paused'].includes(s.phase))return false;if(s.lateJoinPolicy==='allowed')return true;if(s.lateJoinPolicy==='closed')return false;if(s.lateJoinPolicy==='cutoff'&&s.startedAt)return Date.now()-s.startedAt<s.lateJoinCutoffMinutes*60000;return false}
function rulesText(s){if(!s)return '';const win=s.winCondition==='target'?`First to ${s.bingoTarget} Bingos`:`${Math.round(s.roundDuration/60)}-minute round`;const mode=s.mode==='teams'?'Team Mode • Top 3 count':'Solo Mode';return `${mode} • ${win} • ${s.callDuration}s calls`}
function shareLink(){const round=state?.roundNumber||1;return `${location.origin}/join/${encodeURIComponent(sessionCode)}?r=${round}`}
function shareText(){const sponsor=state?.sponsorName?` This round is sponsored by ${state.sponsorName}.`:'';return `Join my Bingo Rush game — Game Code ${sessionCode}.${sponsor}`}

const REG_VIEWS=['auto','mobile','tablet'];
function setRegistrationView(view,save=true){
  const next=REG_VIEWS.includes(view)?view:'auto',reg=$('#register');if(!reg)return;
  REG_VIEWS.forEach(v=>reg.classList.toggle('reg-view-'+v,v===next));
  $$('.reg-view-btn').forEach(btn=>{const on=btn.dataset.regView===next;btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on));});
  if(save)try{localStorage.setItem('br-registration-view',next)}catch{}
}
function initRegistrationView(){let saved='auto';try{saved=localStorage.getItem('br-registration-view')||'auto'}catch{}setRegistrationView(saved,false)}

let gameplayFitRaf=0;
function gameplayViewport(){
  const vv=window.visualViewport;
  const width=Math.max(1,Math.round(vv?.width||window.innerWidth||document.documentElement.clientWidth||320));
  const height=Math.max(1,Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||480));
  return {width,height};
}
function requestGameplayFit(){
  cancelAnimationFrame(gameplayFitRaf);
  gameplayFitRaf=requestAnimationFrame(()=>requestAnimationFrame(fitGameplayToViewport));
}
function fitGameplayToViewport(){
  const play=$('#play'),fit=$('#gameplayFit');
  if(!play?.classList.contains('active')||!fit)return;
  const {width,height}=gameplayViewport();
  document.documentElement.style.setProperty('--play-vw',width+'px');
  document.documentElement.style.setProperty('--play-vh',height+'px');
  const landscape=width/height>=1.18;
  const tallPortrait=!landscape && height/width>=1.55;
  fit.classList.toggle('landscape-layout',landscape);
  fit.classList.toggle('tall-layout',tallPortrait);

  // Reset dynamic height before measuring the natural game canvas.
  fit.style.removeProperty('--game-design-height');
  fit.style.setProperty('--game-scale','1');
  const designW=Math.max(1,fit.offsetWidth),naturalH=Math.max(1,fit.offsetHeight);
  const safe=Math.max(3,Math.min(12,Math.min(width,height)*0.018));
  const availW=Math.max(1,width-safe*2),availH=Math.max(1,height-safe*2);
  const widthScale=availW/designW,heightScale=availH/naturalH;
  let scale=Math.min(widthScale,heightScale);
  scale=Math.max(0.20,Math.min(scale,1.65));

  // When width is the limiting dimension (common on tall phones), preserve the
  // board width but expand the design canvas vertically to use the entire usable
  // screen. CSS then distributes the header, call, board and sponsor from top to bottom.
  if(widthScale<=heightScale+0.001){
    const fullDesignH=Math.max(naturalH,availH/scale);
    fit.style.setProperty('--game-design-height',fullDesignH.toFixed(2)+'px');
  }
  fit.style.setProperty('--game-scale',String(scale));
}
window.addEventListener('resize',requestGameplayFit,{passive:true});
window.addEventListener('orientationchange',requestGameplayFit,{passive:true});
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',requestGameplayFit,{passive:true});
  window.visualViewport.addEventListener('scroll',requestGameplayFit,{passive:true});
}

function populateTeams(){
  const sel=$('#teamSelect');if(!sel||!state)return;
  const teamMode=state.mode==='teams';$('#teamField').classList.toggle('hidden',!teamMode);
  if(!teamMode){sel.innerHTML='';return;}
  const previous=sel.value;const teams=state.teams||[];const available=teams.filter(t=>!t.full);
  sel.innerHTML=`<option value="">Choose a team</option>`+teams.map(t=>`<option value="${escapeHtml(t.id)}" ${t.full?'disabled':''}>${escapeHtml(t.name)} — ${t.playerCount||0}/${t.capacity||12}${t.full?' • FULL':''}</option>`).join('');
  if(previous&&teams.some(t=>t.id===previous&&!t.full))sel.value=previous;
  else if(available.length===1)sel.value=available[0].id;
}
function connect(){if(source)source.close();source=new EventSource(`/events?session=${encodeURIComponent(sessionCode)}${playerId?`&player=${encodeURIComponent(playerId)}`:''}`);source.addEventListener('state',e=>{state=JSON.parse(e.data);renderState()});source.addEventListener('room_reset',()=>{try{localStorage.removeItem('br-player-'+sessionCode)}catch{}playerId='';state=null;if(source){source.close();source=null}sessionCode='';$('#gameCodeInput').value='';$('#codeError').textContent='The host reset the game room. Enter the new Game Code when announced.';show('codeEntry')});source.onerror=()=>{}}

function renderBoard(){
  const board=$('#board');if(!board||!state?.me)return;board.innerHTML='';const current=state.currentCall;const already=current&&state.me.placedCallId===current.id;
  for(let i=0;i<25;i++){
    const cell=document.createElement('button');cell.className='cell';cell.type='button';const item=state.me.board[i];const col=i%5;const isCalled=current&&LETTERS[col]===current.letter;
    if(current&&!isCalled)cell.classList.add('dim');
    if(item){cell.classList.add('filled');cell.style.setProperty('--ball',item.hex);cell.innerHTML=`<span class="mini-face"><span class="mini-letter">${escapeHtml(item.letter)}</span><span class="mini-number">${item.number}</span></span>`;}
    else if(isCalled&&!already&&state.phase==='running'){cell.classList.add('hot');cell.style.setProperty('--call',current.hex);cell.onclick=()=>place(i);}
    cell.disabled=!!item||!isCalled||already||state.phase!=='running';board.appendChild(cell);
  }
  $$('.letter-head').forEach((h,i)=>{h.classList.toggle('hot',!!current&&LETTERS[i]===current.letter);h.classList.toggle('dim',!!current&&LETTERS[i]!==current.letter);if(current&&LETTERS[i]===current.letter)h.style.setProperty('--call',current.hex)});
}
function renderCall(){
  const c=state?.currentCall,ball=$('#callBall');if(!ball)return;
  const stack=ball.querySelector('.ball-face > div');
  if(c){
    ball.style.setProperty('--ball',c.hex);
    stack.innerHTML=`<span class="call-letter">${escapeHtml(c.letter)}</span><span class="call-number">${c.number}</span>`;
  } else {
    ball.style.setProperty('--ball','#258cff');
    stack.innerHTML=`<span class="call-letter">—</span><span class="call-number">—</span>`;
  }
}
function renderFinalRows(){
  $('#finalLeaderRows').innerHTML=(state.standings||[]).map(x=>`<div class="leader-row ${x.id===playerId?'me':''}"><span>${x.rank===1?'🏆 ':''}#${x.rank} ${escapeHtml(x.name)}</span><span>${x.score} BINGOS</span></div>`).join('')||'<p class="muted">No scores.</p>';
  const teamCard=$('#finalTeamCard');teamCard.classList.toggle('hidden',state.mode!=='teams');if(state.mode==='teams')$('#finalTeamRows').innerHTML=(state.teamStandings||[]).map(t=>`<div class="leader-row"><span>${t.rank===1?'🏆 ':''}#${t.rank} ${escapeHtml(t.name)}</span><span>${t.score} BINGOS</span></div>`).join('');
}
function showEndSequence(){
  if(endSequenceShown)return;endSequenceShown=true;show('end');$('#gameOverStage').classList.remove('hidden');$('#winnerStage').classList.add('hidden');$('#finalStage').classList.add('hidden');$('#endCode').textContent=sessionCode;
  const winner=state.standings?.[0],teamWinner=state.teamStandings?.[0],me=state.standings?.find(x=>x.id===playerId);
  setTimeout(()=>{if(!$('#end').classList.contains('active'))return;$('#gameOverStage').classList.add('hidden');$('#winnerStage').classList.remove('hidden');$('#winnerName').textContent=winner?.name||'—';$('#winnerScore').textContent=winner?.score||0;$('#teamWinnerBlock').classList.toggle('hidden',state.mode!=='teams');if(state.mode==='teams'){$('#teamWinnerName').textContent=teamWinner?.name||'—';$('#teamWinnerScore').textContent=teamWinner?.score||0;}},1600);
  setTimeout(()=>{if(!$('#end').classList.contains('active'))return;$('#winnerStage').classList.add('hidden');$('#finalStage').classList.remove('hidden');renderFinalRows();$('#playerResult').textContent=me?.rank===1?`🏆 YOU WON • ${me.score} BINGOS`:`YOU FINISHED #${me?.rank||'—'} • ${me?.score||0} BINGOS`;const myTeam=state.mode==='teams'?(state.teamStandings||[]).find(t=>t.id===me?.teamId):null;$('#shareResult').textContent=myTeam?.rank===1?'SHARE TEAM WIN':me?.rank===1?'SHARE MY WIN':'SHARE MY SCORE';sponsor($('#endSponsor'),state)},3900);
}
function renderPrestart(){
  show('prestart');
  const pre=$('#prestart'),rem=Math.max(0,(state.startsAt||Date.now())-Date.now()),logo=$('#preSponsorLogo');
  const hasSponsor=!!(state.sponsorName||state.sponsorLogoUrl);
  $('#preSponsorName').textContent=state.sponsorName||'';
  $('#preSponsorName').classList.toggle('hidden',!state.sponsorName);
  if(state.sponsorLogoUrl){logo.src=state.sponsorLogoUrl;logo.classList.remove('hidden')}else logo.classList.add('hidden');
  const countdown=!(hasSponsor&&rem>3000);
  pre.classList.toggle('countdown-takeover',countdown);
  if(!countdown){
    $('#preSponsorStage').classList.remove('hidden');
    $('#countdownStage').classList.add('hidden');
  }else{
    $('#preSponsorStage').classList.add('hidden');
    $('#countdownStage').classList.remove('hidden');
    $('#startCount').textContent=Math.max(1,Math.ceil(rem/1000));
  }
}
function renderState(){
  if(!state)return;
  if(state.phase!=='ended')endSequenceShown=false;
  populateTeams();$('#gameCode').textContent=sessionCode;$('#waitingCode').textContent=sessionCode;$('#endCode').textContent=sessionCode;$('#roundRules').textContent=rulesText(state);sponsor($('#regSponsor'),state);
  const joined=!!state.me;
  if(joined){$('#waitingName').textContent=state.me.name;$('#joinedCount').textContent=state.playerCount;$('#waitRules').textContent=rulesText(state);sponsor($('#waitSponsor'),state);const team=state.teams?.find(t=>t.id===state.me.teamId);$('#waitingTeam').classList.toggle('hidden',!team);if(team)$('#waitingTeam').textContent=team.name;}
  if(joined&&state.phase==='waiting')show('waiting');
  if(joined&&state.phase==='starting')renderPrestart();
  if(joined&&['running','paused'].includes(state.phase)){
    show('play');
    const myTeam=state.mode==='teams'?(state.teams||[]).find(t=>t.id===state.me.teamId):null;
    const identity=myTeam?.name||state.me.name||'PLAYER';
    $('#playerIdentity').textContent=identity;
    $('#playerIdentity').title=identity;
    gameplaySponsor($('#gameSponsor'),state);$('#score').textContent=state.me.score;$('#rank').textContent='#'+(state.me.rank||1);renderCall();renderBoard();requestGameplayFit();
  }
  if(joined&&state.phase==='ended')showEndSequence();
  if(!joined){
    show('register');
    const joinWindowOpen=canJoinFromState(state);
    const teamMode=state.mode==='teams';const teams=state.teams||[];const availableTeams=teams.filter(t=>!t.full);
    const selectedTeam=teamMode?$('#teamSelect').value:'';
    const canJoin=joinWindowOpen&&(!teamMode||(availableTeams.length>0&&!!selectedTeam));
    $('#join').disabled=!canJoin;
    if(!joinWindowOpen)$('#joinError').textContent=state.phase==='ended'?'This round has ended. Wait for the host to reset the room.':'Late joining is closed for this round.';
    else if(teamMode&&teams.length===0)$('#joinError').textContent='The host has not opened any teams yet.';
    else if(teamMode&&availableTeams.length===0)$('#joinError').textContent='All teams are full for this round.';
    else $('#joinError').textContent='';
  }
}
async function place(index){
  if(!state?.currentCall||!playerId)return;try{const out=await api(`/api/sessions/${sessionCode}/place`,{method:'POST',body:JSON.stringify({playerId,callId:state.currentCall.id,index})});if(out.bingos){showToast(out.points>out.bingos?`COLOR BINGO +${out.points}`:`${out.bingos>1?'MULTI BINGO':'BINGO'} +${out.points}`)}}catch(e){showToast(e.message)}
}
function showToast(t){const el=$('#toast');el.textContent=t;el.classList.remove('go');void el.offsetWidth;el.classList.add('go')}
async function shareGame(){const url=shareLink();const data={title:`Bingo Rush — Join ${sessionCode}`,text:shareText(),url};if(navigator.share){try{await navigator.share(data);return}catch(e){if(e.name==='AbortError')return}}try{await navigator.clipboard.writeText(`${shareText()}\n${url}`);showToast('GAME LINK COPIED')}catch{showToast(`GAME CODE: ${sessionCode}`)}}
async function join(){
  const name=$('#playerName').value.trim();if(!sessionCode){$('#joinError').textContent='Enter a valid game code first.';return}if(!name){$('#joinError').textContent='Enter your player name.';return}const teamId=state?.mode==='teams'?$('#teamSelect').value:null;if(state?.mode==='teams'&&!teamId){$('#joinError').textContent='Choose an available team.';return}$('#joinError').textContent='';
  try{const old=localStorage.getItem('br-player-'+sessionCode)||'';const j=await api(`/api/sessions/${sessionCode}/join`,{method:'POST',body:JSON.stringify({name,teamId,playerId:old})});playerId=j.playerId;localStorage.setItem('br-player-'+sessionCode,playerId);state=j.state;connect();renderState()}catch(e){$('#joinError').textContent=e.message}
}
async function loadGameCode(raw){
  const next=normalizeCode(raw);$('#codeError').textContent='';if(next.length<4){$('#codeError').textContent='Enter a 4–15 character game code.';return false}
  try{
    const loaded=await api(`/api/sessions/${next}`);sessionCode=next;state=loaded;history.replaceState(null,'',`/join/${encodeURIComponent(sessionCode)}?r=${loaded.roundNumber||1}`);$('#gameCodeInput').value=sessionCode;const old=localStorage.getItem('br-player-'+sessionCode)||'';if(old)playerId=old;else playerId='';connect();renderState();return true;
  }catch(e){$('#codeError').textContent='Game code not found. Check the code and try again.';return false}
}
function tickUi(){
  if(!state)return;
  if(state.phase==='starting'&&state.me)renderPrestart();
  if(['running','paused'].includes(state.phase)&&state.me){
    if(state.winCondition==='timed')$('#timer').textContent=fmtSecs(remainingMs()/1000);else $('#timer').textContent=`GOAL ${state.bingoTarget}`;
    const dur=state.callDuration||5;let r=state.phase==='running'&&state.callDeadline?(state.callDeadline-Date.now())/1000:0;r=Math.max(0,r);$('#callFill').style.width=Math.min(100,Math.max(0,r/dur*100))+'%';$('#callBall')?.classList.toggle('urgent',r<=2&&r>0);
  }
}
setInterval(tickUi,100);

function loadCanvasImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not load share artwork.'));img.src=src})}
function fitCanvasText(ctx,text,maxWidth,startSize,minSize=28,weight=900){let size=startSize;do{ctx.font=`${weight} ${size}px system-ui,-apple-system,Segoe UI,sans-serif`;if(ctx.measureText(text).width<=maxWidth)break;size-=2}while(size>minSize);return size}
function roundRectPath(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
function drawCover(ctx,img,x,y,w,h,focusY=.5){const scale=Math.max(w/img.width,h/img.height),sw=w/scale,sh=h/scale,sx=Math.max(0,(img.width-sw)/2),sy=Math.max(0,Math.min(img.height-sh,(img.height-sh)*focusY));ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h)}
async function shareCard(){
  const me=(state.standings||[]).find(x=>x.id===playerId)||{name:'PLAYER',score:0,rank:0};
  const team=state.mode==='teams'?(state.teamStandings||[]).find(t=>t.id===me.teamId):null;
  const teamMode=!!team,rank=teamMode?(team.rank||0):(me.rank||0),score=teamMode?(team.score||0):(me.score||0),first=rank===1;
  const primary=String(teamMode?team.name:me.name||'PLAYER').toUpperCase();
  const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');

  // Use the real Bingo Rush title artwork as the visual foundation.
  try{const art=await loadCanvasImage('/assets/bingo-rush-title.png');drawCover(x,art,0,0,1080,1350,.44)}catch{const g=x.createLinearGradient(0,0,1080,1350);g.addColorStop(0,'#08113d');g.addColorStop(.5,'#471474');g.addColorStop(1,'#090914');x.fillStyle=g;x.fillRect(0,0,1080,1350)}

  // Focus the eye on the result while keeping the title artwork visible.
  const shade=x.createLinearGradient(0,500,0,1350);shade.addColorStop(0,'rgba(5,7,24,0)');shade.addColorStop(.28,'rgba(5,7,24,.08)');shade.addColorStop(.52,'rgba(5,7,24,.58)');shade.addColorStop(1,'rgba(5,7,24,.96)');x.fillStyle=shade;x.fillRect(0,0,1080,1350);
  const vignette=x.createRadialGradient(540,650,260,540,650,780);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.48)');x.fillStyle=vignette;x.fillRect(0,0,1080,1350);

  // Championship/result banner.
  const bannerY=755;roundRectPath(x,82,bannerY,916,148,34);const bg=x.createLinearGradient(82,bannerY,998,bannerY+148);bg.addColorStop(0,first?'rgba(255,177,0,.97)':'rgba(27,83,242,.96)');bg.addColorStop(.52,first?'rgba(255,89,20,.97)':'rgba(118,56,235,.97)');bg.addColorStop(1,first?'rgba(214,27,139,.97)':'rgba(222,42,200,.96)');x.fillStyle=bg;x.fill();x.lineWidth=5;x.strokeStyle='rgba(255,255,255,.92)';x.stroke();
  x.textAlign='center';x.textBaseline='middle';x.fillStyle='#fff';x.shadowColor='rgba(0,0,0,.72)';x.shadowBlur=12;
  const rankText=first?(teamMode?'1ST PLACE TEAM':'1ST PLACE'):(teamMode?`TEAM FINISHED #${rank||'—'}`:`FINISHED #${rank||'—'}`);fitCanvasText(x,rankText,820,68,38,1000);x.fillText(rankText,540,bannerY+74);x.shadowBlur=0;

  // Player or team identity — the hero of the card.
  x.fillStyle='#fff';x.shadowColor='rgba(0,0,0,.9)';x.shadowBlur=18;fitCanvasText(x,primary,900,82,40,1000);x.fillText(primary,540,968);x.shadowBlur=0;
  if(teamMode){x.fillStyle='#d9ddff';const line=`${String(me.name||'PLAYER').toUpperCase()}  •  INDIVIDUAL #${me.rank||'—'}  •  ${me.score||0} BINGOS`;fitCanvasText(x,line,870,30,19,900);x.fillText(line,540,1020)}

  // Score is intentionally simple and huge.
  const scoreY=teamMode?1115:1088;x.fillStyle=first?'#ffe06a':'#fff';x.shadowColor=first?'rgba(255,177,0,.55)':'rgba(97,145,255,.5)';x.shadowBlur=24;x.font='1000 108px system-ui,-apple-system,Segoe UI,sans-serif';x.fillText(String(score),540,scoreY);x.shadowBlur=0;x.fillStyle='#fff';x.font='1000 30px system-ui,-apple-system,Segoe UI,sans-serif';x.fillText(teamMode?'TEAM BINGOS':'BINGOS',540,scoreY+68);

  // Minimal sponsor footer; no game code clutter on a result card.
  if(state.sponsorName){x.fillStyle='rgba(7,9,24,.78)';roundRectPath(x,185,1224,710,78,22);x.fill();x.fillStyle='#cbd4ff';x.font='800 19px system-ui,-apple-system,Segoe UI,sans-serif';x.fillText('SPONSORED BY',540,1246);x.fillStyle='#fff';const sp=String(state.sponsorName).toUpperCase();fitCanvasText(x,sp,620,28,18,1000);x.fillText(sp,540,1277)}
  else{x.fillStyle='#d8deff';x.font='900 24px system-ui,-apple-system,Segoe UI,sans-serif';x.fillText('BINGO RUSH',540,1274)}
  return c
}
async function shareResult(){
  const me=(state.standings||[]).find(x=>x.id===playerId)||{name:'Player',score:0,rank:0};
  const team=state.mode==='teams'?(state.teamStandings||[]).find(t=>t.id===me.teamId):null;
  const canvas=await shareCard();const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const file=new File([blob],'bingo-rush-result.png',{type:'image/png'});
  let text;if(team){text=team.rank===1?`${team.name} took 1st place in Bingo Rush with ${team.score} team Bingos! I scored ${me.score}. `:`${team.name} finished #${team.rank} in Bingo Rush with ${team.score} team Bingos. I scored ${me.score}. `}else{text=me.rank===1?`${me.name} took 1st place in Bingo Rush with ${me.score} Bingos! `:`${me.name} finished #${me.rank} in Bingo Rush with ${me.score} Bingos. `}text+=`Game Code ${sessionCode}`;
  const data={title:'Bingo Rush',text,files:[file]};if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share(data);return}catch(e){if(e.name==='AbortError')return}}if(navigator.share){try{delete data.files;data.url=shareLink();await navigator.share(data);return}catch(e){if(e.name==='AbortError')return}}const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='bingo-rush-result.png';a.click()
}
$('#enterGame').onclick=async()=>{if(sessionCode){$('#gameCodeInput').value=sessionCode;await loadGameCode(sessionCode)}else show('codeEntry')};
$('#gameCodeInput').addEventListener('input',e=>{const n=normalizeCode(e.target.value);if(e.target.value!==n)e.target.value=n});
$('#gameCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#findGame').click()});
$$('.reg-view-btn').forEach(btn=>btn.addEventListener('click',()=>setRegistrationView(btn.dataset.regView)));
$('#teamSelect').addEventListener('change',()=>renderState());
$('#findGame').onclick=()=>loadGameCode($('#gameCodeInput').value);
$('#changeCode').onclick=()=>{if(source){source.close();source=null}state=null;playerId='';sessionCode='';history.replaceState(null,'','/');$('#gameCodeInput').value='';$('#codeError').textContent='';show('codeEntry')};
$('#join').onclick=join;$('#shareInvite').onclick=shareGame;$('#shareWaiting').onclick=shareGame;$('#shareResult').onclick=shareResult;
initRegistrationView();
if(sessionCode){$('#gameCodeInput').value=sessionCode;loadGameCode(sessionCode)}
