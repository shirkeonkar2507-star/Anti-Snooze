// BlockPattern.jsx  — Game 3/3
// Memorize a lit pattern, then recreate it from memory.
// Easy:   3×3 grid, 4 blocks lit, 3s memorize time
// Medium: 4×4 grid, 7 blocks lit, 2s memorize time
// Hard:   5×5 grid,12 blocks lit, 1.5s memorize time

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CONFIG = {
  easy:   { size:3, lit:4,  memorizeMs:3000 },
  medium: { size:4, lit:7,  memorizeMs:2000 },
  hard:   { size:5, lit:12, memorizeMs:1500 },
};

function generatePattern(size, count) {
  const total = size * size;
  const indices = [];
  while (indices.length < count) {
    const i = Math.floor(Math.random() * total);
    if (!indices.includes(i)) indices.push(i);
  }
  return indices; // sorted for consistency
}

export default function BlockPattern({ difficulty, meta, onSolve }) {
  const cfg = CONFIG[difficulty] ?? CONFIG.medium;
  const { size, lit, memorizeMs } = cfg;

  const [pattern]     = useState(() => generatePattern(size, lit));
  const [phase, setPhase]       = useState("memorize"); // memorize | recall | result
  const [countdown, setCountdown] = useState(Math.ceil(memorizeMs/1000));
  const [selected, setSelected] = useState(new Set());
  const [result, setResult]     = useState(null); // "ok" | "bad"
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef(null);

  // Memorize phase countdown
  useEffect(() => {
    if (phase !== "memorize") return;
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(tick);
          setPhase("recall");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [phase]);

  const toggle = (i) => {
    if (phase !== "recall") return;
    setSelected(s => {
      const next = new Set(s);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const verify = () => {
    const patSet = new Set(pattern);
    const correct =
      selected.size === patSet.size &&
      [...selected].every(i => patSet.has(i));

    if (correct) {
      setResult("ok");
      setTimeout(onSolve, 800);
    } else {
      setAttempts(a => a+1);
      setResult("bad");
      // Show wrong cells briefly, then reset for retry
      setTimeout(() => {
        setSelected(new Set());
        setResult(null);
        // Give a quick re-show of pattern on 2nd+ attempt
        setPhase("memorize");
        setCountdown(Math.ceil(memorizeMs/1000));
      }, 1200);
    }
  };

  // Cell rendering
  const renderCell = (i) => {
    const isPattern = pattern.includes(i);
    const isSelected = selected.has(i);

    let bg = "#0a1220";
    let border = "#1e2d4a";
    let glow = "none";

    if (phase === "memorize") {
      if (isPattern) {
        bg = meta.color;
        border = meta.color;
        glow = `0 0 12px ${meta.color}88`;
      }
    } else {
      // recall / result phase
      if (result === "ok" && isPattern) {
        bg = "#4ade80"; border = "#4ade80"; glow = "0 0 12px #4ade8088";
      } else if (result === "bad") {
        if (isPattern && isSelected) { bg="#4ade80"; border="#4ade80"; }       // correct pick
        else if (isSelected && !isPattern) { bg="#f87171"; border="#f87171"; } // wrong pick
        else if (isPattern && !isSelected) { bg="#fbbf24"; border="#fbbf24"; } // missed
        else { bg="#0a1220"; }
      } else if (isSelected) {
        bg = meta.color+"99";
        border = meta.color;
        glow = `0 0 8px ${meta.color}55`;
      }
    }

    const cellPx = Math.min(56, Math.floor(280 / size));

    return (
      <motion.div
        key={i}
        whileTap={ phase==="recall" ? { scale:0.88 } : {}}
        onClick={() => toggle(i)}
        style={{
          width:cellPx, height:cellPx,
          borderRadius:5,
          background:bg,
          border:`2px solid ${border}`,
          cursor: phase==="recall" ? "pointer" : "default",
          transition:"background 0.15s, border-color 0.15s",
          boxShadow:glow,
        }}
      />
    );
  };

  const cellPx = Math.min(56, Math.floor(280/size));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, alignItems:"center" }}>

      {/* Phase label */}
      <AnimatePresence mode="wait">
        {phase === "memorize" ? (
          <motion.div key="mem"
            initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:6}}
            style={{ textAlign:"center" }}
          >
            <p style={{ color:meta.color, fontSize:11, letterSpacing:"0.35em",
              fontWeight:800, margin:0 }}>MEMORIZE THE PATTERN</p>
            <p style={{ color:"#64748b", fontSize:10, letterSpacing:"0.25em",
              fontWeight:700, margin:"6px 0 0" }}>
              HIDING IN &nbsp;
              <span style={{ color:"#f1f5f9", fontSize:18, fontWeight:900 }}>
                {countdown}
              </span>
            </p>
          </motion.div>
        ) : (
          <motion.div key="rec"
            initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:6}}
            style={{ textAlign:"center" }}
          >
            <p style={{ color:meta.color, fontSize:11, letterSpacing:"0.35em",
              fontWeight:800, margin:0 }}>
              {result==="bad" ? "WRONG! WATCH AGAIN…" : "RECREATE THE PATTERN"}
            </p>
            <p style={{ color:"#64748b", fontSize:9, letterSpacing:"0.25em",
              fontWeight:700, margin:"4px 0 0" }}>
              {selected.size} / {lit} SELECTED
              {attempts>0 ? `  ·  ATTEMPT ${attempts+1}` : ""}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div style={{
        display:"grid",
        gridTemplateColumns:`repeat(${size},${cellPx}px)`,
        gap:5,
        padding:12,
        background:"#070d16",
        borderRadius:8,
        border:`1px solid ${result==="ok"?"#4ade8066":result==="bad"?"#f8717166":meta.border}`,
        transition:"border-color 0.3s",
      }}>
        {Array.from({length:size*size},(_,i)=>renderCell(i))}
      </div>

      {/* Submit — only in recall phase */}
      {phase === "recall" && !result && (
        <button
          onClick={verify}
          disabled={selected.size === 0}
          style={{
            padding:"11px 28px", borderRadius:4,
            background: selected.size > 0 ? meta.color : "#0a1220",
            border:`1px solid ${selected.size > 0 ? meta.color : "#1e2d4a"}`,
            color: selected.size > 0 ? "#000" : "#2d3e5a",
            fontSize:10, letterSpacing:"0.4em",
            fontFamily:"inherit", fontWeight:800,
            cursor: selected.size > 0 ? "pointer" : "not-allowed",
            transition:"all 0.15s",
            boxShadow: selected.size > 0 ? `0 0 24px ${meta.color}40` : "none",
          }}
        >
          VERIFY PATTERN
        </button>
      )}

      {/* Hint */}
      <p style={{ color:"#334155", fontSize:9, letterSpacing:"0.2em",
        fontWeight:600, margin:0, textAlign:"center" }}>
        {phase==="memorize"
          ? `REMEMBER ${lit} LIT BLOCKS`
          : `SELECT EXACTLY ${lit} BLOCKS`}
      </p>
    </div>
  );
}
