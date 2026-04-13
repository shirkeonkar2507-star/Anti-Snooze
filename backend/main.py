from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from pydantic import BaseModel
import datetime
import random

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"],
)

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def startup(): scheduler.start()

@app.on_event("shutdown")
async def shutdown(): scheduler.shutdown()

# ── WebSocket ─────────────────────────────────────────────────────────────────
active_connections: list[WebSocket] = []

@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
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
    alarm_time: str
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

# ── Math Puzzle ───────────────────────────────────────────────────────────────
# easy:   single op  (+ - ×)
# medium: two-step   (a×b) ± c
# hard:   three-step (a×b) − (c×d) ± e

puzzle_store: dict = {}

def make_math(difficulty: str):
    r = lambda a, b: random.randint(a, b)

    if difficulty == "easy":
        op = random.choice(["+", "-", "×"])
        if op == "×":
            a, b = r(2,9), r(2,9)
            return f"{a} × {b}", a * b
        a, b = r(15,60), r(5,30)
        if op == "+":
            return f"{a} + {b}", a + b
        big, small = max(a,b), min(a,b)
        return f"{big} − {small}", big - small

    if difficulty == "medium":
        a, b, c = r(3,14), r(3,12), r(5,30)
        op = random.choice(["+", "−"])
        ans = a*b + c if op == "+" else a*b - c
        return f"({a} × {b}) {op} {c}", ans

    # hard
    a, b = r(4,15), r(4,12)
    c, d = r(2,9),  r(2,8)
    e    = r(5,25)
    op   = random.choice(["+", "−"])
    ans  = a*b - c*d + (e if op=="+" else -e)
    return f"({a}×{b}) − ({c}×{d}) {op} {e}", ans


@app.get("/get-puzzle")
async def get_puzzle(difficulty: str = "medium"):
    question, answer = make_math(difficulty)
    puzzle_store["answer"] = answer
    return {"question": question, "difficulty": difficulty}


class VerifyRequest(BaseModel):
    answer: int

@app.post("/verify-puzzle")
async def verify_puzzle(req: VerifyRequest):
    correct = puzzle_store.get("answer")
    if correct is None:
        return {"success": False, "message": "No active puzzle"}
    if req.answer == correct:
        puzzle_store.clear()
        return {"success": True}
    return {"success": False, "message": "Wrong answer"}