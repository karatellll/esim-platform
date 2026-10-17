from pathlib import Path

import uvicorn

from app.config import Settings


def main():
    settings = Settings()
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        reload_dirs=[str(Path(__file__).resolve().parent)],
    )


if __name__ == "__main__":
    main()
