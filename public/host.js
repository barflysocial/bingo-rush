const $=s=>document.querySelector(s);let code='',token='',state=null,source=null,logoData='';
async function api(url,options={}){const r=await fetch(url,{...options,headers:{'content-type':'application/json'}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function normalizeCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,15)}
function sponsor(el,s){if(!el||!s)return;const name=String(s.sponsorName||'').trim(),logo=String(s.sponsorLogoUrl||'').trim();if(!name&&!logo){el.classList.add('hidden');el.innerHTML='';return;}el.classList.remove('hidden');el.innerHTML=`THIS ROUND'S GAME IS SPONSORED BY${name?`<b>${escapeHtml(name)}</b>`:''}${logo?`<img src="${escapeHtml(logo)}" alt="Sponsor logo">`:''}`}
function playerSite(){return location.origin}
function shareLink(){return `${location.origin}/join/${encodeURIComponent(code)}?r=${state?.roundNumber||1}`}
function shareText(){const sponsor=state?.sponsorName?` This round is sponsored by ${state.sponsorName}.`:'';return `Join Bingo Rush — Game Code ${code}.${sponsor}`}
function qrSrc(){return code?`/api/sessions/${encodeURIComponent(code)}/qr.svg?r=${state?.roundNumber||1}&v=${Date.now()}`:''}
function renderQr(){if(!state||!code)return;$('#qrHeaderCode').textContent=code;$('#qrPreviewCode').textContent=code;$('#qrPreviewUrl').textContent=location.host;$('#qrPreviewImage').src=qrSrc();const sp=$('#qrSponsorPreview');if(state.sponsorName||state.sponsorLogoUrl){sp.classList.remove('hidden');sp.innerHTML=`<span>THIS ROUND'S GAME IS SPONSORED BY</span>${state.sponsorName?`<b>${escapeHtml(state.sponsorName)}</b>`:''}${state.sponsorLogoUrl?`<img src="${escapeHtml(state.sponsorLogoUrl)}" alt="Sponsor logo">`:''}`}else{sp.classList.add('hidden');sp.innerHTML=''}}
function setHostTab(which){const qr=which==='qr';$('#controlTab').classList.toggle('active',!qr);$('#qrTab').classList.toggle('active',qr);$('#controlTab').setAttribute('aria-selected',String(!qr));$('#qrTab').setAttribute('aria-selected',String(qr));$('#controlPanel').classList.toggle('active',!qr);$('#qrPanel').classList.toggle('active',qr);if(qr)renderQr()}
function connect(){if(source)source.close();source=new EventSource('/events?session='+encodeURIComponent(code));source.addEventListener('state',e=>{state=JSON.parse(e.data);render()})}
function remaining(){if(!state)return 0;if(state.winCondition!=='timed')return 0;if(state.phase==='paused')return Math.ceil((state.pausedRemaining||0)/1000);if(!state.endsAt)return state.roundDuration;return Math.max(0,Math.ceil((state.endsAt-Date.now())/1000))}
function elapsed(){if(!state?.startedAt)return 0;const end=state.phase==='ended'?(state.endedAt||Date.now()):Date.now();return Math.max(0,Math.ceil((end-state.startedAt)/1000))}
function fmt(s){s=Math.max(0,s|0);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function fmtMs(ms){if(!Number.isFinite(ms)||ms<=0)return '—';const rel=state?.startedAt?Math.max(0,ms-state.startedAt):0;const m=Math.floor(rel/60000),sec=Math.floor((rel%60000)/1000),mil=Math.floor(rel%1000);return `${m}:${String(sec).padStart(2,'0')}.${String(mil).padStart(3,'0')}`}
function startingRemaining(){return state?.phase==='starting'&&state.startsAt?Math.max(0,Math.ceil((state.startsAt-Date.now())/1000)):0}
function readLogo(file){return new Promise((resolve,reject)=>{if(!file)return resolve('');if(file.size>1_150_000)return reject(new Error('Sponsor logo must be under 1.15 MB.'));const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Could not read sponsor logo.'));r.readAsDataURL(file)})}

function renderTeamManager(){
  const card=$('#teamManagerCard');card.classList.toggle('hidden',state.mode!=='teams');$('#teamLeaderboardCard').classList.toggle('hidden',state.mode!=='teams');if(state.mode!=='teams')return;
  $('#teamManager').innerHTML=(state.teams||[]).map(t=>`<div class="manage-row"><input class="team-name-input" data-team-name="${escapeHtml(t.id)}" value="${escapeHtml(t.name)}" maxlength="32"><button class="mini-btn" data-team-save="${escapeHtml(t.id)}">SAVE</button><button class="mini-btn danger-mini" data-team-remove="${escapeHtml(t.id)}" ${state.phase!=='waiting'?'disabled':''}>REMOVE</button></div>`).join('')||'<p class="muted">No teams yet.</p>';
  document.querySelectorAll('[data-team-save]').forEach(btn=>btn.onclick=()=>teamAction('rename',btn.dataset.teamSave,$(`[data-team-name="${btn.dataset.teamSave}"]`).value));
  document.querySelectorAll('[data-team-remove]').forEach(btn=>btn.onclick=()=>{if(confirm('Remove this team?'))teamAction('remove',btn.dataset.teamRemove)});
}
function renderRoster(){
  $('#playerRoster').innerHTML=(state.standings||[]).map(p=>{
    const teamSelect=state.mode==='teams'?`<select data-player-team="${p.id}" ${state.phase!=='waiting'?'disabled':''}>${(state.teams||[]).map(t=>`<option value="${escapeHtml(t.id)}" ${t.id===p.teamId?'selected':''}>${escapeHtml(t.name)}</option>`).join('')}</select>`:'';
    return `<div class="roster-row"><div class="roster-main"><input data-player-name="${p.id}" value="${escapeHtml(p.name)}" maxlength="24">${teamSelect}</div><div class="roster-actions"><button class="mini-btn" data-player-save="${p.id}">SAVE</button><button class="mini-btn danger-mini" data-player-remove="${p.id}" ${state.phase!=='waiting'?'disabled':''}>REMOVE</button></div></div>`;
  }).join('')||'<p class="muted">Waiting for players…</p>';
  document.querySelectorAll('[data-player-save]').forEach(btn=>btn.onclick=()=>savePlayer(btn.dataset.playerSave));
  document.querySelectorAll('[data-player-remove]').forEach(btn=>btn.onclick=()=>{if(confirm('Remove this player from the game room?'))removePlayer(btn.dataset.playerRemove)});
}
function render(){
  if(!state)return;
  $('#hostState').textContent=state.phase.toUpperCase();$('#hostPlayers').textContent=state.playerCount;$('#hostSpeed').textContent=state.callDuration+'s';$('#roundTitle').textContent=state.roundName||'Bingo Rush';$('#deckCycle').textContent=state.deckCycle||'—';$('#code').textContent=state.code;$('#headerCode').textContent=state.code;$('#playerSite').textContent=playerSite();
  if(state.winCondition==='timed'){$('#hostTimer').textContent=fmt(remaining());$('#hostTimerLabel').textContent='ROUND TIME';$('#hostWinCondition').textContent=`${Math.round(state.roundDuration/60)} MINUTES`;}else{$('#hostTimer').textContent=state.phase==='paused'?'PAUSED':fmt(elapsed());$('#hostTimerLabel').textContent='ELAPSED';$('#hostWinCondition').textContent=`FIRST TO ${state.bingoTarget}`;}
  $('#hostCall').textContent=state.currentCall?`${state.currentCall.color} ${state.currentCall.letter}-${state.currentCall.number}`:(state.phase==='starting'?`STARTING IN ${startingRemaining()}`:'—');sponsor($('#hostSponsor'),state);
  $('#hostLeaderboard').innerHTML=(state.standings||[]).map(x=>`<div class="leader-row"><span>${x.rank===1?'🏆 ':''}#${x.rank} ${escapeHtml(x.name)}</span><span>${x.score} BINGOS</span></div>`).join('')||'<p class="muted">Waiting for players…</p>';
  if(state.mode==='teams')$('#hostTeamLeaderboard').innerHTML=(state.teamStandings||[]).map(t=>`<div class="team-leader-card"><div class="leader-row"><span>${t.rank===1?'🏆 ':''}#${t.rank} ${escapeHtml(t.name)}</span><span>${t.score} BINGOS</span></div><div class="top3-line">COUNTING: ${(t.top3||[]).map(p=>`${escapeHtml(p.name)} (${p.score})`).join(' • ')||'No scores yet'}${t.score?` • reached ${fmtMs(t.scoreReachedAt)}`:''}</div></div>`).join('')||'<p class="muted">No teams.</p>';
  renderTeamManager();renderRoster();renderQr();
  $('#startBtn').disabled=state.phase!=='waiting'||state.playerCount<1;$('#pauseBtn').disabled=state.phase!=='running';$('#resumeBtn').disabled=state.phase!=='paused';$('#endBtn').disabled=state.phase==='ended'||state.phase==='waiting';$('#resetBtn').disabled=state.phase!=='ended';
  const late=state.lateJoinPolicy==='allowed'?'Late joining allowed':state.lateJoinPolicy==='closed'?'Late joining closes at start':`Late joining closes after ${state.lateJoinCutoffMinutes} min`;
  $('#hostNotice').textContent=state.phase==='waiting'?(state.playerCount<1?`Game Code ${state.code} is ready. Waiting for at least one player.`:`Ready for the next round • ${late}`):state.phase==='starting'?'Players are seeing the sponsor intro and 3…2…1 countdown.':state.phase==='paused'?'Round paused for every player.':state.phase==='ended'?`Round complete. NEXT ROUND / RESET keeps Game Code ${state.code}, players, teams, and sponsor.`:`${late} • Deck automatically reshuffles after all 375 unique calls.`;
}
setInterval(()=>{if(state){if(state.winCondition==='timed')$('#hostTimer').textContent=fmt(remaining());else if(state.phase==='running')$('#hostTimer').textContent=fmt(elapsed());if(state.phase==='starting')$('#hostCall').textContent=`STARTING IN ${startingRemaining()}`}},200);

$('#customGameCode').addEventListener('input',e=>{const n=normalizeCode(e.target.value);if(e.target.value!==n)e.target.value=n});
$('#gameMode').onchange=()=>$('#teamSetup').classList.toggle('hidden',$('#gameMode').value!=='teams');
$('#winCondition').onchange=()=>{$('#timedSettings').classList.toggle('hidden',$('#winCondition').value!=='timed');$('#targetSettings').classList.toggle('hidden',$('#winCondition').value!=='target')};
$('#lateJoinPolicy').onchange=()=>$('#lateCutoffField').classList.toggle('hidden',$('#lateJoinPolicy').value!=='cutoff');
$('#sponsorLogoFile').onchange=async e=>{try{$('#createError').textContent='';logoData=await readLogo(e.target.files?.[0]);if(logoData)$('#sponsorLogoUrl').value=''}catch(err){logoData='';e.target.value='';$('#createError').textContent=err.message}};

$('#createRound').onclick=async()=>{
  try{
    $('#createError').textContent='';const customCode=normalizeCode($('#customGameCode').value);if(customCode.length<4)throw new Error('Choose a Game Code with 4–15 letters or numbers.');
    const file=$('#sponsorLogoFile').files?.[0];if(file&&!logoData)logoData=await readLogo(file);
    const minutes=Math.max(1,Math.min(120,Number($('#roundMinutes').value)||15));const teamNames=$('#teamNames').value.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const j=await api('/api/sessions',{method:'POST',body:JSON.stringify({gameCode:customCode,roundName:$('#roundName').value,sponsorName:$('#sponsorName').value,sponsorLogoUrl:logoData||$('#sponsorLogoUrl').value,callDuration:Number($('#callDuration').value),mode:$('#gameMode').value,teamNames,winCondition:$('#winCondition').value,roundDuration:Math.round(minutes*60),bingoTarget:Number($('#bingoTarget').value),lateJoinPolicy:$('#lateJoinPolicy').value,lateJoinCutoffMinutes:Number($('#lateJoinCutoffMinutes').value)})});
    code=j.code;token=j.hostToken;state=j.state;localStorage.setItem('br-host-'+code,token);localStorage.setItem('br-last-host',JSON.stringify({code,token}));$('#createPane').classList.add('hidden');$('#managePane').classList.remove('hidden');connect();render();
  }catch(e){$('#createError').textContent=e.message}
};
async function hostAction(action){try{const j=await api(`/api/sessions/${code}/host/${action}`,{method:'POST',body:JSON.stringify({hostToken:token})});state=j.state;render()}catch(e){alert(e.message)}}
async function teamAction(action,teamId,name){try{const j=await api(`/api/sessions/${code}/host/team`,{method:'POST',body:JSON.stringify({hostToken:token,action,teamId,name})});state=j.state;render()}catch(e){alert(e.message)}}
async function savePlayer(playerId){try{const name=$(`[data-player-name="${playerId}"]`).value;const teamEl=$(`[data-player-team="${playerId}"]`);const body={hostToken:token,playerId,name};if(teamEl)body.teamId=teamEl.value;const j=await api(`/api/sessions/${code}/host/player`,{method:'POST',body:JSON.stringify(body)});state=j.state;render()}catch(e){alert(e.message)}}
async function removePlayer(playerId){try{const j=await api(`/api/sessions/${code}/host/player`,{method:'POST',body:JSON.stringify({hostToken:token,playerId,remove:true})});state=j.state;render()}catch(e){alert(e.message)}}

$('#addTeamBtn').onclick=()=>{const name=prompt('New team name');if(name?.trim())teamAction('add','',name.trim())};
$('#controlTab').onclick=()=>setHostTab('control');$('#qrTab').onclick=()=>setHostTab('qr');
$('#openQrScreen').onclick=()=>{if(!code)return;window.open(`/qr.html?code=${encodeURIComponent(code)}&r=${state?.roundNumber||1}`,'bingoRushQr','popup,width=1920,height=1080')};
$('#refreshQr').onclick=()=>renderQr();
$('#startBtn').onclick=()=>hostAction('start');$('#pauseBtn').onclick=()=>hostAction('pause');$('#resumeBtn').onclick=()=>hostAction('resume');$('#endBtn').onclick=()=>{if(confirm('End this round now?'))hostAction('end')};
$('#resetBtn').onclick=()=>{if(confirm('Reset for the next round? Scores, boards, rankings, and the call deck will clear. The Game Code, players, teams, and sponsor will stay the same.'))hostAction('reset')};
$('#globalResetBtn').onclick=async()=>{if(!code||!token)return;if(!confirm('GLOBAL HOST RESET will permanently delete this game room, all players, teams, scores, sponsor, settings, and the current Game Code. Continue?'))return;if(!confirm('Final confirmation: reset EVERYTHING and return to Create Game?'))return;try{await api(`/api/sessions/${code}/host/global-reset`,{method:'POST',body:JSON.stringify({hostToken:token})});if(source){source.close();source=null}localStorage.removeItem('br-host-'+code);localStorage.removeItem('br-last-host');code='';token='';state=null;logoData='';$('#managePane').classList.add('hidden');$('#createPane').classList.remove('hidden');$('#hostState').textContent='NO GAME';$('#customGameCode').value='';$('#sponsorName').value='';$('#sponsorLogoUrl').value='';$('#sponsorLogoFile').value='';setHostTab('control');}catch(e){alert(e.message)}};
$('#copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(code);$('#copyCode').textContent='COPIED';setTimeout(()=>$('#copyCode').textContent='COPY CODE',1200)}catch{alert('Game Code: '+code)}};
$('#shareCode').onclick=async()=>{const url=shareLink();const data={title:`Bingo Rush — Join ${code}`,text:shareText(),url};if(navigator.share)try{await navigator.share(data)}catch(e){if(e.name==='AbortError')return}else{try{await navigator.clipboard.writeText(`${shareText()}\n${url}`);$('#shareCode').textContent='LINK COPIED';setTimeout(()=>$('#shareCode').textContent='SHARE GAME',1200)}catch{alert(`Game Code: ${code}\n${url}`)}}};

async function restoreLastHost(){
  try{
    const saved=JSON.parse(localStorage.getItem('br-last-host')||'null');if(!saved?.code||!saved?.token)return;const c=normalizeCode(saved.code);const s=await api(`/api/sessions/${c}`);code=c;token=saved.token;state=s;$('#createPane').classList.add('hidden');$('#managePane').classList.remove('hidden');connect();render();
  }catch{}
}
restoreLastHost();
