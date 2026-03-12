"""
Time and date utilities.

Central place for timezone handling, formatting, etc.
Currently only a placeholder to illustrate where such helpers belong.
"""

from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return the current UTC time as an aware datetime."""
    return datetime.now(timezone.utc)

"""
Time and date utilities.

Central place for timezone handling, formatting, etc.
Currently only a placeholder to illustrate where such helpers belong.
"""

from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return the current UTC time as an aware datetime."""
    return datetime.now(timezone.utc)

