import { useState, useEffect, useRef, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─── SHARED STORAGE KEYS ───
const KEY_DATASET   = "streye:dataset";
const KEY_SESSIONS  = "streye:sessions";
const KEY_ACTIVITY  = "streye:activity";
const KEY_CHAT      = "streye:chat";

// ─── DEFAULT DATASET ───
const DEFAULT_DS = {
  low:  { acc:94.2, pre:93.5, rec:95.1, f1:94.3 },
  med:  { acc:91.3, pre:90.8, rec:91.9, f1:91.3 },
  hi:   { acc:91.7, pre:91.1, rec:92.3, f1:91.7 },
  ov:   { acc:92.4, pre:91.8, rec:93.1, f1:92.4 },
  par:200, sess:30, fps:60, lat:20, latp:98.7,
  dist:[33,33,34],
  bl:[92.4,85.4,83.6,79.3,71.2],
  bn:["Proposed CNN-LSTM","SVM w/ Eye Features","Pupil-only CNN","Facial Expression","Rule-Based"],
  cm:{ll:94,lm:4,lh:2,ml:5,mm:91,mh:4,hl:3,hm:5,hh:92},
  ef:{
    blink:{lo:[14,20],me:[20,30],hi:[30,45]},
    pupil:{lo:[3.8,4.5],me:[4.5,5.5],hi:[5.5,7.0]},
    gaze: {lo:[8,14], me:[14,22],hi:[22,35]},
    stab: {lo:[0.5,1.0],me:[1.0,1.8],hi:[2.0,3.5]},
    pct:  {lo:[15,38], me:[42,65],hi:[68,90]},
  },
  featWeights:{pupil:38,stab:30,blink:20,gaze:12},
  updatedBy:"", updatedAt:"",
};

const COLORS = {
  low:"#00f5a0", med:"#f5a623", hi:"#f74f4f",
  blu:"#4f8ef7", pur:"#b07ef7",
};

const rnd=(min,max,dec)=>+(Math.random()*(max-min)+min).toFixed(dec);
const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
const AUTO=['low','low','med','low','hi','med','low','hi','hi','med'];

// ─── TOAST ───
function Toast({msg,type,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[]);
  const bg=type==='ok'?'#00f5a0':type==='warn'?'#f5a623':'#f74f4f';
  return(
    <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,background:'#0e1117',
      border:'1px solid rgba(255,255,255,.12)',borderLeft:`3px solid ${bg}`,
      padding:'12px 18px',borderRadius:10,fontSize:13,color:'#e8edf5',maxWidth:320,
      animation:'slideUp .3s ease'}}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
      {msg}
    </div>
  );
}

// ─── LIVE DOT ───
function LiveDot({active}){
  return <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',
    background:active?COLORS.low:'#5a6478',
    animation:active?'blink 1.4s infinite':'none',
    marginRight:6}}><style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}`}</style></span>;
}

// ─── MAIN APP ───
export default function StressEyeApp(){
  const [page,setPage]=useState('dashboard');
  const [ds,setDs]=useState(DEFAULT_DS);
  const [sessions,setSessions]=useState([]);
  const [activity,setActivity]=useState([]);
  const [chat,setChat]=useState([]);
  const [toast,setToast]=useState(null);
  const [userName,setUserName]=useState(()=>localStorage.getItem('streye:username')||'');
  const [nameInput,setNameInput]=useState('');
  const [pollTs,setPollTs]=useState(0);
  const pollerRef=useRef(null);

  // ── SHOW TOAST ──
  const showToast=(msg,type='ok')=>{setToast({msg,type,id:Date.now()});};

  // ── SAVE USERNAME ──
  const saveUserName=()=>{
    if(!nameInput.trim())return;
    const n=nameInput.trim();
    localStorage.setItem('streye:username',n);
    setUserName(n);
    showToast(`Welcome, ${n}!`,'ok');
  };

  // ── LOG ACTIVITY ──
  const logActivity=useCallback(async(action,detail='')=>{
    if(!userName)return;
    try{
      const prev=await window.storage.get(KEY_ACTIVITY,true).catch(()=>null);
      const list=prev?JSON.parse(prev.value):[];
      list.unshift({user:userName,action,detail,time:new Date().toLocaleTimeString()});
      await window.storage.set(KEY_ACTIVITY,JSON.stringify(list.slice(0,50)),true);
    }catch{}
  },[userName]);

  // ── LOAD FROM SHARED STORAGE ──
  const loadShared=useCallback(async()=>{
    try{
      const [dsR,sessR,actR,chatR]=await Promise.allSettled([
        window.storage.get(KEY_DATASET,true),
        window.storage.get(KEY_SESSIONS,true),
        window.storage.get(KEY_ACTIVITY,true),
        window.storage.get(KEY_CHAT,true),
      ]);
      if(dsR.status==='fulfilled'&&dsR.value)setDs(JSON.parse(dsR.value.value));
      if(sessR.status==='fulfilled'&&sessR.value)setSessions(JSON.parse(sessR.value.value));
      if(actR.status==='fulfilled'&&actR.value)setActivity(JSON.parse(actR.value.value));
      if(chatR.status==='fulfilled'&&chatR.value)setChat(JSON.parse(chatR.value.value));
    }catch{}
  },[]);

  // ── SAVE DATASET TO SHARED ──
  const saveDataset=useCallback(async(newDs)=>{
    if(!userName){showToast('Set your name first','warn');return;}
    const d={...newDs,updatedBy:userName,updatedAt:new Date().toLocaleString()};
    setDs(d);
    try{
      await window.storage.set(KEY_DATASET,JSON.stringify(d),true);
      await logActivity('Updated dataset',`by ${userName}`);
      showToast('✓ Dataset saved & synced to all users','ok');
    }catch(e){showToast('Storage error: '+e.message,'err');}
  },[userName,logActivity]);

  // ── SAVE SESSION TO SHARED ──
  const saveSession=useCallback(async(sess)=>{
    if(!userName){showToast('Set your name first','warn');return;}
    const newList=[{...sess,user:userName,date:new Date().toLocaleString()},...sessions].slice(0,100);
    setSessions(newList);
    try{
      await window.storage.set(KEY_SESSIONS,JSON.stringify(newList),true);
      await logActivity('Saved session',`Stress: ${sess.avgStress}% | Level: ${sess.peakLevel}`);
      showToast('💾 Session saved & visible to all users','ok');
    }catch(e){showToast('Storage error: '+e.message,'err');}
  },[userName,sessions,logActivity]);

  // ── SEND CHAT ──
  const sendChat=useCallback(async(msg)=>{
    if(!userName||!msg.trim())return;
    const entry={user:userName,msg:msg.trim(),time:new Date().toLocaleTimeString()};
    const newChat=[...chat,entry].slice(-100);
    setChat(newChat);
    try{
      await window.storage.set(KEY_CHAT,JSON.stringify(newChat),true);
    }catch{}
  },[userName,chat]);

  // ── CLEAR ALL SESSIONS ──
  const clearSessions=useCallback(async()=>{
    setSessions([]);
    try{await window.storage.set(KEY_SESSIONS,'[]',true);await logActivity('Cleared all sessions');}catch{}
    showToast('🗑 All sessions cleared for everyone','warn');
  },[logActivity]);

  // ── RESET DATASET ──
  const resetDataset=useCallback(async()=>{
    await saveDataset(DEFAULT_DS);
    showToast('↺ Dataset reset to defaults for everyone','ok');
  },[saveDataset]);

  // ── POLL FOR CHANGES (every 4s) ──
  useEffect(()=>{
    loadShared();
    pollerRef.current=setInterval(()=>{
      loadShared();
      setPollTs(Date.now());
    },4000);
    return()=>clearInterval(pollerRef.current);
  },[loadShared]);

  if(!userName){
    return(
      <div style={{minHeight:'100vh',background:'#06080d',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Space Mono, monospace'}}>
        <div style={{background:'#0e1117',border:'1px solid rgba(255,255,255,.1)',borderRadius:16,padding:40,width:360,textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:12}}>👁</div>
          <div style={{fontSize:20,fontWeight:700,color:'#e8edf5',marginBottom:6}}>StressEye VR</div>
          <div style={{fontSize:12,color:'#5a6478',marginBottom:24}}>Shared real-time dashboard · VCET 2026</div>
          <div style={{fontSize:13,color:'#8892a4',marginBottom:10,textAlign:'left'}}>Enter your name to join:</div>
          <input value={nameInput} onChange={e=>setNameInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&saveUserName()}
            placeholder="Your name (e.g. Karthika)"
            style={{width:'100%',background:'#151920',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,
              padding:'10px 14px',color:'#e8edf5',fontSize:13,marginBottom:12,outline:'none',fontFamily:'Space Mono'}}/>
          <button onClick={saveUserName} style={{width:'100%',background:'#00f5a0',border:'none',borderRadius:8,
            padding:'10px 0',fontSize:13,fontWeight:700,cursor:'pointer',color:'#000'}}>
            Join Dashboard →
          </button>
          <div style={{marginTop:16,fontSize:11,color:'#5a6478'}}>⚠️ Data shared with all users — visible to everyone</div>
        </div>
      </div>
    );
  }

  return(
    <div style={{minHeight:'100vh',background:'#06080d',fontFamily:'Syne, sans-serif',display:'flex'}}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#06080d}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:3px}
        input[type=number],input[type=text],input[type=range],textarea{font-family:'Space Mono',monospace}
        @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .page-anim{animation:slideUp .3s ease}
      `}</style>

      {/* SIDEBAR */}
      <Sidebar page={page} setPage={setPage} userName={userName} activity={activity} sessions={sessions}/>

      {/* MAIN */}
      <div style={{marginLeft:220,flex:1,padding:'24px 28px',minHeight:'100vh',overflowX:'hidden'}}>

        {/* SYNC BAR */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
          background:'#0e1117',border:'1px solid rgba(255,255,255,.06)',
          borderRadius:10,padding:'8px 14px',marginBottom:20,fontSize:12}}>
          <div style={{display:'flex',alignItems:'center',gap:8,color:'#8892a4'}}>
            <LiveDot active/> Live sync · auto-refreshes every 4s · all changes shared globally
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            {ds.updatedBy&&<span style={{color:'#5a6478',fontSize:11}}>Last edit: {ds.updatedBy} · {ds.updatedAt}</span>}
            <span style={{background:'rgba(0,245,160,.12)',color:'#00f5a0',padding:'2px 10px',borderRadius:20,fontSize:11,fontFamily:'Space Mono'}}>
              {userName}
            </span>
          </div>
        </div>

        <div className="page-anim" key={page}>
          {page==='dashboard'&&<DashPage ds={ds}/>}
          {page==='dataset'&&<DatasetPage ds={ds} saveDataset={saveDataset} resetDataset={resetDataset} showToast={showToast}/>}
          {page==='monitor'&&<MonitorPage ds={ds} saveSession={saveSession} userName={userName}/>}
          {page==='sessions'&&<SessionsPage sessions={sessions} clearSessions={clearSessions} showToast={showToast}/>}
          {page==='activity'&&<ActivityPage activity={activity}/>}
          {page==='chat'&&<ChatPage chat={chat} sendChat={sendChat} userName={userName}/>}
          {page==='about'&&<AboutPage/>}
        </div>
      </div>

      {toast&&<Toast key={toast.id} msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </div>
  );
}

// ─── SIDEBAR ───
function Sidebar({page,setPage,userName,activity,sessions}){
  const ni=(id,icon,label,badge)=>(
    <div onClick={()=>setPage(id)} style={{display:'flex',alignItems:'center',gap:10,
      padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:600,
      color:page===id?'#00f5a0':'#8892a4',
      borderLeft:`2px solid ${page===id?'#00f5a0':'transparent'}`,
      background:page===id?'rgba(0,245,160,.1)':'transparent',
      transition:'all .2s'}}>
      <span style={{fontSize:16,width:20,textAlign:'center'}}>{icon}</span>
      <span>{label}</span>
      {badge!=null&&<span style={{marginLeft:'auto',fontFamily:'Space Mono',fontSize:10,
        background:'rgba(0,245,160,.15)',color:'#00f5a0',padding:'1px 6px',borderRadius:4}}>
        {badge}
      </span>}
    </div>
  );
  return(
    <div style={{width:220,flexShrink:0,background:'#0e1117',borderRight:'1px solid rgba(255,255,255,.06)',
      display:'flex',flexDirection:'column',padding:'24px 0',position:'fixed',top:0,bottom:0,left:0,zIndex:100,overflowY:'auto'}}>
      <div style={{padding:'0 18px 18px',borderBottom:'1px solid rgba(255,255,255,.06)',marginBottom:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#00f5a0,#4f8ef7)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>👁</div>
          <div>
            <div style={{fontFamily:'Space Mono',fontSize:14,fontWeight:700,color:'#e8edf5'}}>StressEye</div>
            <div style={{fontSize:10,color:'#5a6478'}}>v2.0 · VCET 2026</div>
          </div>
        </div>
      </div>
      <nav>
        {ni('dashboard','📊','Dashboard')}
        {ni('dataset','🗂','Dataset Editor','EDIT')}
        {ni('monitor','🎥','Live Monitor')}
        {ni('sessions','📋','Sessions',sessions.length||null)}
        {ni('activity','📡','Live Activity',activity.length?activity.length:null)}
        {ni('chat','💬','Team Chat',null)}
        {ni('about','ℹ️','About')}
      </nav>
      <div style={{marginTop:'auto',padding:'14px 18px',borderTop:'1px solid rgba(255,255,255,.06)',
        fontSize:12,color:'#5a6478'}}>
        <LiveDot active/> Syncing as <span style={{color:'#00f5a0'}}>{userName}</span>
      </div>
    </div>
  );
}

// ─── DASHBOARD PAGE ───
function DashPage({ds}){
  const classData=['Low','Medium','High','Overall'].map((label,i)=>{
    const row=[ds.low,ds.med,ds.hi,ds.ov][i];
    return{name:label,Accuracy:row.acc,Precision:row.pre,Recall:row.rec};
  });
  const baseData=ds.bn.map((name,i)=>({name:name.split(' ').slice(0,2).join(' '),acc:ds.bl[i]}));
  const radarData=[
    {metric:'Accuracy',val:ds.ov.acc},
    {metric:'Precision',val:ds.ov.pre},
    {metric:'Recall',val:ds.ov.rec},
    {metric:'F1',val:ds.ov.f1},
  ];
  const distData=[
    {name:'Low',value:ds.dist[0],color:COLORS.low},
    {name:'Medium',value:ds.dist[1],color:COLORS.med},
    {name:'High',value:ds.dist[2],color:COLORS.hi},
  ];
  const diff=(ds.ov.acc-Math.max(...ds.bl.slice(1))).toFixed(1);

  return(
    <div>
      <PageHeader title="System Dashboard" sub="All charts driven by shared dataset · changes sync instantly to all users"/>
      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        <KPI color={COLORS.low} label="Overall Accuracy" val={ds.ov.acc.toFixed(1)+'%'} delta={`+${diff}pp vs 2nd best`}/>
        <KPI color={COLORS.blu} label="Inference Latency" val={`<${ds.lat}ms`} delta={`${ds.latp}% within target`}/>
        <KPI color={COLORS.med} label="Participants" val={ds.par} delta={`${ds.sess} min sessions`}/>
        <KPI color={COLORS.pur} label="F1-Score (Macro)" val={ds.ov.f1.toFixed(1)+'%'} delta="Balanced classifier"/>
      </div>
      {/* Charts row 1 */}
      <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:16,marginBottom:16}}>
        <Card title="Baseline Model Comparison — accuracy %">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={baseData} margin={{top:4,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/>
              <XAxis dataKey="name" tick={{fill:'#5a6478',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis domain={[Math.max(0,Math.floor(Math.min(...ds.bl)-10)),100]} tick={{fill:'#5a6478',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v+'%'}/>
              <Tooltip contentStyle={{background:'#151920',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,fontSize:12}} formatter={v=>[v+'%','Accuracy']}/>
              <Bar dataKey="acc" radius={[6,6,0,0]}>
                {baseData.map((_,i)=><Cell key={i} fill={i===0?COLORS.low:['#4f8ef7','#b07ef7','#f5a623','#f74f4f'][i-1]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Per-Class Performance">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={classData} margin={{top:4,bottom:4}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)"/>
              <XAxis dataKey="name" tick={{fill:'#5a6478',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis domain={[85,100]} tick={{fill:'#5a6478',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>v+'%'}/>
              <Tooltip contentStyle={{background:'#151920',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,fontSize:12}}/>
              <Legend wrapperStyle={{fontSize:11,color:'#8892a4'}}/>
              <Bar dataKey="Accuracy" fill={COLORS.low} radius={[4,4,0,0]}/>
              <Bar dataKey="Precision" fill={COLORS.blu} radius={[4,4,0,0]}/>
              <Bar dataKey="Recall" fill={COLORS.pur} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      {/* Charts row 2 */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        <Card title="Metrics Radar">
          <ResponsiveContainer width="100%" height={190}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,.07)"/>
              <PolarAngleAxis dataKey="metric" tick={{fill:'#8892a4',fontSize:11}}/>
              <Radar dataKey="val" stroke={COLORS.low} fill={COLORS.low} fillOpacity={0.12} dot={{fill:COLORS.low,r:4}}/>
              <Tooltip contentStyle={{background:'#151920',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,fontSize:12}} formatter={v=>[v+'%']}/>
            </RadarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Stress Level Distribution">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={distData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                {distData.map((d,i)=><Cell key={i} fill={d.color}/>)}
              </Pie>
              <Tooltip contentStyle={{background:'#151920',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,fontSize:12}} formatter={v=>[v+'%']}/>
              <Legend wrapperStyle={{fontSize:11,color:'#8892a4'}}/>
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Confusion Matrix">
          <ConfMatrix cm={ds.cm}/>
        </Card>
      </div>
    </div>
  );
}

// ─── CONFUSION MATRIX ───
function ConfMatrix({cm}){
  const total=Object.values(cm).reduce((a,b)=>a+b,0);
  const rows=[
    [null,'Pred L','Pred M','Pred H'],
    ['Act L',cm.ll,cm.lm,cm.lh],
    ['Act M',cm.ml,cm.mm,cm.mh],
    ['Act H',cm.hl,cm.hm,cm.hh],
  ];
  const isDiag=(r,c)=>r>0&&c>0&&r===c;
  return(
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:3,marginTop:8}}>
      {rows.map((row,ri)=>row.map((cell,ci)=>(
        <div key={ri+'-'+ci} style={{
          padding:'6px 2px',textAlign:'center',borderRadius:6,
          background:isDiag(ri,ci)?'rgba(0,245,160,.18)':ri===0||ci===0?'transparent':'rgba(255,255,255,.04)',
          border:isDiag(ri,ci)?'1px solid rgba(0,245,160,.3)':ri===0||ci===0?'none':'1px solid rgba(255,255,255,.06)',
          fontSize:ri===0||ci===0?10:13,
          fontFamily:'Space Mono',fontWeight:isDiag(ri,ci)?700:400,
          color:isDiag(ri,ci)?COLORS.low:ri===0||ci===0?'#5a6478':'#e8edf5'}}>
          {cell!=null?cell:''}
          {isDiag(ri,ci)&&total>0&&<div style={{fontSize:9,color:'rgba(0,245,160,.7)',marginTop:1}}>{(cell/total*100).toFixed(0)}%</div>}
        </div>
      )))}
    </div>
  );
}

// ─── DATASET EDITOR PAGE ───
function DatasetPage({ds,saveDataset,resetDataset,showToast}){
  const [local,setLocal]=useState(ds);
  const [tab,setTab]=useState('model');
  const [csvText,setCsvText]=useState('');
  const [csvPreview,setCsvPreview]=useState(null);

  useEffect(()=>setLocal(ds),[ds]);

  const upd=(path,val)=>{
    setLocal(prev=>{
      const next=JSON.parse(JSON.stringify(prev));
      const keys=path.split('.');
      let cur=next;
      for(let i=0;i<keys.length-1;i++){
        const k=keys[i];
        if(k.includes('[')){ const[a,b]=k.replace(']','').split('[');cur=cur[a][parseInt(b)]; }
        else cur=cur[k];
      }
      const last=keys[keys.length-1];
      if(last.includes('[')){ const[a,b]=last.replace(']','').split('[');cur[a][parseInt(b)]=val; }
      else cur[last]=val;
      return next;
    });
  };

  const parseCSV=()=>{
    const lines=csvText.trim().split('\n').filter(l=>l.trim());
    if(lines.length<2){showToast('CSV must have header + data rows','warn');return;}
    const headers=lines[0].split(',').map(h=>h.trim().toLowerCase());
    const rows=lines.slice(1).map(l=>l.split(',').map(v=>v.trim()));
    const mi=headers.indexOf('metric'),li=headers.indexOf('low'),mei=headers.indexOf('medium'),hi=headers.indexOf('high'),oi=headers.indexOf('overall');
    if(mi<0){showToast('CSV needs a "metric" column','warn');return;}
    const preview=[];
    const next=JSON.parse(JSON.stringify(local));
    rows.forEach(r=>{
      const metric=(r[mi]||'').toLowerCase();
      const g=(idx)=>idx>=0&&r[idx]?parseFloat(r[idx]):null;
      const lo=g(li),me=g(mei),h=g(hi),ov=g(oi);
      if(metric==='accuracy'){ if(lo!=null)next.low.acc=lo; if(me!=null)next.med.acc=me; if(h!=null)next.hi.acc=h; if(ov!=null)next.ov.acc=ov; }
      if(metric==='precision'){ if(lo!=null)next.low.pre=lo; if(me!=null)next.med.pre=me; if(h!=null)next.hi.pre=h; if(ov!=null)next.ov.pre=ov; }
      if(metric==='recall'){ if(lo!=null)next.low.rec=lo; if(me!=null)next.med.rec=me; if(h!=null)next.hi.rec=h; if(ov!=null)next.ov.rec=ov; }
      if(metric==='f1'){ if(lo!=null)next.low.f1=lo; if(me!=null)next.med.f1=me; if(h!=null)next.hi.f1=h; if(ov!=null)next.ov.f1=ov; }
      if(metric==='participants'&&ov!=null)next.par=ov;
      if(metric==='sessions_min'&&ov!=null)next.sess=ov;
      preview.push({metric,lo,me,h,ov});
    });
    setCsvPreview({rows:preview,next});
    showToast(`Parsed ${rows.length} rows — review & apply`,'ok');
  };

  const applyCSV=()=>{if(csvPreview){setLocal(csvPreview.next);setCsvPreview(null);showToast('CSV applied — click Save to sync','ok');}};

  const F=(label,path,opts={})=>(
    <div style={{display:'flex',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
      <span style={{padding:'9px 12px',fontSize:12,color:'#8892a4',width:140,flexShrink:0,fontWeight:600,borderRight:'1px solid rgba(255,255,255,.05)'}}>{label}</span>
      <input type={opts.type||'number'} step={opts.step||0.1} min={opts.min} max={opts.max||100}
        value={String(path.split('.').reduce((o,k)=>{if(k.includes('[')){const[a,b]=k.replace(']','').split('[');return o[a][parseInt(b)];}return o[k];},local))}
        onChange={e=>upd(path,opts.type==='text'?e.target.value:parseFloat(e.target.value))}
        style={{flex:1,background:'transparent',border:'none',outline:'none',color:'#e8edf5',fontFamily:'Space Mono',fontSize:13,padding:'9px 12px',width:'100%'}}/>
    </div>
  );

  const DS=(children)=>(
    <div style={{border:'1px solid rgba(255,255,255,.08)',borderRadius:10,overflow:'hidden',marginBottom:14}}>
      {children}
    </div>
  );
  const DH=(title,color='#00f5a0')=>(
    <div style={{padding:'10px 14px',background:'#151920',borderBottom:'1px solid rgba(255,255,255,.06)',
      fontFamily:'Space Mono',fontSize:10,color,letterSpacing:'.08em'}}>
      {title}
    </div>
  );

  return(
    <div>
      <PageHeader title="Dataset Editor" sub="Edit any value → click Save to sync changes to ALL connected users instantly"/>
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {['model','baseline','eyefeat','csv'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'8px 16px',borderRadius:8,border:'1px solid',cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'Space Mono',
            background:tab===t?'rgba(0,245,160,.12)':'transparent',
            borderColor:tab===t?'#00f5a0':'rgba(255,255,255,.12)',
            color:tab===t?'#00f5a0':'#8892a4'}}>
            {{'model':'🧠 Model Metrics','baseline':'📊 Baselines','eyefeat':'👁 Eye Features','csv':'📥 CSV Import'}[t]}
          </button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          <button onClick={resetDataset} style={btnStyle('warn')}>↺ Reset</button>
          <button onClick={()=>saveDataset(local)} style={btnStyle('ok')}>💾 Save &amp; Sync All →</button>
        </div>
      </div>

      {tab==='model'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div>
            {DS(<>{DH('LOW STRESS CLASS',COLORS.low)}{F('Accuracy %','low.acc')}{F('Precision %','low.pre')}{F('Recall %','low.rec')}{F('F1-Score %','low.f1')}</>)}
            {DS(<>{DH('MEDIUM STRESS CLASS',COLORS.med)}{F('Accuracy %','med.acc')}{F('Precision %','med.pre')}{F('Recall %','med.rec')}{F('F1-Score %','med.f1')}</>)}
            {DS(<>{DH('HIGH STRESS CLASS',COLORS.hi)}{F('Accuracy %','hi.acc')}{F('Precision %','hi.pre')}{F('Recall %','hi.rec')}{F('F1-Score %','hi.f1')}</>)}
            {DS(<>{DH('OVERALL (MACRO AVG)')}{F('Accuracy %','ov.acc')}{F('Precision %','ov.pre')}{F('Recall %','ov.rec')}{F('F1-Score %','ov.f1')}</>)}
          </div>
          <div>
            {DS(<>{DH('EXPERIMENT PARAMETERS')}{F('Participants','par',{step:1,min:1,max:10000})}{F('Session (min)','sess',{step:1,min:1,max:300})}{F('Camera FPS','fps',{step:1,min:1,max:240})}{F('Latency (ms)','lat',{step:1,min:1,max:1000})}{F('% within latency','latp')}{F('Dist % Low','dist[0]',{step:1,min:0,max:100})}{F('Dist % Medium','dist[1]',{step:1,min:0,max:100})}{F('Dist % High','dist[2]',{step:1,min:0,max:100})}</>)}
            {DS(<>{DH('CONFUSION MATRIX COUNTS')}
              {F('TP Low (L→L)','cm.ll',{step:1,min:0,max:10000})}{F('Low→Med (L→M)','cm.lm',{step:1,min:0,max:10000})}{F('Low→High (L→H)','cm.lh',{step:1,min:0,max:10000})}
              {F('Med→Low (M→L)','cm.ml',{step:1,min:0,max:10000})}{F('TP Med (M→M)','cm.mm',{step:1,min:0,max:10000})}{F('Med→High (M→H)','cm.mh',{step:1,min:0,max:10000})}
              {F('High→Low (H→L)','cm.hl',{step:1,min:0,max:10000})}{F('High→Med (H→M)','cm.hm',{step:1,min:0,max:10000})}{F('TP High (H→H)','cm.hh',{step:1,min:0,max:10000})}</>)}
          </div>
        </div>
      )}

      {tab==='baseline'&&(
        <Card title="Baseline Systems — rename and change accuracy values">
          {DS(<>
            {DH('SYSTEM NAME & ACCURACY — first row = your proposed model')}
            {[0,1,2,3,4].map(i=>(
              <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 140px',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                <div style={{display:'flex',alignItems:'center',borderRight:'1px solid rgba(255,255,255,.05)'}}>
                  <span style={{padding:'9px 12px',fontSize:12,color:'#8892a4',width:50,flexShrink:0,borderRight:'1px solid rgba(255,255,255,.05)',fontFamily:'Space Mono'}}>Sys {i+1}</span>
                  <input type="text" value={local.bn[i]} onChange={e=>{const bn=[...local.bn];bn[i]=e.target.value;setLocal(p=>({...p,bn}));}}
                    style={{flex:1,background:'transparent',border:'none',outline:'none',color:'#e8edf5',fontFamily:'Space Mono',fontSize:13,padding:'9px 12px'}}/>
                </div>
                <div style={{display:'flex',alignItems:'center'}}>
                  <span style={{padding:'9px 8px',fontSize:11,color:'#5a6478',width:40}}>Acc%</span>
                  <input type="number" step="0.1" min="0" max="100" value={local.bl[i]}
                    onChange={e=>{const bl=[...local.bl];bl[i]=parseFloat(e.target.value);setLocal(p=>({...p,bl}));}}
                    style={{flex:1,background:'transparent',border:'none',outline:'none',color:i===0?COLORS.low:'#e8edf5',fontFamily:'Space Mono',fontSize:13,padding:'9px 8px',fontWeight:i===0?700:400}}/>
                </div>
              </div>
            ))}
          </>)}
          <div style={{padding:'10px 14px',background:'rgba(0,245,160,.05)',borderRadius:8,fontSize:12,color:'#8892a4',marginTop:8}}>
            💡 System 1 is your proposed model. The comparison bar chart on Dashboard updates for all users when you Save &amp; Sync.
          </div>
        </Card>
      )}

      {tab==='eyefeat'&&(
        <div>
          <Card title="Eye Feature Ranges per Stress Level — controls Live Monitor simulation for all users">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:0,border:'1px solid rgba(255,255,255,.08)',borderRadius:10,overflow:'hidden',marginTop:8}}>
              {[['low',COLORS.low],['med',COLORS.med],['hi',COLORS.hi]].map(([k,col])=>(
                <div key={k} style={{borderRight:k!=='hi'?'1px solid rgba(255,255,255,.06)':'none'}}>
                  <div style={{padding:'10px 12px',background:'#151920',borderBottom:'1px solid rgba(255,255,255,.06)',fontFamily:'Space Mono',fontSize:10,color:col,letterSpacing:'.08em'}}>
                    {k.toUpperCase()} STRESS
                  </div>
                  {[['Blink min',`ef.blink.${k}[0]`,{step:1}],['Blink max',`ef.blink.${k}[1]`,{step:1}],
                    ['Pupil min',`ef.pupil.${k}[0]`,{step:0.1}],['Pupil max',`ef.pupil.${k}[1]`,{step:0.1}],
                    ['Gaze min°',`ef.gaze.${k}[0]`,{step:1}],['Gaze max°',`ef.gaze.${k}[1]`,{step:1}],
                    ['Stab min σ',`ef.stab.${k}[0]`,{step:0.1}],['Stab max σ',`ef.stab.${k}[1]`,{step:0.1}],
                    ['Stress % min',`ef.pct.${k}[0]`,{step:1}],['Stress % max',`ef.pct.${k}[1]`,{step:1}],
                  ].map(([label,path,opts])=>F(label,path,opts))}
                </div>
              ))}
            </div>
          </Card>
          <Card title="Feature Importance Weights (draggable sliders)">
            <div style={{display:'flex',flexDirection:'column',gap:12,marginTop:8}}>
              {[['pupil','Pupil Size',COLORS.low],['stab','Gaze Stability',COLORS.pur],['blink','Blink Rate',COLORS.blu],['gaze','Gaze Direction',COLORS.med]].map(([k,label,color])=>(
                <div key={k} style={{display:'flex',alignItems:'center',gap:12,fontSize:13}}>
                  <span style={{color:'#8892a4',width:130}}>{label}</span>
                  <input type="range" min="0" max="100" value={local.featWeights[k]}
                    onChange={e=>setLocal(p=>({...p,featWeights:{...p.featWeights,[k]:parseInt(e.target.value)}}))}
                    style={{flex:1,accentColor:color}}/>
                  <span style={{fontFamily:'Space Mono',fontSize:12,width:36,textAlign:'right',color}}>{local.featWeights[k]}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab==='csv'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <Card title="Paste or type CSV data">
            <textarea value={csvText} onChange={e=>setCsvText(e.target.value)}
              placeholder={"metric,low,medium,high,overall\naccuracy,94.2,91.3,91.7,92.4\nprecision,93.5,90.8,91.1,91.8\nrecall,95.1,91.9,92.3,93.1\nf1,94.3,91.3,91.7,92.4\nparticipants,,,,200\nsessions_min,,,,30"}
              style={{width:'100%',height:200,background:'#151920',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,
                padding:12,color:'#e8edf5',fontFamily:'Space Mono',fontSize:12,resize:'vertical',outline:'none',marginBottom:10}}/>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setCsvText("metric,low,medium,high,overall\naccuracy,94.2,91.3,91.7,92.4\nprecision,93.5,90.8,91.1,91.8\nrecall,95.1,91.9,92.3,93.1\nf1,94.3,91.3,91.7,92.4\nparticipants,,,,200")} style={btnStyle('neutral')}>📄 Load Sample</button>
              <button onClick={parseCSV} style={btnStyle('ok')}>→ Parse</button>
            </div>
          </Card>
          <div>
            {csvPreview?(
              <Card title="Parsed Preview — click Apply to use">
                <div style={{overflow:'auto',maxHeight:200,marginBottom:12}}>
                  <table style={{width:'100%',fontSize:12,borderCollapse:'collapse',fontFamily:'Space Mono'}}>
                    <thead><tr>{['Metric','Low','Medium','High','Overall'].map(h=><th key={h} style={{padding:'6px 8px',color:'#5a6478',textAlign:'left',borderBottom:'1px solid rgba(255,255,255,.06)',fontSize:10}}>{h}</th>)}</tr></thead>
                    <tbody>{csvPreview.rows.map((r,i)=><tr key={i}>{[r.metric,r.lo,r.me,r.h,r.ov].map((v,j)=><td key={j} style={{padding:'6px 8px',borderBottom:'1px solid rgba(255,255,255,.04)',color:v!=null?'#e8edf5':'#5a6478'}}>{v!=null?v:'—'}</td>)}</tr>)}</tbody>
                  </table>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={applyCSV} style={btnStyle('ok')}>✓ Apply Changes</button>
                  <button onClick={()=>setCsvPreview(null)} style={btnStyle('neutral')}>✕ Cancel</button>
                </div>
                <div style={{marginTop:8,fontSize:11,color:'#5a6478'}}>After applying, click "Save &amp; Sync All" to push to all users.</div>
              </Card>
            ):(
              <Card title="Format guide">
                <div style={{fontSize:12,color:'#8892a4',lineHeight:1.7}}>
                  <strong style={{color:'#e8edf5'}}>Supported metric names:</strong><br/>
                  accuracy · precision · recall · f1 · participants · sessions_min<br/><br/>
                  <strong style={{color:'#e8edf5'}}>Column order:</strong><br/>
                  metric, low, medium, high, overall<br/><br/>
                  <strong style={{color:'#e8edf5'}}>Leave cells blank</strong> with commas if not applicable.<br/><br/>
                  After parsing, preview appears → Apply → Save &amp; Sync to push to all users.
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MONITOR PAGE ───
function MonitorPage({ds,saveSession,userName}){
  const [active,setActive]=useState(false);
  const [scen,setScen]=useState('auto');
  const [timer,setTimer]=useState(0);
  const [metrics,setMetrics]=useState({blink:'--',pupil:'--',gaze:'--',stab:'--',pct:0,color:COLORS.low,label:'NOT STARTED',hint:'Start a session to begin'});
  const [timelineData,setTimelineData]=useState([]);
  const [sessData,setSessData]=useState([]);
  const [canSave,setCanSave]=useState(false);
  const simRef=useRef(null);
  const timerRef=useRef(null);
  const autoStepRef=useRef(0);

  const SCEN=()=>{
    const ef=ds.ef;
    return{
      low:{blink:ef.blink.lo,pupil:ef.pupil.lo,gaze:ef.gaze.lo,stab:ef.stab.lo,pct:ef.pct.lo,color:COLORS.low,label:'LOW STRESS',hint:'Normal blink · stable gaze · no dilation'},
      med:{blink:ef.blink.me,pupil:ef.pupil.me,gaze:ef.gaze.me,stab:ef.stab.me,pct:ef.pct.me,color:COLORS.med,label:'MEDIUM STRESS',hint:'Elevated blink · moderate dilation · gaze drift'},
      hi: {blink:ef.blink.hi,pupil:ef.pupil.hi,gaze:ef.gaze.hi,stab:ef.stab.hi,pct:ef.pct.hi,color:COLORS.hi, label:'HIGH STRESS',hint:'High blink rate · dilated pupils · unstable fixation'},
    };
  };

  const start=()=>{
    setActive(true);setTimer(0);setTimelineData([]);setSessData([]);setCanSave(false);autoStepRef.current=0;
    timerRef.current=setInterval(()=>setTimer(t=>t+1),1000);
    simRef.current=setInterval(()=>{
      const sc=scen==='auto'?AUTO[autoStepRef.current++%AUTO.length]:scen;
      const cfg=SCEN()[sc]||SCEN().low;
      const blink=rnd(cfg.blink[0],cfg.blink[1],0),pupil=rnd(cfg.pupil[0],cfg.pupil[1],1);
      const gaze=rnd(cfg.gaze[0],cfg.gaze[1],0),stab=rnd(cfg.stab[0],cfg.stab[1],2);
      const pct=rnd(cfg.pct[0],cfg.pct[1],0);
      setMetrics({blink,pupil,gaze:gaze+'°',stab,pct,color:cfg.color,label:cfg.label,hint:cfg.hint});
      setTimelineData(prev=>{const next=[...prev,{t:prev.length,pct,color:cfg.color}];return next.slice(-60);});
      setSessData(prev=>[...prev,{blink,pupil,gaze,stab,pct,sc}]);
    },1000);
  };

  const stop=()=>{
    setActive(false);clearInterval(simRef.current);clearInterval(timerRef.current);
    setCanSave(sessData.length>0);
  };

  const save=()=>{
    const pcts=sessData.map(d=>d.pct),blinks=sessData.map(d=>d.blink),pupils=sessData.map(d=>d.pupil);
    const ap=avg(pcts);
    saveSession({duration:timer,avgStress:ap.toFixed(1),peakLevel:ap<40?'Low':ap<65?'Medium':'High',avgBlink:avg(blinks).toFixed(1),avgPupil:avg(pupils).toFixed(2)});
    setCanSave(false);
  };

  useEffect(()=>()=>{clearInterval(simRef.current);clearInterval(timerRef.current);},[]);

  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const off=377-(metrics.pct/100)*377;

  return(
    <div>
      <PageHeader title="Live Eye Monitor" sub="Webcam feed · CNN-LSTM inference · eye metric simulation from Dataset Editor ranges">
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontFamily:'Space Mono',fontSize:14,color:'#8892a4'}}>{fmt(timer)}</span>
          <button onClick={active?stop:start} style={{...btnStyle(active?'err':'ok')}}>
            {active?'⏹ Stop':'▶ Start Session'}
          </button>
          <button onClick={save} disabled={!canSave} style={{...btnStyle('neutral'),opacity:canSave?1:.4}}>💾 Save &amp; Sync</button>
        </div>
      </PageHeader>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        {/* Left */}
        <div>
          <div style={{background:'#000',borderRadius:12,border:'1px solid rgba(255,255,255,.08)',position:'relative',aspectRatio:'4/3',overflow:'hidden',marginBottom:14}}>
            <IROverlay active={active}/>
            <div style={{position:'absolute',top:12,left:'50%',transform:'translateX(-50%)',background:'rgba(0,0,0,.7)',border:'1px solid rgba(255,255,255,.15)',fontFamily:'Space Mono',fontSize:10,color:active?COLORS.low:'#5a6478',padding:'3px 10px',borderRadius:4,whiteSpace:'nowrap'}}>
              {active?'IR EYE TRACKING · LIVE':'AWAITING SESSION'}
            </div>
            <div style={{position:'absolute',bottom:12,right:12,background:'rgba(0,0,0,.7)',fontFamily:'Space Mono',fontSize:10,color:'#5a6478',padding:'3px 8px',borderRadius:4}}>
              {active?`${ds.fps} FPS (sim)`:'-- FPS'}
            </div>
            <div style={{position:'absolute',top:12,left:12,display:'flex',alignItems:'center',gap:5,background:'rgba(0,0,0,.7)',fontFamily:'Space Mono',fontSize:10,padding:'3px 8px',borderRadius:4}}>
              <LiveDot active={active}/><span style={{color:active?COLORS.low:'#5a6478'}}>{active?'ACTIVE':'IDLE'}</span>
            </div>
          </div>
          <Card title="Stress timeline · live session">
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={timelineData}>
                <XAxis dataKey="t" hide/>
                <YAxis domain={[0,100]} tick={{fill:'#5a6478',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>v+'%'}/>
                <Line type="monotone" dataKey="pct" stroke={metrics.color} dot={false} strokeWidth={2} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
        {/* Right */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'#8892a4',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>
              Eye metrics · real-time (ranges from Dataset Editor)
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[['Blink Rate','blink',COLORS.low,'blinks/min'],['Pupil Size','pupil',COLORS.blu,'calibrated px'],['Gaze Dir','gaze',COLORS.med,'angular °'],['Gaze Stab','stab',COLORS.pur,'std dev σ']].map(([label,key,color,unit])=>(
                <div key={key} style={{background:'#151920',border:'1px solid rgba(255,255,255,.06)',borderRadius:10,padding:14,borderTop:`1px solid ${color}`}}>
                  <div style={{fontSize:10,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>{label}</div>
                  <div style={{fontFamily:'Space Mono',fontSize:22,fontWeight:700,color,lineHeight:1}}>{metrics[key]}</div>
                  <div style={{fontSize:10,color:'#5a6478',marginTop:3}}>{unit}</div>
                </div>
              ))}
            </div>
          </div>
          <Card>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:'8px 0'}}>
              <div style={{position:'relative',width:140,height:140}}>
                <svg width="140" height="140" viewBox="0 0 140 140" style={{transform:'rotate(-90deg)'}}>
                  <circle cx="70" cy="70" r="56" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10"/>
                  <circle cx="70" cy="70" r="56" fill="none" stroke={metrics.color} strokeWidth="10"
                    strokeLinecap="round" strokeDasharray="352" strokeDashoffset={off}
                    style={{transition:'stroke-dashoffset .8s ease,stroke .5s'}}/>
                </svg>
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                  <div style={{fontFamily:'Space Mono',fontSize:24,fontWeight:700,color:metrics.color}}>{metrics.pct}%</div>
                  <div style={{fontSize:11,color:'#5a6478'}}>Stress</div>
                </div>
              </div>
              <div style={{textAlign:'center',padding:'10px 16px',borderRadius:10,border:'1px solid rgba(255,255,255,.08)',width:'100%'}}>
                <div style={{fontFamily:'Space Mono',fontSize:15,fontWeight:700,color:metrics.color,letterSpacing:'.05em'}}>{metrics.label}</div>
                <div style={{fontSize:12,color:'#8892a4',marginTop:4,lineHeight:1.5}}>{metrics.hint}</div>
              </div>
            </div>
          </Card>
          <Card title="Scenario controls">
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
              {[['low','😌 Low'],['med','😐 Medium'],['hi','😰 High'],['auto','🔀 Auto']].map(([k,label])=>(
                <button key={k} onClick={()=>setScen(k)} style={{...btnStyle('neutral'),borderColor:scen===k?COLORS.low:'rgba(255,255,255,.12)',color:scen===k?COLORS.low:'#8892a4'}}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{fontSize:12,color:'#8892a4',lineHeight:1.6}}>
              💡 Eye ranges come from <strong style={{color:COLORS.low}}>Dataset Editor → Eye Features</strong>. Change them there and the simulation here updates immediately for all users.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── IR OVERLAY (pure canvas animation) ───
function IROverlay({active}){
  const canvasRef=useRef(null);
  const rafRef=useRef(null);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const draw=()=>{
      canvas.width=canvas.offsetWidth||640;canvas.height=canvas.offsetHeight||480;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if(!active){ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(0,0,canvas.width,canvas.height);rafRef.current=requestAnimationFrame(draw);return;}
      ctx.fillStyle='rgba(0,25,12,.2)';ctx.fillRect(0,0,canvas.width,canvas.height);
      const cx=canvas.width/2,cy=canvas.height/2,t=Date.now()/1000;
      const sy=((Date.now()/12)%canvas.height);
      const g=ctx.createLinearGradient(0,sy-30,0,sy+30);
      g.addColorStop(0,'rgba(0,245,160,0)');g.addColorStop(.5,'rgba(0,245,160,.05)');g.addColorStop(1,'rgba(0,245,160,0)');
      ctx.fillStyle=g;ctx.fillRect(0,sy-30,canvas.width,60);
      const r=28+Math.sin(t*2)*3;
      ctx.strokeStyle='rgba(0,245,160,.65)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='rgba(0,245,160,.35)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(cx-55,cy);ctx.lineTo(cx+55,cy);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy-55);ctx.lineTo(cx,cy+55);ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle='rgba(0,245,160,.45)';ctx.lineWidth=1.5;ctx.strokeRect(cx-52,cy-32,104,64);
      const gx=cx+Math.sin(t*.7)*18,gy=cy+Math.cos(t*.9)*11;
      ctx.fillStyle='rgba(79,142,247,.85)';ctx.beginPath();ctx.arc(gx,gy,4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(0,245,160,.7)';ctx.font='9px Space Mono,monospace';
      ctx.fillText('ROI',cx-52,cy-36);ctx.fillText(`PUPIL Ø${(r).toFixed(1)}px`,cx+r+5,cy+4);
      ['tl','tr','bl','br'].forEach((pos)=>{
        const x=pos.includes('l')?12:canvas.width-28,y=pos.includes('t')?12:canvas.height-28;
        ctx.strokeStyle='rgba(0,245,160,.6)';ctx.lineWidth=2;ctx.beginPath();
        if(pos==='tl'){ctx.moveTo(x,y+16);ctx.lineTo(x,y);ctx.lineTo(x+16,y);}
        if(pos==='tr'){ctx.moveTo(x,y);ctx.lineTo(x+16,y);ctx.moveTo(x+16,y);ctx.lineTo(x+16,y+16);}
        if(pos==='bl'){ctx.moveTo(x,y);ctx.lineTo(x,y+16);ctx.moveTo(x,y+16);ctx.lineTo(x+16,y+16);}
        if(pos==='br'){ctx.moveTo(x+16,y);ctx.lineTo(x+16,y+16);ctx.lineTo(x,y+16);}
        ctx.stroke();
      });
      rafRef.current=requestAnimationFrame(draw);
    };
    draw();
    return()=>cancelAnimationFrame(rafRef.current);
  },[active]);
  return<canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}/>;
}

// ─── SESSIONS PAGE ───
function SessionsPage({sessions,clearSessions,showToast}){
  const exportCSV=()=>{
    if(!sessions.length){showToast('No sessions to export','warn');return;}
    const rows=['User,Date,Duration,Avg Stress %,Peak Level,Avg Blink,Avg Pupil'];
    sessions.forEach((s,i)=>rows.push(`${s.user||'?'},"${s.date}","${Math.floor(s.duration/60)}m ${s.duration%60}s",${s.avgStress},${s.peakLevel},${s.avgBlink},${s.avgPupil}`));
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));a.download='StressEye_Sessions_Shared.csv';a.click();
    showToast('⬇ Shared sessions exported','ok');
  };
  if(!sessions.length){
    const chipColor=l=>l==='Low'?COLORS.low:l==='Medium'?COLORS.med:COLORS.hi;
    return(
      <div>
        <PageHeader title="Recorded Sessions" sub="All sessions from all users · shared storage · auto-refreshes every 4s"/>
        <Card><div style={{textAlign:'center',padding:40,color:'#5a6478'}}>No sessions recorded yet. Go to Live Monitor → Start Session → Save &amp; Sync.</div></Card>
      </div>
    );
  }
  const chipColor=l=>l==='Low'?COLORS.low:l==='Medium'?COLORS.med:COLORS.hi;
  const stats={total:sessions.length,avgStress:(avg(sessions.map(s=>parseFloat(s.avgStress)))).toFixed(1),lo:sessions.filter(s=>s.peakLevel==='Low').length,me:sessions.filter(s=>s.peakLevel==='Medium').length,hi:sessions.filter(s=>s.peakLevel==='High').length};
  return(
    <div>
      <PageHeader title="Recorded Sessions" sub={`${sessions.length} sessions from all users · shared · auto-synced`}>
        <div style={{display:'flex',gap:8}}>
          <button onClick={exportCSV} style={btnStyle('neutral')}>⬇ Export CSV</button>
          <button onClick={clearSessions} style={btnStyle('err')}>🗑 Clear All (for everyone)</button>
        </div>
      </PageHeader>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:16}}>
        <KPI color={COLORS.low} label="Total Sessions" val={stats.total}/>
        <KPI color={COLORS.blu} label="Avg Stress" val={stats.avgStress+'%'}/>
        <KPI color={COLORS.low} label="Low Sessions" val={stats.lo}/>
        <KPI color={COLORS.med} label="Medium Sessions" val={stats.me}/>
        <KPI color={COLORS.hi} label="High Sessions" val={stats.hi}/>
      </div>
      <Card>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr>{['#','User','Date','Duration','Avg Stress','Peak Level','Avg Blink','Avg Pupil'].map(h=>(
            <th key={h} style={{textAlign:'left',padding:'10px 12px',fontSize:11,fontWeight:700,color:'#5a6478',textTransform:'uppercase',letterSpacing:'.06em',borderBottom:'1px solid rgba(255,255,255,.06)'}}>{h}</th>
          ))}</tr></thead>
          <tbody>{sessions.map((s,i)=>(
            <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,.04)'}}>
              <td style={{padding:'11px 12px',fontFamily:'Space Mono',color:'#5a6478'}}>{i+1}</td>
              <td style={{padding:'11px 12px'}}><span style={{background:'rgba(0,245,160,.1)',color:COLORS.low,padding:'2px 8px',borderRadius:4,fontSize:11,fontFamily:'Space Mono'}}>{s.user||'?'}</span></td>
              <td style={{padding:'11px 12px',fontSize:12}}>{s.date}</td>
              <td style={{padding:'11px 12px',fontFamily:'Space Mono'}}>{Math.floor(s.duration/60)}m {s.duration%60}s</td>
              <td style={{padding:'11px 12px',fontFamily:'Space Mono'}}>{s.avgStress}%</td>
              <td style={{padding:'11px 12px'}}><span style={{background:`${chipColor(s.peakLevel)}20`,color:chipColor(s.peakLevel),padding:'2px 8px',borderRadius:4,fontSize:11,fontFamily:'Space Mono',fontWeight:700}}>{s.peakLevel}</span></td>
              <td style={{padding:'11px 12px',fontFamily:'Space Mono'}}>{s.avgBlink}/min</td>
              <td style={{padding:'11px 12px',fontFamily:'Space Mono'}}>{s.avgPupil}px</td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── ACTIVITY PAGE ───
function ActivityPage({activity}){
  return(
    <div>
      <PageHeader title="Live Activity Feed" sub="Every action by every connected user · real-time · last 50 events"/>
      <Card>
        {activity.length===0?<div style={{textAlign:'center',padding:40,color:'#5a6478'}}>No activity yet. Actions from any user will appear here.</div>:(
          <div style={{display:'flex',flexDirection:'column',gap:0}}>
            {activity.map((a,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:i<activity.length-1?'1px solid rgba(255,255,255,.05)':'none'}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(0,245,160,.1)',border:'1px solid rgba(0,245,160,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:COLORS.low,flexShrink:0}}>
                  {a.user.charAt(0).toUpperCase()}
                </div>
                <div style={{flex:1}}>
                  <span style={{color:COLORS.low,fontWeight:600,fontSize:13}}>{a.user}</span>
                  <span style={{color:'#8892a4',fontSize:13}}> · {a.action}</span>
                  {a.detail&&<span style={{color:'#5a6478',fontSize:12}}> — {a.detail}</span>}
                </div>
                <div style={{fontFamily:'Space Mono',fontSize:11,color:'#5a6478',flexShrink:0}}>{a.time}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── CHAT PAGE ───
function ChatPage({chat,sendChat,userName}){
  const [input,setInput]=useState('');
  const bottomRef=useRef(null);
  useEffect(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),[chat]);
  const send=()=>{if(!input.trim())return;sendChat(input);setInput('');};
  return(
    <div>
      <PageHeader title="Team Chat" sub="Real-time messaging · all users see messages instantly"/>
      <Card>
        <div style={{height:360,overflowY:'auto',display:'flex',flexDirection:'column',gap:8,padding:'4px 0',marginBottom:12}}>
          {chat.length===0&&<div style={{textAlign:'center',padding:40,color:'#5a6478'}}>No messages yet. Say hello!</div>}
          {chat.map((m,i)=>{
            const isMe=m.user===userName;
            return(
              <div key={i} style={{display:'flex',flexDirection:isMe?'row-reverse':'row',gap:8,alignItems:'flex-end'}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:isMe?'rgba(0,245,160,.15)':'rgba(79,142,247,.15)',border:`1px solid ${isMe?'rgba(0,245,160,.3)':'rgba(79,142,247,.3)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:isMe?COLORS.low:COLORS.blu,flexShrink:0}}>
                  {m.user.charAt(0).toUpperCase()}
                </div>
                <div style={{maxWidth:'70%'}}>
                  <div style={{fontSize:10,color:'#5a6478',marginBottom:3,textAlign:isMe?'right':'left',fontFamily:'Space Mono'}}>{m.user} · {m.time}</div>
                  <div style={{background:isMe?'rgba(0,245,160,.1)':'#151920',border:`1px solid ${isMe?'rgba(0,245,160,.2)':'rgba(255,255,255,.08)'}`,borderRadius:10,padding:'8px 12px',fontSize:13,color:'#e8edf5',lineHeight:1.5}}>
                    {m.msg}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef}/>
        </div>
        <div style={{display:'flex',gap:8}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
            placeholder="Type a message and press Enter..."
            style={{flex:1,background:'#151920',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,padding:'10px 14px',color:'#e8edf5',fontSize:13,outline:'none',fontFamily:'Space Mono'}}/>
          <button onClick={send} style={btnStyle('ok')}>Send →</button>
        </div>
      </Card>
    </div>
  );
}

// ─── ABOUT PAGE ───
function AboutPage(){
  return(
    <div>
      <PageHeader title="About This Project" sub="Stress Level Detection Using Eye Tracking in VR Phone Headset · May 2026"/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <Card title="Team">
          {[['👩','Karthika G S','23CSR041','rgba(0,245,160,.1)','rgba(0,245,160,.3)',COLORS.low],['👨','Kavin S','23CSR043','rgba(79,142,247,.1)','rgba(79,142,247,.3)',COLORS.blu],['👨','Mohamedsalmankan S','23CSR052','rgba(245,166,35,.1)','rgba(245,166,35,.3)',COLORS.med]].map(([ic,name,id,bg,border,col])=>(
            <div key={id} style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
              <div style={{width:42,height:42,borderRadius:10,background:bg,border:`1px solid ${border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{ic}</div>
              <div><div style={{fontWeight:700,color:'#e8edf5'}}>{name}</div><div style={{fontSize:12,color:'#5a6478',fontFamily:'Space Mono'}}>{id}</div></div>
            </div>
          ))}
          <div style={{paddingTop:12,borderTop:'1px solid rgba(255,255,255,.06)',fontSize:13,color:'#8892a4',lineHeight:1.9}}>
            <div>🏛 Velalar College of Engineering &amp; Technology</div>
            <div>📍 Erode – 638012, Tamil Nadu</div>
            <div>📅 B.E. Computer Science · May 2026</div>
            <div>👩‍🏫 Guide: Ms. M. Nanthini, M.E.</div>
            <div>👩‍💼 HoD: Dr. S. Jabeen Begum, M.E., Ph.D.</div>
          </div>
        </Card>
        <Card title="Abstract">
          <div style={{fontSize:13,color:'#8892a4',lineHeight:1.85}}>
            A contactless, non-intrusive, low-cost solution for real-time stress detection based on eye metrics, implemented on an affordable VR phone headset.<br/><br/>
            Five-stage pipeline: IR capture → pre-processing (CLAHE, Gaussian) → feature extraction (blink rate, pupil size, gaze direction, gaze stability) → CNN-LSTM classification → AR visualization.<br/><br/>
            Achieves <strong style={{color:COLORS.low}}>92.4% overall accuracy</strong> across Low/Medium/High stress levels with <strong style={{color:COLORS.blu}}>&lt;20ms inference latency</strong> on Raspberry Pi 4.
          </div>
        </Card>
      </div>
      <Card title="System Pipeline">
        <div style={{display:'flex',alignItems:'center',overflowX:'auto',paddingBottom:4,gap:0}}>
          {[['📡','IR Capture','60 FPS · VR headset'],['⚙️','Pre-process','CLAHE · Gaussian · ROI'],['👁','Feature Extract','Blink · Pupil · Gaze'],['🧠','CNN-LSTM','TF Lite · Pi4 edge'],['📱','AR Display','Flask · Unity AR']].map(([ic,title,sub],i,arr)=>(
            <>
              <div style={{flex:1,textAlign:'center',padding:'14px 8px',background:'#151920',borderRadius:i===0?'10px 0 0 10px':i===arr.length-1?'0 10px 10px 0':0,border:'1px solid rgba(255,255,255,.07)',minWidth:110,borderLeft:i>0?'none':undefined}}>
                <div style={{fontSize:22,marginBottom:6}}>{ic}</div>
                <div style={{fontSize:13,fontWeight:700,color:'#e8edf5'}}>{title}</div>
                <div style={{fontSize:11,color:'#5a6478',marginTop:3}}>{sub}</div>
              </div>
              {i<arr.length-1&&<div style={{color:'#5a6478',padding:'0 4px',fontSize:20,flexShrink:0}}>›</div>}
            </>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── HELPERS ───
function PageHeader({title,sub,children}){
  return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:22,flexWrap:'wrap',gap:10}}>
      <div>
        <div style={{fontSize:21,fontWeight:800,letterSpacing:'-.3px',color:'#e8edf5'}}>{title}</div>
        {sub&&<div style={{fontSize:13,color:'#8892a4',marginTop:3}}>{sub}</div>}
      </div>
      {children&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{children}</div>}
    </div>
  );
}

function Card({title,children}){
  return(
    <div style={{background:'#0e1117',border:'1px solid rgba(255,255,255,.07)',borderRadius:14,padding:'20px 22px',marginBottom:0}}>
      {title&&<div style={{fontSize:11,fontWeight:700,color:'#8892a4',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:14}}>{title}</div>}
      {children}
    </div>
  );
}

function KPI({color,label,val,delta}){
  return(
    <div style={{background:'#0e1117',border:'1px solid rgba(255,255,255,.07)',borderRadius:12,padding:'16px 18px',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:color,borderRadius:'12px 12px 0 0'}}/>
      <div style={{fontFamily:'Space Mono',fontSize:22,fontWeight:700,color,lineHeight:1,marginBottom:5}}>{val}</div>
      <div style={{fontSize:12,color:'#8892a4'}}>{label}</div>
      {delta&&<div style={{fontSize:11,color:COLORS.low,marginTop:4}}>{delta}</div>}
    </div>
  );
}

function btnStyle(type){
  const map={ok:{background:COLORS.low,borderColor:COLORS.low,color:'#000'},err:{background:'rgba(247,79,79,.15)',borderColor:COLORS.hi,color:COLORS.hi},warn:{background:'rgba(245,166,35,.15)',borderColor:COLORS.med,color:COLORS.med},neutral:{background:'transparent',borderColor:'rgba(255,255,255,.12)',color:'#8892a4'}};
  return{...map[type]||map.neutral,border:'1px solid',borderRadius:8,padding:'8px 14px',cursor:'pointer',fontSize:12,fontFamily:'Space Mono',fontWeight:400,transition:'all .2s'};
}
