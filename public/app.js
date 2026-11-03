const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const qs=new URLSearchParams(location.search);
const pathCode=(location.pathname.match(/^\/join\/([A-Za-z0-9]+)\/?$/)||[])[1]||'';
let sessionCode=normalizeCode(pathCode||qs.get('session')||'');
let state=null,playerId='',source=null,endSequenceShown=false;
const LETTERS=['B','I','N','G','O'];

function normalizeCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,15)}
async function api(url,options={}){const r=await fetch(url,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function show(id){$$('.screen').forEach(x=>x.classList.toggle('active',x.id===id));document.body.classList.toggle('live-play',id==='play')}
function sponsor(el,s){if(!el||!s)return;const name=String(s.sponsorName||'').trim(),logo=String(s.sponsorLogoUrl||'').trim();if(!name&&!logo){el.classList.add('hidden');el.innerHTML='';return;}el.classList.remove('hidden');el.innerHTML=`THIS ROUND'S GAME IS SPONSORED BY${name?`<b>${escapeHtml(name)}</b>`:''}${logo?`<img src="${escapeHtml(logo)}" alt="Sponsor logo">`:''}`} 
function fmtSecs(s){s=Math.max(0,Math.floor(s||0));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function remainingMs(){if(!state)return 0;if(state.winCondition!=='timed')return 0;if(state.phase==='paused')return state.pausedRemaining||0;if(!state.endsAt)return (state.roundDuration||0)*1000;return Math.max(0,state.endsAt-Date.now())}
function elapsedMs(){if(!state?.startedAt)return 0;const end=state.phase==='ended'?(state.endedAt||Date.now()):Date.now();return Math.max(0,end-state.startedAt)}
function canJoinFromState(s){if(!s||s.phase==='ended')return false;if(['waiting','starting'].includes(s.phase))return true;if(!['running','paused'].includes(s.phase))return false;if(s.lateJoinPolicy==='allowed')return true;if(s.lateJoinPolicy==='closed')return false;if(s.lateJoinPolicy==='cutoff'&&s.startedAt)return Date.now()-s.startedAt<s.lateJoinCutoffMinutes*60000;return false}
function rulesText(s){if(!s)return '';const win=s.winCondition==='target'?`First to ${s.bingoTarget} Bingos`:`${Math.round(s.roundDuration/60)}-minute round`;const mode=s.mode==='teams'?'Team Mode • Top 3 count':'Solo Mode';return `${mode} • ${win} • ${s.callDuration}s calls`}
function shareLink(){const round=state?.roundNumber||1;return `${location.origin}/join/${encodeURIComponent(sessionCode)}?r=${round}`}
function shareText(){const sponsor=state?.sponsorName?` This round is sponsored by ${state.sponsorName}.`:'';return `Join my Bingo Rush game — Game Code ${sessionCode}.${sponsor}`}

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
    if(item){cell.classList.add('filled');cell.style.setProperty('--ball',item.hex);cell.innerHTML=`<span class="mini-face">${escapeHtml(item.letter)}<br>${item.number}</span>`;}
    else if(isCalled&&!already&&state.phase==='running'){cell.classList.add('hot');cell.style.setProperty('--call',current.hex);cell.onclick=()=>place(i);}
    cell.disabled=!!item||!isCalled||already||state.phase!=='running';board.appendChild(cell);
  }
  $$('.letter-head').forEach((h,i)=>{h.classList.toggle('hot',!!current&&LETTERS[i]===current.letter);h.classList.toggle('dim',!!current&&LETTERS[i]!==current.letter);if(current&&LETTERS[i]===current.letter)h.style.setProperty('--call',current.hex)});
}
function renderCall(){
  const c=state?.currentCall,ball=$('#callBall');if(!ball)return;
  if(c){ball.style.setProperty('--ball',c.hex);ball.querySelector('b').textContent=`${c.letter}-${c.number}`;ball.querySelector('small').textContent=c.color;$('#instruction').textContent=state.me?.placedCallId===c.id?'PLACED — waiting for next call':`Choose an empty ${c.letter} space`;}
  else{ball.style.setProperty('--ball','#258cff');ball.querySelector('b').textContent='—';ball.querySelector('small').textContent=state?.phase==='paused'?'PAUSED':'WAITING';$('#instruction').textContent=state?.phase==='paused'?'Game paused by host':'Waiting for call…';}
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
  show('prestart');const rem=Math.max(0,(state.startsAt||Date.now())-Date.now());const logo=$('#preSponsorLogo');const hasSponsor=!!(state.sponsorName||state.sponsorLogoUrl);$('#preSponsorName').textContent=state.sponsorName||'';$('#preSponsorName').classList.toggle('hidden',!state.sponsorName);if(state.sponsorLogoUrl){logo.src=state.sponsorLogoUrl;logo.classList.remove('hidden')}else logo.classList.add('hidden');
  if(hasSponsor&&rem>3000){$('#preSponsorStage').classList.remove('hidden');$('#countdownStage').classList.add('hidden')}else{$('#preSponsorStage').classList.add('hidden');$('#countdownStage').classList.remove('hidden');$('#startCount').textContent=Math.max(1,Math.ceil(rem/1000));}
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
    sponsor($('#gameSponsor'),state);$('#score').textContent=state.me.score;$('#rank').textContent='#'+(state.me.rank||1);renderCall();renderBoard();
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
    if(state.winCondition==='timed')$('#timer').textContent=fmtSecs(remainingMs()/1000);else $('#timer').textContent=`GOAL ${state.bingoTarget} • ${fmtSecs(elapsedMs()/1000)}`;
    const dur=state.callDuration||5;let r=state.phase==='running'&&state.callDeadline?(state.callDeadline-Date.now())/1000:0;r=Math.max(0,r);$('#callSeconds').textContent=Math.ceil(r);$('#callFill').style.width=Math.min(100,Math.max(0,r/dur*100))+'%';$('#callBall')?.classList.toggle('urgent',r<=2&&r>0);
  }
}
setInterval(tickUi,100);

function loadCanvasImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not load share artwork.'));img.src=src})}
function fitCanvasText(ctx,text,maxWidth,startSize,minSize=28,weight=900){let size=startSize;do{ctx.font=`${weight} ${size}px system-ui,-apple-system,Segoe UI,sans-serif`;if(ctx.measureText(text).width<=maxWidth)break;size-=2}while(size>minSize);return size}
function roundRectPath(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
function drawContain(ctx,img,x,y,w,h){const scale=Math.min(w/img.width,h/img.height);const dw=img.width*scale,dh=img.height*scale;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}
async function shareCard(){
  const me=(state.standings||[]).find(x=>x.id===playerId)||{name:'PLAYER',score:0,rank:0};
  const team=state.mode==='teams'?(state.teamStandings||[]).find(t=>t.id===me.teamId):null;
  const isTeam=!!team;
  const primaryName=(isTeam?team.name:me.name)||'PLAYER';
  const primaryRank=isTeam?(team.rank||0):(me.rank||0);
  const primaryScore=isTeam?(team.score||0):(me.score||0);
  const first=primaryRank===1;
  const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');

  // Deep neon stage background.
  const bg=x.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,'#07091b');bg.addColorStop(.42,'#151b55');bg.addColorStop(.72,'#3b145e');bg.addColorStop(1,'#070914');x.fillStyle=bg;x.fillRect(0,0,1080,1350);
  const glow=x.createRadialGradient(540,590,30,540,590,560);glow.addColorStop(0,'rgba(255,194,35,.34)');glow.addColorStop(.25,'rgba(238,48,199,.23)');glow.addColorStop(.58,'rgba(46,115,255,.17)');glow.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=glow;x.fillRect(0,0,1080,1120);

  // Title artwork reference at top, contained so it is never stretched.
  try{const art=await loadCanvasImage('/assets/bingo-rush-title.png');x.save();x.globalAlpha=.96;drawContain(x,art,250,12,580,440);x.restore();}catch{}

  // Decorative neon rays / stars.
  x.save();x.translate(540,520);for(let i=0;i<18;i++){const a=(Math.PI*2*i)/18;const len=420+(i%3)*55;x.strokeStyle=i%3===0?'rgba(255,205,55,.28)':i%3===1?'rgba(75,150,255,.24)':'rgba(245,65,215,.22)';x.lineWidth=3;x.beginPath();x.moveTo(Math.cos(a)*120,Math.sin(a)*120);x.lineTo(Math.cos(a)*len,Math.sin(a)*len);x.stroke()}x.restore();
  for(let i=0;i<26;i++){const px=65+(i*137)%950,py=80+(i*211)%980,r=2+(i%4);x.fillStyle=i%2?'rgba(255,219,93,.78)':'rgba(171,204,255,.7)';x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill()}

  // Result panel.
  roundRectPath(x,78,430,924,690,42);const panel=x.createLinearGradient(78,430,1002,1120);panel.addColorStop(0,'rgba(21,26,70,.94)');panel.addColorStop(.5,'rgba(48,20,90,.95)');panel.addColorStop(1,'rgba(11,15,43,.97)');x.fillStyle=panel;x.fill();x.lineWidth=4;x.strokeStyle='rgba(255,205,72,.88)';x.stroke();
  x.shadowColor='rgba(127,76,255,.65)';x.shadowBlur=26;x.lineWidth=2;x.strokeStyle='rgba(112,176,255,.9)';roundRectPath(x,90,442,900,666,34);x.stroke();x.shadowBlur=0;

  // Placement badge.
  const badgeText=first?(isTeam?'1ST PLACE TEAM':'1ST PLACE'):(isTeam?`TEAM #${primaryRank||'—'}`:`FINISHED #${primaryRank||'—'}`);
  roundRectPath(x,205,478,670,112,28);const badge=x.createLinearGradient(205,478,875,590);badge.addColorStop(0,first?'#ffb600':'#2b66ff');badge.addColorStop(.5,first?'#ff5b24':'#7e45ff');badge.addColorStop(1,first?'#e8249b':'#da38db');x.fillStyle=badge;x.fill();x.strokeStyle='rgba(255,255,255,.82)';x.lineWidth=3;x.stroke();
  x.textAlign='center';x.textBaseline='middle';x.fillStyle='#fff';x.shadowColor='rgba(0,0,0,.75)';x.shadowBlur=8;fitCanvasText(x,badgeText,610,58,34,1000);x.fillText(badgeText,540,535);x.shadowBlur=0;

  // Main winner/player/team name.
  x.fillStyle='#fff';const name=String(primaryName).toUpperCase();fitCanvasText(x,name,820,82,42,1000);x.fillText(name,540,682);
  if(isTeam){x.fillStyle='#cfd7ff';const playerLine=`PLAYER ${String(me.name||'').toUpperCase()}  •  INDIVIDUAL #${me.rank||'—'}`;fitCanvasText(x,playerLine,790,32,22,850);x.fillText(playerLine,540,742)}

  // Score block.
  const scoreY=isTeam?835:810;x.fillStyle=first?'#ffd85b':'#ffffff';x.font='1000 112px system-ui,-apple-system,Segoe UI,sans-serif';x.fillText(String(primaryScore),540,scoreY);
  x.fillStyle='#d7ddff';x.font='900 36px system-ui,-apple-system,Segoe UI,sans-serif';x.fillText(isTeam?'TEAM BINGOS':'BINGOS',540,scoreY+72);
  if(isTeam){x.fillStyle='#adb9e8';x.font='850 28px system-ui,-apple-system,Segoe UI,sans-serif';x.fillText(`${me.score||0} PERSONAL BINGOS`,540,scoreY+122)}

  // Sponsor area only when a sponsor exists.
  let footerY=1045;if(state.sponsorName){x.fillStyle='#aeb8e9';x.font='800 23px system-ui,-apple-system,Segoe UI,sans-serif';x.fillText("THIS ROUND'S GAME IS SPONSORED BY",540,1005);x.fillStyle='#fff';const sp=String(state.sponsorName).toUpperCase();fitCanvasText(x,sp,760,38,24,1000);x.fillText(sp,540,1052);footerY=1132}

  // Game code / challenge footer.
  x.fillStyle='#cdd5ff';x.font='850 28px system-ui,-apple-system,Segoe UI,sans-serif';x.fillText(`GAME CODE ${sessionCode}`,540,footerY);x.fillStyle='#fff';x.font='1000 30px system-ui,-apple-system,Segoe UI,sans-serif';x.fillText(first?'CAN YOU BEAT THIS SCORE?':'CAN YOU BEAT ME?',540,footerY+54);

  // Bottom neon stage rings.
  x.save();x.translate(540,1265);for(const [w,a] of [[700,.6],[550,.45],[390,.34]]){x.strokeStyle=`rgba(87,174,255,${a})`;x.lineWidth=5;x.beginPath();x.ellipse(0,0,w/2,34,0,0,Math.PI*2);x.stroke()}x.strokeStyle='rgba(255,91,221,.6)';x.beginPath();x.ellipse(0,0,255,24,0,0,Math.PI*2);x.stroke();x.restore();
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
$('#teamSelect').addEventListener('change',()=>renderState());
$('#findGame').onclick=()=>loadGameCode($('#gameCodeInput').value);
$('#changeCode').onclick=()=>{if(source){source.close();source=null}state=null;playerId='';sessionCode='';history.replaceState(null,'','/');$('#gameCodeInput').value='';$('#codeError').textContent='';show('codeEntry')};
$('#join').onclick=join;$('#shareInvite').onclick=shareGame;$('#shareWaiting').onclick=shareGame;$('#shareResult').onclick=shareResult;
if(sessionCode){$('#gameCodeInput').value=sessionCode;loadGameCode(sessionCode)}
