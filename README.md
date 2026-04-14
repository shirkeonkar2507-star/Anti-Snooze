# Anti-Snooze (Cortex) ⏰🧠

**Anti-Snooze** is a modern, full-stack digital alarm clock designed specifically for hostellers and students who struggle with oversleeping. Unlike traditional alarms, this application locks the screen and forces the user to solve a cognitive puzzle before the alarm can be dismissed.

## 🚀 Key Features
- **Cognitive Interlock:** Prevents dismissal of alarms until a math or logic puzzle is solved correctly.
- **Real-Time Triggers:** Built using WebSockets for instantaneous alarm synchronization between the backend and frontend.
- **Neo-Minimalist UI:** A clean, glassmorphic interface built with React and Tailwind CSS v4.
- **Persistence Logic:** Uses browser local storage to ensure the alarm resumes even if the page is refreshed.
- **Adaptive Difficulty:** (Planned) Adjusts puzzle complexity based on the user's wake-up history.

## 🛠️ Tech Stack
- **Frontend:** React.js, Tailwind CSS v4, Framer Motion (for animations).
- **Backend:** FastAPI (Python), WebSockets, APScheduler (for task scheduling).
- **State Management:** React Hooks (useState, useEffect, useRef).

## 📂 Project Structure
```text
Anti-Snooze/
├── backend/
│   ├── main.py            # FastAPI server & WebSocket logic
│   └── requirements.txt   # Python dependencies
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── AlarmOverlay.jsx  # The "Lock" puzzle screen
    │   │   └── Clock.jsx         # Dashboard components
    │   └── App.jsx               # Main application logic
    └── tailwind.config.js
