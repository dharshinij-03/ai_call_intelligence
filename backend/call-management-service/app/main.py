import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401  (ensures models are registered on Base before create_all)
from app.config import get_settings
from app.database import Base, engine
from app.routers import calls, health, live

settings = get_settings()

# google-cloud-* libraries read this from the real process environment, not
# from our pydantic Settings object, so mirror it across explicitly.
if settings.google_application_credentials:
    os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", settings.google_application_credentials)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Warm Whisper in a background thread so the first live call isn't stuck downloading
    def _warm():
        try:
            from app.services.whisper_speech_service import _get_model

            _get_model()
        except Exception:
            logging.getLogger(__name__).exception("Whisper warm-up failed")

    import logging
    import threading

    threading.Thread(target=_warm, daemon=True).start()
    yield


app = FastAPI(title="Call Management Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(calls.router, prefix="/calls", tags=["calls"])
app.include_router(live.router, prefix="/ws", tags=["live"])

demo_dir = Path(__file__).resolve().parent.parent / "demo"
app.mount("/demo", StaticFiles(directory=demo_dir, html=True), name="demo")
