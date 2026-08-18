from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str

    google_application_credentials: Optional[str] = None
    gcs_bucket_name: Optional[str] = None
    gemini_api_key: Optional[str] = None

    default_language_code: str = "en-IN"
    alternative_language_codes: List[str] = ["hi-IN", "ta-IN", "te-IN", "bn-IN"]

    upload_dir: str = "./storage/uploads"
    cors_origins: List[str] = ["*"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
