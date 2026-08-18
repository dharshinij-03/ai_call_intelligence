from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401  (ensures models are registered on Base before create_all)
from app.database import Base, engine
from app.routers import calls, complaints


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="Citizen Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(calls.router, tags=["calls"])
app.include_router(complaints.router, tags=["complaints"])

demo_dir = Path(__file__).resolve().parent.parent / "demo"
app.mount("/demo", StaticFiles(directory=demo_dir, html=True), name="demo")
