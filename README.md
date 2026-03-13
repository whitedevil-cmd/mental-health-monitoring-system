## AI Mental Health Monitoring System

A full-stack AI-powered mental health monitoring application with speech emotion recognition, trend analysis, and supportive response generation.

### Architecture

```
React UI (Vite, port 8080)
        ↓  Vite proxy
FastAPI Backend (port 8000)
        ↓
┌───────────────────────────────┐
│  /upload-audio → store WAV    │
│  /detect-emotion → ML model   │
│  /emotion-trend → analysis    │
│  /api/v1/emotions/analyze     │
│  /api/v1/insights/{user_id}   │
└───────────────────────────────┘
        ↓
┌──────────────┐  ┌───────────────┐  ┌──────────────┐
│ Emotion Model│  │ SQLite (async)│  │ Groq LLM     │
│ (wav2vec2)   │  │ (backend.db)  │  │ (optional)   │
└──────────────┘  └───────────────┘  └──────────────┘
```

### Tech stack

- **Frontend**: React, TypeScript, Vite, TailwindCSS, Recharts
- **Backend**: Python 3.10+, FastAPI, SQLAlchemy (async), Uvicorn
- **ML Model**: `ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition` (Hugging Face)
- **LLM**: Groq API (optional, for supportive messages)
- **Database**: SQLite via `aiosqlite`

### Project structure

```
project_root/
├── backend/
│   ├── main.py                 # FastAPI app factory + CORS + health
│   ├── api/
│   │   ├── emotion_routes.py   # POST /detect-emotion
│   │   └── v1/
│   │       ├── routes_audio.py     # POST /upload-audio, /api/v1/audio/upload
│   │       ├── routes_emotions.py  # POST /api/v1/emotions/analyze
│   │       └── routes_insights.py  # GET /api/v1/insights/emotion-trend, /{user_id}
│   ├── services/
│   │   ├── emotion_detector.py     # wav2vec2 ML pipeline (loads once)
│   │   ├── emotion_service.py      # Emotion persistence
│   │   ├── trend_analyzer.py       # 7-day trend analysis logic
│   │   ├── trend_service.py        # Orchestrates trend + support generation
│   │   ├── support_generator.py    # Groq LLM supportive messages
│   │   └── response_service.py     # Static fallback messages
│   ├── database/
│   │   ├── session.py              # Async engine + session
│   │   └── repositories/           # Data access layer
│   └── models/
│       ├── domain/                 # SQLAlchemy ORM models
│       └── schemas/                # Pydantic API schemas
├── frontend/
│   ├── src/
│   │   ├── hooks/
│   │   │   ├── use-voice-recorder.ts   # Audio recording + upload
│   │   │   └── use-dashboard-data.ts   # Dashboard API integration
│   │   ├── components/                 # UI components
│   │   └── pages/                      # Dashboard + Recording pages
│   └── vite.config.ts              # Dev proxy → localhost:8000
├── tests/                          # pytest suite
│   ├── test_full_pipeline.py       # End-to-end integration test
│   ├── test_trend_analyzer.py      # Trend analysis unit tests
│   └── ...                         # Audio, emotion, insights tests
├── requirements.txt
└── README.md
```

### Environment variables

Create a `.env` file at the project root:

```env
APP_NAME="AI Mental Health Monitoring API"
ENVIRONMENT="development"
DEBUG=true
DATABASE_URL="sqlite+aiosqlite:///./backend.db"
AUDIO_STORAGE_DIR="backend/audio_storage/data"

# Optional: Groq LLM for supportive messages
LLM_API_KEY="gsk_your_key_here"
```

### Running the system

**Backend** (from project root):
```bash
pip install -r requirements.txt
uvicorn backend.main:app --reload
```
Verify: `http://localhost:8000/health` → `{"status": "ok"}`

**Frontend** (from `frontend/`):
```bash
npm install
npm run dev
```
Open: `http://localhost:8080`

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Connectivity check |
| `POST` | `/upload-audio` | Upload WAV audio file |
| `POST` | `/detect-emotion` | Run speech emotion recognition |
| `POST` | `/api/v1/emotions/analyze` | Store an emotion reading |
| `GET` | `/api/v1/insights/emotion-trend?user_id=X` | Trend analysis (7 days) |
| `GET` | `/api/v1/insights/{user_id}` | Full insights + supportive message |
| `POST` | `/api/v1/audio/upload` | Upload with user_id (versioned) |

### Running tests

```bash
pytest -v
```

### Performance

- **Emotion model**: Loaded once via `@lru_cache` — no per-request overhead
- **Database**: Async SQLAlchemy for non-blocking I/O
- **CORS**: Configured for `localhost:8080` and `localhost:3000`
