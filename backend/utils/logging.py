"""
Logging configuration for the backend.

This module defines a single function `configure_logging` that should be
called once at application startup (see `main.py`). It configures
structured logging suitable for production use, while remaining simple.
"""

import logging
from logging.config import dictConfig


def configure_logging(level: str = "INFO") -> None:
    """
    Configure application-wide logging using the standard logging module.

    In a real production system, you might extend this to send logs to
    external aggregators like ELK, Loki, or any observability platform.
    """
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": (
                        "%(asctime)s | %(levelname)s | "
                        "%(name)s | %(message)s"
                    ),
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                },
                "file": {
                    "class": "logging.FileHandler",
                    "filename": "backend/app.log",
                    "formatter": "default",
                }
            },
            "root": {
                "handlers": ["console", "file"],
                "level": level.upper(),
            },
        }
    )

