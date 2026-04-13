// ZipPuzzle.jsx  — Game 2/3
// Draw a continuous path connecting numbers in sequence (1 -> 2 -> 3...)
// All cells must be visited exactly once (Hamiltonian path).

import { useState, useEffect, useCallback, useMemo } from "react";

// ── Puzzle definitions per difficulty ─────────────────────────────────────────
// Each puzzle: { size, nodes: [{id: number, r, c}] }
// The "easy" puzzle exactly replicates the layout from your screenshot.
const PUZZLES = {
  easy: [
    {
      size: 4,
      nodes: [
        { id: 1, r: 3, c: 0 },
        { id: 2, r: 3, c: 2 },
        { id: 3, r: 0, c: 2 },
        { id: 4, r: 1, c: 2 },
        { id: 5, r: 1, c: 0 },
        { id: 6, r: 2, c: 2 }
      ],
    }
  ],
  medium: [
    {
      size: 5,
      nodes: [
        { id: 1, r: 0, c: 0 },
        { id: 2, r: 0, c: 4 },
        { id: 3, r: 1, c: 0 },
        { id: 4, r: 2, c: 4 },
        { id: 5, r: 4, c: 0 },
        { id: 6, r: 4, c: 4 }
      ]
    }
  ],
  hard: [
    {
      size: 6,
      nodes: [
        { id: 1, r: 0, c: 0 },
        { id: 2, r: 0, c: 5 },
        { id: 3, r: 2, c: 0 },
        { id: 4, r: 3, c: 5 },
        { id: 5, r: 5, c: 0 },
        { id: 6, r: 5, c: 5 }
      ]
    }
  ]
};

function pickPuzzle(difficulty) {
  const list = PUZZLES[difficulty] ?? PUZZLES.medium;
  return list[Math.floor(Math.random() * list.length)];
}

export default function ZipPuzzle({ difficulty, meta = { border: "#1e2d4a" }, onSolve }) {
  const [puzzle] = useState(() => pickPuzzle(difficulty));
  const [path, setPath] = useState([]); // Array of [r, c] coordinates
  const [drawing, setDrawing] = useState(false);
  const [solved, setSolved] = useState(false);
  const [flash, setFlash] = useState(false);

  const { size, nodes } = puzzle;
  const cellSize = Math.min(52, Math.floor(320 / size));

  // Helper to find the highest number reached in the current path
  const getCurrentMax = useCallback((currentPath) => {
    let max = 0;
    for (const [pr, pc] of currentPath) {
      const node = nodes.find(n => n.r === pr && n.c === pc);
      if (node && node.id > max) max = node.id;
    }
    return max;
  }, [nodes]);

  // Check victory condition whenever the path updates
  useEffect(() => {
    if (path.length === size * size && getCurrentMax(path) === nodes.length) {
      setSolved(true);
      setFlash(true);
      if (onSolve) setTimeout(onSolve, 900);
    }
  }, [path, size, nodes.length, getCurrentMax, onSolve]);

  // ── Interaction Logic ─────────────────────────────────────────────────────
  const startDraw = (r, c) => {
    if (solved) return;
    const node = nodes.find(n => n.r === r && n.c === c);

    if (path.length === 0) {
      // Must start at 1
      if (node && node.id === 1) {
        setPath([[r, c]]);
        setDrawing(true);
      }
      return;
    }

    // If clicking an existing cell in the path, truncate to that point to resume
    const existingIndex = path.findIndex(p => p[0] === r && p[1] === c);
    if (existingIndex !== -1) {
      setPath(path.slice(0, existingIndex + 1));
      setDrawing(true);
    } else if (node && node.id === 1) {
      // Allow fast reset by clicking 1 again
      setPath([[r, c]]);
      setDrawing(true);
    }
  };

  const enterCell = (r, c) => {
    if (!drawing || solved) return;
    const last = path[path.length - 1];
    if (last[0] === r && last[1] === c) return;

    // Must be adjacent to the last cell
    const isAdjacent = Math.abs(r - last[0]) + Math.abs(c - last[1]) === 1;
    if (!isAdjacent) return;

    // If backtracking to the immediate previous cell, undo last move
    if (path.length >= 2 && path[path.length - 2][0] === r && path[path.length - 2][1] === c) {
      setPath(p => p.slice(0, -1));
      return;
    }

    // If crossing own path, truncate back to that point
    const existingIndex = path.findIndex(p => p[0] === r && p[1] === c);
    if (existingIndex !== -1) {
      setPath(p => p.slice(0, existingIndex + 1));
      return;
    }

    // Check numerical order constraint
    const node = nodes.find(n => n.r === r && n.c === c);
    if (node) {
      const expectedNext = getCurrentMax(path) + 1;
      if (node.id !== expectedNext) return; // Cannot connect out of order
    }

    setPath(p => [...p, [r, c]]);
  };

  const endDraw = () => setDrawing(false);

  const resetPuzzle = () => {
    setPath([]);
    setDrawing(false);
  };

  // ── Visual generation ──
  // Creates the smooth SVG rounded path based on coordinates
  const svgPathData = useMemo(() => {
    if (path.length === 0) return "";
    return `M ${path[0][1] * cellSize + cellSize / 2} ${path[0][0] * cellSize + cellSize / 2} ` +
      path.slice(1).map(([r, c]) => `L ${c * cellSize + cellSize / 2} ${r * cellSize + cellSize / 2}`).join(' ');
  }, [path, cellSize]);

  const currentMax = getCurrentMax(path);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
      <p style={{
        color: "#94a3b8", fontSize: 10, letterSpacing: "0.3em",
        fontWeight: 700, margin: 0, textAlign: "center",
      }}>
        CONNECT IN ORDER · FILL EVERY CELL
      </p>

      {/* Sequence Legend */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {nodes.map((n, i) => {
          const isReached = currentMax >= n.id;
          return (
            <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%",
                background: isReached ? "#f97316" : "#1e2d4a",
                color: isReached ? "#000" : "#64748b",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: "bold",
                transition: "all 0.3s"
              }}>
                {n.id}
              </span>
              {i < nodes.length - 1 && (
                <span style={{ color: isReached ? "#f97316" : "#1e2d4a", fontSize: 12 }}>→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid Container */}
      <div
        onMouseLeave={endDraw}
        onTouchEnd={endDraw}
        style={{
          position: "relative",
          width: size * cellSize,
          height: size * cellSize,
          background: "#fde6c1", // Base background color similar to image
          borderRadius: 12,
          border: `2px solid ${flash ? "#4ade80" : meta.border}`,
          transition: "border-color 0.3s",
          userSelect: "none",
          touchAction: "none",
          overflow: "hidden"
        }}
      >
        {/* SVG overlay for the continuous path line */}
        <svg
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}
        >
          <path
            d={svgPathData}
            stroke="#f97316"
            strokeWidth={cellSize * 0.65}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        {/* Interactive Grid overlay */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${size}, ${cellSize}px)`,
          position: "absolute",
          top: 0, left: 0,
          width: "100%", height: "100%",
          zIndex: 2
        }}>
          {Array.from({ length: size }, (_, r) =>
            Array.from({ length: size }, (_, c) => {
              const node = nodes.find(n => n.r === r && n.c === c);
              return (
                <div
                  key={`${r}-${c}`}
                  onMouseDown={() => startDraw(r, c)}
                  onMouseEnter={() => enterCell(r, c)}
                  onMouseUp={endDraw}
                  onTouchStart={(e) => { e.preventDefault(); startDraw(r, c); }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    const t = e.touches[0];
                    const el = document.elementFromPoint(t.clientX, t.clientY);
                    if (el?.dataset?.row) enterCell(+el.dataset.row, +el.dataset.col);
                  }}
                  data-row={r} data-col={c}
                  style={{
                    width: cellSize, height: cellSize,
                    border: "1px solid rgba(0, 0, 0, 0.05)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxSizing: "border-box",
                  }}
                >
                  {node && (
                    <div style={{
                      width: cellSize * 0.5, height: cellSize * 0.5,
                      borderRadius: "50%",
                      background: "#111827",
                      color: "#ffffff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800,
                      fontSize: cellSize * 0.3,
                      zIndex: 3, // Sit above the SVG line
                    }}>
                      {node.id}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reset Controls */}
      <button onClick={resetPuzzle} style={{
        padding: "7px 20px", borderRadius: 4,
        background: "transparent",
        border: "1px solid #1e2d4a",
        color: "#64748b", fontSize: 9,
        letterSpacing: "0.3em", fontFamily: "inherit",
        fontWeight: 700, cursor: "pointer",
        transition: "all 0.15s",
      }}
        onMouseEnter={e => e.target.style.borderColor = "#64748b"}
        onMouseLeave={e => e.target.style.borderColor = "#1e2d4a"}
      >
        ↺ RESET
      </button>
    </div>
  );
}