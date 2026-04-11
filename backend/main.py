from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler  # ← KEY FIX
from pydantic import BaseModel
import datetime
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# AsyncIOScheduler shares FastAPI's running event loop — no asyncio.run() needed
scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup():
    scheduler.start()

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()

# ── WebSocket manager ─────────────────────────────────────────────────────────
active_connections: list[WebSocket] = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()   # keep-alive
    except WebSocketDisconnect:
        active_connections.remove(websocket)

async def broadcast(payload: dict):
    dead = []
    for ws in active_connections:
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        active_connections.remove(ws)

# ── Set Alarm ─────────────────────────────────────────────────────────────────
class AlarmRequest(BaseModel):
    alarm_time: str           # "HH:MM"
    difficulty: str = "medium"

@app.post("/set-alarm")
async def set_alarm(req: AlarmRequest):
    now = datetime.datetime.now()
    target = datetime.datetime.strptime(req.alarm_time, "%H:%M").replace(
        year=now.year, month=now.month, day=now.day
    )
    if target <= now:
        target += datetime.timedelta(days=1)

    diff = req.difficulty

    async def fire():
        await broadcast({"action": "TRIGGER_ALARM", "difficulty": diff})

    scheduler.add_job(fire, "date", run_date=target, id="alarm", replace_existing=True)
    return {"status": "success", "scheduled_for": str(target), "difficulty": diff}

# ── Puzzle generator ──────────────────────────────────────────────────────────
puzzle_store: dict = {}

def make_puzzle(difficulty: str):
    r = lambda a, b: random.randint(a, b)
    if difficulty == "easy":
        a, b = r(10, 30), r(5, 20)
        op = random.choice(["+", "-"])
        ans = a + b if op == "+" else a - b
        return f"{a} {op} {b}", ans

    if difficulty == "medium":
        a, b, c = r(2, 12), r(2, 10), r(1, 20)
        op = random.choice(["+", "-"])
        ans = a * b + c if op == "+" else a * b - c
        return f"({a} × {b}) {op} {c}", ans

    # hard
    a, b, c, d = r(3, 12), r(3, 10), r(2, 8), r(2, 6)
    return f"({a} × {b}) − ({c} × {d})", a * b - c * d

@app.get("/get-puzzle")
async def get_puzzle(difficulty: str = "medium"):
    question, answer = make_puzzle(difficulty)
    puzzle_store["answer"] = answer
    return {"question": question, "difficulty": difficulty}

# ── Verify answer ─────────────────────────────────────────────────────────────
class VerifyRequest(BaseModel):
    answer: int

@app.post("/verify-puzzle")
async def verify_puzzle(req: VerifyRequest):
    correct = puzzle_store.get("answer")
    if correct is None:
        return {"success": False, "message": "No active puzzle"}
    if req.answer == correct:
        puzzle_store.clear()
        await broadcast({"action": "DISMISS_ALARM"})
        return {"success": True}
    return {"success": False, "message": "Wrong answer"}