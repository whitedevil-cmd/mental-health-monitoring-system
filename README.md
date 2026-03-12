## AI Mental Health Monitoring Backend (FastAPI)

This project is a **backend skeleton** for an AI-powered mental health monitoring system.  
It is designed to be **modular**, **production-oriented**, and easy to extend with real emotion models and LLMs later.

### Tech stack

- **Language**: Python 3.10+
- **Framework**: FastAPI
- **ORM**: SQLAlchemy (async)
- **Config**: Pydantic Settings (`.env` support)
- **Server**: Uvicorn

### Folder structure (backend)

- `backend/main.py` – FastAPI app factory, lifespan, router registration, DB table creation (for dev)
- `backend/api/`
  - `v1/routes_audio.py` – audio upload endpoint
  - `v1/routes_emotions.py` – placeholder emotion analyze/store endpoint
  - `v1/routes_insights.py` – trend + supportive message endpoint
- `backend/services/`
  - `audio_service.py` – handles audio uploads via storage backend
  - `emotion_service.py` – placeholder emotion detection + persistence
  - `trend_service.py` – builds simple emotion trends over time
  - `response_service.py` – placeholder supportive response (future LLM integration)
- `backend/models/`
  - `domain/` – SQLAlchemy ORM models (`AudioRecording`, `EmotionReading`)
  - `schemas/` – Pydantic API schemas (audio, emotions, insights)
- `backend/database/`
  - `config.py` – gets `DATABASE_URL` from settings
  - `base.py` – SQLAlchemy `Base`
  - `session.py` – async engine + `get_session` dependency
  - `repositories/` – repository layer (e.g. `EmotionRepository`)
- `backend/utils/`
  - `config.py` – env-based settings via Pydantic
  - `logging.py` – app-wide logging config
  - `time.py` – small time utilities
- `backend/audio_storage/`
  - `filesystem_backend.py` – stores audio files under `backend/audio_storage/data`

### Environment variables

Environment variables are loaded via `backend.utils.config.Settings`.  
You can define them in a `.env` file at the project root (`C:\Users\KIIT\Desktop\test`), for example:

```env
APP_NAME="AI Mental Health Monitoring API"
ENVIRONMENT="development"
DEBUG=true

DATABASE_URL="sqlite+aiosqlite:///./backend.db"

# Where uploaded audio is stored (relative or absolute path)
AUDIO_STORAGE_DIR="backend/audio_storage/data"

# Placeholders for future integrations
EMOTION_MODEL_NAME=""
LLM_PROVIDER=""
LLM_API_KEY=""
```

### Installing dependencies

From the project root:

```bash
pip install -r requirements.txt
```

### Running the backend

From the project root:

```bash
uvicorn backend.main:app --reload
```

The app will be available at `http://127.0.0.1:8000`.

Open the interactive docs:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### Key API endpoints (v1)

Base prefix for v1: `/api/v1`

- **Upload audio**
  - **POST** `/api/v1/audio/upload`
  - Multipart form with:
    - `user_id` (form field)
    - `file` (audio file)
  - Returns basic metadata (`audio_id`, `user_id`, `stored_at`).

- **Analyze/store emotion (placeholder)**
  - **POST** `/api/v1/emotions/analyze`
  - JSON body (`EmotionReadingCreate`):
    - `user_id`: string
    - `audio_id`: string or `null`
    - `emotion_label`: string (e.g. "happy", "sad")
    - `confidence`: float or `null`
  - Currently just stores the payload; future version will call a real model.

- **Get emotion insights + supportive message**
  - **GET** `/api/v1/insights/{user_id}`
  - Builds a basic trend from stored emotion readings and attaches a static, supportive message.

### What is NOT implemented yet

- Actual **emotion detection model** for speech.
- Real **LLM integration** for supportive messages.
- Authentication/authorization, rate limiting, or advanced security.
- Production-grade migrations (the app currently auto-creates tables on startup for convenience).

These can be added incrementally by plugging models and external APIs into the existing **services** and **repository** layers.

