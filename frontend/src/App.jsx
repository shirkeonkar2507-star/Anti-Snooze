import { useEffect, useState, useRef, useCallback } from "react";
import AlarmOverlay from "./components/AlarmOverlay";
import axios from "axios";

const API = "http://localhost:8000";

// ─────────────────────────────────────────────────────────────────────────────
// WEB AUDIO ALARM ENGINE
// ─────────────────────────────────────────────────────────────────────────────
class AlarmTone {
  constructor() {
    this.ctx       = null;
    this.gainNode  = null;
    this.beepTimer = null;
    this.rampTimer = null;
    this.volume    = 0.05;
    this.playing   = false;
  }

  _init() {
    if (this.ctx) return;
    this.ctx      = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
    this.gainNode.gain.value = 0.05;
  }

  _beep(freq = 880, durationMs = 160) {
    if (!this.ctx) return;
    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.gainNode);
    osc.type = "square";
    osc.frequency.value = freq;
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000 - 0.01);
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  }

  _startPattern() {
    const pattern = () => {
      this._beep(880, 160);
      setTimeout(() => this._beep(880, 160), 220);
    };
    pattern();
    this.beepTimer = setInterval(pattern, 900);
  }

  _startRamp() {
    const steps  = 90;
    const stepMs = 30000 / steps;
    const delta  = (1.0 - this.volume) / steps;
    this.rampTimer = setInterval(() => {
      this.volume = Math.min(1.0, this.volume + delta);
      if (this.gainNode) this.gainNode.gain.value = this.volume;
      if (this.volume >= 1.0) clearInterval(this.rampTimer);
    }, stepMs);
  }

  play() {
    if (this.playing) return;
    this._init();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.playing = true;
    this.volume  = 0.05;
    this.gainNode.gain.value = this.volume;
    this._startPattern();
    this._startRamp();
  }

  stop() {
    clearInterval(this.beepTimer);
    clearInterval(this.rampTimer);
    this.playing = false;
    this.volume  = 0.05;
    if (this.gainNode) this.gainNode.gain.value = 0;
    if (this.ctx) { this.ctx.close(); this.ctx = null; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALOG CLOCK
// ─────────────────────────────────────────────────────────────────────────────
function AnalogClock({ date }) {
  const s = date.getSeconds();
  const m = date.getMinutes() + s / 60;
  const h = (date.getHours() % 12) + m / 60;

  const hand = (angle, len, width, color, glow) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return (
      <line x1="50" y1="50"
        x2={50 + len * Math.cos(rad)} y2={50 + len * Math.sin(rad)}
        stroke={color} strokeWidth={width} strokeLinecap="round"
        style={glow ? { filter:`drop-shadow(0 0 5px ${color})` } : {}}
      />
    );
  };

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * 360;
    const rad   = ((angle - 90) * Math.PI) / 180;
    const big   = i % 5 === 0;
    return (
      <line key={i}
        x1={50 + (big?40:43.5)*Math.cos(rad)} y1={50 + (big?40:43.5)*Math.sin(rad)}
        x2={50 + 46*Math.cos(rad)}             y2={50 + 46*Math.sin(rad)}
        stroke={big?"#fbbf24":"#3b4a6b"} strokeWidth={big?1.0:0.5}
      />
    );
  });

  return (
    <svg viewBox="0 0 100 100" style={{ width:"100%", height:"100%" }}>
      <circle cx="50" cy="50" r="48" fill="#0a0f1a" stroke="#1e2d4a" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#fbbf2422" strokeWidth="0.5" />
      {ticks}
      {[12,1,2,3,4,5,6,7,8,9,10,11].map((n,i) => {
        const a = ((i/12)*360-90)*(Math.PI/180);
        return (
          <text key={n} x={50+34*Math.cos(a)} y={50+34*Math.sin(a)}
            textAnchor="middle" dominantBaseline="central"
            fontSize="5.2" fill="#94a3b8"
            fontFamily="'Courier New',monospace" fontWeight="bold"
          >{n}</text>
        );
      })}
      {hand(h*30, 23, 2.2, "#e2e8f0", false)}
      {hand(m*6,  31, 1.4, "#cbd5e1", false)}
      {hand(s*6,  35, 0.8, "#fbbf24", true)}
      <circle cx="50" cy="50" r="1.8" fill="#fbbf24"
        style={{ filter:"drop-shadow(0 0 5px #fbbf24)" }} />
    </svg>
  );
}

const DIFFS = [
  { id:"easy",   label:"EASY",  color:"#4ade80" },
  { id:"medium", label:"MED",   color:"#fbbf24" },
  { id:"hard",   label:"HARD",  color:"#f87171" },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [now, setNow]             = useState(new Date());
  const [alarmTime, setAlarmTime] = useState("");
  const [difficulty, setDiff]     = useState("medium");
  const [alarmSet, setAlarmSet]   = useState(null);
  const [isRinging, setIsRinging] = useState(false);
  const [ringDiff, setRingDiff]   = useState("medium");
  const [wsStatus, setWsStatus]   = useState("connecting");
  const [customTone, setCustomTone] = useState(null);
  const [toneMode, setToneMode]   = useState("beep");
  const [interacted, setInteracted] = useState(false);

  // ── Refs (never stale inside callbacks) ───────────────────────────────────
  const alarmTone    = useRef(new AlarmTone());
  const fileAudioRef = useRef(null);      // HTMLAudioElement for custom file
  const fileUrlRef   = useRef(null);      // Blob URL
  const toneModeRef  = useRef("beep");    // mirrors toneMode state — readable in WS callback
  const rampIdRef    = useRef(null);      // file-audio ramp interval
  const wsRef        = useRef(null);
  const reconnRef    = useRef(null);

  // Keep toneModeRef in sync whenever toneMode state changes
  useEffect(() => { toneModeRef.current = toneMode; }, [toneMode]);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Interaction tracking
  useEffect(() => {
    const mark = () => setInteracted(true);
    window.addEventListener("pointerdown", mark, { once: true });
    return () => window.removeEventListener("pointerdown", mark);
  }, []);

  // ── Audio start / stop ────────────────────────────────────────────────────
  // These read from REFS so they are always current, even inside the WS closure.
  const startAudio = useCallback(() => {
    if (toneModeRef.current === "file" && fileAudioRef.current) {
      // ── Custom file path ──
      const audio = fileAudioRef.current;
      audio.currentTime = 0;
      audio.volume = 0.05;
      audio.play()
        .then(() => {
          // Ramp volume 5% → 100% over 30 s
          clearInterval(rampIdRef.current);
          let v = 0.05;
          rampIdRef.current = setInterval(() => {
            v = Math.min(1.0, v + (0.95 / 90));
            audio.volume = v;
            if (v >= 1.0) clearInterval(rampIdRef.current);
          }, 333);
        })
        .catch(err => {
          console.error("Custom audio play failed:", err);
          // Fallback to generated beep if file fails
          alarmTone.current.play();
        });
    } else {
      // ── Generated beep path ──
      alarmTone.current.play();
    }
  }, []); // no deps — reads refs directly

  const stopAudio = useCallback(() => {
    // Stop generated beep
    alarmTone.current.stop();
    // Stop custom file
    clearInterval(rampIdRef.current);
    if (fileAudioRef.current) {
      fileAudioRef.current.pause();
      fileAudioRef.current.currentTime = 0;
    }
    setIsRinging(false);
  }, []);

  // ── WebSocket with auto-reconnect ─────────────────────────────────────────
  const connect = useCallback(() => {
    setWsStatus("connecting");
    const ws = new WebSocket("ws://localhost:8000/ws");
    wsRef.current = ws;
    ws.onopen  = () => setWsStatus("ok");
    ws.onclose = () => {
      setWsStatus("lost");
      reconnRef.current = setTimeout(connect, 3000);
    };
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.action === "TRIGGER_ALARM") {
        setRingDiff(d.difficulty || "medium");
        setIsRinging(true);
        startAudio();           // reads toneModeRef + fileAudioRef — always fresh
      }
      if (d.action === "DISMISS_ALARM") {
        stopAudio();
      }
    };
  }, [startAudio, stopAudio]);

  useEffect(() => {
    connect();
    return () => { clearTimeout(reconnRef.current); wsRef.current?.close(); };
  }, [connect]);

  // ── Custom tone file upload ────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke old blob URL to free memory
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);

    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;

    // Build the Audio element and store in ref immediately
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.05;
    fileAudioRef.current = audio;   // ref updated instantly — no async/stale issue

    setCustomTone(file.name);
    setToneMode("file");
    // toneModeRef is synced via useEffect above
    toneModeRef.current = "file";   // also set immediately so it's ready at once
  };

  // ── Set alarm ─────────────────────────────────────────────────────────────
  const handleSet = async () => {
    if (!alarmTime) return;
    try {
      await axios.post(`${API}/set-alarm`, { alarm_time: alarmTime, difficulty });
      setAlarmSet({ time: alarmTime, difficulty });
    } catch {
      alert("Backend unreachable. Is FastAPI running on :8000?");
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const pad = n => String(n).padStart(2, "0");
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const dayStr = now.toLocaleDateString("en-GB", {
    weekday:"long", day:"numeric", month:"long"
  }).toUpperCase();

  const accent  = DIFFS.find(d => d.id===difficulty)?.color ?? "#fbbf24";
  const wsColor = { connecting:"#fbbf24", ok:"#4ade80", lost:"#f87171" }[wsStatus];
  const wsLabel = { connecting:"LINKING…", ok:"LINKED", lost:"LOST · RETRYING" }[wsStatus];

  return (
    <div
      onPointerDown={() => setInteracted(true)}
      style={{
        minHeight:"100svh", display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        background:"#05080d",
        fontFamily:"'Courier New','Lucida Console',monospace",
        overflow:"hidden", position:"relative",
      }}
    >
      {/* Scanlines */}
      <div style={{
        position:"fixed", inset:0, zIndex:50, pointerEvents:"none",
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.12) 2px,rgba(0,0,0,0.12) 4px)",
      }}/>

      {/* Grid */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none",
        backgroundImage:`linear-gradient(rgba(251,191,36,0.04) 1px,transparent 1px),
                         linear-gradient(90deg,rgba(251,191,36,0.04) 1px,transparent 1px)`,
        backgroundSize:"44px 44px",
      }}/>

      {/* Corner brackets */}
      {[
        {top:0,    left:0,    borderTop:"1px solid #fbbf2455",    borderLeft:"1px solid #fbbf2455"},
        {top:0,    right:0,   borderTop:"1px solid #fbbf2455",    borderRight:"1px solid #fbbf2455"},
        {bottom:0, left:0,    borderBottom:"1px solid #fbbf2455", borderLeft:"1px solid #fbbf2455"},
        {bottom:0, right:0,   borderBottom:"1px solid #fbbf2455", borderRight:"1px solid #fbbf2455"},
      ].map((s,i)=>(
        <div key={i} style={{position:"fixed",width:72,height:72,pointerEvents:"none",...s}}/>
      ))}

      {/* Status bar */}
      <div style={{
        position:"fixed", top:0, left:0, right:0,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 36px", zIndex:40,
        borderBottom:"1px solid #1a2035",
        background:"linear-gradient(180deg,rgba(5,8,13,0.97),transparent)",
      }}>
        <span style={{color:"#64748b",fontSize:11,letterSpacing:"0.35em",fontWeight:600}}>
          ANTI-SNOOZE SYS v2
        </span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{
            width:7,height:7,borderRadius:"50%",display:"inline-block",
            background:wsColor, boxShadow:`0 0 10px ${wsColor}`,
          }}/>
          <span style={{color:wsColor,fontSize:11,letterSpacing:"0.3em",fontWeight:700}}>
            {wsLabel}
          </span>
        </div>
        <span style={{color:"#64748b",fontSize:11,letterSpacing:"0.25em",fontWeight:600}}>
          {dayStr}
        </span>
      </div>

      {/* Main layout */}
      <div style={{
        display:"flex", alignItems:"center", gap:72,
        maxWidth:920, width:"100%", padding:"0 52px",
        position:"relative", zIndex:10,
      }}>

        {/* Analog clock */}
        <div style={{flexShrink:0,width:264,height:264,position:"relative"}}>
          <div style={{
            position:"absolute",inset:-2,borderRadius:"50%",
            boxShadow:"0 0 0 1px #fbbf2422, 0 0 50px #fbbf2418",
          }}/>
          <AnalogClock date={now}/>
        </div>

        {/* Vertical divider */}
        <div style={{
          width:1, alignSelf:"stretch", flexShrink:0,
          background:"linear-gradient(180deg,transparent,#fbbf2466 30%,#fbbf2466 70%,transparent)",
        }}/>

        {/* Right panel */}
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:22}}>

          {/* Digital time */}
          <div>
            <div style={{
              fontSize:"clamp(3rem,7vw,5.2rem)", fontWeight:800,
              letterSpacing:"0.04em", color:"#f1f5f9", lineHeight:1,
              display:"flex", alignItems:"baseline", gap:2,
            }}>
              <span>{hh}</span>
              <span style={{color:"#fbbf24",margin:"0 2px",animation:"blink 1s step-end infinite"}}>:</span>
              <span>{mm}</span>
              <span style={{fontSize:"32%",color:"#94a3b8",marginLeft:"0.5em",fontWeight:400}}>{ss}</span>
            </div>
            <div style={{color:"#64748b",fontSize:11,letterSpacing:"0.35em",marginTop:8,fontWeight:600}}>
              {dayStr}
            </div>
          </div>

          <div style={{height:1,background:"linear-gradient(90deg,#fbbf2455,transparent)"}}/>

          {/* Time picker */}
          <div>
            <div style={{color:"#94a3b8",fontSize:10,letterSpacing:"0.35em",marginBottom:10,fontWeight:700}}>
              ◈ TARGET WAKE TIME
            </div>
            <input type="time"
              onChange={e=>setAlarmTime(e.target.value)}
              style={{
                width:"100%",padding:"11px 16px",
                background:"#0d1520",
                border:`1px solid ${alarmTime?"#fbbf2466":"#1e2d4a"}`,
                borderRadius:4, color:"#f1f5f9",
                fontSize:28, fontFamily:"inherit",
                letterSpacing:"0.08em", outline:"none",
                colorScheme:"dark", transition:"border-color 0.2s",
                boxSizing:"border-box",
              }}
            />
          </div>

          {/* Difficulty */}
          <div>
            <div style={{color:"#94a3b8",fontSize:10,letterSpacing:"0.35em",marginBottom:10,fontWeight:700}}>
              ◈ PUZZLE DIFFICULTY
            </div>
            <div style={{display:"flex",gap:10}}>
              {DIFFS.map(d=>(
                <button key={d.id} onClick={()=>setDiff(d.id)} style={{
                  flex:1, padding:"11px 0",
                  background:difficulty===d.id?`${d.color}1a`:"#0d1520",
                  border:`1px solid ${difficulty===d.id?d.color:"#1e2d4a"}`,
                  borderRadius:4,
                  color:difficulty===d.id?d.color:"#64748b",
                  fontSize:10, letterSpacing:"0.3em",
                  fontFamily:"inherit", fontWeight:800,
                  cursor:"pointer", transition:"all 0.18s",
                  boxShadow:difficulty===d.id?`0 0 18px ${d.color}30`:"none",
                }}>{d.label}</button>
              ))}
            </div>
          </div>

          {/* Alarm Tone */}
          <div>
            <div style={{color:"#94a3b8",fontSize:10,letterSpacing:"0.35em",marginBottom:10,fontWeight:700}}>
              ◈ ALARM TONE
            </div>
            <div style={{display:"flex",gap:10,marginBottom:8}}>

              <button onClick={()=>setToneMode("beep")} style={{
                flex:1, padding:"10px 0",
                background:toneMode==="beep"?"#fbbf2414":"#0d1520",
                border:`1px solid ${toneMode==="beep"?"#fbbf24":"#1e2d4a"}`,
                borderRadius:4,
                color:toneMode==="beep"?"#fbbf24":"#64748b",
                fontSize:10, letterSpacing:"0.2em",
                fontFamily:"inherit", fontWeight:800, cursor:"pointer",
                transition:"all 0.18s",
                boxShadow:toneMode==="beep"?"0 0 18px #fbbf2430":"none",
              }}>⚡ GENERATED</button>

              <label style={{
                flex:1, padding:"10px 0",
                background:toneMode==="file"?"#4ade8014":"#0d1520",
                border:`1px solid ${toneMode==="file"?"#4ade80":"#1e2d4a"}`,
                borderRadius:4,
                color:toneMode==="file"?"#4ade80":"#64748b",
                fontSize:10, letterSpacing:"0.2em",
                fontFamily:"inherit", fontWeight:800, cursor:"pointer",
                transition:"all 0.18s", textAlign:"center",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:toneMode==="file"?"0 0 18px #4ade8030":"none",
              }}>
                ♪ CUSTOM FILE
                <input type="file" accept="audio/*"
                  onChange={handleFileUpload}
                  style={{display:"none"}}
                />
              </label>
            </div>

            {/* Tone status line */}
            <div style={{
              fontSize:9, letterSpacing:"0.2em", paddingLeft:2,
              color: toneMode==="file" ? "#4ade80" : "#64748b",
            }}>
              {toneMode==="file" && customTone
                ? `▶ ${customTone}`
                : "▶ SQUARE WAVE BEEP · RAMPS 5%→100% / 30s"
              }
            </div>
          </div>

          {/* ARM button */}
          <button onClick={handleSet} disabled={!alarmTime} style={{
            padding:"14px", borderRadius:4,
            background:alarmTime?accent:"#0d1520",
            border:`1px solid ${alarmTime?accent:"#1e2d4a"}`,
            color:alarmTime?"#000":"#2d3e5a",
            fontSize:11, letterSpacing:"0.45em",
            fontFamily:"inherit", fontWeight:800,
            cursor:alarmTime?"pointer":"not-allowed",
            transition:"all 0.2s",
            boxShadow:alarmTime?`0 0 32px ${accent}45`:"none",
          }}>ARM ALARM</button>

          {/* Confirmation */}
          {alarmSet && (
            <div style={{
              padding:"11px 16px", borderRadius:4,
              border:"1px solid #4ade8033", background:"#4ade8010",
              color:"#4ade80", fontSize:10, letterSpacing:"0.25em", fontWeight:700,
            }}>
              ◆ ARMED · {alarmSet.time} · {alarmSet.difficulty.toUpperCase()}
            </div>
          )}

          {/* Interaction warning */}
          {!interacted && (
            <div style={{
              padding:"10px 14px", borderRadius:4,
              border:"1px solid #fbbf2433", background:"#fbbf2410",
              color:"#fbbf24", fontSize:9, letterSpacing:"0.2em", fontWeight:700,
            }}>
              ⚠ CLICK ANYWHERE ONCE TO ENABLE AUDIO
            </div>
          )}
        </div>
      </div>

      {/* Bottom strip */}
      <div style={{
        position:"fixed", bottom:14, left:0, right:0,
        textAlign:"center", color:"#2d3e5a",
        fontSize:9, letterSpacing:"0.3em", zIndex:40, fontWeight:600,
      }}>
        WEB AUDIO API · CUSTOM FILE SUPPORT · WS AUTO-RECONNECT · SERVER-SIDE VERIFICATION
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        input[type=time]::-webkit-calendar-picker-indicator{filter:invert(0.5) sepia(1) saturate(2);cursor:pointer;}
      `}</style>

      {isRinging && <AlarmOverlay difficulty={ringDiff} onSolve={stopAudio}/>}
    </div>
  );
}
