from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    PROJECT_NAME: str = "MD Editor"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    DATABASE_URL: str = "sqlite+aiosqlite:///./md_editor.db"
    
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    WORKSPACE_PATH: str = "./workspace"
    
    class Config:
        env_file = ".env"

settings = Settings()

# 确保工作目录存在
Path(settings.WORKSPACE_PATH).mkdir(exist_ok=True)
