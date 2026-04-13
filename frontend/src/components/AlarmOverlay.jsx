// AlarmOverlay.jsx
// Orchestrates 3 mandatory games in order:
//   1. Math Puzzle
//   2. ZIP (connect pairs / fill grid)
//   3. Block Pattern (memorize → recreate)

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MathPuzzle   from "./MathPuzzle";
import ZipPuzzle    from "./ZipPuzzle";
import BlockPattern from "./BlockPattern";

const DIFF_META = {
  easy:   { label:"EASY",   color:"#4ade80", bg:"#4ade8012", border:"#4ade8033" },
  medium: { label:"MEDIUM", color:"#fbbf24", bg:"#fbbf2412", border:"#fbbf2433" },
  hard:   { label:"HARD",   color:"#f87171", bg:"#f8717112", border:"#f8717133" },
};

const GAMES = [
  { id:"math",    label:"MATH",    icon:"∑", desc:"Solve the equation" },
  { id:"zip",     label:"ZIP",     icon:"⬡", desc:"Connect all pairs · Fill every cell" },
  { id:"pattern", label:"PATTERN", icon:"▦", desc:"Memorize · Recreate the block pattern" },
];

// ── Glitch text ───────────────────────────────────────────────────────────────
function GlitchText({ text }) {
  const [g, setG] = useState(false);
  useEffect(() => {
    const id = setInterval(() => {
      setG(true);
      setTimeout(() => setG(false), 110);
    }, 2200 + Math.random()*1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ position:"relative", display:"inline-block", color:"#f1f5f9" }}>
      {g && <>
        <span style={{ position:"absolute", inset:0, color:"#f87171",
          transform:"translate(-3px,1px)", opacity:0.55,
          clipPath:"inset(20% 0 55% 0)", pointerEvents:"none" }}>{text}</span>
        <span style={{ position:"absolute", inset:0, color:"#4ade80",
          transform:"translate(3px,-1px)", opacity:0.55,
          clipPath:"inset(55% 0 15% 0)", pointerEvents:"none" }}>{text}</span>
      </>}
      <span>{text}</span>
    </div>
  );
}

// ── Elapsed timer ─────────────────────────────────────────────────────────────
function ElapsedTimer() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS(n=>n+1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(s/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  return <span style={{ fontVariantNumeric:"tabular-nums" }}>{mm}:{ss}</span>;
}

// ── Progress bar across top ───────────────────────────────────────────────────
function ProgressBar({ current, total, meta, completedGames }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:20 }}>
      {GAMES.map((g, i) => {
        const done    = completedGames.includes(g.id);
        const active  = i === current;
        return (
          <div key={g.id} style={{
            flex:1, display:"flex", flexDirection:"column",
            alignItems:"center", gap:5,
          }}>
            <div style={{
              width:"100%", height:3, borderRadius:2,
              background: done ? "#4ade80" : active ? meta.color : "#1e2d4a",
              boxShadow: active ? `0 0 8px ${meta.color}88` : done ? "0 0 6px #4ade8066" : "none",
              transition:"background 0.4s",
            }}/>
            <div style={{
              fontSize:9, letterSpacing:"0.2em", fontWeight:800,
              color: done?"#4ade80" : active?meta.color : "#334155",
              display:"flex", alignItems:"center", gap:4,
            }}>
              <span>{g.icon}</span>
              <span>{done ? `${g.label} ✓` : g.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Game complete transition card ─────────────────────────────────────────────
function StageClear({ game, meta, onContinue, isLast }) {
  useEffect(() => {
    const id = setTimeout(onContinue, isLast ? 1200 : 1600);
    return () => clearTimeout(id);
  }, [onContinue, isLast]);

  return (
    <motion.div
      initial={{ opacity:0, scale:0.9 }}
      animate={{ opacity:1, scale:1 }}
      exit={{ opacity:0, scale:1.05 }}
      style={{
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        gap:12, padding:"32px 0",
      }}
    >
      <motion.div
        animate={{ scale:[1,1.2,1] }}
        transition={{ duration:0.5 }}
        style={{ fontSize:48 }}
      >
        {isLast ? "🔓" : "✅"}
      </motion.div>
      <div style={{
        fontSize:isLast?28:22, fontWeight:900,
        letterSpacing:"0.1em",
        color: isLast ? "#4ade80" : meta.color,
        textShadow:`0 0 20px ${isLast?"#4ade80":meta.color}`,
      }}>
        {isLast ? "ALARM DISARMED" : `${game.label} CLEARED`}
      </div>
      <div style={{ fontSize:10, color:"#64748b", letterSpacing:"0.3em", fontWeight:700 }}>
        {isLast ? "GOOD MORNING" : `NEXT: ${GAMES[GAMES.findIndex(g=>g.id===game.id)+1]?.label ?? ""}`}
      </div>
    </motion.div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────
export default function AlarmOverlay({ difficulty = "medium", onSolve }) {
  const meta = DIFF_META[difficulty] ?? DIFF_META.medium;

  const [gameIndex, setGameIndex]       = useState(0);   // 0,1,2
  const [completedGames, setCompleted]  = useState([]);
  const [stageClear, setStageClear]     = useState(false);
  const [allDone, setAllDone]           = useState(false);

  useEffect(() => {
    const block = e => { if (e.key==="Escape") e.preventDefault(); };
    window.addEventListener("keydown", block);
    return () => window.removeEventListener("keydown", block);
  }, []);

  // 1. LOCKED GAME SOLVE HANDLER
  // Wrapping in useCallback and adding the `stageClear` guard prevents race conditions.
  const handleGameSolved = useCallback(() => {
    if (stageClear || allDone) return; 

    const game = GAMES[gameIndex];
    setCompleted(c => c.includes(game.id) ? c : [...c, game.id]);
    setStageClear(true);
  }, [gameIndex, stageClear, allDone]);

  // 2. CENTRALIZED STAGE PROGRESSION
  // This is triggered strictly by the StageClear component's internal timer.
  const handleStageContinue = useCallback(() => {
    if (gameIndex === GAMES.length - 1) {
      setAllDone(true);
      onSolve(); // Master disarm
    } else {
      setStageClear(false);
      setGameIndex(i => i + 1);
    }
  }, [gameIndex, onSolve]);

  const currentGame = GAMES[gameIndex];
  if (!currentGame) return null; // Safe fallback in case of state mismatch

  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }}
      style={{
        position:"fixed", inset:0, zIndex:999,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:"'Courier New','Lucida Console',monospace",
        background:"rgba(2,5,10,0.93)",
        backdropFilter:"blur(22px)",
        overflowY:"auto",
        padding:"20px 0",
      }}
      onPointerDown={e=>e.stopPropagation()}
    >
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none",
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.13) 2px,rgba(0,0,0,0.13) 4px)",
      }}/>

      <motion.div
        animate={{ scale:[1,1.3,1], opacity:[0.4,0.75,0.4] }}
        transition={{ repeat:Infinity, duration:2.5, ease:"easeInOut" }}
        style={{
          position:"fixed", width:600, height:600, borderRadius:"50%",
          background:`radial-gradient(circle,${meta.color}14 0%,transparent 70%)`,
          pointerEvents:"none",
        }}
      />

      <motion.div
        style={{
          position:"relative", zIndex:1,
          width: currentGame.id==="zip" ? 420 : 400,
          maxWidth:"95vw",
          borderRadius:8,
          border:`1px solid ${meta.border}`,
          background:"#060c16",
          padding:"28px 30px",
          boxShadow:`0 0 0 1px #0f1a2e, 0 0 80px ${meta.color}1a`,
        }}
      >
        <div style={{
          display:"flex", alignItems:"center",
          justifyContent:"space-between", marginBottom:20,
        }}>
          <div style={{ display:"flex", gap:6 }}>
            {[0,1,2].map(i=>(
              <motion.div key={i}
                animate={{ opacity:[1,0.2,1] }}
                transition={{ repeat:Infinity, duration:0.8, delay:i*0.17 }}
                style={{ width:8, height:8, borderRadius:"50%",
                  background:"#f87171", boxShadow:"0 0 7px #f87171" }}
              />
            ))}
          </div>

          <div style={{
            fontSize:"clamp(1.4rem,4vw,2rem)", fontWeight:900,
            letterSpacing:"0.1em",
          }}>
            <GlitchText text="WAKE UP" />
          </div>

          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3 }}>
            <span style={{
              fontSize:8, letterSpacing:"0.2em", padding:"2px 8px",
              borderRadius:3, color:meta.color,
              background:meta.bg, border:`1px solid ${meta.border}`,
              fontWeight:800,
            }}>{meta.label}</span>
            <span style={{ fontSize:8, color:"#334155", letterSpacing:"0.2em" }}>
              <ElapsedTimer/>
            </span>
          </div>
        </div>

        <ProgressBar
          current={gameIndex}
          total={GAMES.length}
          meta={meta}
          completedGames={completedGames}
        />

        <AnimatePresence mode="wait">
          {!stageClear && (
            <motion.div key={`title-${gameIndex}`}
              initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }}
              exit={{ opacity:0 }}
              style={{ marginBottom:18 }}
            >
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                <span style={{ fontSize:18, color:meta.color }}>{currentGame.icon}</span>
                <span style={{
                  fontSize:12, fontWeight:800, letterSpacing:"0.3em", color:"#f1f5f9",
                }}>STAGE {gameIndex+1}/3 · {currentGame.label}</span>
              </div>
              <p style={{
                fontSize:9, color:"#64748b",
                letterSpacing:"0.25em", fontWeight:700, margin:0,
              }}>{currentGame.desc.toUpperCase()}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{
          height:1, marginBottom:20,
          background:`linear-gradient(90deg,transparent,${meta.color}55,transparent)`,
        }}/>

        <AnimatePresence mode="wait">
          {stageClear ? (
            <StageClear
              key="clear"
              game={currentGame}
              meta={meta}
              isLast={gameIndex === GAMES.length - 1}
              onContinue={handleStageContinue} // 3. PROPERLY WIRED CONTINUE TRIGGER
            />
          ) : (
            <motion.div
              key={`game-${gameIndex}`}
              initial={{ opacity:0, x:30 }}
              animate={{ opacity:1, x:0 }}
              exit={{ opacity:0, x:-30 }}
              transition={{ duration:0.3 }}
            >
              {currentGame.id === "math" && (
                <MathPuzzle difficulty={difficulty} meta={meta} onSolve={handleGameSolved} />
              )}
              {currentGame.id === "zip" && (
                <ZipPuzzle difficulty={difficulty} meta={meta} onSolve={handleGameSolved} />
              )}
              {currentGame.id === "pattern" && (
                <BlockPattern difficulty={difficulty} meta={meta} onSolve={handleGameSolved} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{
          marginTop:16, textAlign:"center",
          fontSize:9, color:"#1e2d4a",
          letterSpacing:"0.2em", fontWeight:700,
        }}>
          {completedGames.length === 0
            ? "3 CHALLENGES STAND BETWEEN YOU AND YOUR DAY"
            : completedGames.length === 1
            ? "1 DOWN · 2 TO GO · NO GOING BACK"
            : completedGames.length === 2
            ? "LAST ONE · FINISH STRONG"
            : ""}
        </div>
      </motion.div>
    </motion.div>
  );
}