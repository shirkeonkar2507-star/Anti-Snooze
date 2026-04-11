import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";

const API = "http://localhost:8000";

const DIFF_META = {
  easy:   { label:"EASY",   color:"#22c55e", bg:"#22c55e0d", border:"#22c55e25" },
  medium: { label:"MEDIUM", color:"#f59e0b", bg:"#f59e0b0d", border:"#f59e0b25" },
  hard:   { label:"HARD",   color:"#ef4444", bg:"#ef44440d", border:"#ef444425" },
};

// Glitchy digit display
function GlitchText({ text, color }) {
  const [glitch, setGlitch] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 120);
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      position:"relative", display:"inline-block",
      color, fontFamily:"'Courier New',monospace",
    }}>
      {glitch && (
        <>
          <span style={{
            position:"absolute", inset:0,
            color:"#ef4444", transform:"translate(-2px,1px)",
            opacity:0.7, clipPath:"inset(30% 0 50% 0)", pointerEvents:"none",
          }}>{text}</span>
          <span style={{
            position:"absolute", inset:0,
            color:"#22c55e", transform:"translate(2px,-1px)",
            opacity:0.7, clipPath:"inset(60% 0 20% 0)", pointerEvents:"none",
          }}>{text}</span>
        </>
      )}
      <span>{text}</span>
    </div>
  );
}

// Animated countdown since alarm fired
function ElapsedTimer() {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const m = String(Math.floor(sec / 60)).padStart(2,"0");
  const s = String(sec % 60).padStart(2,"0");
  return <span style={{ fontVariantNumeric:"tabular-nums" }}>{m}:{s}</span>;
}

function generateFallback(difficulty) {
  const r = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  if (difficulty === "easy") {
    const a = r(10,30), b = r(5,20);
    return { question:`${a} + ${b}`, answer: a+b };
  }
  if (difficulty === "medium") {
    const a = r(2,12), b = r(2,10), c = r(1,20);
    return { question:`(${a} × ${b}) + ${c}`, answer: a*b+c };
  }
  const a = r(3,12), b = r(3,10), c = r(2,8), d = r(2,6);
  return { question:`(${a} × ${b}) − (${c} × ${d})`, answer: a*b - c*d };
}

export default function AlarmOverlay({ difficulty = "medium", onSolve }) {
  const [puzzle, setPuzzle]   = useState(null);   // { question }
  const [answer, setAnswer]   = useState(null);   // only for fallback mode
  const [input, setInput]     = useState("");
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake]     = useState(false);
  const [loading, setLoading] = useState(true);
  const [solved, setSolved]   = useState(false);
  const inputRef = useRef(null);

  const meta = DIFF_META[difficulty] ?? DIFF_META.medium;

  const fetchPuzzle = async () => {
    setLoading(true); setInput("");
    try {
      const res = await axios.get(`${API}/get-puzzle?difficulty=${difficulty}`);
      setPuzzle({ question: res.data.question });
      setAnswer(null);
    } catch {
      const fb = generateFallback(difficulty);
      setPuzzle({ question: fb.question });
      setAnswer(fb.answer);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  };

  useEffect(() => { fetchPuzzle(); }, [difficulty]);

  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") e.preventDefault(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSubmit = async e => {
    e?.preventDefault();
    const val = parseInt(input, 10);
    if (isNaN(val)) return;

    let correct = false;
    try {
      const res = await axios.post(`${API}/verify-puzzle`, { answer: val });
      correct = res.data.success;
    } catch {
      // fallback mode
      correct = answer !== null && val === answer;
    }

    if (correct) {
      setSolved(true);
      setTimeout(onSolve, 800);
    } else {
      setAttempts(n => n + 1);
      setShake(true);
      setInput("");
      setTimeout(() => { setShake(false); inputRef.current?.focus(); }, 550);
    }
  };

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{
        position:"fixed", inset:0, zIndex:999,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:"'Courier New','Lucida Console',monospace",
        background:"rgba(2,4,8,0.94)",
        backdropFilter:"blur(20px)",
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      {/* Scanlines */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.2) 2px,rgba(0,0,0,0.2) 4px)",
      }} />

      {/* Pulsing radial glow behind card */}
      <motion.div
        animate={{ scale:[1,1.3,1], opacity:[0.6,1,0.6] }}
        transition={{ repeat:Infinity, duration:2, ease:"easeInOut" }}
        style={{
          position:"absolute", width:500, height:500, borderRadius:"50%",
          background:`radial-gradient(circle, ${meta.color}14 0%, transparent 70%)`,
          pointerEvents:"none",
        }}
      />

      {/* Card */}
      <motion.div
        animate={shake ? {
          x:[0,-14,14,-10,10,-6,6,-3,3,0],
          transition:{ duration:0.5 }
        } : { x:0 }}
        style={{
          position:"relative", zIndex:1,
          width:380, borderRadius:4,
          border:`1px solid ${meta.border}`,
          background:"#05080d",
          padding:"40px 36px",
          boxShadow:`0 0 0 1px #0f172a, 0 0 80px ${meta.color}18`,
        }}
      >
        {/* Top bar */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          marginBottom:28,
        }}>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            {/* Traffic-light style dots — all red when ringing */}
            {["#ef4444","#ef4444","#ef4444"].map((c,i) => (
              <motion.div key={i}
                animate={{ opacity:[1,0.3,1] }}
                transition={{ repeat:Infinity, duration:0.9, delay:i*0.15 }}
                style={{ width:8, height:8, borderRadius:"50%", background:c,
                  boxShadow:`0 0 6px ${c}` }}
              />
            ))}
          </div>
          <span style={{ fontSize:8, letterSpacing:"0.4em", color:"#334155" }}>
            ANTI-SNOOZE · ALARM TRIGGERED
          </span>
          <span style={{
            fontSize:8, letterSpacing:"0.2em", padding:"3px 8px",
            border:`1px solid ${meta.border}`, borderRadius:2,
            color: meta.color, background: meta.bg,
          }}>{meta.label}</span>
        </div>

        {/* Big WAKE UP */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <GlitchText
            text="WAKE UP"
            color="#f1f5f9"
          />
          <div style={{
            fontSize:"clamp(2.2rem,8vw,3.6rem)", fontWeight:700,
            letterSpacing:"0.12em", lineHeight:1,
            marginBottom:4,
          }} />
          {/* Elapsed time */}
          <div style={{ fontSize:10, color:"#334155", letterSpacing:"0.35em", marginTop:8 }}>
            ELAPSED &nbsp;<ElapsedTimer />
          </div>
        </div>

        {/* Divider */}
        <div style={{ height:1, background:`linear-gradient(90deg,transparent,${meta.color}44,transparent)`, marginBottom:24 }} />

        {/* Puzzle */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:9, letterSpacing:"0.35em", color:"#334155", marginBottom:10 }}>
            ◈ SOLVE TO DISARM
          </div>
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading"
                animate={{ opacity:[0.4,1,0.4] }} transition={{ repeat:Infinity, duration:1 }}
                style={{ fontSize:11, color:"#334155", letterSpacing:"0.3em", padding:"20px 0", textAlign:"center" }}
              >
                GENERATING PUZZLE…
              </motion.div>
            ) : (
              <motion.div key={puzzle?.question}
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                style={{
                  fontSize:"clamp(1.5rem,5vw,2.2rem)", fontWeight:700,
                  textAlign:"center", letterSpacing:"0.1em",
                  padding:"20px 16px", borderRadius:3,
                  border:`1px solid ${meta.border}`,
                  background: meta.bg,
                  color: meta.color,
                  textShadow:`0 0 20px ${meta.color}60`,
                }}
              >
                {puzzle?.question} = ?
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Answer input */}
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <input
            ref={inputRef}
            type="number"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="ANSWER"
            disabled={loading || solved}
            style={{
              width:"100%", padding:"14px", borderRadius:3,
              background:"#080b10",
              border:`1px solid ${input ? meta.color+"66" : "#0f172a"}`,
              color: meta.color,
              fontSize:28, textAlign:"center",
              fontFamily:"inherit", letterSpacing:"0.1em",
              outline:"none", caretColor: meta.color,
              transition:"border-color 0.2s",
              boxSizing:"border-box",
            }}
          />

          {/* Attempts warning */}
          <AnimatePresence>
            {attempts > 0 && (
              <motion.div
                initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }}
                style={{ fontSize:9, letterSpacing:"0.25em", color:"#ef4444", textAlign:"center" }}
              >
                {attempts} FAILED ATTEMPT{attempts>1?"S":""} — KEEP TRYING
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit"
            disabled={loading || !input || solved}
            style={{
              padding:"14px", borderRadius:3,
              background: input && !loading ? meta.color : "transparent",
              border:`1px solid ${input && !loading ? meta.color : "#0f172a"}`,
              color: input && !loading ? "#000" : "#0f172a",
              fontSize:10, letterSpacing:"0.45em",
              fontFamily:"inherit", fontWeight:700,
              cursor: input && !loading ? "pointer" : "not-allowed",
              transition:"all 0.15s",
              boxShadow: input ? `0 0 24px ${meta.color}40` : "none",
            }}
          >
            {solved ? "DISARMED ◆" : "VERIFY & DISARM"}
          </button>
        </form>

        {/* Roommate guilt */}
        {attempts >= 4 && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }}
            style={{
              marginTop:16, fontSize:9, letterSpacing:"0.2em",
              color:"#334155", textAlign:"center",
            }}
          >
            YOUR ROOMMATES ARE AWAKE NOW. SOLVE IT.
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}