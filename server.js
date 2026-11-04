const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const QRCode = require('qrcode');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'sessions.json');
const sessions = new Map();

const COLORS = [
  {name:'RED', hex:'#ff3158'},
  {name:'BLUE', hex:'#258cff'},
  {name:'GREEN', hex:'#18d38b'},
  {name:'YELLOW', hex:'#ffd32a'},
  {name:'PURPLE', hex:'#a35cff'}
];
const LETTERS = ['B','I','N','G','O'];
// Bingo Rush core: five horizontal lines plus the two diagonals. No vertical Bingos.
const LINES = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
  [0,6,12,18,24],[4,8,12,16,20]
];
const MAX_TEAMS = 12;
const MAX_PLAYERS_PER_TEAM = 12;

function id(len=8){ return crypto.randomBytes(Math.ceil(len/2)).toString('hex').slice(0,len).toUpperCase(); }
function json(res,status,body){ res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'}); res.end(JSON.stringify(body)); }
function readBody(req){ return new Promise((resolve,reject)=>{ let s=''; req.on('data',c=>{ s+=c; if(s.length>2_500_000){ req.destroy(); reject(new Error('Request too large')); }}); req.on('end',()=>{ try{ resolve(s?JSON.parse(s):{}); }catch(e){ reject(e); }}); req.on('error',reject); }); }
function clampText(v,max){ return String(v ?? '').trim().slice(0,max); }
function normalizeGameCode(v){ return String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,15); }
function safeLogo(v){ const s=String(v||'').trim(); if(!s)return ''; if(/^https?:\/\//i.test(s))return s.slice(0,1000); if(/^data:image\/(png|jpeg|webp|gif);base64,/i.test(s)&&s.length<=1_600_000)return s; return ''; }
function asInt(v,min,max,def){ const n=Number(v); return Number.isInteger(n)&&n>=min&&n<=max?n:def; }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=crypto.randomInt(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function buildDeck(){
  const deck=[];
  for(let li=0;li<5;li++){
    for(let n=li*15+1;n<=li*15+15;n++){
      for(const c of COLORS) deck.push({id:id(12),letter:LETTERS[li],number:n,color:c.name,hex:c.hex});
    }
  }
  return shuffle(deck); // 375 exact color+number calls, no duplicates within a cycle.
}

function individualStandings(s){
  return [...s.players.values()]
    .map(p=>({id:p.id,name:p.name,score:p.score,lastScoreAt:p.lastScoreAt||Number.MAX_SAFE_INTEGER,teamId:p.teamId||null,joinedAt:p.joinedAt}))
    .sort((a,b)=>b.score-a.score || a.lastScoreAt-b.lastScoreAt || a.name.localeCompare(b.name))
    .map((x,i)=>({...x,rank:i+1}));
}
function teamScoreFor(s,teamId){
  const scores=[...s.players.values()].filter(p=>p.teamId===teamId).map(p=>p.score).sort((a,b)=>b-a);
  return scores.slice(0,3).reduce((a,b)=>a+b,0);
}
function recomputeTeamScores(s,now=Date.now()){
  if(s.mode!=='teams') return;
  for(const t of s.teams.values()){
    const next=teamScoreFor(s,t.id);
    if(next>t.score){ t.score=next; t.scoreReachedAt=now; }
    else if(next!==t.score){ t.score=next; t.scoreReachedAt=next?now:null; }
  }
}
function teamStandings(s){
  if(s.mode!=='teams') return [];
  recomputeTeamScores(s);
  return [...s.teams.values()]
    .map(t=>({id:t.id,name:t.name,score:t.score||0,scoreReachedAt:t.scoreReachedAt||Number.MAX_SAFE_INTEGER,playerCount:[...s.players.values()].filter(p=>p.teamId===t.id).length,top3:individualStandings(s).filter(p=>p.teamId===t.id).slice(0,3).map(p=>({id:p.id,name:p.name,score:p.score}))}))
    .sort((a,b)=>b.score-a.score || a.scoreReachedAt-b.scoreReachedAt || a.name.localeCompare(b.name))
    .map((x,i)=>({...x,rank:i+1}));
}
function rankOf(s,pid){ return individualStandings(s).findIndex(x=>x.id===pid)+1; }
function teamRankOf(s,teamId){ if(!teamId)return 0; return teamStandings(s).findIndex(x=>x.id===teamId)+1; }
function teamPlayerCount(s,teamId){ return [...s.players.values()].filter(p=>p.teamId===teamId).length; }
function teamHasSpace(s,teamId,excludePlayerId=''){
  const count=[...s.players.values()].filter(p=>p.teamId===teamId && p.id!==excludePlayerId).length;
  return count<MAX_PLAYERS_PER_TEAM;
}
function teamNameExists(s,name,excludeTeamId=''){
  const key=String(name||'').trim().toLowerCase();
  return [...s.teams.values()].some(t=>t.id!==excludeTeamId && String(t.name||'').trim().toLowerCase()===key);
}
function teamList(s){
  return [...s.teams.values()].map(t=>{
    const playerCount=teamPlayerCount(s,t.id);
    return {id:t.id,name:t.name,playerCount,capacity:MAX_PLAYERS_PER_TEAM,full:playerCount>=MAX_PLAYERS_PER_TEAM};
  });
}

function safeSession(s){
  return {
    code:s.code,roundNumber:s.roundNumber||1,roundName:s.roundName,sponsorName:s.sponsorName,sponsorLogoUrl:s.sponsorLogoUrl,
    phase:s.phase,mode:s.mode,teams:teamList(s),maxTeams:MAX_TEAMS,maxPlayersPerTeam:MAX_PLAYERS_PER_TEAM,callDuration:s.callDuration,winCondition:s.winCondition,
    roundDuration:s.roundDuration,bingoTarget:s.bingoTarget,lateJoinPolicy:s.lateJoinPolicy,lateJoinCutoffMinutes:s.lateJoinCutoffMinutes,
    startsAt:s.startsAt,startedAt:s.startedAt,endsAt:s.endsAt,pausedRemaining:s.pausedRemaining,
    currentCall:s.currentCall,callDeadline:s.callDeadline,callNumber:s.callNumber,deckCycle:s.deckCycle,
    playerCount:s.players.size,standings:individualStandings(s),teamStandings:teamStandings(s),createdAt:s.createdAt,endedAt:s.endedAt
  };
}
function playerView(s,p){
  const base=safeSession(s);
  return {...base,me:{id:p.id,name:p.name,score:p.score,board:p.board,placedCallId:p.placedCallId,rank:rankOf(s,p.id),teamId:p.teamId||null,teamRank:teamRankOf(s,p.teamId),joinedAt:p.joinedAt,joinedElapsedMs:p.joinedElapsedMs||0}};
}
function broadcast(s){
  for(const c of s.clients){
    const p=c.playerId?s.players.get(c.playerId):null;
    const payload=p?playerView(s,p):safeSession(s);
    try{ c.res.write(`event: state\ndata: ${JSON.stringify(payload)}\n\n`); }catch{}
  }
}
function clearTimer(s){ if(s.tick){ clearInterval(s.tick); s.tick=null; } }
function checkGoal(s){
  if(s.winCondition!=='target' || s.phase!=='running') return false;
  if(s.mode==='teams'){
    const leader=teamStandings(s)[0];
    return !!leader && leader.score>=s.bingoTarget;
  }
  const leader=individualStandings(s)[0];
  return !!leader && leader.score>=s.bingoTarget;
}
function nextCall(s){
  if(s.phase!=='running') return;
  if(s.winCondition==='timed' && s.endsAt && Date.now()>=s.endsAt){ finish(s,'timer'); return; }
  if(checkGoal(s)){ finish(s,'target'); return; }
  if(s.deckIndex>=s.deck.length){
    s.deck=buildDeck();
    s.deckIndex=0;
    s.deckCycle+=1;
  }
  const call=s.deck[s.deckIndex++];
  s.currentCall=call;
  s.callNumber+=1;
  s.callDeadline=Date.now()+s.callDuration*1000;
  for(const p of s.players.values()) p.placedCallId=null;
  persistSoon(); broadcast(s);
}
function beginRunning(s){
  if(s.phase!=='starting') return;
  s.phase='running';
  s.startedAt=Date.now();
  s.endsAt=s.winCondition==='timed'?s.startedAt+s.roundDuration*1000:null;
  s.startsAt=null;
  nextCall(s);
  persistSoon(); broadcast(s);
}
function startTicker(s){
  clearTimer(s);
  s.tick=setInterval(()=>{
    const now=Date.now();
    if(s.phase==='starting'){
      if(now>=s.startsAt) beginRunning(s);
      else if(now%1000<260) broadcast(s);
      return;
    }
    if(s.phase!=='running') return;
    if(s.winCondition==='timed' && s.endsAt && now>=s.endsAt){ finish(s,'timer'); return; }
    if(checkGoal(s)){ finish(s,'target'); return; }
    if(now>=s.callDeadline) nextCall(s);
    else if(now%1000<260) broadcast(s);
  },250);
}
function start(s){
  if(s.phase!=='waiting'||s.players.size<1)return false;
  if(s.mode==='teams' && s.teams.size<1)return false;
  s.deck=buildDeck();s.deckIndex=0;s.deckCycle=1;s.callNumber=0;s.currentCall=null;s.callDeadline=null;
  s.phase='starting';s.startsAt=Date.now()+5000;s.startedAt=null;s.endsAt=null;s.pausedRemaining=null;s.endReason=null;
  for(const t of s.teams.values()){ t.score=0;t.scoreReachedAt=null; }
  for(const p of s.players.values()){ p.score=0;p.board=Array(25).fill(null);p.placedCallId=null;p.lastScoreAt=null;p.joinedElapsedMs=0; }
  startTicker(s);persistSoon();broadcast(s);return true;
}
function pause(s){
  if(s.phase!=='running')return false;
  if(s.winCondition==='timed')s.pausedRemaining=Math.max(0,s.endsAt-Date.now());
  else s.pausedRemaining=null;
  s.phase='paused';clearTimer(s);persistSoon();broadcast(s);return true;
}
function resume(s){
  if(s.phase!=='paused')return false;
  if(s.winCondition==='timed')s.endsAt=Date.now()+Math.max(0,s.pausedRemaining||0);
  s.phase='running';s.pausedRemaining=null;
  if(s.currentCall)s.callDeadline=Date.now()+s.callDuration*1000;
  startTicker(s);persistSoon();broadcast(s);return true;
}
function finish(s,reason='host'){
  if(s.phase==='ended')return;
  s.phase='ended';s.endReason=reason;s.endedAt=Date.now();s.startsAt=null;s.currentCall=null;s.callDeadline=null;
  if(s.winCondition==='timed')s.endsAt=s.endedAt;
  clearTimer(s);persistSoon();broadcast(s);
}
function resetRound(s){
  if(s.phase!=='ended')return false;
  s.roundNumber=(s.roundNumber||1)+1;
  clearTimer(s);
  s.phase='waiting';s.startsAt=null;s.startedAt=null;s.endsAt=null;s.pausedRemaining=null;s.endReason=null;s.endedAt=null;
  s.deck=[];s.deckIndex=0;s.deckCycle=0;s.currentCall=null;s.callDeadline=null;s.callNumber=0;
  for(const t of s.teams.values()){t.score=0;t.scoreReachedAt=null;}
  for(const p of s.players.values()){p.score=0;p.board=Array(25).fill(null);p.placedCallId=null;p.lastScoreAt=null;p.joinedElapsedMs=0;}
  persistSoon();broadcast(s);return true;
}
function globalResetRoom(s){
  clearTimer(s);
  for(const c of s.clients){try{c.res.write(`event: room_reset\ndata: ${JSON.stringify({code:s.code})}\n\n`);c.res.end();}catch{}}
  s.clients.clear();
  sessions.delete(s.code);
  persistSoon();
  return true;
}
function placeBall(s,p,callId,index){
  if(s.phase!=='running')return{ok:false,error:'Round is not running.'};
  if(!s.currentCall||callId!==s.currentCall.id)return{ok:false,error:'That call has expired.'};
  if(Date.now()>s.callDeadline)return{ok:false,error:'That call has expired.'};
  if(p.placedCallId===callId)return{ok:false,error:'You already used this call.'};
  if(!Number.isInteger(index)||index<0||index>24)return{ok:false,error:'Invalid space.'};
  const col=index%5;
  if(LETTERS[col]!==s.currentCall.letter)return{ok:false,error:'Wrong column.'};
  if(p.board[index])return{ok:false,error:'That space is occupied.'};

  p.board[index]={...s.currentCall};
  p.placedCallId=callId;

  // Detect every completed horizontal/diagonal line before clearing any cells.
  const wins=LINES.filter(line=>line.every(i=>p.board[i]));
  if(wins.length){
    const clear=new Set();let gain=0;
    for(const line of wins){
      const same=line.every(i=>p.board[i].color===p.board[line[0]].color);
      gain+=same?2:1;
      line.forEach(i=>clear.add(i));
    }
    p.score+=gain;p.lastScoreAt=Date.now();clear.forEach(i=>p.board[i]=null);
    recomputeTeamScores(s,p.lastScoreAt);
    const reached=checkGoal(s);
    persistSoon();broadcast(s);
    if(reached)setTimeout(()=>finish(s,'target'),50);
    return{ok:true,bingos:wins.length,points:gain};
  }
  persistSoon();broadcast(s);return{ok:true,bingos:0,points:0};
}
function canLateJoin(s){
  if(s.phase==='waiting'||s.phase==='starting')return true;
  if(s.phase!=='running'&&s.phase!=='paused')return false;
  if(s.lateJoinPolicy==='allowed')return true;
  if(s.lateJoinPolicy==='closed')return false;
  if(s.lateJoinPolicy==='cutoff'){
    if(!s.startedAt)return false;
    return Date.now()-s.startedAt < s.lateJoinCutoffMinutes*60*1000;
  }
  return false;
}
function hostAuthorized(s,token){ if(!s||!token)return false; const a=Buffer.from(String(token)),b=Buffer.from(String(s.hostToken)); return a.length===b.length&&crypto.timingSafeEqual(a,b); }

function serializableSession(s){
  return {
    code:s.code,hostToken:s.hostToken,roundNumber:s.roundNumber||1,roundName:s.roundName,sponsorName:s.sponsorName,sponsorLogoUrl:s.sponsorLogoUrl,
    callDuration:s.callDuration,winCondition:s.winCondition,roundDuration:s.roundDuration,bingoTarget:s.bingoTarget,
    lateJoinPolicy:s.lateJoinPolicy,lateJoinCutoffMinutes:s.lateJoinCutoffMinutes,mode:s.mode,
    teams:[...s.teams.values()],phase:s.phase,startsAt:s.startsAt,startedAt:s.startedAt,endsAt:s.endsAt,pausedRemaining:s.pausedRemaining,
    deck:s.deck,deckIndex:s.deckIndex,deckCycle:s.deckCycle,currentCall:s.currentCall,callDeadline:s.callDeadline,callNumber:s.callNumber,
    endReason:s.endReason,endedAt:s.endedAt,createdAt:s.createdAt,players:[...s.players.values()]
  };
}
let persistTimer=null;
function persistSoon(){ if(persistTimer)return; persistTimer=setTimeout(()=>{persistTimer=null;persist();},120); }
function persist(){ try{fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(DATA_FILE,JSON.stringify([...sessions.values()].map(serializableSession),null,2));}catch(e){console.error('Persist failed:',e.message);} }
function loadPersisted(){
  try{
    if(!fs.existsSync(DATA_FILE))return;
    const rows=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
    for(const raw of Array.isArray(rows)?rows:[]){
      const teams=new Map((raw.teams||[]).map(t=>[t.id,t]));
      const s={...raw,roundNumber:raw.roundNumber||1,sponsorName:raw.sponsorName==='YOUR BUSINESS'?'':(raw.sponsorName||''),teams,players:new Map((raw.players||[]).map(p=>[p.id,p])),clients:new Set(),tick:null};
      if(['running','starting'].includes(s.phase)){
        s.phase='paused';
        s.pausedRemaining=s.winCondition==='timed'?Math.max(0,(raw.endsAt||Date.now())-Date.now()):null;
        s.startsAt=null;s.callDeadline=null;
      }
      sessions.set(s.code,s);
    }
  }catch(e){console.error('Load persisted sessions failed:',e.message);}
}
loadPersisted();

function escAttr(v){ return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
function requestOrigin(req){
  const proto=String(req.headers['x-forwarded-proto']||'http').split(',')[0].trim();
  const host=String(req.headers['x-forwarded-host']||req.headers.host||`localhost:${PORT}`).split(',')[0].trim();
  return `${proto}://${host}`;
}
function socialMeta(req,s=null){
  const origin=requestOrigin(req);
  const image=`${origin}/assets/bingo-rush-share.png?v=1.6.0`;
  if(!s){
    return `<meta name="description" content="Join a live Bingo Rush game with a Game Code."><meta property="og:type" content="website"><meta property="og:site_name" content="Bingo Rush"><meta property="og:title" content="Bingo Rush"><meta property="og:description" content="Fast live bingo strategy. Enter a Game Code and join the round."><meta property="og:image" content="${escAttr(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${escAttr(origin+'/')}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Bingo Rush"><meta name="twitter:description" content="Fast live bingo strategy. Enter a Game Code and join the round."><meta name="twitter:image" content="${escAttr(image)}">`;
  }
  const sponsor=s.sponsorName?` This round is sponsored by ${s.sponsorName}.`:'';
  const title=`Bingo Rush — Join ${s.code}`;
  const desc=`Join this live Bingo Rush round. Game Code ${s.code}.${sponsor}`;
  const url=`${origin}/join/${encodeURIComponent(s.code)}?r=${s.roundNumber||1}`;
  return `<meta name="description" content="${escAttr(desc)}"><link rel="canonical" href="${escAttr(url)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Bingo Rush"><meta property="og:title" content="${escAttr(title)}"><meta property="og:description" content="${escAttr(desc)}"><meta property="og:image" content="${escAttr(image)}"><meta property="og:image:secure_url" content="${escAttr(image)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${escAttr(url)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escAttr(title)}"><meta name="twitter:description" content="${escAttr(desc)}"><meta name="twitter:image" content="${escAttr(image)}">`;
}
function serveIndex(req,res,s=null){
  fs.readFile(path.join(PUBLIC,'index.html'),'utf8',(err,html)=>{
    if(err){res.writeHead(500);return res.end('Server error');}
    const body=html.replace('<!--SOCIAL_META-->',socialMeta(req,s));
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store, max-age=0'});res.end(body);
  });
}

function serveFile(req,res,pathname){
  const rel=pathname==='/'?'index.html':pathname.slice(1);const file=path.normalize(path.join(PUBLIC,rel));
  if(!file.startsWith(PUBLIC)){res.writeHead(403);return res.end('Forbidden');}
  fs.stat(file,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);return res.end('Not found');}const ext=path.extname(file).toLowerCase();const ct={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'}[ext]||'application/octet-stream';const appCode=['.html','.js','.css'].includes(ext);res.writeHead(200,{'content-type':ct,'cache-control':appCode?'no-store, max-age=0':'public, max-age=3600'});fs.createReadStream(file).pipe(res);});
}

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);const p=u.pathname;
  try{
    if(req.method==='GET'&&(p==='/'||p==='/index.html'))return serveIndex(req,res,null);
    let joinMatch,m;
    if(req.method==='GET'&&(joinMatch=p.match(/^\/join\/([A-Za-z0-9]+)\/?$/))){const code=normalizeGameCode(joinMatch[1]);const s=sessions.get(code);return serveIndex(req,res,s||null);}
    if(req.method==='GET'&&(m=p.match(/^\/api\/sessions\/([A-Z0-9]+)\/qr\.svg$/))){
      const s=sessions.get(m[1]);if(!s){res.writeHead(404);return res.end('Game not found');}
      const joinUrl=`${requestOrigin(req)}/join/${encodeURIComponent(s.code)}?r=${s.roundNumber||1}`;
      const svg=await QRCode.toString(joinUrl,{type:'svg',errorCorrectionLevel:'H',margin:1,width:640,color:{dark:'#080B1C',light:'#FFFFFF'}});
      res.writeHead(200,{'content-type':'image/svg+xml; charset=utf-8','cache-control':'no-store, max-age=0'});return res.end(svg);
    }
    if(req.method==='POST'&&p==='/api/sessions'){
      const b=await readBody(req);const code=normalizeGameCode(b.gameCode);
      if(code.length<4)return json(res,400,{error:'Game Code must be 4–15 letters or numbers.'});
      if(sessions.has(code))return json(res,409,{error:'That Game Code is already in use. Choose another code.'});
      const hostToken=crypto.randomBytes(24).toString('hex');
      const mode=b.mode==='teams'?'teams':'solo';
      const teams=new Map();
      if(mode==='teams'){
        const names=Array.isArray(b.teamNames)?b.teamNames.map(x=>clampText(x,32)).filter(Boolean):[];
        if(names.length>MAX_TEAMS)return json(res,400,{error:`Team Mode supports up to ${MAX_TEAMS} teams per round.`});
        const seen=new Set();
        for(const name of names){
          const key=name.toLowerCase();
          if(seen.has(key))return json(res,400,{error:`Team names must be unique. “${name}” was entered more than once.`});
          seen.add(key);
          const tid=id(10);teams.set(tid,{id:tid,name,score:0,scoreReachedAt:null});
        }
      }
      const winCondition=b.winCondition==='target'?'target':'timed';
      const s={
        code,hostToken,roundName:clampText(b.roundName||'Bingo Rush',60)||'Bingo Rush',sponsorName:clampText(b.sponsorName,80),sponsorLogoUrl:safeLogo(b.sponsorLogoUrl),
        callDuration:[3,4,5,6,8,10].includes(Number(b.callDuration))?Number(b.callDuration):5,
        winCondition,roundDuration:asInt(b.roundDuration,60,7200,900),bingoTarget:asInt(b.bingoTarget,1,999,20),
        lateJoinPolicy:['allowed','cutoff','closed'].includes(b.lateJoinPolicy)?b.lateJoinPolicy:'allowed',lateJoinCutoffMinutes:asInt(b.lateJoinCutoffMinutes,1,120,5),
        mode,teams,roundNumber:1,phase:'waiting',players:new Map(),clients:new Set(),deck:[],deckIndex:0,deckCycle:0,currentCall:null,callDeadline:null,callNumber:0,tick:null,createdAt:Date.now(),startsAt:null,startedAt:null,endsAt:null,pausedRemaining:null,endReason:null,endedAt:null
      };
      sessions.set(code,s);persistSoon();return json(res,201,{code,hostToken,state:safeSession(s)});
    }
    if(req.method==='GET'&&(m=p.match(/^\/api\/sessions\/([A-Z0-9]+)$/))){const s=sessions.get(m[1]);if(!s)return json(res,404,{error:'Game not found'});return json(res,200,safeSession(s));}
    if(req.method==='POST'&&(m=p.match(/^\/api\/sessions\/([A-Z0-9]+)\/join$/))){
      const s=sessions.get(m[1]);if(!s)return json(res,404,{error:'Game not found'});const b=await readBody(req);
      let playerId=String(b.playerId||''),player=s.players.get(playerId);
      if(player){ player.name=clampText(b.name||player.name,24)||player.name; persistSoon();broadcast(s);return json(res,200,{playerId,state:playerView(s,player)}); }
      if(!canLateJoin(s))return json(res,409,{error:'Late joining is closed for this round.'});
      const name=clampText(b.name,24);if(!name)return json(res,400,{error:'Player name required'});
      let teamId=null;
      if(s.mode==='teams'){
        teamId=String(b.teamId||'');
        if(!s.teams.has(teamId))return json(res,400,{error:'Choose one of the teams created by the host.'});
        if(!teamHasSpace(s,teamId))return json(res,409,{error:`That team is full (${MAX_PLAYERS_PER_TEAM}/${MAX_PLAYERS_PER_TEAM}). Choose another available team.`});
      }
      playerId=id(16);const isLate=['running','paused'].includes(s.phase);
      player={id:playerId,name,teamId,score:0,board:Array(25).fill(null),placedCallId:isLate&&s.currentCall?s.currentCall.id:null,joinedAt:Date.now(),joinedElapsedMs:isLate&&s.startedAt?Date.now()-s.startedAt:0,lastScoreAt:null};
      s.players.set(playerId,player);persistSoon();broadcast(s);return json(res,200,{playerId,state:playerView(s,player)});
    }
    if(req.method==='POST'&&(m=p.match(/^\/api\/sessions\/([A-Z0-9]+)\/place$/))){const s=sessions.get(m[1]);if(!s)return json(res,404,{error:'Game not found'});const b=await readBody(req);const player=s.players.get(String(b.playerId||''));if(!player)return json(res,401,{error:'Player not registered'});const out=placeBall(s,player,String(b.callId||''),Number(b.index));return json(res,out.ok?200:409,out);}
    if(req.method==='POST'&&(m=p.match(/^\/api\/sessions\/([A-Z0-9]+)\/host\/global-reset$/))){
      const s=sessions.get(m[1]);if(!s)return json(res,404,{error:'Game not found'});const b=await readBody(req);if(!hostAuthorized(s,b.hostToken))return json(res,403,{error:'Host authorization failed'});globalResetRoom(s);return json(res,200,{ok:true,reset:true});
    }
    if(req.method==='POST'&&(m=p.match(/^\/api\/sessions\/([A-Z0-9]+)\/host\/(start|pause|resume|end|reset)$/))){
      const s=sessions.get(m[1]);if(!s)return json(res,404,{error:'Game not found'});const b=await readBody(req);if(!hostAuthorized(s,b.hostToken))return json(res,403,{error:'Host authorization failed'});let ok=false;
      if(m[2]==='start')ok=start(s);if(m[2]==='pause')ok=pause(s);if(m[2]==='resume')ok=resume(s);if(m[2]==='end'){finish(s,'host');ok=true;}if(m[2]==='reset')ok=resetRound(s);
      return json(res,ok?200:409,{ok,state:safeSession(s),error:ok?undefined:'That action is not available right now.'});
    }
    if(req.method==='POST'&&(m=p.match(/^\/api\/sessions\/([A-Z0-9]+)\/host\/team$/))){
      const s=sessions.get(m[1]);if(!s)return json(res,404,{error:'Game not found'});const b=await readBody(req);if(!hostAuthorized(s,b.hostToken))return json(res,403,{error:'Host authorization failed'});if(s.mode!=='teams')return json(res,409,{error:'This is a solo round.'});
      const action=String(b.action||'');
      if(action==='add'){
        if(s.teams.size>=MAX_TEAMS)return json(res,409,{error:`This round already has the maximum of ${MAX_TEAMS} teams.`});
        const name=clampText(b.name,32);if(!name)return json(res,400,{error:'Team name required'});
        if(teamNameExists(s,name))return json(res,409,{error:'That team name is already in use in this room.'});
        const tid=id(10);s.teams.set(tid,{id:tid,name,score:0,scoreReachedAt:null});
      }else if(action==='rename'){
        const t=s.teams.get(String(b.teamId||''));if(!t)return json(res,404,{error:'Team not found'});
        const name=clampText(b.name,32);if(!name)return json(res,400,{error:'Team name required'});
        if(teamNameExists(s,name,t.id))return json(res,409,{error:'That team name is already in use in this room.'});
        t.name=name;
      }else if(action==='remove'){
        if(s.phase!=='waiting')return json(res,409,{error:'Teams can only be removed before the game starts.'});const tid=String(b.teamId||'');if(!s.teams.has(tid))return json(res,404,{error:'Team not found'});if([...s.players.values()].some(p=>p.teamId===tid))return json(res,409,{error:'Move players off this team before removing it.'});s.teams.delete(tid);
      }else return json(res,400,{error:'Invalid team action'});
      persistSoon();broadcast(s);return json(res,200,{ok:true,state:safeSession(s)});
    }
    if(req.method==='POST'&&(m=p.match(/^\/api\/sessions\/([A-Z0-9]+)\/host\/player$/))){
      const s=sessions.get(m[1]);if(!s)return json(res,404,{error:'Game not found'});const b=await readBody(req);if(!hostAuthorized(s,b.hostToken))return json(res,403,{error:'Host authorization failed'});const player=s.players.get(String(b.playerId||''));if(!player)return json(res,404,{error:'Player not found'});
      if(b.remove===true){if(s.phase!=='waiting')return json(res,409,{error:'Players can only be removed before the game starts.'});s.players.delete(player.id);persistSoon();broadcast(s);return json(res,200,{ok:true,state:safeSession(s)});}
      if(b.name!==undefined){const name=clampText(b.name,24);if(!name)return json(res,400,{error:'Player name required'});player.name=name;}
      if(b.teamId!==undefined){
        if(s.phase!=='waiting')return json(res,409,{error:'Team assignment can only change before the game starts.'});
        const tid=String(b.teamId||'');
        if(s.mode==='teams'&&!s.teams.has(tid))return json(res,400,{error:'Choose a valid team.'});
        if(s.mode==='teams'&&tid!==player.teamId&&!teamHasSpace(s,tid,player.id))return json(res,409,{error:`That team is full (${MAX_PLAYERS_PER_TEAM}/${MAX_PLAYERS_PER_TEAM}).`});
        player.teamId=s.mode==='teams'?tid:null;
      }
      persistSoon();broadcast(s);return json(res,200,{ok:true,state:safeSession(s)});
    }
    if(req.method==='GET'&&p==='/events'){
      const code=String(u.searchParams.get('session')||'').toUpperCase();const s=sessions.get(code);if(!s){res.writeHead(404);return res.end('Game not found');}
      const playerId=String(u.searchParams.get('player')||'');res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive','access-control-allow-origin':'*'});res.write(': connected\n\n');const client={res,playerId};s.clients.add(client);const pv=playerId&&s.players.get(playerId)?playerView(s,s.players.get(playerId)):safeSession(s);res.write(`event: state\ndata: ${JSON.stringify(pv)}\n\n`);const keep=setInterval(()=>{try{res.write(': ping\n\n')}catch{}},20000);req.on('close',()=>{clearInterval(keep);s.clients.delete(client)});return;
    }
    return serveFile(req,res,p);
  }catch(e){console.error(e);return json(res,500,{error:'Server error'});}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Bingo Rush running on http://localhost:${PORT}`));
