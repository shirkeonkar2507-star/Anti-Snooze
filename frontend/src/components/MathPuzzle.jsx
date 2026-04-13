// MathPuzzle.jsx  — Game 1/3
// Easy:   single op  e.g.  34 + 17
// Medium: two-step   e.g.  (8 × 6) + 23
// Hard:   three-step e.g.  (9 × 7) − (4 × 6) + 13

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

function generate(difficulty) {
  const r = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  if (difficulty === "easy") {
    const ops = ["+", "-", "×"];
    const op  = ops[r(0, 2)];
    if (op === "×") {
      const a = r(2, 9), b = r(2, 9);
      return { q: `${a} × ${b}`, ans: a * b };
    }
    const a = r(15, 60), b = r(5, 30);
    return op === "+"
      ? { q: `${a} + ${b}`, ans: a + b }
      : { q: `${Math.max(a,b)} − ${Math.min(a,b)}`, ans: Math.abs(a - b) };
  }
  if (difficulty === "medium") {
    const a = r(3, 14), b = r(3, 12), c = r(5, 30);
    const op = r(0,1) ? "+" : "−";
    const ans = op === "+" ? a * b + c : a * b - c;
    return { q: `(${a} × ${b}) ${op} ${c}`, ans };
  }
  // hard — three terms
  const a = r(4, 15), b = r(4, 12);
  const c = r(2, 9),  d = r(2, 8);
  const e = r(5, 25);
  const op = r(0,1) ? "+" : "−";
  const ans = a * b - c * d + (op === "+" ? e : -e);
  return { q: `(${a}×${b}) − (${c}×${d}) ${op} ${e}`, ans };
}

export default function MathPuzzle({ difficulty, meta, onSolve }) {
  const [puzzle, setPuzzle]     = useState(() => generate(difficulty));
  const [input, setInput]       = useState("");
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake]       = useState(false);
  const [flash, setFlash]       = useState(null); // "ok" | "bad"
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const submit = (e) => {
    e?.preventDefault();
    const val = parseInt(input, 10);
    if (isNaN(val)) return;
    if (val === puzzle.ans) {
      setFlash("ok");
      setTimeout(onSolve, 600);
    } else {
      setAttempts(n => n + 1);
      setFlash("bad");
      setShake(true);
      setInput("");
      setTimeout(() => { setShake(false); setFlash(null); inputRef.current?.focus(); }, 600);
    }
  };

  return (
    <motion.div
      animate={shake ? { x:[0,-14,14,-10,10,-6,6,0], transition:{ duration:0.45 } } : { x:0 }}
      style={{ display:"flex", flexDirection:"column", gap:18 }}
    >
      {/* Problem display */}
      <motion.div
        key={puzzle.q}
        initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }}
        style={{
          fontSize:"clamp(1.5rem,5vw,2.2rem)", fontWeight:800,
          textAlign:"center", letterSpacing:"0.08em",
          padding:"24px 16px", borderRadius:6,
          border:`1px solid ${flash==="ok"?"#4ade80":flash==="bad"?"#f87171":meta.border}`,
          background: flash==="ok"?"#4ade8015":flash==="bad"?"#f8717115":meta.bg,
          color: flash==="ok"?"#4ade80":flash==="bad"?"#f87171":meta.color,
          textShadow:`0 0 24px ${meta.color}60`,
          transition:"all 0.2s",
          fontFamily:"'Courier New',monospace",
        }}
      >
        {puzzle.q} = ?
      </motion.div>

      <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <input
          ref={inputRef}
          type="number"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="?"
          style={{
            width:"100%", padding:"13px",
            borderRadius:4, background:"#0a1220",
            border:`1px solid ${input ? meta.color+"88" : "#1e2d4a"}`,
            color:"#f1f5f9", fontSize:30, textAlign:"center",
            fontFamily:"'Courier New',monospace", letterSpacing:"0.1em",
            outline:"none", caretColor:meta.color,
            transition:"border-color 0.2s", boxSizing:"border-box",
          }}
        />

        <AnimatePresence>
          {attempts > 0 && (
            <motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}}
              style={{ fontSize:10, color:"#f87171", textAlign:"center",
                letterSpacing:"0.25em", fontWeight:700, margin:0 }}>
              {attempts} WRONG — THINK HARDER
            </motion.p>
          )}
        </AnimatePresence>

        <button type="submit" disabled={!input} style={{
          padding:"13px", borderRadius:4,
          background: input ? meta.color : "#0a1220",
          border:`1px solid ${input ? meta.color : "#1e2d4a"}`,
          color: input ? "#000" : "#2d3e5a",
          fontSize:10, letterSpacing:"0.4em",
          fontFamily:"inherit", fontWeight:800,
          cursor: input ? "pointer" : "not-allowed",
          transition:"all 0.15s",
          boxShadow: input ? `0 0 24px ${meta.color}40` : "none",
        }}>SUBMIT ANSWER</button>
      </form>
    </motion.div>
  );
}
