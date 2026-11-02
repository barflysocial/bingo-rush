const $=s=>document.querySelector(s);let code='',token='',state=null,source=null,logoData='';
async function api(url,options={}){const r=await fetch(url,{...options,headers:{'content-type':'application/json'}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function sponsor(el,s){el.innerHTML=`THIS ROUND'S GAME IS SPONSORED BY<b>${escapeHtml(s.sponsorName||'YOUR BUSINESS')}</b>${s.sponsorLogoUrl?`<img src="${escapeHtml(s.sponsorLogoUrl)}" alt="Sponsor logo">`:''}`}
function playerUrl(){return `${location.origin}/?session=${encodeURIComponent(code)}`}
function connect(){if(source)source.close();source=new EventSource('/events?session='+code);source.addEventListener('state',e=>{state=JSON.parse(e.data);render()})}
function remaining(){if(!state)return 0;if(state.winCondition!=='timed')return 0;if(state.phase==='paused')return Math.ceil((state.pausedRemaining||0)/1000);if(!state.endsAt)return state.roundDuration;return Math.max(0,Math.ceil((state.endsAt-Date.now())/1000))}
function elapsed(){if(!state?.startedAt)return 0;return Math.max(0,Math.ceil((Date.now()-state.startedAt)/1000))}
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
  const teamOptions=(state.teams||[]).map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('');
  $('#playerRoster').innerHTML=(state.standings||[]).map(p=>{
    const teamSelect=state.mode==='teams'?`<select data-player-team="${p.id}" ${state.phase!=='waiting'?'disabled':''}>${(state.teams||[]).map(t=>`<option value="${escapeHtml(t.id)}" ${t.id===p.teamId?'selected':''}>${escapeHtml(t.name)}</option>`).join('')}</select>`:'';
    return `<div class="roster-row"><div class="roster-main"><input data-player-name="${p.id}" value="${escapeHtml(p.name)}" maxlength="24">${teamSelect}</div><div class="roster-actions"><button class="mini-btn" data-player-save="${p.id}">SAVE</button><button class="mini-btn danger-mini" data-player-remove="${p.id}" ${state.phase!=='waiting'?'disabled':''}>REMOVE</button></div></div>`;
  }).join('')||'<p class="muted">Waiting for players…</p>';
  document.querySelectorAll('[data-player-save]').forEach(btn=>btn.onclick=()=>savePlayer(btn.dataset.playerSave));
  document.querySelectorAll('[data-player-remove]').forEach(btn=>btn.onclick=()=>{if(confirm('Remove this player from the round?'))removePlayer(btn.dataset.playerRemove)});
}
function render(){
  if(!state)return;
  $('#hostState').textContent=state.phase.toUpperCase();$('#hostPlayers').textContent=state.playerCount;$('#hostSpeed').textContent=state.callDuration+'s';$('#roundTitle').textContent=state.roundName||'Bingo Rush';$('#deckCycle').textContent=state.deckCycle||'—';
  if(state.winCondition==='timed'){$('#hostTimer').textContent=fmt(remaining());$('#hostTimerLabel').textContent='ROUND TIME';$('#hostWinCondition').textContent=`${Math.round(state.roundDuration/60)} MINUTES`;}else{$('#hostTimer').textContent=state.phase==='paused'?'PAUSED':fmt(elapsed());$('#hostTimerLabel').textContent='ELAPSED';$('#hostWinCondition').textContent=`FIRST TO ${state.bingoTarget}`;}
  $('#hostCall').textContent=state.currentCall?`${state.currentCall.color} ${state.currentCall.letter}-${state.currentCall.number}`:(state.phase==='starting'?`STARTING IN ${startingRemaining()}`:'—');sponsor($('#hostSponsor'),state);
  $('#hostLeaderboard').innerHTML=(state.standings||[]).map(x=>`<div class="leader-row"><span>${x.rank===1?'🏆 ':''}#${x.rank} ${escapeHtml(x.name)}</span><span>${x.score} BINGOS</span></div>`).join('')||'<p class="muted">Waiting for players…</p>';
  if(state.mode==='teams')$('#hostTeamLeaderboard').innerHTML=(state.teamStandings||[]).map(t=>`<div class="team-leader-card"><div class="leader-row"><span>${t.rank===1?'🏆 ':''}#${t.rank} ${escapeHtml(t.name)}</span><span>${t.score} BINGOS</span></div><div class="top3-line">COUNTING: ${(t.top3||[]).map(p=>`${escapeHtml(p.name)} (${p.score})`).join(' • ')||'No scores yet'}${t.score?` • reached ${fmtMs(t.scoreReachedAt)}`:''}</div></div>`).join('')||'<p class="muted">No teams.</p>';
  renderTeamManager();renderRoster();
  $('#startBtn').disabled=state.phase!=='waiting'||state.playerCount<1;$('#pauseBtn').disabled=state.phase!=='running';$('#resumeBtn').disabled=state.phase!=='paused';$('#endBtn').disabled=state.phase==='ended';
  const late=state.lateJoinPolicy==='allowed'?'Late joining allowed':state.lateJoinPolicy==='closed'?'Late joining closes at start':`Late joining closes after ${state.lateJoinCutoffMinutes} min`;
  $('#hostNotice').textContent=state.phase==='waiting'?(state.playerCount<1?'Waiting for at least one player to join.':`Ready • ${late}`):state.phase==='starting'?'Players are seeing the sponsor intro and 3…2…1 countdown.':state.phase==='paused'?'Round paused for every player.':`${late} • Deck automatically reshuffles after all 375 unique calls.`;
}
setInterval(()=>{if(state){if(state.winCondition==='timed')$('#hostTimer').textContent=fmt(remaining());else if(state.phase==='running')$('#hostTimer').textContent=fmt(elapsed());if(state.phase==='starting')$('#hostCall').textContent=`STARTING IN ${startingRemaining()}`}},200);

$('#gameMode').onchange=()=>$('#teamSetup').classList.toggle('hidden',$('#gameMode').value!=='teams');
$('#winCondition').onchange=()=>{$('#timedSettings').classList.toggle('hidden',$('#winCondition').value!=='timed');$('#targetSettings').classList.toggle('hidden',$('#winCondition').value!=='target')};
$('#lateJoinPolicy').onchange=()=>$('#lateCutoffField').classList.toggle('hidden',$('#lateJoinPolicy').value!=='cutoff');
$('#sponsorLogoFile').onchange=async e=>{try{$('#createError').textContent='';logoData=await readLogo(e.target.files?.[0]);if(logoData)$('#sponsorLogoUrl').value=''}catch(err){logoData='';e.target.value='';$('#createError').textContent=err.message}};

$('#createRound').onclick=async()=>{
  try{
    $('#createError').textContent='';const file=$('#sponsorLogoFile').files?.[0];if(file&&!logoData)logoData=await readLogo(file);
    const minutes=Math.max(1,Math.min(120,Number($('#roundMinutes').value)||15));const teamNames=$('#teamNames').value.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    const j=await api('/api/sessions',{method:'POST',body:JSON.stringify({roundName:$('#roundName').value,sponsorName:$('#sponsorName').value,sponsorLogoUrl:logoData||$('#sponsorLogoUrl').value,callDuration:Number($('#callDuration').value),mode:$('#gameMode').value,teamNames,winCondition:$('#winCondition').value,roundDuration:Math.round(minutes*60),bingoTarget:Number($('#bingoTarget').value),lateJoinPolicy:$('#lateJoinPolicy').value,lateJoinCutoffMinutes:Number($('#lateJoinCutoffMinutes').value)})});
    code=j.code;token=j.hostToken;state=j.state;localStorage.setItem('br-host-'+code,token);localStorage.setItem('br-last-host',JSON.stringify({code,token}));$('#code').textContent=code;$('#playerLink').textContent=playerUrl();$('#createPane').classList.add('hidden');$('#managePane').classList.remove('hidden');connect();render();
  }catch(e){$('#createError').textContent=e.message}
};
async function hostAction(action){try{const j=await api(`/api/sessions/${code}/host/${action}`,{method:'POST',body:JSON.stringify({hostToken:token})});state=j.state;render()}catch(e){alert(e.message)}}
async function teamAction(action,teamId,name){try{const j=await api(`/api/sessions/${code}/host/team`,{method:'POST',body:JSON.stringify({hostToken:token,action,teamId,name})});state=j.state;render()}catch(e){alert(e.message)}}
async function savePlayer(playerId){try{const name=$(`[data-player-name="${playerId}"]`).value;const teamEl=$(`[data-player-team="${playerId}"]`);const body={hostToken:token,playerId,name};if(teamEl)body.teamId=teamEl.value;const j=await api(`/api/sessions/${code}/host/player`,{method:'POST',body:JSON.stringify(body)});state=j.state;render()}catch(e){alert(e.message)}}
async function removePlayer(playerId){try{const j=await api(`/api/sessions/${code}/host/player`,{method:'POST',body:JSON.stringify({hostToken:token,playerId,remove:true})});state=j.state;render()}catch(e){alert(e.message)}}

$('#addTeamBtn').onclick=()=>{const name=prompt('New team name');if(name?.trim())teamAction('add','',name.trim())};
$('#startBtn').onclick=()=>hostAction('start');$('#pauseBtn').onclick=()=>hostAction('pause');$('#resumeBtn').onclick=()=>hostAction('resume');$('#endBtn').onclick=()=>{if(confirm('End this round now?'))hostAction('end')};
$('#copyLink').onclick=async()=>{await navigator.clipboard.writeText(playerUrl());$('#copyLink').textContent='COPIED';setTimeout(()=>$('#copyLink').textContent='COPY LINK',1200)};
$('#shareLink').onclick=async()=>{const data={title:'Bingo Rush',text:'Join this Bingo Rush round!',url:playerUrl()};if(navigator.share)try{await navigator.share(data)}catch{}else{await navigator.clipboard.writeText(playerUrl());$('#shareLink').textContent='LINK COPIED';setTimeout(()=>$('#shareLink').textContent='SHARE LINK',1200)}};
