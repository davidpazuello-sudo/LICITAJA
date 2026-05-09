from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LicitaAI"
    environment: str = "development"
    api_prefix: str = "/api"
    app_url: str = "http://localhost:5173"
    api_url: str = "http://127.0.0.1:8000"
    frontend_origin: str = "http://localhost:5173"
    allowed_origins_raw: str = "http://localhost:5173,http://127.0.0.1:5173"
    database_url: str = "sqlite:///./licitai.db"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    deepseek_api_key: str = ""
    groq_api_key: str = ""
    pncp_base_url: str = "https://pncp.gov.br/api/consulta/v1"
    uploads_dir: str = "uploads"
    storage_backend: str = "local"
    storage_bucket: str = ""
    storage_region: str = ""
    storage_endpoint_url: str = ""
    storage_access_key_id: str = ""
    storage_secret_access_key: str = ""
    storage_public_base_url: str = ""
    storage_prefix: str = "licitai"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        values = [
            value.strip()
            for value in self.allowed_origins_raw.split(",")
            if value.strip()
        ]
        defaults = [
            self.frontend_origin.strip(),
            self.app_url.strip(),
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
        combined = [*values, *defaults]
        return list(dict.fromkeys(origin for origin in combined if origin))


@lru_cache
def get_settings() -> Settings:
    return Settings()
