from pydantic import BaseSettings

class Settings(BaseSettings):
    app_name: str = "Mental Health Monitoring System"
    admin_email: str = "admin@example.com"
    database_url: str
    secret_key: str

    class Config:
        env_file = ".env"

settings = Settings()