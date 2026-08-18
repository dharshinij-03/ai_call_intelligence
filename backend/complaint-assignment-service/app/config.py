from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str

    call_analysis_service_url: str = "http://localhost:8002"
    user_management_service_url: str = "http://localhost:8003"
    service_api_key: str

    gemini_api_key: str
    gemini_model: str = "gemini-flash-latest"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
