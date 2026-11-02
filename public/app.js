const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const qs=new URLSearchParams(location.search);
let sessionCode=normalizeCode(qs.get('session')||'');
let state=null,playerId='',source=null,endSequenceShown=false;
const LETTERS=['B','I','N','G','O'];

function normalizeCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,15)}
async function api(url,options={}){const r=await fetch(url,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function show(id){$$('.screen').forEach(x=>x.classList.toggle('active',x.id===id))}
function sponsor(el,s){if(!el||!s)return;el.innerHTML=`THIS ROUND'S GAME IS SPONSORED BY<b>${escapeHtml(s.sponsorName||'YOUR BUSINESS')}</b>${s.sponsorLogoUrl?`<img src="${escapeHtml(s.sponsorLogoUrl)}" alt="Sponsor logo">`:''}`}
function fmtSecs(s){s=Math.max(0,Math.floor(s||0));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function remainingMs(){if(!state)return 0;if(state.winCondition!=='timed')return 0;if(state.phase==='paused')return state.pausedRemaining||0;if(!state.endsAt)return (state.roundDuration||0)*1000;return Math.max(0,state.endsAt-Date.now())}
function elapsedMs(){if(!state?.startedAt)return 0;const end=state.phase==='ended'?(state.endedAt||Date.now()):Date.now();return Math.max(0,end-state.startedAt)}
function canJoinFromState(s){if(!s||s.phase==='ended')return false;if(['waiting','starting'].includes(s.phase))return true;if(!['running','paused'].includes(s.phase))return false;if(s.lateJoinPolicy==='allowed')return true;if(s.lateJoinPolicy==='closed')return false;if(s.lateJoinPolicy==='cutoff'&&s.startedAt)return Date.now()-s.startedAt<s.lateJoinCutoffMinutes*60000;return false}
function rulesText(s){if(!s)return '';const win=s.winCondition==='target'?`First to ${s.bingoTarget} Bingos`:`${Math.round(s.roundDuration/60)}-minute round`;const mode=s.mode==='teams'?'Team Mode • Top 3 count':'Solo Mode';return `${mode} • ${win} • ${s.callDuration}s calls`}
function shareText(){return `Join my Bingo Rush game! Open ${location.origin} and enter Game Code ${sessionCode}.`}

function populateTeams(){const sel=$('#teamSelect');if(!sel||!state)return;sel.innerHTML=(state.teams||[]).map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');$('#teamField').classList.toggle('hidden',state.mode!=='teams')}
function connect(){if(source)source.close();source=new EventSource(`/events?session=${encodeURIComponent(sessionCode)}${playerId?`&player=${encodeURIComponent(playerId)}`:''}`);source.addEventListener('state',e=>{state=JSON.parse(e.data);renderState()});source.onerror=()=>{}}

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
  setTimeout(()=>{if(!$('#end').classList.contains('active'))return;$('#winnerStage').classList.add('hidden');$('#finalStage').classList.remove('hidden');renderFinalRows();$('#playerResult').textContent=me?.rank===1?`🏆 YOU WON • ${me.score} BINGOS`:`YOU FINISHED #${me?.rank||'—'} • ${me?.score||0} BINGOS`;$('#shareResult').textContent=me?.rank===1?'SHARE MY WIN':'SHARE MY SCORE';sponsor($('#endSponsor'),state)},3900);
}
function renderPrestart(){
  show('prestart');const rem=Math.max(0,(state.startsAt||Date.now())-Date.now());const logo=$('#preSponsorLogo');$('#preSponsorName').textContent=state.sponsorName||'YOUR BUSINESS';if(state.sponsorLogoUrl){logo.src=state.sponsorLogoUrl;logo.classList.remove('hidden')}else logo.classList.add('hidden');
  if(rem>3000){$('#preSponsorStage').classList.remove('hidden');$('#countdownStage').classList.add('hidden')}else{$('#preSponsorStage').classList.add('hidden');$('#countdownStage').classList.remove('hidden');$('#startCount').textContent=Math.max(1,Math.ceil(rem/1000));}
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
    show('play');sponsor($('#gameSponsor'),state);$('#score').textContent=state.me.score;$('#rank').textContent='#'+(state.me.rank||1);$('#teamRankPill').classList.toggle('hidden',state.mode!=='teams');if(state.mode==='teams')$('#teamRank').textContent='#'+(state.me.teamRank||'—');renderCall();renderBoard();
  }
  if(joined&&state.phase==='ended')showEndSequence();
  if(!joined){show('register');$('#join').disabled=!canJoinFromState(state);$('#joinError').textContent=canJoinFromState(state)?'':(state.phase==='ended'?'This round has ended. Wait for the host to reset the room.':'Late joining is closed for this round.');}
}
async function place(index){
  if(!state?.currentCall||!playerId)return;try{const out=await api(`/api/sessions/${sessionCode}/place`,{method:'POST',body:JSON.stringify({playerId,callId:state.currentCall.id,index})});if(out.bingos){showToast(out.points>out.bingos?`COLOR BINGO +${out.points}`:`${out.bingos>1?'MULTI BINGO':'BINGO'} +${out.points}`)}}catch(e){showToast(e.message)}
}
function showToast(t){const el=$('#toast');el.textContent=t;el.classList.remove('go');void el.offsetWidth;el.classList.add('go')}
async function shareGame(){const data={title:'Bingo Rush',text:shareText(),url:location.origin};if(navigator.share){try{await navigator.share(data);return}catch(e){if(e.name==='AbortError')return}}try{await navigator.clipboard.writeText(`${location.origin}\nGame Code: ${sessionCode}`);showToast('GAME CODE COPIED')}catch{showToast(`GAME CODE: ${sessionCode}`)}}
async function join(){
  const name=$('#playerName').value.trim();if(!sessionCode){$('#joinError').textContent='Enter a valid game code first.';return}if(!name){$('#joinError').textContent='Enter your player name.';return}const teamId=state?.mode==='teams'?$('#teamSelect').value:null;$('#joinError').textContent='';
  try{const old=localStorage.getItem('br-player-'+sessionCode)||'';const j=await api(`/api/sessions/${sessionCode}/join`,{method:'POST',body:JSON.stringify({name,teamId,playerId:old})});playerId=j.playerId;localStorage.setItem('br-player-'+sessionCode,playerId);state=j.state;connect();renderState()}catch(e){$('#joinError').textContent=e.message}
}
async function loadGameCode(raw){
  const next=normalizeCode(raw);$('#codeError').textContent='';if(next.length<4){$('#codeError').textContent='Enter a 4–15 character game code.';return false}
  try{
    const loaded=await api(`/api/sessions/${next}`);sessionCode=next;state=loaded;history.replaceState(null,'',`/?session=${encodeURIComponent(sessionCode)}`);$('#gameCodeInput').value=sessionCode;const old=localStorage.getItem('br-player-'+sessionCode)||'';if(old){playerId=old;connect()}else{playerId='';renderState()}return true;
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

function shareCard(){const me=state.standings.find(x=>x.id===playerId);const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,1080,1350);g.addColorStop(0,'#111849');g.addColorStop(.5,'#401c70');g.addColorStop(1,'#080b1c');x.fillStyle=g;x.fillRect(0,0,c.width,c.height);x.textAlign='center';x.fillStyle='#fff';x.font='900 92px system-ui';x.fillText('BINGO RUSH',540,180);x.font='900 170px system-ui';x.fillText(me.rank===1?'🏆':'⚡',540,380);x.font='900 72px system-ui';x.fillStyle=me.rank===1?'#ffd32a':'#fff';x.fillText(me.rank===1?'CHAMPION':`FINISHED #${me.rank}`,540,500);x.fillStyle='#fff';x.font='900 86px system-ui';x.fillText(me.name.toUpperCase(),540,650);x.font='800 52px system-ui';x.fillText(`${me.score} BINGOS`,540,750);if(state.mode==='teams'){const t=state.teams.find(t=>t.id===me.teamId);x.font='800 38px system-ui';x.fillStyle='#cdd5ff';x.fillText(t?`TEAM ${t.name.toUpperCase()}`:'TEAM MODE',540,835)}x.font='800 34px system-ui';x.fillStyle='#cdd5ff';x.fillText("THIS ROUND'S GAME IS SPONSORED BY",540,980);x.fillStyle='#fff';x.font='900 52px system-ui';x.fillText((state.sponsorName||'YOUR BUSINESS').toUpperCase(),540,1055);x.font='700 30px system-ui';x.fillStyle='#cdd5ff';x.fillText(`GAME CODE ${sessionCode}`,540,1165);x.fillText('Bingo Rush',540,1220);return c}
async function shareResult(){const me=state.standings.find(x=>x.id===playerId);const canvas=shareCard();const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));const file=new File([blob],'bingo-rush-result.png',{type:'image/png'});const data={title:'Bingo Rush',text:(me.rank===1?`I won Bingo Rush with ${me.score} Bingos! `:`I finished #${me.rank} in Bingo Rush with ${me.score} Bingos. `)+`Game Code ${sessionCode}`,files:[file]};if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share(data);return}catch(e){if(e.name==='AbortError')return}}if(navigator.share){try{delete data.files;data.url=location.origin;await navigator.share(data);return}catch(e){if(e.name==='AbortError')return}}const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='bingo-rush-result.png';a.click()}

$('#enterGame').onclick=async()=>{if(sessionCode){$('#gameCodeInput').value=sessionCode;await loadGameCode(sessionCode)}else show('codeEntry')};
$('#gameCodeInput').addEventListener('input',e=>{const n=normalizeCode(e.target.value);if(e.target.value!==n)e.target.value=n});
$('#gameCodeInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#findGame').click()});
$('#findGame').onclick=()=>loadGameCode($('#gameCodeInput').value);
$('#changeCode').onclick=()=>{if(source){source.close();source=null}state=null;playerId='';sessionCode='';history.replaceState(null,'','/');$('#gameCodeInput').value='';$('#codeError').textContent='';show('codeEntry')};
$('#join').onclick=join;$('#shareInvite').onclick=$('#shareWaiting').onclick=$('#shareGame').onclick=shareGame;$('#shareResult').onclick=shareResult;
$$('.tab').forEach(btn=>btn.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.panel').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$('#'+btn.dataset.tab+'Panel').classList.add('active')});
if(sessionCode)$('#gameCodeInput').value=sessionCode;
