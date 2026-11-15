"""DoseRelay Core Configuration."""
from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    APP_NAME: str = "DoseRelay"
    APP_ENV: str = "development"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str = "postgresql://doserelay:doserelay_secret@localhost:5432/doserelay"
    
    # JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production-abcdef123456"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # CORS
    CORS_ORIGINS: str = '["http://localhost:5173","http://localhost:3000"]'
    
    # Demo
    LOAD_DEMO_DATA: bool = True
    
    # Groq AI
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    
    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return ["http://localhost:5173"]
    
    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
