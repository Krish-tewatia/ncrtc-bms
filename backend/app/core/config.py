from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://ncrtc:ncrtc@db:5432/ncrtc_bms"
    REDIS_URL: str = "redis://redis:6379/0"
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_ALGO: str = "HS256"
    ACCESS_TOKEN_MIN: int = 720

settings = Settings()
