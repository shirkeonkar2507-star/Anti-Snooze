// ZipPuzzle.jsx — LinkedIn ZIP style
// Fully random valid puzzle every time, using backtracking to guarantee
// a complete Hamiltonian path, then placing numbered waypoints along it.
//
// Easy:   4×4, 4 waypoints
// Medium: 5×5, 6 waypoints
// Hard:   6×6, 8 waypoints

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// RANDOM HAMILTONIAN PATH GENERATOR (backtracking + Warnsdorff heuristic)
// Returns array of [r,c] covering every cell exactly once.
// ─────────────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function neighbors(r, c, size) {
  return [[-1,0],[1,0],[0,-1],[0,1]]
    .map(([dr,dc]) => [r+dr, c+dc])
    .filter(([nr,nc]) => nr>=0 && nr<size && nc>=0 && nc<size);
}

// Warnsdorff degree: number of unvisited neighbors
function degree(r, c, visited, size) {
  return neighbors(r, c, size).filter(([nr,nc]) => !visited[nr*size+nc]).length;
}

function generateHamiltonianPath(size) {
  const total = size * size;

  // Try up to 200 random starts to get a complete path
  for (let attempt = 0; attempt < 200; attempt++) {
    const visited = new Uint8Array(total);
    const path = [];

    // Random starting cell
    let r = Math.floor(Math.random() * size);
    let c = Math.floor(Math.random() * size);
    visited[r*size+c] = 1;
    path.push([r, c]);

    let stuck = false;
    while (path.length < total) {
      // Get unvisited neighbours, sort by Warnsdorff degree (fewest exits first)
      let nbrs = neighbors(r, c, size)
        .filter(([nr,nc]) => !visited[nr*size+nc]);

      if (nbrs.length === 0) { stuck = true; break; }

      // Warnsdorff: sort by degree, shuffle ties for randomness
      nbrs.sort((a, b) => {
        const da = degree(a[0], a[1], visited, size);
        const db = degree(b[0], b[1], visited, size);
        if (da !== db) return da - db;
        return Math.random() - 0.5; // tie-break randomly
      });

      [r, c] = nbrs[0];
      visited[r*size+c] = 1;
      path.push([r, c]);
    }

    if (!stuck && path.length === total) return path;
  }

  // Absolute fallback: horizontal snake (always valid)
  const path = [];
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      path.push([row, row%2===0 ? col : size-1-col]);
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE BUILDER
// Places N waypoints at evenly-spaced positions along the Hamiltonian path,
// with small random jitter so they don't always land at identical spots.
// ─────────────────────────────────────────────────────────────────────────────
function buildPuzzle(size, numWaypoints) {
  const sol = generateHamiltonianPath(size);
  const total = sol.length; // = size*size

  // Space waypoints with slight random offset
  // Always include index 0 (node 1) and total-1 (last node)
  const step = (total - 1) / (numWaypoints - 1);
  const indices = [];

  for (let i = 0; i < numWaypoints; i++) {
    if (i === 0) {
      indices.push(0);
    } else if (i === numWaypoints - 1) {
      indices.push(total - 1);
    } else {
      // Jitter ±(step*0.3) but clamp away from neighbours
      const base = Math.round(i * step);
      const jitter = Math.floor((Math.random() - 0.5) * step * 0.6);
      const prev = indices[i-1];
      const next = Math.round((i+1) * step); // approximate next
      const idx = Math.max(prev+2, Math.min(next-2, base+jitter));
      indices.push(idx);
    }
  }

  // Build nodes array
  const nodes = indices.map((solIdx, i) => ({
    id: i + 1,
    r: sol[solIdx][0],
    c: sol[solIdx][1],
  }));

  return { size, nodes, solution: sol };
}

// Difficulty config
const DIFF_CONFIG = {
  easy:   { size: 4, waypoints: 4 },
  medium: { size: 5, waypoints: 6 },
  hard:   { size: 6, waypoints: 8 },
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ZipPuzzle({ difficulty, meta, onSolve }) {
  const cfg = DIFF_CONFIG[difficulty] ?? DIFF_CONFIG.medium;

  const [puzzle, setPuzzle] = useState(() => buildPuzzle(cfg.size, cfg.waypoints));
  const [path, setPath]     = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [solved, setSolved]   = useState(false);
  const [flash, setFlash]     = useState(false);

  const { size, nodes } = puzzle;
  const total    = size * size;
  const cellSize = Math.min(54, Math.floor(300 / size));
  const GAP      = 3;
  const PAD      = 10;
  const GPIX     = size * (cellSize + GAP) - GAP;

  // Node lookup map: "r,c" → node id
  const nodeMap = useMemo(() => {
    const m = {};
    for (const n of nodes) m[`${n.r},${n.c}`] = n.id;
    return m;
  }, [nodes]);

  // Highest node id visited in current path
  const getMaxNode = useCallback((p) => {
    let max = 0;
    for (const [r,c] of p) {
      const id = nodeMap[`${r},${c}`];
      if (id && id > max) max = id;
    }
    return max;
  }, [nodeMap]);

  // Check win
  useEffect(() => {
    if (path.length === total && getMaxNode(path) === nodes.length) {
      setSolved(true);
      setFlash(true);
      setTimeout(onSolve, 900);
    }
  }, [path, total, nodes.length, getMaxNode, onSolve]);

  // ── Interaction ─────────────────────────────────────────────────────────────
  const startCell = (r, c) => {
    if (solved) return;
    const key = `${r},${c}`;
    const nodeId = nodeMap[key];

    if (path.length === 0) {
      if (nodeId === 1) { setPath([[r,c]]); setDrawing(true); }
      return;
    }

    // Clicked node 1 → full reset
    if (nodeId === 1) {
      setPath([[r,c]]); setDrawing(true); return;
    }

    // Clicked existing path cell → truncate to that point
    const idx = path.findIndex(([pr,pc]) => pr===r && pc===c);
    if (idx !== -1) {
      setPath(path.slice(0, idx+1));
      setDrawing(true);
    }
  };

  const enterCell = (r, c) => {
    if (!drawing || solved || path.length === 0) return;
    const last = path[path.length-1];
    if (last[0]===r && last[1]===c) return;

    // Must be adjacent
    if (Math.abs(r-last[0]) + Math.abs(c-last[1]) !== 1) return;

    // Backtrack: step to second-last
    if (path.length >= 2) {
      const prev = path[path.length-2];
      if (prev[0]===r && prev[1]===c) {
        setPath(p => p.slice(0,-1));
        return;
      }
    }

    // Crossed own path → truncate to that point
    const idx = path.findIndex(([pr,pc]) => pr===r && pc===c);
    if (idx !== -1) {
      setPath(p => p.slice(0, idx+1));
      return;
    }

    // Node order constraint
    const nodeId = nodeMap[`${r},${c}`];
    if (nodeId !== undefined) {
      const expected = getMaxNode(path) + 1;
      if (nodeId !== expected) return;
    }

    setPath(p => [...p, [r,c]]);
  };

  const stopDraw = () => setDrawing(false);

  const reset = () => { setPath([]); setDrawing(false); setSolved(false); setFlash(false); };

  const newPuzzle = () => {
    setPuzzle(buildPuzzle(cfg.size, cfg.waypoints));
    setPath([]); setDrawing(false); setSolved(false); setFlash(false);
  };

  // ── SVG path string ─────────────────────────────────────────────────────────
  const svgD = useMemo(() => {
    if (path.length === 0) return "";
    return path.map(([r,c], i) => {
      const x = PAD + c*(cellSize+GAP) + cellSize/2;
      const y = PAD + r*(cellSize+GAP) + cellSize/2;
      return `${i===0?"M":"L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [path, cellSize, GAP, PAD]);

  const pathSet    = useMemo(() => new Set(path.map(([r,c])=>`${r},${c}`)), [path]);
  const maxNode    = getMaxNode(path);
  const nextReq    = maxNode + 1;
  const nextNode   = nodes.find(n => n.id === nextReq);
  const pct        = Math.round(path.length / total * 100);

  // Cell position helper
  const cellXY = (r, c) => ({
    x: PAD + c*(cellSize+GAP) + cellSize/2,
    y: PAD + r*(cellSize+GAP) + cellSize/2,
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12, alignItems:"center" }}>

      {/* Header */}
      <div style={{
        display:"flex", justifyContent:"space-between",
        width:GPIX + PAD*2, alignItems:"center",
      }}>
        <span style={{ fontSize:9, color:"#64748b", letterSpacing:"0.25em", fontWeight:700 }}>
          {path.length}/{total} CELLS
        </span>

        {nextReq <= nodes.length ? (
          <div style={{
            display:"flex", alignItems:"center", gap:7,
            padding:"3px 12px", borderRadius:4,
            background:meta.bg, border:`1px solid ${meta.border}`,
          }}>
            <motion.div
              animate={{ scale:[1,1.18,1] }}
              transition={{ repeat:Infinity, duration:1.1 }}
              style={{
                width:18, height:18, borderRadius:"50%",
                background:meta.color,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:9, fontWeight:900, color:"#000",
              }}
            >{nextReq}</motion.div>
            <span style={{ fontSize:9, color:meta.color, letterSpacing:"0.2em", fontWeight:700 }}>
              NEXT
            </span>
          </div>
        ) : (
          <span style={{ fontSize:9, color:"#4ade80", letterSpacing:"0.2em", fontWeight:700 }}>
            {solved ? "✓ COMPLETE" : "FILL ALL CELLS"}
          </span>
        )}

        <span style={{ fontSize:9, color:"#64748b", letterSpacing:"0.25em", fontWeight:700 }}>
          {pct}%
        </span>
      </div>

      {/* Grid */}
      <div
        style={{
          position:"relative",
          width:GPIX + PAD*2,
          height:GPIX + PAD*2,
          background:"#060e1a",
          borderRadius:10,
          border:`2px solid ${flash?"#4ade8088":meta.border}`,
          userSelect:"none", touchAction:"none", cursor:"crosshair",
          transition:"border-color 0.4s",
          boxShadow: flash ? "0 0 30px #4ade8033" : `0 0 20px ${meta.color}0d`,
          overflow:"hidden",
        }}
        onMouseLeave={stopDraw}
        onMouseUp={stopDraw}
        onTouchEnd={stopDraw}
        onTouchMove={e => {
          e.preventDefault();
          if (!drawing) return;
          const t = e.touches[0];
          const rect = e.currentTarget.getBoundingClientRect();
          const x = t.clientX - rect.left - PAD;
          const y = t.clientY - rect.top - PAD;
          const col = Math.floor(x / (cellSize+GAP));
          const row = Math.floor(y / (cellSize+GAP));
          if (row>=0 && row<size && col>=0 && col<size) enterCell(row,col);
        }}
      >
        {/* Filled cell backgrounds */}
        {path.map(([r,c], i) => (
          <div key={`fill-${i}`} style={{
            position:"absolute",
            left: PAD + c*(cellSize+GAP),
            top:  PAD + r*(cellSize+GAP),
            width:cellSize, height:cellSize,
            borderRadius:4,
            background:`${meta.color}28`,
            pointerEvents:"none",
            zIndex:1,
          }}/>
        ))}

        {/* Grid lines */}
        {Array.from({length:size},(_,r)=>
          Array.from({length:size},(_,c)=>(
            <div key={`g-${r}-${c}`} style={{
              position:"absolute",
              left: PAD + c*(cellSize+GAP),
              top:  PAD + r*(cellSize+GAP),
              width:cellSize, height:cellSize,
              borderRadius:4,
              border:`1px solid #0f1e30`,
              boxSizing:"border-box",
              zIndex:0,
            }}/>
          ))
        )}

        {/* SVG: path tube + pulse ring + head */}
        <svg style={{
          position:"absolute", inset:0, zIndex:3,
          width:GPIX+PAD*2, height:GPIX+PAD*2,
          pointerEvents:"none", overflow:"visible",
        }}>
          {/* Tube */}
          {path.length > 1 && (
            <path
              d={svgD}
              stroke={meta.color}
              strokeWidth={cellSize * 0.56}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity="0.5"
            />
          )}
          {/* Glow copy */}
          {path.length > 1 && (
            <path
              d={svgD}
              stroke={meta.color}
              strokeWidth={cellSize * 0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity="0.9"
            />
          )}
          {/* Next node pulse ring */}
          {!solved && nextNode && (
            <motion.circle
              cx={cellXY(nextNode.r, nextNode.c).x}
              cy={cellXY(nextNode.r, nextNode.c).y}
              r={cellSize * 0.44}
              fill="none"
              stroke={meta.color}
              strokeWidth="2"
              opacity="0.5"
              animate={{ r:[cellSize*0.44, cellSize*0.55, cellSize*0.44], opacity:[0.5,1,0.5] }}
              transition={{ repeat:Infinity, duration:1.1 }}
            />
          )}
          {/* Head dot */}
          {!solved && path.length > 0 && (
            <circle
              cx={cellXY(path[path.length-1][0], path[path.length-1][1]).x}
              cy={cellXY(path[path.length-1][0], path[path.length-1][1]).y}
              r={cellSize*0.22}
              fill="#fff"
              opacity="0.9"
            />
          )}
        </svg>

        {/* Interactive cells + numbered nodes */}
        {Array.from({length:size},(_,r)=>
          Array.from({length:size},(_,c)=>{
            const key    = `${r},${c}`;
            const nodeId = nodeMap[key];
            const inPath = pathSet.has(key);
            const isNextN = nextNode && nextNode.r===r && nextNode.c===c;
            const {x,y} = cellXY(r,c);

            return (
              <div
                key={key}
                onMouseDown={()=>startCell(r,c)}
                onMouseEnter={()=>enterCell(r,c)}
                onTouchStart={e=>{e.preventDefault(); startCell(r,c); setDrawing(true);}}
                style={{
                  position:"absolute",
                  left: PAD + c*(cellSize+GAP),
                  top:  PAD + r*(cellSize+GAP),
                  width:cellSize, height:cellSize,
                  zIndex: nodeId ? 5 : 2,
                  cursor:"crosshair",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}
              >
                {nodeId && (
                  <motion.div
                    initial={{ scale:0.7 }}
                    animate={{ scale:1 }}
                    style={{
                      width: cellSize*0.64,
                      height: cellSize*0.64,
                      borderRadius:"50%",
                      background: inPath ? meta.color : "#111d30",
                      border:`2.5px solid ${inPath ? meta.color : isNextN ? meta.color : "#2a3d5a"}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      boxShadow: inPath
                        ? `0 0 14px ${meta.color}cc, 0 0 0 3px ${meta.color}33`
                        : isNextN ? `0 0 12px ${meta.color}66` : "none",
                      transition:"all 0.2s",
                      pointerEvents:"none",
                    }}
                  >
                    <span style={{
                      fontSize:Math.max(10, cellSize*0.34),
                      fontWeight:900,
                      color: inPath ? "#000" : "#94a3b8",
                      fontFamily:"'Courier New',monospace",
                      lineHeight:1,
                      userSelect:"none",
                    }}>{nodeId}</span>
                  </motion.div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Node progress strip */}
      <div style={{ display:"flex", gap:4, flexWrap:"wrap", justifyContent:"center" }}>
        {nodes.map((n, i) => {
          const done   = maxNode >= n.id;
          const active = nextReq === n.id;
          return (
            <div key={n.id} style={{ display:"flex", alignItems:"center", gap:3 }}>
              <motion.div
                animate={active ? { scale:[1,1.18,1] } : {}}
                transition={{ repeat:Infinity, duration:1 }}
                style={{
                  width:18, height:18, borderRadius:"50%",
                  background: done ? meta.color : active ? meta.bg : "#0c1626",
                  border:`2px solid ${done?meta.color:active?meta.color:"#1e2d4a"}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:8, fontWeight:900,
                  color: done?"#000":active?meta.color:"#334155",
                  boxShadow: done?`0 0 8px ${meta.color}55`:active?`0 0 12px ${meta.color}77`:"none",
                  transition:"all 0.2s",
                }}
              >
                {done ? "✓" : n.id}
              </motion.div>
              {i < nodes.length-1 && (
                <span style={{ color:done?meta.color:"#1e2d4a", fontSize:7, fontWeight:800 }}>→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Buttons */}
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={reset}
          style={{
            padding:"5px 14px", borderRadius:4,
            background:"transparent", border:"1px solid #1e2d4a",
            color:"#64748b", fontSize:9, letterSpacing:"0.3em",
            fontFamily:"inherit", fontWeight:700, cursor:"pointer",
          }}
          onMouseEnter={e=>{e.target.style.borderColor="#64748b";e.target.style.color="#94a3b8";}}
          onMouseLeave={e=>{e.target.style.borderColor="#1e2d4a";e.target.style.color="#64748b";}}
        >↺ RESET</button>

        <button onClick={newPuzzle}
          style={{
            padding:"5px 14px", borderRadius:4,
            background:"transparent", border:`1px solid ${meta.border}`,
            color:meta.color, fontSize:9, letterSpacing:"0.3em",
            fontFamily:"inherit", fontWeight:700, cursor:"pointer",
          }}
          onMouseEnter={e=>{e.target.style.background=meta.bg;}}
          onMouseLeave={e=>{e.target.style.background="transparent";}}
        >⟳ NEW PUZZLE</button>
      </div>

      <p style={{
        color:"#1e2d4a", fontSize:9, letterSpacing:"0.15em",
        fontWeight:600, margin:0, textAlign:"center",
      }}>
        START AT 1 · VISIT {nodes.length} NODES IN ORDER · FILL ALL {total} CELLS
      </p>
    </div>
  );
}
