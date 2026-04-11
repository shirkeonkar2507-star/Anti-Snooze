import { useEffect, useState, useRef, useCallback } from "react";
import AlarmOverlay from "./components/AlarmOverlay";
import axios from "axios";

const API = "http://localhost:8000";

function rampVolume(audio, from = 0.04, to = 1.0, durationMs = 30000) {
  audio.volume = from;
  const steps = 80;
  const stepMs = durationMs / steps;
  const delta = (to - from) / steps;
  let cur = from;
  const id = setInterval(() => {
    cur = Math.min(to, cur + delta);
    audio.volume = cur;
    if (cur >= to) clearInterval(id);
  }, stepMs);
  return id;
}

// ── Analog SVG Clock ──────────────────────────────────────────────────────────
function AnalogClock({ date }) {
  const s = date.getSeconds();
  const m = date.getMinutes() + s / 60;
  const h = (date.getHours() % 12) + m / 60;

  const hand = (angle, len, width, color, glow) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    const x = 50 + len * Math.cos(rad);
    const y = 50 + len * Math.sin(rad);
    return (
      <line x1="50" y1="50" x2={x} y2={y}
        stroke={color} strokeWidth={width} strokeLinecap="round"
        style={glow ? { filter: `drop-shadow(0 0 4px ${color})` } : {}}
      />
    );
  };

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * 360;
    const rad = ((angle - 90) * Math.PI) / 180;
    const big = i % 5 === 0;
    const r1 = big ? 40 : 43.5;
    return (
      <line key={i}
        x1={50 + r1 * Math.cos(rad)} y1={50 + r1 * Math.sin(rad)}
        x2={50 + 46 * Math.cos(rad)} y2={50 + 46 * Math.sin(rad)}
        stroke={big ? "#f59e0b" : "#1e293b"} strokeWidth={big ? 0.9 : 0.45}
      />
    );
  });

  return (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
      <circle cx="50" cy="50" r="48" fill="#080b10" stroke="#0f172a" strokeWidth="1" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#f59e0b11" strokeWidth="0.5" />
      {ticks}
      {[12,1,2,3,4,5,6,7,8,9,10,11].map((n, i) => {
        const a = ((i / 12) * 360 - 90) * (Math.PI / 180);
        return (
          <text key={n}
            x={50 + 34 * Math.cos(a)} y={50 + 34 * Math.sin(a)}
            textAnchor="middle" dominantBaseline="central"
            fontSize="4.8" fill="#475569"
            fontFamily="'Courier New', monospace" fontWeight="bold"
          >{n}</text>
        );
      })}
      {hand(h * 30, 23, 2.0, "#cbd5e1", false)}
      {hand(m * 6, 31, 1.3, "#94a3b8", false)}
      {hand(s * 6, 35, 0.7, "#f59e0b", true)}
      <circle cx="50" cy="50" r="1.8" fill="#f59e0b"
        style={{ filter: "drop-shadow(0 0 4px #f59e0b)" }} />
    </svg>
  );
}

const DIFFS = [
  { id: "easy",   label: "EASY",   color: "#22c55e" },
  { id: "medium", label: "MED",    color: "#f59e0b" },
  { id: "hard",   label: "HARD",   color: "#ef4444" },
];

export default function App() {
  const [now, setNow]           = useState(new Date());
  const [alarmTime, setAlarmTime] = useState("");
  const [difficulty, setDiff]   = useState("medium");
  const [alarmSet, setAlarmSet] = useState(null);
  const [isRinging, setIsRinging] = useState(false);
  const [ringDiff, setRingDiff] = useState("medium");
  const [wsStatus, setWsStatus] = useState("connecting");

  const audioRef = useRef(null);
  const rampRef  = useRef(null);
  const wsRef    = useRef(null);
  const reconnRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const a = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock_prowl.ogg");
    a.loop = true; a.volume = 0.04;
    audioRef.current = a;
    return () => a.pause();
  }, []);

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
        const a = audioRef.current;
        a.currentTime = 0;
        a.play().catch(() => {});
        rampRef.current = rampVolume(a);
      }
      if (d.action === "DISMISS_ALARM") stopAlarm();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => { clearTimeout(reconnRef.current); wsRef.current?.close(); };
  }, [connect]);

  const stopAlarm = () => {
    setIsRinging(false);
    clearInterval(rampRef.current);
    const a = audioRef.current;
    if (a) { a.pause(); a.currentTime = 0; a.volume = 0.04; }
  };

  const handleSet = async () => {
    if (!alarmTime) return;
    try {
      await axios.post(`${API}/set-alarm`, { alarm_time: alarmTime, difficulty });
      setAlarmSet({ time: alarmTime, difficulty });
    } catch {
      alert("Backend unreachable. Is FastAPI running on :8000?");
    }
  };

  const pad = n => String(n).padStart(2, "0");
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const dayStr = now.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" }).toUpperCase();

  const accent = DIFFS.find(d => d.id === difficulty)?.color ?? "#f59e0b";
  const wsColor = { connecting:"#f59e0b", ok:"#22c55e", lost:"#ef4444" }[wsStatus];
  const wsLabel = { connecting:"LINKING…", ok:"LINKED", lost:"LOST · RETRYING" }[wsStatus];

  return (
    <div style={{
      minHeight: "100svh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "#05080d",
      fontFamily: "'Courier New', 'Lucida Console', monospace",
      overflow: "hidden", position: "relative",
    }}>
      {/* Scanlines */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 50, pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 4px)",
      }} />

      {/* Grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(rgba(245,158,11,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.03) 1px,transparent 1px)`,
        backgroundSize: "44px 44px",
      }} />

      {/* Corner brackets */}
      {[
        { top:0,    left:0,    borderTop:"1px solid #f59e0b33", borderLeft:"1px solid #f59e0b33"  },
        { top:0,    right:0,   borderTop:"1px solid #f59e0b33", borderRight:"1px solid #f59e0b33" },
        { bottom:0, left:0,    borderBottom:"1px solid #f59e0b33", borderLeft:"1px solid #f59e0b33"  },
        { bottom:0, right:0,   borderBottom:"1px solid #f59e0b33", borderRight:"1px solid #f59e0b33" },
      ].map((s, i) => (
        <div key={i} style={{ position:"fixed", width:64, height:64, pointerEvents:"none", ...s }} />
      ))}

      {/* Top status bar */}
      <div style={{
        position:"fixed", top:0, left:0, right:0,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"16px 32px", zIndex:40,
        borderBottom: "1px solid #0f172a",
        background: "linear-gradient(180deg,#05080d,transparent)",
      }}>
        <span style={{ color:"#1e293b", fontSize:10, letterSpacing:"0.35em" }}>ANTI-SNOOZE SYS v2</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{
            width:6, height:6, borderRadius:"50%", display:"inline-block",
            background: wsColor, boxShadow: `0 0 8px ${wsColor}`,
          }} />
          <span style={{ color: wsColor, fontSize:10, letterSpacing:"0.25em" }}>{wsLabel}</span>
        </div>
        <span style={{ color:"#1e293b", fontSize:10, letterSpacing:"0.25em" }}>{dayStr}</span>
      </div>

      {/* ── Main content ── */}
      <div style={{
        display:"flex", alignItems:"center", gap:64,
        maxWidth:860, width:"100%", padding:"0 48px", position:"relative", zIndex:10,
      }}>

        {/* ─ Left: Analog clock ─ */}
        <div style={{ flexShrink:0, width:256, height:256, position:"relative" }}>
          <div style={{
            position:"absolute", inset:-1, borderRadius:"50%",
            boxShadow:"0 0 0 1px #f59e0b1a, 0 0 60px #f59e0b0d, 0 0 120px #f59e0b06",
          }} />
          <AnalogClock date={now} />
        </div>

        {/* Vertical rule */}
        <div style={{
          width:1, alignSelf:"stretch",
          background:"linear-gradient(180deg,transparent,#f59e0b33 30%,#f59e0b33 70%,transparent)",
        }} />

        {/* ─ Right: Digital + Controls ─ */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:24 }}>

          {/* Digital time */}
          <div>
            <div style={{
              fontSize:"clamp(2.8rem,7vw,5rem)", fontWeight:700,
              letterSpacing:"0.04em", color:"#f1f5f9", lineHeight:1,
              textShadow:"0 0 60px rgba(241,245,249,0.08)",
            }}>
              {hh}
              <span style={{ color:"#f59e0b", animation:"blink 1s step-end infinite" }}>:</span>
              {mm}
              <span style={{ fontSize:"36%", color:"#334155", marginLeft:"0.4em", verticalAlign:"middle" }}>
                {ss}
              </span>
            </div>
            <div style={{ color:"#1e293b", fontSize:9, letterSpacing:"0.4em", marginTop:6 }}>
              {dayStr}
            </div>
          </div>

          {/* Rule */}
          <div style={{ height:1, background:"linear-gradient(90deg,#f59e0b33,transparent)" }} />

          {/* Time picker */}
          <div>
            <div style={{ color:"#334155", fontSize:9, letterSpacing:"0.35em", marginBottom:8 }}>
              ◈ TARGET WAKE TIME
            </div>
            <input type="time"
              onChange={e => setAlarmTime(e.target.value)}
              style={{
                width:"100%", padding:"10px 14px",
                background:"#080b10",
                border:`1px solid ${alarmTime ? "#f59e0b55" : "#0f172a"}`,
                borderRadius:3, color:"#f1f5f9",
                fontSize:26, fontFamily:"inherit", letterSpacing:"0.08em",
                outline:"none", colorScheme:"dark",
                transition:"border-color 0.2s",
                boxSizing:"border-box",
              }}
            />
          </div>

          {/* Difficulty */}
          <div>
            <div style={{ color:"#334155", fontSize:9, letterSpacing:"0.35em", marginBottom:8 }}>
              ◈ PUZZLE DIFFICULTY
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {DIFFS.map(d => (
                <button key={d.id} onClick={() => setDiff(d.id)} style={{
                  flex:1, padding:"10px 0",
                  background: difficulty===d.id ? `${d.color}14` : "transparent",
                  border:`1px solid ${difficulty===d.id ? d.color : "#0f172a"}`,
                  borderRadius:3,
                  color: difficulty===d.id ? d.color : "#334155",
                  fontSize:9, letterSpacing:"0.3em",
                  fontFamily:"inherit", fontWeight:700,
                  cursor:"pointer", transition:"all 0.15s",
                  boxShadow: difficulty===d.id ? `0 0 16px ${d.color}25` : "none",
                }}>{d.label}</button>
              ))}
            </div>
          </div>

          {/* ARM button */}
          <button onClick={handleSet} disabled={!alarmTime} style={{
            padding:"14px", borderRadius:3,
            background: alarmTime ? accent : "transparent",
            border:`1px solid ${alarmTime ? accent : "#0f172a"}`,
            color: alarmTime ? "#000" : "#0f172a",
            fontSize:10, letterSpacing:"0.45em",
            fontFamily:"inherit", fontWeight:700,
            cursor: alarmTime ? "pointer" : "not-allowed",
            transition:"all 0.2s",
            boxShadow: alarmTime ? `0 0 32px ${accent}40` : "none",
          }}>
            ARM ALARM
          </button>

          {/* Armed confirmation */}
          {alarmSet && (
            <div style={{
              padding:"10px 14px", borderRadius:3,
              border:"1px solid #22c55e2a", background:"#22c55e08",
              color:"#22c55e", fontSize:10, letterSpacing:"0.25em",
            }}>
              ◆ ARMED · {alarmSet.time} · {alarmSet.difficulty.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Bottom strip */}
      <div style={{
        position:"fixed", bottom:16, left:0, right:0,
        textAlign:"center", color:"#0f172a", fontSize:9, letterSpacing:"0.3em", zIndex:40,
      }}>
        VOL 5%→100% / 30s &nbsp;·&nbsp; WS AUTO-RECONNECT &nbsp;·&nbsp; PUZZLE VERIFIED SERVER-SIDE
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
        input[type=time]::-webkit-calendar-picker-indicator { filter:invert(0.3); cursor:pointer; }
        * { box-sizing: border-box; }
      `}</style>

      {isRinging && <AlarmOverlay difficulty={ringDiff} onSolve={stopAlarm} />}
    </div>
  );
}