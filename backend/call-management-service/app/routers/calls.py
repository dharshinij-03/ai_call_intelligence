from typing import Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Call, CallSource, CallStatus
from app.schemas import CallDetailOut, CallOut
from app.services import storage
from app.workers.transcription import process_uploaded_call

router = APIRouter()


@router.post("/upload", response_model=CallOut)
async def upload_call(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language_code: Optional[str] = Form(None),
    caller_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    call = Call(
        source=CallSource.uploaded,
        status=CallStatus.pending,
        caller_id=caller_id,
        primary_language=language_code,
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)

    local_path = await storage.save_upload(file, call.id)
    call.audio_url = str(local_path)
    await db.commit()

    background_tasks.add_task(process_uploaded_call, call.id, str(local_path))
    return call


@router.get("/{call_id}", response_model=CallDetailOut)
async def get_call(call_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Call)
        .options(selectinload(Call.segments))
        .where((Call.id == call_id) | (Call.caller_id == str(call_id)))
        .order_by(Call.created_at.desc())
    )
    call = result.scalars().first()
    if call is None:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


@router.get("/by-caller/{caller_id}", response_model=CallDetailOut)
async def get_call_by_caller(
    caller_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Look up the most recent call for a given caller_id (citizen session UUID)."""
    result = await db.execute(
        select(Call)
        .options(selectinload(Call.segments))
        .where(Call.caller_id == caller_id)
        .order_by(Call.created_at.desc())
    )
    call = result.scalars().first()
    if call is None:
        raise HTTPException(status_code=404, detail="No call found for this caller_id")
    return call


@router.get("", response_model=list[CallOut])
async def list_calls(limit: int = 20, offset: int = 0, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Call).order_by(Call.created_at.desc()).limit(limit).offset(offset)
    )
    return result.scalars().all()
