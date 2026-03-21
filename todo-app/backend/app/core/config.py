import os
from pathlib import Path


class Settings:
    base_dir = Path(__file__).resolve().parents[2]
    default_db = base_dir / "todos.db"
    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{default_db.as_posix()}")
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    refresh_token_expire_days: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
    password_reset_token_expire_minutes: int = int(os.getenv("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", "10"))


settings = Settings()