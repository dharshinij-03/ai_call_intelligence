from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import analytics, complaints, departments

app = FastAPI(title="Admin Service")

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


app.include_router(departments.router, tags=["departments"])
app.include_router(complaints.router, tags=["complaints"])
app.include_router(analytics.router, tags=["analytics"])
