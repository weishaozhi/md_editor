from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    PROJECT_NAME: str = "MD Editor"
    VERSION: str = "1.1.0"
    API_PREFIX: str = "/api"

    DATABASE_URL: str = "sqlite+aiosqlite:///./md_editor.db"

    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    WORKSPACE_PATH: str = "./workspace"

    # CORS: comma-separated allow list. Default covers local Vite (5173) and CRA (3000).
    # Set via env or .env. Production deployments MUST override.
    CORS_ALLOW_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # When DEBUG=True and CORS_ALLOW_ORIGINS="*" is given, credentials are disabled
    # so the browser-unsafe combination is never allowed.
    DEBUG: bool = False

    class Config:
        env_file = ".env"

settings = Settings()

# Ensure workspace dir exists
Path(settings.WORKSPACE_PATH).mkdir(exist_ok=True)
