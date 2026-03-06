// @ts-nocheck
"use client"
// @ts-nocheck
"use client"
import { useState, useEffect, useRef, useMemo } from "react"

const C = {
  pageBg:"#EDECEA", card:"#FFFFFF", border:"#E2E0DB",
  text:"#1C1F2E", sub:"#6B7080", muted:"#AAADBA",
  sidebar:"#13162B",
  blue:"#4A6EF0", green:"#2DC98A", amber:"#E09030",
  red:"#E05060", purple:"#8050D8", pink:"#D04090", teal:"#20A8A0",
}
const RANK_COLORS = { S:C.amber, A:C.green, B:C.blue, C:C.muted, D:"#BBBBBB" }

// JST helpers
function jstNow() { return new Date(Date.now() + 9*3600*1000) }
function jstDateStr() { return jstNow().toISOString().slice(0,10) }
function jstHour() { return jstNow().getUTCHours() }

function fmt(n) {
  if (!n && n!==0) return "—"
  if (n>=10000) return `${(n/10000).toFixed(1)}万`
  if (n>=1000)  return `${(n/1000).toFixed(1)}k`
  return String(n)
}
function dayLabel(ds) {
  if (!ds) return ""
  const d = new Date(ds+"T00:00:00")
  return `${d.getMonth()+1}/${d.getDate()}(${"日月火水木金土"[d.getDay()]})`
}
function weekStart(ds) {
  const d = new Date(ds+"T00:00:00")
  d.setDate(d.getDate()-((d.getDay()+6)%7))
  return d.toISOString().slice(0,10)
}

// Web Audio — 3-tone ascending beep
function playBeep() {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)()
    ;[[880,0],[1100,.18],[1320,.36]].forEach(([f,t])=>{
      const o=ctx.createOscillator(), g=ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value=f; o.type="sine"
      g.gain.setValueAtTime(0.3, ctx.currentTime+t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+t+0.2)
      o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+0.25)
    })
  } catch(e) {}
}

// ── API helper ────────────────────────────────────────────────
async function api(path, method='GET', body=null) {
  try {
    const opts = { method, headers:{'Content-Type':'application/json'} }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(path, opts)
    if (!res.ok) return null
    return await res.json()
  } catch(e) { return null }
}

// ── DEFAULTS ──────────────────────────────────────────────────
const DEFAULT_ACTION_ITEMS = [
  { id:"a1", label:"リプライ", color:C.amber,  target:30 },
  { id:"a2", label:"引用",     color:C.pink,   target:5  },
  { id:"a3", label:"投稿",     color:C.green,  target:3  },
  { id:"a4", label:"記事投稿", color:C.purple, target:1  },
]
const DEFAULT_KPI_ITEMS = [
  { id:"k1", label:"インプレッション", unit:"回", daily_target:10000, monthly_target:300000, color:C.blue,   analyticsKey:"impressions" },
  { id:"k2", label:"フォロワー増",     unit:"人", daily_target:10,    monthly_target:200,    color:C.green,  analyticsKey:"net_follows" },
  { id:"k3", label:"プロフィール訪問", unit:"回", daily_target:500,   monthly_target:15000,  color:C.purple, analyticsKey:"profile_visits" },
]
const DEFAULT_SETTINGS = {
  soundEnabled: true,
  resetHour: 0,
  sessionTarget: 3,
  postLabels: ["引用","図解","長文","記事","フック","ストーリー","リスト","共感","日常"],
  ruleCategories: ["フック構成","投稿タイミング","画像・図解","リプライ","引用","文章スタイル","その他"],
}

// ── SAMPLE DATA ───────────────────────────────────────────────
const INIT_TODAY = jstDateStr()
const SAMPLE_ACTIONS = [
  { id:1, date:INIT_TODAY,   a1:8,  a2:3, a3:2, a4:0, sessions:1, focus_min:25 },
  { id:2, date:"2026-03-05", a1:12, a2:5, a3:3, a4:1, sessions:2, focus_min:50 },
  { id:3, date:"2026-03-04", a1:7,  a2:2, a3:1, a4:0, sessions:1, focus_min:25 },
  { id:4, date:"2026-03-03", a1:15, a2:6, a3:4, a4:1, sessions:3, focus_min:75 },
  { id:5, date:"2026-02-28", a1:5,  a2:8, a3:1, a4:1, sessions:2, focus_min:50 },
  { id:6, date:"2026-02-27", a1:13, a2:5, a3:1, a4:0, sessions:3, focus_min:75 },
]
const SAMPLE_POSTS = [
  { id:1, date:"2026-03-05", url:"https://x.com/ex/1", title:"バズったフック構成、冒頭3行が命", labels:["フック","長文"], rank:"S", type:"own", memo:"冒頭で疑問を作ることで読み進めさせる構成が機能した。数字＋逆張りが鍵。", impressions:48200, likes:312 },
  { id:2, date:"2026-03-04", url:"https://x.com/ex/2", title:"図解ポスト「睡眠の質を上げる7つのルール」", labels:["図解","リスト"], rank:"A", type:"own", memo:"図解は保存率が高い。情報密度が高すぎると離脱する。", impressions:22800, likes:156 },
  { id:3, date:"2026-03-03", url:"https://x.com/ex/3", title:"引用リポスト戦略まとめ", labels:["引用"], rank:"B", type:"research", memo:"タイミングと相手選びが重要。フォロワーが多い人への引用が効果的。", impressions:11200, likes:78 },
  { id:4, date:"2026-03-01", url:"https://x.com/ex/4", title:"失敗談ストーリー「半年で挫折した話」", labels:["ストーリー","共感"], rank:"A", type:"own", memo:"弱さを見せることで信頼が生まれる。リプライ数が通常の3倍。", impressions:19500, likes:201 },
  { id:5, date:"2026-02-27", url:"https://x.com/ex/5", title:"リスト型「継続できる人の習慣7選」", labels:["リスト","共感"], rank:"A", type:"own", memo:"リスト型は安定してインプレが取れる。", impressions:16200, likes:132 },
]
const SAMPLE_ANALYTICS = [
  { id:1, date:INIT_TODAY,   impressions:48200, followers:1842, profile_visits:234, new_follows:18, unfollows:5 },
  { id:2, date:"2026-03-05", impressions:31500, followers:1829, profile_visits:189, new_follows:12, unfollows:8 },
  { id:3, date:"2026-03-04", impressions:22800, followers:1825, profile_visits:156, new_follows:9,  unfollows:3 },
]
const SAMPLE_REVIEWS = [
  { id:1, week_start:"2026-03-02", memo:"引用のタイミングが改善できた週。ただし図解の量が少なかった。", next_goal:"図解を週3本作る" },
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Card({ children, style={} }) {
  return <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, ...style }}>{children}</div>
}
function SLabel({ children }) {
  return <p style={{ color:C.muted, fontSize:10, fontWeight:700, letterSpacing:1.5, margin:"0 0 10px", textTransform:"uppercase" }}>{children}</p>
}
function Btn({ children, onClick, variant="primary", small=false, disabled=false, style={} }) {
  const cv = {
    primary:{ background:C.blue, color:"#fff" },
    ghost:  { background:"transparent", border:`1px solid ${C.border}`, color:C.sub },
    danger: { background:C.red, color:"#fff" },
  }
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"inline-flex", alignItems:"center", gap:5, border:"none", borderRadius:8,
        cursor:disabled?"not-allowed":"pointer", fontSize:small?12:13, fontWeight:600, fontFamily:"inherit",
        padding:small?"5px 12px":"8px 18px", opacity:disabled?0.4:1, transition:"opacity 0.15s",
        ...cv[variant], ...style }}>
      {children}
    </button>
  )
}
function PBar({ value, max, color=C.blue, h=5 }) {
  const pct = max>0 ? Math.min(value/max*100,100) : 0
  return (
    <div style={{ background:C.border, borderRadius:3, height:h, overflow:"hidden" }}>
      <div style={{ width:`${pct}%`, height:"100%", background:pct>=100?C.green:color, transition:"width 0.4s ease", borderRadius:3 }}/>
    </div>
  )
}
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:300, padding:16 }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, width:"100%", maxWidth:520, maxHeight:"90vh", overflow:"auto", padding:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ color:C.text, fontSize:15, fontWeight:800 }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:22, lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
const IS = { background:C.pageBg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"8px 12px", fontSize:13, outline:"none", fontFamily:"inherit", width:"100%", boxSizing:"border-box" }
function Field({ label, children }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      {label && <label style={{ color:C.sub, fontSize:11, fontWeight:700 }}>{label}</label>}
      {children}
    </div>
  )
}
function Chip({ label, active, color=C.blue, onClick }) {
  return (
    <button onClick={onClick} style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600,
      cursor:"pointer", border:`1px solid ${active?color:C.border}`,
      background:active?`${color}18`:"transparent", color:active?color:C.sub,
      fontFamily:"inherit", transition:"all 0.12s" }}>
      {label}
    </button>
  )
}
function Toggle({ value, onChange }) {
  return (
    <button onClick={()=>onChange(!value)} style={{ width:44, height:24, borderRadius:12,
      background:value?C.blue:C.border, border:"none", cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
      <span style={{ position:"absolute", top:2, left:value?22:2, width:20, height:20, borderRadius:10,
        background:"white", transition:"left 0.2s" }}/>
    </button>
  )
}
function CopyMemoBtn({ posts }) {
  const [copied, setCopied] = useState(false)
  const has = posts.filter(p=>p.memo?.trim())
  if (!has.length) return null
  function copy() {
    const txt = has.map(p=>`${p.date} [${p.rank}] ${p.title}${p.labels.length?` (${p.labels.join(", ")})`:""}
${p.memo}`).join("\n\n---\n\n")
    navigator.clipboard.writeText(txt).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000) })
  }
  return (
    <button onClick={copy} style={{ display:"inline-flex", alignItems:"center", gap:4,
      background:copied?`${C.green}18`:C.pageBg, border:`1px solid ${copied?C.green:C.border}`,
      borderRadius:7, padding:"3px 10px", fontSize:11, fontWeight:600, color:copied?C.green:C.muted,
      cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}>
      {copied?"✓ コピー完了":"メモを一括コピー"}
    </button>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETTINGS MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SettingsModal({ settings, setSettings, onClose }) {
  const [s, setS] = useState({
    ...settings,
    postLabels: [...settings.postLabels],
    ruleCategories: [...(settings.ruleCategories || DEFAULT_SETTINGS.ruleCategories)],
  })
  const [newLabel, setNewLabel]   = useState("")
  const [newCat,   setNewCat]     = useState("")

  function addLabel() { const t=newLabel.trim(); if(t&&!s.postLabels.includes(t)) setS(x=>({...x,postLabels:[...x.postLabels,t]})); setNewLabel("") }
  function removeLabel(l) { setS(x=>({...x,postLabels:x.postLabels.filter(p=>p!==l)})) }
  function addCat() { const t=newCat.trim(); if(t&&!s.ruleCategories.includes(t)) setS(x=>({...x,ruleCategories:[...x.ruleCategories,t]})); setNewCat("") }
  function removeCat(c) { setS(x=>({...x,ruleCategories:x.ruleCategories.filter(p=>p!==c)})) }

  return (
    <Modal title="設定" onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:22 }}>

        {/* タイマー */}
        <div>
          <SLabel>タイマー</SLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <p style={{ color:C.text, fontSize:13, margin:"0 0 2px" }}>終了時に音を鳴らす</p>
                <p style={{ color:C.muted, fontSize:11, margin:0 }}>3音の上昇トーン</p>
              </div>
              <Toggle value={s.soundEnabled} onChange={v=>setS(x=>({...x,soundEnabled:v}))}/>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <p style={{ color:C.text, fontSize:13, margin:0 }}>1日のセッション目標</p>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <input type="number" min={1} value={s.sessionTarget}
                  onChange={e=>setS(x=>({...x,sessionTarget:Math.max(1,+e.target.value)}))}
                  style={{ ...IS, width:56, textAlign:"center" }}/>
                <span style={{ color:C.muted, fontSize:12 }}>回</span>
              </div>
            </div>
          </div>
        </div>

        {/* デイリーリセット */}
        <div>
          <SLabel>デイリーリセット</SLabel>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <p style={{ color:C.text, fontSize:13, margin:"0 0 3px" }}>リセット時刻（JST）</p>
              <p style={{ color:C.muted, fontSize:11, margin:0 }}>この時刻以降に日付が変わったとき新しい日として記録します</p>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:12, flexShrink:0 }}>
              <input type="number" min={0} max={23} value={s.resetHour}
                onChange={e=>setS(x=>({...x,resetHour:Math.min(23,Math.max(0,+e.target.value))}))}
                style={{ ...IS, width:56, textAlign:"center" }}/>
              <span style={{ color:C.muted, fontSize:12 }}>時</span>
            </div>
          </div>
        </div>

        {/* ポストのラベル */}
        <div>
          <SLabel>ポストのラベル</SLabel>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
            {s.postLabels.map(l=>(
              <span key={l} style={{ display:"inline-flex", alignItems:"center", gap:4,
                background:`${C.blue}12`, color:C.blue, border:`1px solid ${C.blue}25`,
                borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600 }}>
                {l}
                <button onClick={()=>removeLabel(l)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:0, fontSize:13, lineHeight:1 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...IS, flex:1 }} value={newLabel}
              onChange={e=>setNewLabel(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addLabel()}
              placeholder="ラベルを追加（Enterで確定）"/>
            <Btn small onClick={addLabel} disabled={!newLabel.trim()}>追加</Btn>
          </div>
        </div>

        {/* ナレッジカテゴリ */}
        <div>
          <SLabel>ナレッジ カテゴリ</SLabel>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
            {s.ruleCategories.map(c=>(
              <span key={c} style={{ display:"inline-flex", alignItems:"center", gap:4,
                background:`${C.purple}12`, color:C.purple, border:`1px solid ${C.purple}25`,
                borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600 }}>
                {c}
                <button onClick={()=>removeCat(c)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:0, fontSize:13, lineHeight:1 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input style={{ ...IS, flex:1 }} value={newCat}
              onChange={e=>setNewCat(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&addCat()}
              placeholder="カテゴリを追加（Enterで確定）"/>
            <Btn small onClick={addCat} disabled={!newCat.trim()}>追加</Btn>
          </div>
        </div>

        <Btn onClick={async()=>{ setSettings(s); onClose(); await api('/api/settings','PUT', s) }}>保存して閉じる</Btn>
      </div>
    </Modal>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRACKER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Tracker({ today, actions, setActions, posts, setPosts, actionItems, setActionItems, settings }) {
  const todayAct = actions.find(a=>a.date===today) || { date:today, sessions:0, focus_min:0 }

  const [timerMin, setTimerMin] = useState(5)
  const [editTime, setEditTime] = useState(false)
  const [seconds, setSeconds] = useState(300)
  const [running, setRunning] = useState(false)
  const totalRef = useRef(300)
  const timerRef = useRef(null)
  // mutable refs for timer callback — avoids stale closures
  const timerMinRef      = useRef(5)
  const todayRef         = useRef(today)
  const soundEnabledRef  = useRef(settings.soundEnabled)
  const actionItemsRef   = useRef(actionItems)
  const actionsRef        = useRef(actions)
  useEffect(()=>{ timerMinRef.current     = timerMin },      [timerMin])
  useEffect(()=>{ todayRef.current        = today },         [today])
  useEffect(()=>{ soundEnabledRef.current = settings.soundEnabled }, [settings.soundEnabled])
  useEffect(()=>{ actionItemsRef.current  = actionItems },   [actionItems])
  useEffect(()=>{ actionsRef.current      = actions },       [actions])

  const [focusMemo, setFocusMemo] = useState("今日の集中テーマを入力...")
  const [editMemo, setEditMemo] = useState(false)
  const [showPostForm, setShowPostForm] = useState(false)
  const [pf, setPf] = useState({ date:today, url:"", title:"", labels:[], rank:"B", type:"own", memo:"", impressions:"", likes:"" })
  const [showItemSettings, setShowItemSettings] = useState(false)
  const [editingItems, setEditingItems] = useState([])

  useEffect(()=>{
    if (running) {
      timerRef.current = setInterval(()=>{
        setSeconds(s=>{
          if (s<=1) {
            clearInterval(timerRef.current)
            setRunning(false)
            const t = todayRef.current
            setActions(as=>{
              const ex = as.find(a=>a.date===t)
              const ns = (ex?.sessions||0)+1
              const nf = (ex?.focus_min||0)+timerMinRef.current
              if (ex) return as.map(a=>a.date===t?{...a,sessions:ns,focus_min:nf}:a)
              const blank={}; actionItemsRef.current.forEach(i=>{blank[i.id]=0})
              return [{id:Date.now(),date:t,sessions:ns,focus_min:nf,...blank},...as]
            })
            // DB保存
            ;(async()=>{
              const currentAct = actionsRef.current.find(a=>a.date===t) || {date:t,sessions:0,focus_min:0}
              const ns=(currentAct.sessions||0)+1, nf=(currentAct.focus_min||0)+timerMinRef.current
              const saved = await api('/api/actions','POST',{...currentAct,sessions:ns,focus_min:nf})
              if (saved) setActions(as=>as.map(a=>a.date===t?{...a,id:saved.id}:a))
            })()
            if (soundEnabledRef.current) playBeep()
            return 0
          }
          return s-1
        })
      }, 1000)
    } else clearInterval(timerRef.current)
    return ()=>clearInterval(timerRef.current)
  }, [running])

  async function upsertAction(patch) {
    // 楽観的UI更新
    setActions(as=>{
      const ex=as.find(a=>a.date===today)
      if (ex) return as.map(a=>a.date===today?{...a,...patch}:a)
      const blank={}; actionItems.forEach(i=>{blank[i.id]=0})
      return [{id:Date.now(),date:today,sessions:0,focus_min:0,...blank,...patch},...as]
    })
    // DB保存（upsert by date）
    const current = actions.find(a=>a.date===today) || {date:today,sessions:0,focus_min:0}
    const merged = {...current,...patch}
    const saved = await api('/api/actions','POST', merged)
    if (saved) setActions(as=>as.map(a=>a.date===today?{...a,id:saved.id}:a))
  }
  function changeCount(id, delta) { upsertAction({[id]:Math.max(0,(todayAct[id]||0)+delta)}) }
  function pickTimer(m) { if(running)return; setTimerMin(m); setSeconds(m*60); totalRef.current=m*60; setEditTime(false) }
  function resetTimer() { setRunning(false); setSeconds(timerMin*60); totalRef.current=timerMin*60 }
  async function savePost() {
    const data={...pf,impressions:pf.impressions===""?null:+pf.impressions,likes:pf.likes===""?null:+pf.likes}
    const tempId = Date.now()
    setPosts(ps=>[{id:tempId,...data},...ps])
    setShowPostForm(false)
    setPf({date:today,url:"",title:"",labels:[],rank:"B",type:"own",memo:"",impressions:"",likes:""})
    const saved = await api('/api/posts','POST', data)
    if (saved) setPosts(ps=>ps.map(p=>p.id===tempId?saved:p))
  }

  const pct = totalRef.current>0?(1-seconds/totalRef.current)*100:0
  const r=70, circ=2*Math.PI*r
  const mins=Math.floor(seconds/60), secs=seconds%60
  const done=seconds===0
  const curSessions=todayAct.sessions||0
  const { sessionTarget } = settings

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Focus memo */}
      <Card style={{ padding:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <SLabel>TODAY'S FOCUS</SLabel>
          <button onClick={()=>setEditMemo(e=>!e)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>{editMemo?"完了":"編集"}</button>
        </div>
        {editMemo
          ? <textarea value={focusMemo} onChange={e=>setFocusMemo(e.target.value)} rows={3}
              style={{ ...IS, background:"transparent", border:`1px dashed ${C.border}`, resize:"none", fontSize:14, lineHeight:1.8 }}/>
          : <p style={{ color:C.text, fontSize:14, lineHeight:1.8, margin:0, whiteSpace:"pre-wrap" }}>{focusMemo}</p>
        }
      </Card>

      {/* Timer */}
      <Card style={{ padding:20 }}>
        <div style={{ display:"flex", gap:20, alignItems:"center" }}>
          {/* Circle */}
          <div style={{ position:"relative", width:160, height:160, flexShrink:0 }}>
            <svg width="160" height="160" style={{ transform:"rotate(-90deg)" }}>
              <circle cx="80" cy="80" r={r} fill="none" stroke={C.border} strokeWidth="5"/>
              <circle cx="80" cy="80" r={r} fill="none"
                stroke={done?C.green:running?C.blue:C.muted} strokeWidth="5"
                strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
                strokeLinecap="round" style={{ transition:"stroke-dashoffset 1s linear" }}/>
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
              {editTime
                ? <input type="number" value={timerMin}
                    onChange={e=>{const v=Math.max(1,+e.target.value);setTimerMin(v);setSeconds(v*60);totalRef.current=v*60}}
                    style={{ width:52, textAlign:"center", fontSize:26, fontWeight:800, background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, color:C.text, outline:"none", fontFamily:"monospace" }}/>
                : <span onClick={()=>!running&&setEditTime(true)}
                    style={{ fontSize:36, fontWeight:800, color:done?C.green:C.text, fontFamily:"monospace", letterSpacing:-2, cursor:running?"default":"pointer" }}>
                    {String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
                  </span>
              }
              {!editTime && <span style={{ color:C.muted, fontSize:9, letterSpacing:1, marginTop:3 }}>CLICK TO EDIT</span>}
            </div>
          </div>

          {/* Controls */}
          <div style={{ flex:1 }}>
            <SLabel>FOCUS SESSION</SLabel>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <button onClick={()=>setRunning(r=>!r)}
                style={{ display:"flex", alignItems:"center", gap:6, background:running?C.amber:C.blue, border:"none", color:"#fff", borderRadius:8, padding:"9px 18px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {running?"■ 停止":"▶ スタート"}
              </button>
              <button onClick={resetTimer}
                style={{ background:C.pageBg, border:`1px solid ${C.border}`, color:C.sub, borderRadius:8, padding:"9px 12px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>↺</button>
            </div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
              {[5,10,15,25,30].map(m=>(
                <button key={m} onClick={()=>pickTimer(m)}
                  style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600, cursor:running?"not-allowed":"pointer",
                    border:timerMin===m?"none":`1px solid ${C.border}`,
                    background:timerMin===m?C.blue:"transparent", color:timerMin===m?"#fff":C.sub,
                    fontFamily:"inherit", opacity:running&&timerMin!==m?0.4:1 }}>{m}分</button>
              ))}
            </div>
            {/* Sessions card */}
            <div style={{ background:C.pageBg, borderRadius:10, padding:"10px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:sessionTarget>0?6:0 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
                  <span style={{ color:C.muted, fontSize:9, letterSpacing:1, fontWeight:700 }}>SESSIONS</span>
                  {sessionTarget>0 && <span style={{ color:C.muted, fontSize:10 }}>/ {sessionTarget}</span>}
                </div>
                <span style={{ color:curSessions>=sessionTarget&&sessionTarget>0?C.green:C.text, fontSize:22, fontWeight:800, fontFamily:"monospace" }}>
                  {curSessions}
                </span>
              </div>
              {sessionTarget>0 && <PBar value={curSessions} max={sessionTarget} color={C.blue}/>}
              <p style={{ color:C.muted, fontSize:10, margin:"6px 0 0" }}>FOCUS {todayAct.focus_min||0}min</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Action counters */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <SLabel>ACTION COUNTERS</SLabel>
        <button onClick={()=>{setEditingItems(actionItems.map(i=>({...i})));setShowItemSettings(true)}}
          style={{ background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
          項目を編集
        </button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
        {actionItems.map(item=>{
          const val=todayAct[item.id]||0, hit=item.target>0&&val>=item.target
          return (
            <Card key={item.id} style={{ padding:"14px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <p style={{ color:C.sub, fontSize:11, fontWeight:700, margin:"0 0 8px" }}>{item.label}</p>
                  <span style={{ fontSize:42, fontWeight:900, color:hit?C.green:item.color, fontFamily:"monospace", lineHeight:1 }}>{val}</span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                  {item.target>0 && <span style={{ color:C.muted, fontSize:10 }}>目標 {item.target}/日</span>}
                  <button onClick={()=>changeCount(item.id,1)}
                    style={{ width:32, height:32, borderRadius:8, background:`${item.color}18`, border:`1px solid ${item.color}30`, color:item.color, fontSize:18, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                  <button onClick={()=>changeCount(item.id,-1)}
                    style={{ width:32, height:32, borderRadius:8, background:C.pageBg, border:`1px solid ${C.border}`, color:C.muted, fontSize:18, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                </div>
              </div>
              {item.target>0 && <div style={{ marginTop:10 }}><PBar value={val} max={item.target} color={item.color}/></div>}
            </Card>
          )
        })}
      </div>

      {/* Post register */}
      <Card style={{ padding:14, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <p style={{ color:C.text, fontSize:13, fontWeight:700, margin:"0 0 2px" }}>ポストを登録</p>
          <p style={{ color:C.muted, fontSize:11, margin:0 }}>今日の良いポストをストック</p>
        </div>
        <Btn onClick={()=>setShowPostForm(true)}>+ 登録</Btn>
      </Card>

      {/* Action item settings modal */}
      {showItemSettings && (
        <Modal title="アクション項目を編集" onClose={()=>setShowItemSettings(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {editingItems.map((item,i)=>(
              <div key={item.id} style={{ display:"grid", gridTemplateColumns:"1fr 80px 24px", gap:8, alignItems:"center" }}>
                <input style={IS} value={item.label}
                  onChange={e=>setEditingItems(ei=>ei.map((x,j)=>j===i?{...x,label:e.target.value}:x))}
                  placeholder="項目名"/>
                <div style={{ position:"relative" }}>
                  <input type="number" style={{ ...IS, paddingRight:20 }} value={item.target}
                    onChange={e=>setEditingItems(ei=>ei.map((x,j)=>j===i?{...x,target:+e.target.value}:x))}/>
                  <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:10 }}>/日</span>
                </div>
                <button onClick={()=>setEditingItems(ei=>ei.filter((_,j)=>j!==i))}
                  style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:16 }}>×</button>
              </div>
            ))}
            <button onClick={()=>setEditingItems(ei=>[...ei,{id:`a${Date.now()}`,label:"新しい項目",color:C.teal,target:5}])}
              style={{ background:"none", border:`1px dashed ${C.border}`, borderRadius:8, color:C.muted, padding:"8px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>
              + 項目を追加
            </button>
            <Btn onClick={async()=>{setActionItems(editingItems);setShowItemSettings(false);await api('/api/settings','PUT',{actionItems:editingItems})}}>保存</Btn>
          </div>
        </Modal>
      )}

      {/* Post form modal */}
      {showPostForm && (
        <Modal title="ポストを登録" onClose={()=>setShowPostForm(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <Field label="日付"><input type="date" style={IS} value={pf.date} onChange={e=>setPf(f=>({...f,date:e.target.value}))}/></Field>
              <Field label="種別">
                <div style={{ display:"flex", background:C.pageBg, border:`1px solid ${C.border}`, borderRadius:8, padding:3, gap:2 }}>
                  {[["own","自分"],["research","リサーチ"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setPf(f=>({...f,type:v}))}
                      style={{ flex:1, padding:"5px 0", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", border:"none",
                        background:pf.type===v?(v==="own"?C.green:C.amber):"transparent",
                        color:pf.type===v?"#fff":C.sub, fontFamily:"inherit" }}>{l}</button>
                  ))}
                </div>
              </Field>
              <Field label="ランク">
                <select style={IS} value={pf.rank} onChange={e=>setPf(f=>({...f,rank:e.target.value}))}>
                  {["S","A","B","C","D"].map(r=><option key={r} value={r}>{r}ランク</option>)}
                </select>
              </Field>
            </div>
            <Field label="URL"><input style={IS} value={pf.url} onChange={e=>setPf(f=>({...f,url:e.target.value}))} placeholder="https://x.com/..."/></Field>
            <Field label="タイトル"><input style={IS} value={pf.title} onChange={e=>setPf(f=>({...f,title:e.target.value}))} placeholder="内容の要約"/></Field>
            <Field label="ラベル">
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {settings.postLabels.map(l=><Chip key={l} label={l} active={pf.labels.includes(l)}
                  onClick={()=>setPf(f=>({...f,labels:f.labels.includes(l)?f.labels.filter(x=>x!==l):[...f.labels,l]}))}/>)}
              </div>
            </Field>
            <Field label="言語化メモ">
              <textarea style={{ ...IS, resize:"vertical" }} rows={3} value={pf.memo}
                onChange={e=>setPf(f=>({...f,memo:e.target.value}))} placeholder="なぜバズったか、次に活かすポイント..."/>
            </Field>
            <Btn onClick={savePost} disabled={!pf.title}>保存</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Report({ today, actions, setActions, analytics, actionItems, kpiItems, setKpiItems, weeklyReviews, setWeeklyReviews }) {
  const [view, setView] = useState("daily")
  const [showKpiEdit, setShowKpiEdit] = useState(false)
  const [editKpi, setEditKpi] = useState([])
  const [showEdit, setShowEdit] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showWeekly, setShowWeekly] = useState(false)
  const [weekForm, setWeekForm] = useState({ memo:"", next_goal:"" })
  const [editWeekId, setEditWeekId] = useState(null)

  function aggregate(groupFn) {
    const map={}
    actions.forEach(a=>{
      const k=groupFn(a.date)
      if(!map[k]){map[k]={date:k,sessions:0,focus_min:0};actionItems.forEach(i=>{map[k][i.id]=0})}
      actionItems.forEach(i=>{map[k][i.id]+=(a[i.id]||0)})
      map[k].sessions+=(a.sessions||0); map[k].focus_min+=(a.focus_min||0)
    })
    return Object.values(map).sort((a,b)=>b.date.localeCompare(a.date))
  }
  const rows = view==="daily"?[...actions].sort((a,b)=>b.date.localeCompare(a.date)):view==="weekly"?aggregate(weekStart):aggregate(d=>d.slice(0,7))
  const COLS = [{id:"sessions",label:"TIMER",color:C.blue},...actionItems.map(i=>({id:i.id,label:i.label.slice(0,4),color:i.color}))]

  function rowDateLabel(row) {
    if(view==="daily") return dayLabel(row.date)
    if(view==="weekly"){const d=new Date(row.date+"T00:00:00");return `${d.getMonth()+1}/${d.getDate()}週`}
    return row.date.slice(0,7).replace("-","年")+"月"
  }
  function getReview(ws){return weeklyReviews.find(r=>r.week_start===ws)}

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", background:C.pageBg, border:`1px solid ${C.border}`, borderRadius:12, padding:4, gap:3 }}>
        {[["daily","Daily"],["weekly","Weekly"],["monthly","Monthly"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{ padding:"8px", borderRadius:9, fontSize:13, fontWeight:700, cursor:"pointer", border:"none", background:view===v?C.blue:"transparent", color:view===v?"#fff":C.sub, fontFamily:"inherit" }}>{l}</button>
        ))}
      </div>

      {/* KPI */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <SLabel>KPI</SLabel>
        <button onClick={()=>{setEditKpi(kpiItems.map(i=>({...i})));setShowKpiEdit(true)}}
          style={{ background:"none", border:"none", color:C.muted, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>KPIを編集</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
        {kpiItems.map(kpi=>{
          const la=analytics[0]; const target=view==="monthly"?kpi.monthly_target:kpi.daily_target
          let val=null
          if (la) {
            if      (kpi.analyticsKey==="impressions")    val = la.impressions ?? null
            else if (kpi.analyticsKey==="net_follows")    val = (la.new_follows ?? 0) - (la.unfollows ?? 0)
            else if (kpi.analyticsKey==="profile_visits") val = la.profile_visits ?? null
            // カスタムKPIはanalyticsKeyが未設定 → 手動入力値があれば表示
            else if (kpi.manualValue != null)             val = kpi.manualValue
          }
          const hit=val!=null&&target>0&&val>=target
          return (
            <Card key={kpi.id} style={{ padding:"14px 16px" }}>
              <p style={{ color:C.sub, fontSize:10, fontWeight:700, margin:"0 0 6px" }}>{kpi.label}</p>
              <p style={{ color:hit?C.green:kpi.color, fontSize:22, fontWeight:800, margin:0, fontFamily:"monospace" }}>{val!=null?fmt(val):"—"}</p>
              {target>0&&<p style={{ color:C.muted, fontSize:10, margin:"4px 0 8px" }}>目標 {fmt(target)}{kpi.unit}</p>}
              {val!=null&&target>0&&<PBar value={val} max={target} color={kpi.color}/>}
            </Card>
          )
        })}
      </div>

      {/* Table */}
      <Card style={{ overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:`140px repeat(${COLS.length},1fr)`, padding:"9px 16px", background:C.pageBg, borderBottom:`1px solid ${C.border}` }}>
          <span style={{ color:C.muted, fontSize:10, fontWeight:700, letterSpacing:1 }}>DATE</span>
          {COLS.map(c=><span key={c.id} style={{ color:c.color, fontSize:10, fontWeight:700, textAlign:"center" }}>{c.label.toUpperCase()}</span>)}
        </div>
        {rows.map((row)=>{
          const isToday=row.date===today&&view==="daily"
          const ws=view==="weekly"?row.date:null
          const review=ws?getReview(ws):null
          return (
            <div key={row.date}>
              <div onClick={()=>view==="daily"&&(setEditForm({...row}),setShowEdit(row.date))}
                style={{ display:"grid", gridTemplateColumns:`140px repeat(${COLS.length},1fr)`, padding:"13px 16px", borderBottom:review?`1px dashed ${C.border}`:`1px solid ${C.border}`, background:isToday?`${C.blue}06`:"transparent", cursor:view==="daily"?"pointer":"default" }}
                onMouseEnter={e=>e.currentTarget.style.background=isToday?`${C.blue}10`:`${C.pageBg}aa`}
                onMouseLeave={e=>e.currentTarget.style.background=isToday?`${C.blue}06`:"transparent"}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ color:isToday?C.blue:C.text, fontSize:13, fontWeight:isToday?700:500 }}>{rowDateLabel(row)}</span>
                  {isToday&&<span style={{ background:`${C.blue}18`, color:C.blue, fontSize:9, padding:"1px 6px", borderRadius:20 }}>TODAY</span>}
                  {ws&&<button onClick={e=>{e.stopPropagation();const r=getReview(ws);setWeekForm(r?{memo:r.memo,next_goal:r.next_goal}:{memo:"",next_goal:""});setEditWeekId(ws);setShowWeekly(true)}}
                    style={{ background:"none", border:`1px solid ${C.border}`, color:review?C.blue:C.muted, borderRadius:6, padding:"1px 6px", fontSize:10, cursor:"pointer", fontFamily:"inherit" }}>
                    {review?"📝":"+ 振り返り"}
                  </button>}
                </div>
                {COLS.map(c=>{
                  const v=row[c.id]||0, target=actionItems.find(a=>a.id===c.id)?.target, hit=target&&v>=target
                  return <span key={c.id} style={{ color:v===0?C.muted:hit?C.green:c.color, fontSize:v===0?13:17, fontWeight:v===0?400:800, fontFamily:"monospace", textAlign:"center", opacity:v===0?0.35:1 }}>{v}{hit?" ✓":""}</span>
                })}
              </div>
              {review&&<div style={{ padding:"8px 16px 10px", background:`${C.blue}04`, borderBottom:`1px solid ${C.border}` }}>
                <p style={{ color:C.sub, fontSize:11, margin:"0 0 3px", fontWeight:600 }}>週次振り返り</p>
                <p style={{ color:C.text, fontSize:12, margin:"0 0 4px", lineHeight:1.6 }}>{review.memo}</p>
                {review.next_goal&&<p style={{ color:C.blue, fontSize:12, margin:0 }}>来週の目標: {review.next_goal}</p>}
              </div>}
            </div>
          )
        })}
        {rows.length===0&&<div style={{ textAlign:"center", padding:40, color:C.muted }}>データがありません</div>}
      </Card>

      {showEdit&&<Modal title={`${dayLabel(showEdit)} を編集`} onClose={()=>setShowEdit(null)}>
        <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
          {[{id:"sessions",label:"セッション数"},...actionItems].map(item=>(
            <div key={item.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
              <label style={{ color:C.sub, fontSize:13, width:130 }}>{item.label}</label>
              <input type="number" style={{ ...IS, width:72, textAlign:"center" }} value={editForm[item.id]||0} onChange={e=>setEditForm(f=>({...f,[item.id]:+e.target.value}))}/>
            </div>
          ))}
          <Btn onClick={async()=>{
            setActions(as=>as.map(a=>a.date===editForm.date?{...a,...editForm}:a))
            setShowEdit(null)
            await api(`/api/actions/${editForm.id}`,'PUT', editForm)
          }}>保存</Btn>
        </div>
      </Modal>}

      {showWeekly&&<Modal title={`週次振り返り — ${editWeekId}週`} onClose={()=>setShowWeekly(false)}>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <Field label="今週の気づき">
            <textarea style={{ ...IS, resize:"vertical" }} rows={4} value={weekForm.memo} onChange={e=>setWeekForm(f=>({...f,memo:e.target.value}))} placeholder="よかった点、改善点..."/>
          </Field>
          <Field label="来週の目標">
            <input style={IS} value={weekForm.next_goal} onChange={e=>setWeekForm(f=>({...f,next_goal:e.target.value}))} placeholder="具体的な行動目標"/>
          </Field>
          <Btn onClick={async()=>{
            setWeeklyReviews(rs=>{const ex=rs.find(r=>r.week_start===editWeekId);if(ex)return rs.map(r=>r.week_start===editWeekId?{...r,...weekForm}:r);return[...rs,{id:Date.now(),week_start:editWeekId,...weekForm}]})
            setShowWeekly(false)
            await api('/api/reviews','POST',{week_start:editWeekId,...weekForm})
          }}>保存</Btn>
        </div>
      </Modal>}

      {showKpiEdit&&<Modal title="KPI項目を編集" onClose={()=>setShowKpiEdit(false)}>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {editKpi.map((kpi,i)=>(
            <div key={kpi.id} style={{ background:C.pageBg, borderRadius:10, padding:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <input style={{ ...IS, width:160 }} value={kpi.label} onChange={e=>setEditKpi(ei=>ei.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/>
                <button onClick={()=>setEditKpi(ei=>ei.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:16 }}>×</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 56px", gap:8 }}>
                <Field label="日次目標"><input type="number" style={IS} value={kpi.daily_target} onChange={e=>setEditKpi(ei=>ei.map((x,j)=>j===i?{...x,daily_target:+e.target.value}:x))}/></Field>
                <Field label="月次目標"><input type="number" style={IS} value={kpi.monthly_target} onChange={e=>setEditKpi(ei=>ei.map((x,j)=>j===i?{...x,monthly_target:+e.target.value}:x))}/></Field>
                <Field label="単位"><input style={IS} value={kpi.unit} onChange={e=>setEditKpi(ei=>ei.map((x,j)=>j===i?{...x,unit:e.target.value}:x))}/></Field>
              </div>
            </div>
          ))}
          <button onClick={()=>setEditKpi(ei=>[...ei,{id:`k${Date.now()}`,label:"新しいKPI",unit:"",daily_target:0,monthly_target:0,color:C.teal,analyticsKey:"",manualValue:null}])}
            style={{ background:"none", border:`1px dashed ${C.border}`, borderRadius:8, color:C.muted, padding:"8px", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>+ KPIを追加</button>
          <Btn onClick={async()=>{setKpiItems(editKpi);setShowKpiEdit(false);await api('/api/settings','PUT',{kpiItems:editKpi})}}>保存</Btn>
        </div>
      </Modal>}
    </div>
  )
}

// ── Posts用サブコンポーネント（Posts外で定義してレンダー安定化）──
function PostRow({ p, expanded, onToggle, onEdit, onDelete }) {
  const open = expanded===p.id
  const isOwn = (p.type||"own")==="own"
  return (
    <div style={{ borderBottom:`1px solid ${C.border}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 14px", cursor:"pointer" }} onClick={()=>onToggle(p.id)}>
        <span style={{ background:`${RANK_COLORS[p.rank]}18`, color:RANK_COLORS[p.rank], border:`1px solid ${RANK_COLORS[p.rank]}30`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:800, fontFamily:"monospace", flexShrink:0 }}>{p.rank}</span>
        <span style={{ background:isOwn?`${C.green}15`:`${C.amber}15`, color:isOwn?C.green:C.amber, border:`1px solid ${isOwn?C.green:C.amber}30`, borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:700, flexShrink:0 }}>{isOwn?"自分":"リサーチ"}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ margin:"0 0 3px", color:C.text, fontSize:13, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title}</p>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {p.labels.map(l=><span key={l} style={{ background:`${C.blue}12`, color:C.blue, border:`1px solid ${C.blue}25`, borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:600 }}>{l}</span>)}
          </div>
        </div>
        {p.impressions&&<span style={{ color:C.muted, fontSize:11, whiteSpace:"nowrap", flexShrink:0 }}>{fmt(p.impressions)}</span>}
        <div style={{ display:"flex", gap:1 }} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>onEdit(p)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:"4px 7px", fontSize:11, borderRadius:6, fontFamily:"inherit" }}>編集</button>
          <button onClick={()=>onDelete(p.id)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:"4px 7px", fontSize:11, borderRadius:6, fontFamily:"inherit" }}>削除</button>
        </div>
        <span style={{ color:C.muted, fontSize:10 }}>{open?"▲":"▼"}</span>
      </div>
      {open&&<div style={{ padding:"12px 14px 14px", background:C.pageBg, borderTop:`1px solid ${C.border}` }}>
        {p.memo&&<><p style={{ color:C.sub, fontSize:10, fontWeight:700, letterSpacing:1, margin:"0 0 5px" }}>言語化メモ</p><p style={{ color:C.text, fontSize:13, lineHeight:1.8, margin:"0 0 10px", whiteSpace:"pre-wrap" }}>{p.memo}</p></>}
        {p.impressions&&<div style={{ display:"flex", gap:14, marginBottom:8 }}>{[["インプレ",p.impressions],["いいね",p.likes]].map(([l,v])=>(<div key={l}><p style={{ color:C.muted, fontSize:10, margin:"0 0 2px" }}>{l}</p><p style={{ color:C.text, fontSize:15, fontWeight:700, margin:0, fontFamily:"monospace" }}>{fmt(v||0)}</p></div>))}</div>}
        <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color:C.blue, fontSize:11 }}>→ ポストを開く</a>
      </div>}
    </div>
  )
}
function GHeader({ label, ps, color }) {
  return (
    <div style={{ padding:"9px 14px", background:C.pageBg, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <span style={{ color:color||C.text, fontSize:12, fontWeight:700 }}>{label}</span>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ color:C.muted, fontSize:11 }}>{ps.length}件</span>
        <CopyMemoBtn posts={ps}/>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POSTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Posts({ today, posts, setPosts, settings }) {
  const [view, setView] = useState("date")
  const [search, setSearch] = useState("")
  const [filterLabel, setFilterLabel] = useState("ALL")
  const [filterRank, setFilterRank] = useState("ALL")
  const [filterType, setFilterType] = useState("ALL")
  const [expanded, setExpanded] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const blank = { date:today, url:"", title:"", labels:[], rank:"B", type:"own", memo:"", impressions:"", likes:"" }
  const [form, setForm] = useState(blank)

  const allLabels = [...new Set(posts.flatMap(p=>p.labels))]
  const filtered = useMemo(()=>posts.filter(p=>{
    if(filterLabel!=="ALL"&&!p.labels.includes(filterLabel))return false
    if(filterRank!=="ALL"&&p.rank!==filterRank)return false
    if(filterType!=="ALL"&&(p.type||"own")!==filterType)return false
    if(search){const q=search.toLowerCase();if(!p.title.toLowerCase().includes(q)&&!p.memo?.toLowerCase().includes(q)&&!p.labels.join(" ").toLowerCase().includes(q))return false}
    return true
  }),[posts,filterLabel,filterRank,filterType,search])

  async function save() {
    const data={...form,impressions:form.impressions===""?null:+form.impressions,likes:form.likes===""?null:+form.likes}
    if(editId) {
      setPosts(ps=>ps.map(p=>p.id===editId?{...p,...data}:p))
      setShowForm(false);setEditId(null)
      await api(`/api/posts/${editId}`,'PUT', data)
    } else {
      const tempId = Date.now()
      setPosts(ps=>[{id:tempId,...data},...ps])
      setShowForm(false);setEditId(null)
      const saved = await api('/api/posts','POST', data)
      if (saved) setPosts(ps=>ps.map(p=>p.id===tempId?saved:p))
    }
  }
  async function del(id){
    if(confirm("削除しますか？")) {
      setPosts(ps=>ps.filter(p=>p.id!==id))
      await api(`/api/posts/${id}`,'DELETE')
    }
  }

  const byDate={};filtered.forEach(p=>{if(!byDate[p.date])byDate[p.date]=[];byDate[p.date].push(p)})
  const dateSorted=Object.keys(byDate).sort((a,b)=>b.localeCompare(a))
  const byLabel={};filtered.forEach(p=>{(p.labels.length>0?p.labels:["ラベルなし"]).forEach(l=>{if(!byLabel[l])byLabel[l]=[];byLabel[l].push(p)})})
  const byRank={};filtered.forEach(p=>{if(!byRank[p.rank])byRank[p.rank]=[];byRank[p.rank].push(p)})
  const postByDate={};posts.forEach(p=>{if(!postByDate[p.date])postByDate[p.date]=[];postByDate[p.date].push(p)})
  const now2=new Date()
  const [calY,setCalY]=useState(now2.getFullYear())
  const [calM,setCalM]=useState(now2.getMonth())
  function calDays(){const first=new Date(calY,calM,1),last=new Date(calY,calM+1,0);const days=[],sd=(first.getDay()+6)%7;for(let i=0;i<sd;i++)days.push(null);for(let d=1;d<=last.getDate();d++)days.push(`${calY}-${String(calM+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);return days}

  function postRowProps(p) {
    return {
      expanded, onToggle:(id)=>setExpanded(expanded===id?null:id),
      onEdit:(p)=>{setForm({...p,impressions:p.impressions??"",likes:p.likes??""});setEditId(p.id);setShowForm(true)},
      onDelete:del,
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:160 }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:13 }}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="タイトル・メモ・ラベルで検索..." style={{ ...IS, paddingLeft:28 }}/>
        </div>
        <div style={{ display:"flex", background:C.pageBg, border:`1px solid ${C.border}`, borderRadius:10, padding:3, gap:2 }}>
          {[["date","日付"],["label","ラベル"],["rank","ランク"],["calendar","カレンダー"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{ padding:"5px 12px", borderRadius:8, fontSize:11, fontWeight:600, cursor:"pointer", border:"none", background:view===v?C.blue:"transparent", color:view===v?"#fff":C.sub, fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
        <Btn small onClick={()=>{setForm(blank);setEditId(null);setShowForm(true)}}>+ 追加</Btn>
      </div>

      {view!=="calendar"&&<div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", background:C.pageBg, border:`1px solid ${C.border}`, borderRadius:8, padding:2, gap:1, marginRight:4 }}>
          {[["ALL","すべて"],["own","自分"],["research","リサーチ"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFilterType(v)} style={{ padding:"3px 10px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", border:"none", background:filterType===v?(v==="own"?C.green:v==="research"?C.amber:C.text):"transparent", color:filterType===v?"#fff":C.sub, fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
        <Chip label="全て" active={filterLabel==="ALL"} color={C.text} onClick={()=>setFilterLabel("ALL")}/>
        {allLabels.map(l=><Chip key={l} label={l} active={filterLabel===l} onClick={()=>setFilterLabel(filterLabel===l?"ALL":l)}/>)}
        <span style={{ width:1, height:14, background:C.border, margin:"0 4px" }}/>
        {["ALL","S","A","B","C","D"].map(r=>(
          <button key={r} onClick={()=>setFilterRank(r)} style={{ padding:"3px 9px", borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, background:filterRank===r?(RANK_COLORS[r]||C.text):"transparent", color:filterRank===r?"#fff":C.muted, fontFamily:"inherit" }}>{r}</button>
        ))}
        <span style={{ color:C.muted, fontSize:11, marginLeft:4 }}>{filtered.length}件</span>
      </div>}

      {view==="date"&&<div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {dateSorted.map(date=>(
          <Card key={date} style={{ overflow:"hidden" }}>
            <GHeader label={<>{dayLabel(date)}{date===today&&<span style={{ background:`${C.blue}18`, color:C.blue, fontSize:9, padding:"1px 6px", borderRadius:20, marginLeft:6 }}>TODAY</span>}</>} ps={byDate[date]} color={date===today?C.blue:undefined}/>
            {byDate[date].map(p=><PostRow key={p.id} p={p} {...postRowProps(p)}/>)}
          </Card>
        ))}
        {dateSorted.length===0&&<div style={{ textAlign:"center", padding:48, color:C.muted }}>該当するポストがありません</div>}
      </div>}

      {view==="label"&&<div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {Object.entries(byLabel).sort((a,b)=>b[1].length-a[1].length).map(([label,ps])=>(
          <Card key={label} style={{ overflow:"hidden" }}>
            <GHeader label={<span style={{ background:`${C.blue}12`, color:C.blue, border:`1px solid ${C.blue}25`, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{label}</span>} ps={ps}/>
            {ps.map(p=><PostRow key={p.id} p={p} {...postRowProps(p)}/>)}
          </Card>
        ))}
      </div>}

      {view==="rank"&&<div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {["S","A","B","C","D"].map(rank=>{
          const ps=byRank[rank]||[];if(!ps.length)return null
          return (
            <Card key={rank} style={{ overflow:"hidden" }}>
              <GHeader label={<span style={{ background:`${RANK_COLORS[rank]}18`, color:RANK_COLORS[rank], border:`1px solid ${RANK_COLORS[rank]}30`, borderRadius:6, padding:"2px 8px", fontSize:12, fontWeight:800, fontFamily:"monospace" }}>{rank}</span>} ps={ps}/>
              {ps.map(p=><PostRow key={p.id} p={p} {...postRowProps(p)}/>)}
            </Card>
          )
        })}
      </div>}

      {view==="calendar"&&<Card style={{ padding:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <button onClick={()=>{if(calM===0){setCalY(y=>y-1);setCalM(11)}else setCalM(m=>m-1)}} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", color:C.sub, fontFamily:"inherit" }}>◀</button>
          <span style={{ color:C.text, fontSize:14, fontWeight:700 }}>{calY}年 {calM+1}月</span>
          <button onClick={()=>{if(calM===11){setCalY(y=>y+1);setCalM(0)}else setCalM(m=>m+1)}} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", cursor:"pointer", color:C.sub, fontFamily:"inherit" }}>▶</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
          {["月","火","水","木","金","土","日"].map(d=><div key={d} style={{ textAlign:"center", color:C.muted, fontSize:10, padding:"3px 0" }}>{d}</div>)}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
          {calDays().map((ds,i)=>{
            const ps=ds?postByDate[ds]:null,isT=ds===today
            return (
              <div key={i} style={{ minHeight:60, borderRadius:8, background:isT?`${C.blue}10`:ds?C.pageBg:"transparent", border:isT?`1px solid ${C.blue}40`:`1px solid ${ds?C.border:"transparent"}`, padding:5 }}>
                {ds&&<><span style={{ fontSize:10, color:isT?C.blue:C.sub, fontWeight:isT?700:400 }}>{+ds.slice(8)}</span>
                {ps&&ps.slice(0,3).map(p=>(<div key={p.id} title={p.title} style={{ background:`${RANK_COLORS[p.rank]}20`, borderRadius:4, padding:"2px 4px", marginTop:2 }}><p style={{ color:RANK_COLORS[p.rank], fontSize:9, fontWeight:700, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.rank} {p.title}</p></div>))}
                {ps&&ps.length>3&&<p style={{ color:C.muted, fontSize:8, margin:"2px 0 0" }}>+{ps.length-3}</p>}</>}
              </div>
            )
          })}
        </div>
      </Card>}

      {showForm&&<Modal title={editId?"ポストを編集":"ポストを登録"} onClose={()=>{setShowForm(false);setEditId(null)}}>
        <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <Field label="日付"><input type="date" style={IS} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></Field>
            <Field label="種別">
              <div style={{ display:"flex", background:C.pageBg, border:`1px solid ${C.border}`, borderRadius:8, padding:3, gap:2 }}>
                {[["own","自分"],["research","リサーチ"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setForm(f=>({...f,type:v}))} style={{ flex:1, padding:"5px 0", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", border:"none", background:form.type===v?(v==="own"?C.green:C.amber):"transparent", color:form.type===v?"#fff":C.sub, fontFamily:"inherit" }}>{l}</button>
                ))}
              </div>
            </Field>
            <Field label="ランク">
              <select style={IS} value={form.rank} onChange={e=>setForm(f=>({...f,rank:e.target.value}))}>
                {["S","A","B","C","D"].map(r=><option key={r} value={r}>{r}ランク</option>)}
              </select>
            </Field>
          </div>
          <Field label="URL"><input style={IS} value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))} placeholder="https://x.com/..."/></Field>
          <Field label="タイトル"><input style={IS} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="内容の要約"/></Field>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="インプレ（任意）"><input type="number" style={IS} value={form.impressions} onChange={e=>setForm(f=>({...f,impressions:e.target.value}))}/></Field>
            <Field label="いいね（任意）"><input type="number" style={IS} value={form.likes} onChange={e=>setForm(f=>({...f,likes:e.target.value}))}/></Field>
          </div>
          <Field label="ラベル">
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {settings.postLabels.map(l=><Chip key={l} label={l} active={form.labels.includes(l)}
                onClick={()=>setForm(f=>({...f,labels:f.labels.includes(l)?f.labels.filter(x=>x!==l):[...f.labels,l]}))}/>)}
            </div>
          </Field>
          <Field label="言語化メモ">
            <textarea style={{ ...IS, resize:"vertical" }} rows={4} value={form.memo} onChange={e=>setForm(f=>({...f,memo:e.target.value}))} placeholder="なぜ伸びたか、次に活かすポイント..."/>
          </Field>
          <Btn onClick={save} disabled={!form.title}>保存</Btn>
        </div>
      </Modal>}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MEMO STOCK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function MemoStock({ posts, actions, actionItems, tmpls, setTmpls }) {
  const [filterLabel, setFilterLabel] = useState("ALL")
  const [filterRank, setFilterRank] = useState("ALL")
  const [search, setSearch] = useState("")
  const [showTemplates, setShowTemplates] = useState(false)
  const [newTmpl, setNewTmpl] = useState({ title:"", body:"", tags:[] })

  const hasMemo = posts.filter(p=>p.memo?.trim())
  const filtered = hasMemo.filter(p=>{
    if(filterLabel!=="ALL"&&!p.labels.includes(filterLabel))return false
    if(filterRank!=="ALL"&&p.rank!==filterRank)return false
    if(search&&!p.memo.toLowerCase().includes(search.toLowerCase())&&!p.title.toLowerCase().includes(search.toLowerCase()))return false
    return true
  })
  const allLabels=[...new Set(posts.flatMap(p=>p.labels))]
  const correlationData=actionItems.map(item=>{
    const highDays=actions.filter(a=>(a[item.id]||0)>=item.target).map(a=>a.date)
    const highPosts=posts.filter(p=>highDays.includes(p.date))
    const score=ps=>{if(!ps.length)return 0;const sc={S:5,A:4,B:3,C:2,D:1};return ps.reduce((s,p)=>s+(sc[p.rank]||0),0)/ps.length}
    const hs=score(highPosts),as=score(posts)
    return{label:item.label,color:item.color,target:item.target,highScore:hs,allScore:as,diff:hs-as}
  })

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Correlation */}
      <Card style={{ padding:18 }}>
        <SLabel>行動量 × ポスト品質 の相関</SLabel>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
          {correlationData.map(d=>(
            <div key={d.label} style={{ background:C.pageBg, borderRadius:10, padding:"12px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div>
                  <p style={{ color:d.color, fontSize:12, fontWeight:700, margin:"0 0 2px" }}>{d.label}</p>
                  <p style={{ color:C.muted, fontSize:10, margin:0 }}>目標達成日（{d.target}/日）のポスト</p>
                </div>
                <span style={{ color:d.diff>0?C.green:C.muted, fontSize:13, fontWeight:700 }}>{d.diff>0?"↑":"—"}</span>
              </div>
              <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
                <div style={{ textAlign:"center" }}><p style={{ color:C.muted, fontSize:9, margin:"0 0 3px" }}>平均</p><p style={{ color:C.text, fontSize:16, fontWeight:700, margin:0, fontFamily:"monospace" }}>{d.allScore.toFixed(1)}</p></div>
                <span style={{ color:C.muted, fontSize:12, marginBottom:2 }}>→</span>
                <div style={{ textAlign:"center" }}><p style={{ color:C.muted, fontSize:9, margin:"0 0 3px" }}>目標達成日</p><p style={{ color:d.diff>0?C.green:C.text, fontSize:20, fontWeight:800, margin:0, fontFamily:"monospace" }}>{d.highScore.toFixed(1)}</p></div>
                {d.diff>0&&<span style={{ color:C.green, fontSize:10, marginBottom:3, fontWeight:700 }}>+{d.diff.toFixed(1)}</span>}
              </div>
            </div>
          ))}
        </div>
        <p style={{ color:C.muted, fontSize:10, margin:"10px 0 0" }}>スコア: S=5 / A=4 / B=3 / C=2 / D=1 の平均値</p>
      </Card>

      {/* Templates */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <SLabel>言語化テンプレート</SLabel>
        <button onClick={()=>setShowTemplates(true)} style={{ background:"none", border:"none", color:C.blue, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>管理</button>
      </div>
      <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:4 }}>
        {tmpls.map(t=>(
          <Card key={t.id} style={{ padding:"12px 14px", minWidth:200, flexShrink:0 }}>
            <p style={{ color:C.text, fontSize:12, fontWeight:700, margin:"0 0 6px" }}>{t.title}</p>
            <p style={{ color:C.sub, fontSize:11, lineHeight:1.7, margin:0, whiteSpace:"pre-wrap" }}>{t.body}</p>
          </Card>
        ))}
        <button onClick={()=>setShowTemplates(true)} style={{ minWidth:120, background:"none", border:`1px dashed ${C.border}`, borderRadius:12, color:C.muted, cursor:"pointer", fontSize:12, padding:14, fontFamily:"inherit" }}>+ 追加</button>
      </div>

      {/* Memo list */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ position:"relative", flex:1, minWidth:160 }}>
          <span style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:13 }}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="メモを検索..." style={{ ...IS, paddingLeft:27 }}/>
        </div>
        <Chip label="全て" active={filterLabel==="ALL"} color={C.text} onClick={()=>setFilterLabel("ALL")}/>
        {allLabels.map(l=><Chip key={l} label={l} active={filterLabel===l} onClick={()=>setFilterLabel(filterLabel===l?"ALL":l)}/>)}
        <span style={{ width:1, height:14, background:C.border }}/>
        {["ALL","S","A","B","C","D"].map(r=>(
          <button key={r} onClick={()=>setFilterRank(r)} style={{ padding:"3px 9px", borderRadius:7, fontSize:11, fontWeight:700, cursor:"pointer", border:`1px solid ${C.border}`, background:filterRank===r?(RANK_COLORS[r]||C.text):"transparent", color:filterRank===r?"#fff":C.muted, fontFamily:"inherit" }}>{r}</button>
        ))}
        <CopyMemoBtn posts={filtered}/>
      </div>
      <SLabel>{filtered.length}件の言語化メモ</SLabel>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.map(p=>(
          <Card key={p.id} style={{ padding:"14px 16px" }}>
            <div style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:8 }}>
              <span style={{ background:`${RANK_COLORS[p.rank]}18`, color:RANK_COLORS[p.rank], border:`1px solid ${RANK_COLORS[p.rank]}30`, borderRadius:6, padding:"2px 7px", fontSize:11, fontWeight:800, fontFamily:"monospace", flexShrink:0 }}>{p.rank}</span>
              <div style={{ flex:1 }}>
                <p style={{ color:C.text, fontSize:13, fontWeight:700, margin:"0 0 4px" }}>{p.title}</p>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  <span style={{ color:C.muted, fontSize:10 }}>{dayLabel(p.date)}</span>
                  {p.labels.map(l=><span key={l} style={{ background:`${C.blue}12`, color:C.blue, border:`1px solid ${C.blue}25`, borderRadius:20, padding:"1px 7px", fontSize:10, fontWeight:600 }}>{l}</span>)}
                </div>
              </div>
              {p.impressions&&<span style={{ color:C.muted, fontSize:11, flexShrink:0 }}>{fmt(p.impressions)}</span>}
            </div>
            <div style={{ background:C.pageBg, borderRadius:8, padding:"10px 12px", borderLeft:`3px solid ${RANK_COLORS[p.rank]}` }}>
              <p style={{ color:C.text, fontSize:13, lineHeight:1.8, margin:0, whiteSpace:"pre-wrap" }}>{p.memo}</p>
            </div>
          </Card>
        ))}
        {filtered.length===0&&<div style={{ textAlign:"center", padding:40, color:C.muted }}>言語化メモがありません</div>}
      </div>

      {showTemplates&&<Modal title="テンプレートを管理" onClose={()=>setShowTemplates(false)}>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {tmpls.map(t=>(
            <div key={t.id} style={{ background:C.pageBg, borderRadius:10, padding:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ color:C.text, fontSize:13, fontWeight:700 }}>{t.title}</span>
                <button onClick={async()=>{
                setTmpls(ts=>ts.filter(x=>x.id!==t.id))
                await api(`/api/tmpls/${t.id}`,'DELETE')
              }} style={{ background:"none", border:"none", color:C.red, cursor:"pointer" }}>削除</button>
              </div>
              <p style={{ color:C.sub, fontSize:12, margin:0, whiteSpace:"pre-wrap", lineHeight:1.7 }}>{t.body}</p>
            </div>
          ))}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
            <p style={{ color:C.sub, fontSize:12, fontWeight:700, margin:"0 0 8px" }}>新しいテンプレート</p>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <input style={IS} value={newTmpl.title} onChange={e=>setNewTmpl(f=>({...f,title:e.target.value}))} placeholder="テンプレート名"/>
              <textarea style={{ ...IS, resize:"vertical" }} rows={4} value={newTmpl.body} onChange={e=>setNewTmpl(f=>({...f,body:e.target.value}))} placeholder="テンプレート内容..."/>
              <Btn small onClick={async()=>{
                if(!newTmpl.title)return
                const tempId=Date.now()
                setTmpls(ts=>[...ts,{id:tempId,tags:[],...newTmpl}])
                setNewTmpl({title:"",body:"",tags:[]})
                const saved=await api('/api/tmpls','POST',{tags:[],...newTmpl})
                if(saved) setTmpls(ts=>ts.map(t=>t.id===tempId?saved:t))
              }} disabled={!newTmpl.title}>追加</Btn>
            </div>
          </div>
        </div>
      </Modal>}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KNOWLEDGE PAGE — ルールブック / 仮説検証 / テンプレートバンク
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const HYP_STATUS = ["仮説中","検証中","検証済","棄却"]
const HYP_STATUS_COLORS = { "仮説中":C.muted, "検証中":C.amber, "検証済":C.green, "棄却":C.red }

const SAMPLE_RULES = [
  { id:1, cat:"フック構成", labels:["フック","長文"], title:"冒頭3行の黄金パターン", body:"① 数字  ② 逆張り  ③ 読者の悩みの代弁\nこの順で書くと最後まで読まれやすい。", confidence:4, source_title:"バズったフック構成、冒頭3行が命", updated:"2026-03-05" },
  { id:2, cat:"投稿タイミング", labels:[], title:"朝7時投稿が最も伸びる", body:"7:00〜7:30 のタイムラインが最も競合が少なく、通勤電車の閲覧ピークと重なる。", confidence:3, source_title:"", updated:"2026-03-03" },
]
const SAMPLE_HYPS = [
  { id:1, title:"朝投稿は夜投稿より1.5倍伸びる", hypothesis:"朝7時台に投稿すると夜21時台より平均インプレが1.5倍になる", method:"1週間、同内容を朝/夜で交互投稿して比較", result:"朝が平均1.42倍のインプレ。ただし内容依存あり", conclusion:"概ね検証済。ただし図解系は夜の方が伸びるケースも", status:"検証済", start_date:"2026-02-20", end_date:"2026-02-27", promoted:true },
  { id:2, title:"リプライ30件/日でフォロワー増加が加速する", hypothesis:"毎日30件以上リプライするとフォロワー増加ペースが2倍になる", method:"2週間、30件達成日と未達日でフォロワー増加数を比較", result:"", conclusion:"", status:"検証中", start_date:"2026-03-01", end_date:"2026-03-14", promoted:false },
]
const SAMPLE_TMPLS = [
  { id:1, title:"リスト型・習慣系", body:"1行目: 「〇〇できる人の△△選」\n2行目: 共感の一文\n本文: 番号付きリスト\n締め: 行動促進の一文", tags:["リスト","共感"] },
  { id:2, title:"フック型・逆張り", body:"1行目: 「〇〇は間違いです」\n2行目: 読者が驚く事実\n本文: 正しいやり方の解説\n締め: まとめ1行", tags:["フック"] },
]

function StarRating({ value, onChange, readonly=false }) {
  return (
    <div style={{ display:"flex", gap:2 }}>
      {[1,2,3,4,5].map(n=>(
        <button key={n} onClick={()=>!readonly&&onChange(n)}
          style={{ background:"none", border:"none", cursor:readonly?"default":"pointer", padding:0, fontSize:14,
            color:n<=value?C.amber:C.border, transition:"color 0.1s" }}>★</button>
      ))}
    </div>
  )
}

function StatusBadge({ status }) {
  const color = HYP_STATUS_COLORS[status] || C.muted
  return (
    <span style={{ background:`${color}18`, color, border:`1px solid ${color}30`,
      borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
      {status}
    </span>
  )
}

function Knowledge({ rules, setRules, hyps, setHyps, tmpls, setTmpls, settings }) {
  const [tab, setTab] = useState("rulebook")
  const ruleCats   = settings.ruleCategories || DEFAULT_SETTINGS.ruleCategories
  const postLabels = settings.postLabels || DEFAULT_SETTINGS.postLabels

  // ── Rulebook state ──
  const [ruleForm, setRuleForm] = useState(null)
  const [filterCat,   setFilterCat]   = useState("ALL")
  const [filterLabel, setFilterLabel] = useState("ALL")
  const [copyAll, setCopyAll] = useState(false)

  // ── Hypothesis state ──
  const [hypForm, setHypForm]       = useState(null)
  const [hypFilter, setHypFilter]   = useState("ALL")
  const [hypExpanded, setHypExpanded] = useState(null)

  // ── Template state ──
  const [tmplForm, setTmplForm] = useState(null)
  const [newTag, setNewTag]     = useState("")

  const BLANK_RULE = { cat:ruleCats[0]||"", labels:[], title:"", body:"", confidence:3, source_title:"", updated:jstDateStr() }
  const BLANK_HYP  = { title:"", hypothesis:"", method:"", result:"", conclusion:"", status:"仮説中", start_date:jstDateStr(), end_date:"", promoted:false }
  const BLANK_TMPL = { title:"", body:"", tags:[] }

  // ── Rulebook CRUD ──
  async function saveRule() {
    const d = { ...ruleForm, labels:ruleForm.labels||[], updated:jstDateStr() }
    if (d.id) {
      setRules(rs=>rs.map(r=>r.id===d.id?d:r))
      setRuleForm(null)
      await api(`/api/rules/${d.id}`,'PUT', d)
    } else {
      const tempId = Date.now()
      setRules(rs=>[{ id:tempId, ...d }, ...rs])
      setRuleForm(null)
      const saved = await api('/api/rules','POST', d)
      if (saved) setRules(rs=>rs.map(r=>r.id===tempId?saved:r))
    }
  }
  async function delRule(id) {
    if(confirm("削除しますか？")) {
      setRules(rs=>rs.filter(r=>r.id!==id))
      await api(`/api/rules/${id}`,'DELETE')
    }
  }

  // ── Hyp CRUD ──
  async function saveHyp() {
    const d = { ...hypForm }
    if (d.id) {
      setHyps(hs=>hs.map(h=>h.id===d.id?d:h))
      setHypForm(null)
      await api(`/api/hyps/${d.id}`,'PUT', d)
    } else {
      const tempId = Date.now()
      setHyps(hs=>[{ id:tempId, ...d }, ...hs])
      setHypForm(null)
      const saved = await api('/api/hyps','POST', d)
      if (saved) setHyps(hs=>hs.map(h=>h.id===tempId?saved:h))
    }
  }
  async function delHyp(id) {
    if(confirm("削除しますか？")) {
      setHyps(hs=>hs.filter(h=>h.id!==id))
      await api(`/api/hyps/${id}`,'DELETE')
    }
  }
  async function promoteToRule(h) {
    const body = `仮説: ${h.hypothesis}\n\n検証方法: ${h.method}\n\n結果: ${h.result}\n\n結論: ${h.conclusion}`
    const rData = { cat:ruleCats[ruleCats.length-1]||"その他", labels:[], title:h.title, body, confidence:4, source_title:"", updated:jstDateStr() }
    const tempId = Date.now()
    setRules(rs=>[{id:tempId,...rData},...rs])
    setHyps(hs=>hs.map(x=>x.id===h.id?{...x,promoted:true}:x))
    setTab("rulebook")
    const saved = await api('/api/rules','POST', rData)
    if (saved) setRules(rs=>rs.map(r=>r.id===tempId?saved:r))
    await api(`/api/hyps/${h.id}`,'PUT',{...h,promoted:true})
  }

  // ── Template CRUD ──
  async function saveTmpl() {
    const d = { ...tmplForm }
    if (d.id) {
      setTmpls(ts=>ts.map(t=>t.id===d.id?d:t))
      setTmplForm(null)
      await api(`/api/tmpls/${d.id}`,'PUT', d)
    } else {
      const tempId = Date.now()
      setTmpls(ts=>[{ id:tempId, ...d }, ...ts])
      setTmplForm(null)
      const saved = await api('/api/tmpls','POST', d)
      if (saved) setTmpls(ts=>ts.map(t=>t.id===tempId?saved:t))
    }
  }
  async function delTmpl(id) {
    if(confirm("削除しますか？")) {
      setTmpls(ts=>ts.filter(t=>t.id!==id))
      await api(`/api/tmpls/${id}`,'DELETE')
    }
  }

  // ── Copy all rules ──
  function copyAllRules() {
    const txt = filteredRules.map(r=>{
      const labelStr = (r.labels||[]).length ? ` [${r.labels.join(", ")}]` : ""
      return `[${r.cat}]${labelStr} ${r.title} (確信度${"★".repeat(r.confidence)})\n${r.body}`
    }).join("\n\n---\n\n")
    navigator.clipboard.writeText(txt).then(()=>{ setCopyAll(true); setTimeout(()=>setCopyAll(false),2000) })
  }

  const filteredRules = rules.filter(r=>{
    if (filterCat!=="ALL" && r.cat!==filterCat) return false
    if (filterLabel!=="ALL" && !(r.labels||[]).includes(filterLabel)) return false
    return true
  })
  const filteredHyps = hypFilter==="ALL" ? hyps : hyps.filter(h=>h.status===hypFilter)

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Tab bar */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", background:C.pageBg, border:`1px solid ${C.border}`, borderRadius:12, padding:4, gap:3 }}>
        {[["rulebook","ルールブック"],["hypothesis","仮説検証"],["templates","テンプレート"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)}
            style={{ padding:"8px", borderRadius:9, fontSize:13, fontWeight:700, cursor:"pointer", border:"none",
              background:tab===v?C.blue:"transparent", color:tab===v?"#fff":C.sub, fontFamily:"inherit" }}>{l}</button>
        ))}
      </div>

      {/* ═══════════════════ RULEBOOK ═══════════════════ */}
      {tab==="rulebook" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* Category filter */}
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ color:C.muted, fontSize:10, fontWeight:700, letterSpacing:.5 }}>カテゴリ</span>
            <Chip label="すべて" active={filterCat==="ALL"} color={C.purple} onClick={()=>setFilterCat("ALL")}/>
            {ruleCats.map(c=><Chip key={c} label={c} active={filterCat===c} color={C.purple} onClick={()=>setFilterCat(filterCat===c?"ALL":c)}/>)}
          </div>

          {/* Label filter */}
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ color:C.muted, fontSize:10, fontWeight:700, letterSpacing:.5 }}>ラベル</span>
            <Chip label="すべて" active={filterLabel==="ALL"} color={C.blue} onClick={()=>setFilterLabel("ALL")}/>
            {postLabels.map(l=><Chip key={l} label={l} active={filterLabel===l} color={C.blue} onClick={()=>setFilterLabel(filterLabel===l?"ALL":l)}/>)}
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
            <button onClick={copyAllRules}
              style={{ background:copyAll?`${C.green}18`:C.pageBg, border:`1px solid ${copyAll?C.green:C.border}`, borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:600, color:copyAll?C.green:C.muted, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}>
              {copyAll?"✓ コピー完了":"全件コピー（AI用）"}
            </button>
            <Btn small onClick={()=>setRuleForm({...BLANK_RULE})}>+ 追加</Btn>
          </div>

          {filteredRules.length===0 && <div style={{ textAlign:"center", padding:48, color:C.muted }}>ルールがまだありません</div>}

          {filteredRules.map(r=>(
            <Card key={r.id} style={{ padding:"16px 18px" }}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                    {/* Category badge */}
                    <span style={{ background:`${C.purple}14`, color:C.purple, border:`1px solid ${C.purple}25`, borderRadius:20, padding:"1px 9px", fontSize:10, fontWeight:700 }}>{r.cat}</span>
                    {/* Label badges */}
                    {(r.labels||[]).map(l=>(
                      <span key={l} style={{ background:`${C.blue}12`, color:C.blue, border:`1px solid ${C.blue}25`, borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:600 }}>{l}</span>
                    ))}
                    <StarRating value={r.confidence} readonly/>
                    <span style={{ color:C.muted, fontSize:10, marginLeft:"auto" }}>{r.updated}</span>
                  </div>
                  <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:"0 0 8px" }}>{r.title}</p>
                  <p style={{ color:C.sub, fontSize:13, lineHeight:1.8, margin:0, whiteSpace:"pre-wrap" }}>{r.body}</p>
                  {r.source_title && (
                    <p style={{ color:C.muted, fontSize:11, margin:"8px 0 0" }}>
                      出典ポスト: <span style={{ color:C.blue }}>{r.source_title}</span>
                    </p>
                  )}
                </div>
                <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                  <button onClick={()=>setRuleForm({...r,labels:[...(r.labels||[])]})} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:"3px 7px", fontSize:11, fontFamily:"inherit" }}>編集</button>
                  <button onClick={()=>delRule(r.id)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:"3px 7px", fontSize:11, fontFamily:"inherit" }}>削除</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ═══════════════════ HYPOTHESIS ═══════════════════ */}
      {tab==="hypothesis" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ flex:1, display:"flex", gap:5, flexWrap:"wrap" }}>
              <Chip label="すべて" active={hypFilter==="ALL"} color={C.text} onClick={()=>setHypFilter("ALL")}/>
              {HYP_STATUS.map(s=>(
                <button key={s} onClick={()=>setHypFilter(hypFilter===s?"ALL":s)}
                  style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer",
                    border:`1px solid ${hypFilter===s?HYP_STATUS_COLORS[s]:C.border}`,
                    background:hypFilter===s?`${HYP_STATUS_COLORS[s]}18`:"transparent",
                    color:hypFilter===s?HYP_STATUS_COLORS[s]:C.muted, fontFamily:"inherit" }}>{s}</button>
              ))}
            </div>
            <Btn small onClick={()=>setHypForm({...BLANK_HYP})}>+ 追加</Btn>
          </div>

          {filteredHyps.length===0 && <div style={{ textAlign:"center", padding:48, color:C.muted }}>仮説がまだありません</div>}

          {filteredHyps.map(h=>{
            const open = hypExpanded===h.id
            return (
              <Card key={h.id} style={{ overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 16px", cursor:"pointer" }} onClick={()=>setHypExpanded(open?null:h.id)}>
                  <StatusBadge status={h.status}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ color:C.text, fontSize:13, fontWeight:700, margin:"0 0 3px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.title}</p>
                    <p style={{ color:C.muted, fontSize:10, margin:0 }}>
                      {h.start_date}{h.end_date&&` → ${h.end_date}`}
                      {h.promoted&&<span style={{ color:C.green, marginLeft:8, fontWeight:700 }}>✓ ルール化済</span>}
                    </p>
                  </div>
                  <div style={{ display:"flex", gap:4 }} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>setHypForm({...h})} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:"3px 7px", fontSize:11, fontFamily:"inherit" }}>編集</button>
                    <button onClick={()=>delHyp(h.id)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:"3px 7px", fontSize:11, fontFamily:"inherit" }}>削除</button>
                  </div>
                  <span style={{ color:C.muted, fontSize:10 }}>{open?"▲":"▼"}</span>
                </div>
                {open && (
                  <div style={{ padding:"14px 16px 16px", background:C.pageBg, borderTop:`1px solid ${C.border}` }}>
                    {[["仮説",h.hypothesis],["検証方法",h.method],["結果",h.result],["結論",h.conclusion]].map(([label,val])=>(
                      val ? (
                        <div key={label} style={{ marginBottom:12 }}>
                          <p style={{ color:C.muted, fontSize:10, fontWeight:700, letterSpacing:1, margin:"0 0 4px", textTransform:"uppercase" }}>{label}</p>
                          <p style={{ color:C.text, fontSize:13, lineHeight:1.8, margin:0, whiteSpace:"pre-wrap" }}>{val}</p>
                        </div>
                      ) : null
                    ))}
                    {h.status==="検証済" && !h.promoted && (
                      <div style={{ marginTop:8, padding:"10px 14px", background:`${C.green}10`, border:`1px solid ${C.green}30`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                        <p style={{ color:C.green, fontSize:12, fontWeight:600, margin:0 }}>検証済です。ルールブックに昇格しますか？</p>
                        <Btn small onClick={()=>promoteToRule(h)} style={{ background:C.green }}>ルール化 →</Btn>
                      </div>
                    )}
                    <div style={{ marginTop:12, display:"flex", gap:5, flexWrap:"wrap" }}>
                      <span style={{ color:C.muted, fontSize:11, alignSelf:"center" }}>ステータス変更:</span>
                      {HYP_STATUS.map(s=>(
                        <button key={s} onClick={()=>setHyps(hs=>hs.map(x=>x.id===h.id?{...x,status:s}:x))}
                          style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer",
                            border:`1px solid ${h.status===s?HYP_STATUS_COLORS[s]:C.border}`,
                            background:h.status===s?`${HYP_STATUS_COLORS[s]}18`:"transparent",
                            color:h.status===s?HYP_STATUS_COLORS[s]:C.muted, fontFamily:"inherit" }}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ═══════════════════ TEMPLATES ═══════════════════ */}
      {tab==="templates" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <Btn small onClick={()=>setTmplForm({...BLANK_TMPL})}>+ 追加</Btn>
          </div>
          {tmpls.length===0 && <div style={{ textAlign:"center", padding:48, color:C.muted }}>テンプレートがまだありません</div>}
          {tmpls.map(t=>(
            <Card key={t.id} style={{ padding:"16px 18px" }}>
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
                    <p style={{ color:C.text, fontSize:14, fontWeight:700, margin:0 }}>{t.title}</p>
                    {t.tags.map(tag=>(
                      <span key={tag} style={{ background:`${C.blue}12`, color:C.blue, border:`1px solid ${C.blue}25`, borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:600 }}>{tag}</span>
                    ))}
                  </div>
                  <pre style={{ color:C.sub, fontSize:13, lineHeight:1.8, margin:0, fontFamily:"inherit", whiteSpace:"pre-wrap" }}>{t.body}</pre>
                </div>
                <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                  <button onClick={()=>setTmplForm({...t,tags:[...t.tags]})} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:"3px 7px", fontSize:11, fontFamily:"inherit" }}>編集</button>
                  <button onClick={()=>delTmpl(t.id)} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:"3px 7px", fontSize:11, fontFamily:"inherit" }}>削除</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ═══ RULEBOOK FORM MODAL ═══ */}
      {ruleForm && (
        <Modal title={ruleForm.id?"ルールを編集":"ルールを追加"} onClose={()=>setRuleForm(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="カテゴリ">
                <select style={IS} value={ruleForm.cat} onChange={e=>setRuleForm(f=>({...f,cat:e.target.value}))}>
                  {ruleCats.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="確信度">
                <div style={{ paddingTop:8 }}>
                  <StarRating value={ruleForm.confidence} onChange={v=>setRuleForm(f=>({...f,confidence:v}))}/>
                </div>
              </Field>
            </div>
            <Field label="ラベル（ポストと共通）">
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {postLabels.map(l=>(
                  <Chip key={l} label={l} active={(ruleForm.labels||[]).includes(l)} color={C.blue}
                    onClick={()=>setRuleForm(f=>({...f,labels:(f.labels||[]).includes(l)?(f.labels||[]).filter(x=>x!==l):[...(f.labels||[]),l]}))}/>
                ))}
              </div>
            </Field>
            <Field label="タイトル">
              <input style={IS} value={ruleForm.title} onChange={e=>setRuleForm(f=>({...f,title:e.target.value}))} placeholder="法則の名前"/>
            </Field>
            <Field label="内容">
              <textarea style={{ ...IS, resize:"vertical" }} rows={5} value={ruleForm.body} onChange={e=>setRuleForm(f=>({...f,body:e.target.value}))} placeholder="具体的な内容・理由・適用条件..."/>
            </Field>
            <Field label="出典ポスト（任意）">
              <input style={IS} value={ruleForm.source_title} onChange={e=>setRuleForm(f=>({...f,source_title:e.target.value}))} placeholder="関連するポストのタイトル"/>
            </Field>
            <Btn onClick={saveRule} disabled={!ruleForm.title}>保存</Btn>
          </div>
        </Modal>
      )}

      {/* ═══ HYPOTHESIS FORM MODAL ═══ */}
      {hypForm && (
        <Modal title={hypForm.id?"仮説を編集":"仮説を追加"} onClose={()=>setHypForm(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            <Field label="タイトル（仮説の一言要約）">
              <input style={IS} value={hypForm.title} onChange={e=>setHypForm(f=>({...f,title:e.target.value}))} placeholder="例：朝7時投稿は夜より伸びる"/>
            </Field>
            <Field label="仮説の詳細">
              <textarea style={{ ...IS, resize:"vertical" }} rows={3} value={hypForm.hypothesis} onChange={e=>setHypForm(f=>({...f,hypothesis:e.target.value}))} placeholder="具体的に何を検証するか"/>
            </Field>
            <Field label="検証方法">
              <textarea style={{ ...IS, resize:"vertical" }} rows={2} value={hypForm.method} onChange={e=>setHypForm(f=>({...f,method:e.target.value}))} placeholder="どのように確かめるか"/>
            </Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <Field label="ステータス">
                <select style={IS} value={hypForm.status} onChange={e=>setHypForm(f=>({...f,status:e.target.value}))}>
                  {HYP_STATUS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="開始日">
                <input type="date" style={IS} value={hypForm.start_date} onChange={e=>setHypForm(f=>({...f,start_date:e.target.value}))}/>
              </Field>
              <Field label="終了（予定）日">
                <input type="date" style={IS} value={hypForm.end_date} onChange={e=>setHypForm(f=>({...f,end_date:e.target.value}))}/>
              </Field>
            </div>
            <Field label="結果（検証後に記入）">
              <textarea style={{ ...IS, resize:"vertical" }} rows={2} value={hypForm.result} onChange={e=>setHypForm(f=>({...f,result:e.target.value}))} placeholder="数値や観察結果を書く"/>
            </Field>
            <Field label="結論">
              <textarea style={{ ...IS, resize:"vertical" }} rows={2} value={hypForm.conclusion} onChange={e=>setHypForm(f=>({...f,conclusion:e.target.value}))} placeholder="この仮説から何を学んだか"/>
            </Field>
            <Btn onClick={saveHyp} disabled={!hypForm.title}>保存</Btn>
          </div>
        </Modal>
      )}

      {/* ═══ TEMPLATE FORM MODAL ═══ */}
      {tmplForm && (
        <Modal title={tmplForm.id?"テンプレートを編集":"テンプレートを追加"} onClose={()=>setTmplForm(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            <Field label="テンプレート名">
              <input style={IS} value={tmplForm.title} onChange={e=>setTmplForm(f=>({...f,title:e.target.value}))} placeholder="例：リスト型・習慣系"/>
            </Field>
            <Field label="構成内容">
              <textarea style={{ ...IS, resize:"vertical" }} rows={6} value={tmplForm.body} onChange={e=>setTmplForm(f=>({...f,body:e.target.value}))} placeholder="1行目：...\n2行目：...\n本文：...\n締め：..."/>
            </Field>
            <Field label="タグ">
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:6 }}>
                {tmplForm.tags.map(tag=>(
                  <span key={tag} style={{ display:"inline-flex", alignItems:"center", gap:4, background:`${C.blue}12`, color:C.blue, border:`1px solid ${C.blue}25`, borderRadius:20, padding:"2px 9px", fontSize:11 }}>
                    {tag}
                    <button onClick={()=>setTmplForm(f=>({...f,tags:f.tags.filter(t=>t!==tag)}))} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", padding:0, fontSize:12 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...IS, flex:1 }} value={newTag} onChange={e=>setNewTag(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter"&&newTag.trim()){ setTmplForm(f=>({...f,tags:[...f.tags,newTag.trim()]})); setNewTag("") }}}
                  placeholder="タグを追加（Enterで確定）"/>
                <Btn small onClick={()=>{ if(newTag.trim()){ setTmplForm(f=>({...f,tags:[...f.tags,newTag.trim()]})); setNewTag("") }}} disabled={!newTag.trim()}>追加</Btn>
              </div>
            </Field>
            <Btn onClick={saveTmpl} disabled={!tmplForm.title}>保存</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// APP SHELL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const NAV = [
  { id:"tracker",   label:"Tracker",   icon:"◎" },
  { id:"report",    label:"Report",    icon:"≡" },
  { id:"posts",     label:"Posts",     icon:"□" },
  { id:"memo",      label:"Memo",      icon:"✎" },
  { id:"knowledge", label:"Knowledge", icon:"◈" },
]

export default function XManager({ initialData={} }) {
  const {
    actions:     initActions,
    posts:       initPosts,
    analytics:   initAnalytics,
    weeklyReviews: initReviews,
    rules:       initRules,
    hyps:        initHyps,
    tmpls:       initTmpls,
    settings:    initSettings,
    actionItems: initActionItems,
    kpiItems:    initKpiItems,
  } = initialData

  const [page, setPage] = useState("tracker")
  const [sideOpen, setSideOpen] = useState(true)
  const [actions, setActions]           = useState(initActions     || SAMPLE_ACTIONS)
  const [posts,   setPosts]             = useState(initPosts       || SAMPLE_POSTS)
  const [analytics]                     = useState(initAnalytics   || SAMPLE_ANALYTICS)
  const [actionItems, setActionItems]   = useState(initActionItems || DEFAULT_ACTION_ITEMS)
  const [kpiItems,    setKpiItems]      = useState(initKpiItems    || DEFAULT_KPI_ITEMS)
  const [weeklyReviews, setWeeklyReviews] = useState(initReviews  || SAMPLE_REVIEWS)
  const [settings, setSettings]         = useState(initSettings    || DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [rules, setRules]               = useState(initRules       || SAMPLE_RULES)
  const [hyps,  setHyps]                = useState(initHyps        || SAMPLE_HYPS)
  const [tmpls, setTmpls]               = useState(initTmpls       || SAMPLE_TMPLS)

  // ── JST date + auto-reset ───────────────────────────────────
  const [today, setToday] = useState(jstDateStr)
  const lastResetDateRef = useRef(jstDateStr())

  useEffect(()=>{
    const tick = setInterval(()=>{
      const nowDate = jstDateStr()
      const nowHour = jstHour()
      // Advance "today" when JST date has changed AND current hour >= reset threshold
      if (nowDate > lastResetDateRef.current && nowHour >= settings.resetHour) {
        lastResetDateRef.current = nowDate
        setToday(nowDate)
        // Previous day's data stays in actions history; new today starts blank automatically
      }
    }, 30_000) // poll every 30s
    return ()=>clearInterval(tick)
  }, [settings.resetHour])

  const todayAct = actions.find(a=>a.date===today)
  const totalToday = todayAct ? actionItems.reduce((s,i)=>s+(todayAct[i.id]||0),0) : 0
  const PAGE_LABELS = { tracker:"Tracker", report:"Report", posts:"Posts", memo:"Memo Stock", knowledge:"Knowledge" }

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:C.pageBg, fontFamily:"'Helvetica Neue', Helvetica, 'Hiragino Sans', 'Noto Sans JP', sans-serif" }}>

      {/* Sidebar */}
      <div style={{ width:sideOpen?196:52, background:C.sidebar, flexShrink:0, display:"flex", flexDirection:"column", transition:"width 0.2s ease", overflow:"hidden", position:"sticky", top:0, height:"100vh" }}>
        <div style={{ padding:sideOpen?"18px 16px 14px":"18px 10px 14px", borderBottom:"1px solid #ffffff12" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, background:`${C.blue}28`, border:`1px solid ${C.blue}45`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ color:C.blue, fontSize:14, fontWeight:900, fontFamily:"monospace" }}>X</span>
            </div>
            {sideOpen&&<div>
              <p style={{ margin:0, color:"#E0E4F4", fontSize:12, fontWeight:700 }}>X Manager</p>
              <p style={{ margin:0, color:"#3A4060", fontSize:10 }}>{today}</p>
            </div>}
          </div>
        </div>

        <nav style={{ flex:1, padding:"10px 7px" }}>
          {NAV.map(({id,label,icon})=>{
            const active=page===id
            return (
              <button key={id} onClick={()=>setPage(id)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:sideOpen?"8px 12px":"8px 13px", borderRadius:8, border:"none", cursor:"pointer", background:active?`${C.blue}24`:"transparent", color:active?"#C0CFFF":"#4A5880", fontSize:13, fontWeight:active?700:400, fontFamily:"inherit", marginBottom:2, transition:"all 0.12s", borderLeft:active?`2px solid ${C.blue}`:"2px solid transparent", whiteSpace:"nowrap", overflow:"hidden" }}>
                <span style={{ fontSize:13, flexShrink:0 }}>{icon}</span>
                {sideOpen&&label}
              </button>
            )
          })}
        </nav>

        {sideOpen&&<div style={{ padding:"10px 14px 4px", borderTop:"1px solid #ffffff12" }}>
          <p style={{ color:"#2A3055", fontSize:9, letterSpacing:1.5, margin:"0 0 4px", textTransform:"uppercase" }}>Today's XP</p>
          <p style={{ color:C.amber, fontSize:26, fontWeight:900, margin:0, fontFamily:"monospace" }}>+{totalToday}</p>
        </div>}

        {sideOpen&&<div style={{ padding:"4px 14px 8px" }}>
          <p style={{ color:"#2A3055", fontSize:9, margin:0 }}>
            リセット {settings.resetHour}:00 JST{!settings.soundEnabled&&" · 音OFF"}
          </p>
        </div>}

        <div style={{ padding:"0 7px 10px", display:"flex", flexDirection:"column", gap:5 }}>
          <button onClick={()=>setShowSettings(true)}
            style={{ background:"transparent", border:"1px solid #ffffff15", borderRadius:8, color:"#3A4565", padding:"6px", cursor:"pointer", fontSize:12, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
            {sideOpen?<><span>⚙</span>設定</>:"⚙"}
          </button>
          <button onClick={()=>setSideOpen(o=>!o)}
            style={{ background:"transparent", border:"1px solid #ffffff15", borderRadius:8, color:"#3A4565", padding:"5px", cursor:"pointer", fontSize:12 }}>
            {sideOpen?"◀":"▶"}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ padding:"16px 24px 13px", borderBottom:`1px solid ${C.border}`, background:C.card, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
          <h2 style={{ margin:0, color:C.text, fontSize:19, fontWeight:800, letterSpacing:-0.5 }}>{PAGE_LABELS[page]}</h2>
          <span style={{ color:C.muted, fontSize:12, fontFamily:"monospace" }}>{today}</span>
        </div>
        <div style={{ padding:"20px 24px 80px", maxWidth:880, margin:"0 auto" }}>
          {page==="tracker"  &&<Tracker today={today} actions={actions} setActions={setActions} posts={posts} setPosts={setPosts} actionItems={actionItems} setActionItems={setActionItems} settings={settings}/>}
          {page==="report"   &&<Report  today={today} actions={actions} setActions={setActions} analytics={analytics} actionItems={actionItems} kpiItems={kpiItems} setKpiItems={setKpiItems} weeklyReviews={weeklyReviews} setWeeklyReviews={setWeeklyReviews}/>}
          {page==="posts"    &&<Posts   today={today} posts={posts} setPosts={setPosts} settings={settings}/>}
          {page==="memo"     &&<MemoStock posts={posts} actions={actions} actionItems={actionItems} tmpls={tmpls} setTmpls={setTmpls}/>}
          {page==="knowledge"&&<Knowledge rules={rules} setRules={setRules} hyps={hyps} setHyps={setHyps} tmpls={tmpls} setTmpls={setTmpls} settings={settings}/>}
        </div>
      </div>

      {showSettings&&<SettingsModal settings={settings} setSettings={setSettings} onClose={()=>setShowSettings(false)}/>}
    </div>
  )
}
