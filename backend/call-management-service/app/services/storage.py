"""Local disk staging + GCS upload for call audio files."""

from pathlib import Path
from uuid import UUID

from fastapi import UploadFile
from google.cloud import storage as gcs_storage

from app.config import get_settings


def local_upload_path(call_id: UUID, filename: str) -> Path:
    settings = get_settings()
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = Path(filename).suffix or ".bin"
    return upload_dir / f"{call_id}{ext}"


async def save_upload(file: UploadFile, call_id: UUID) -> Path:
    dest = local_upload_path(call_id, file.filename or "audio.bin")
    with open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)
    return dest


def upload_to_gcs(local_path: Path, call_id: UUID) -> str:
    settings = get_settings()
    if not settings.gcs_bucket_name or settings.gcs_bucket_name == "your-gcs-bucket-name":
        raise RuntimeError(
            "GCS_BUCKET_NAME is not configured. A GCS bucket is required to transcribe uploaded "
            "call recordings — Google's synchronous Speech-to-Text API is capped at ~1 minute / "
            "10MB, too small for real call recordings, so long-running recognition (which reads "
            "from GCS) is used instead."
        )

    client = gcs_storage.Client()
    bucket = client.bucket(settings.gcs_bucket_name)
    blob_name = f"call-audio/{call_id}{local_path.suffix}"
    blob = bucket.blob(blob_name)
    blob.upload_from_filename(str(local_path))
    return f"gs://{settings.gcs_bucket_name}/{blob_name}"
