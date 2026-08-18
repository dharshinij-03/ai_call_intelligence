from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    admin_bootstrap_key: str

    # Shared secret other backend services present (X-Service-Key header) to
    # call internal, non-user-facing endpoints like officer lookup — avoids
    # needing a "service account" login flow for machine-to-machine calls.
    service_api_key: str

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
