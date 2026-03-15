"""Common service-layer exceptions and safe API response payloads."""

from __future__ import annotations


class ServiceError(Exception):
    """Base class for recoverable application errors."""

    status_code = 500
    default_message = "Request failed."

    def __init__(
        self,
        message: str | None = None,
        *,
        details: str | None = None,
        status_code: int | None = None,
    ) -> None:
        self.message = message or self.default_message
        self.details = details
        self.status_code = status_code or self.__class__.status_code
        super().__init__(self.message)

    def to_response(self) -> dict[str, str | None]:
        """Return a stable error response payload."""
        return {
            "status": "error",
            "message": self.message,
            "details": self.details,
            "error": self.message,
        }


class AudioUploadError(ServiceError):
    """Raised when audio could not be persisted."""

    status_code = 500
    default_message = "Failed to save audio file."


class AudioValidationError(ServiceError):
    """Raised when an uploaded audio file is invalid."""

    status_code = 400
    default_message = "Invalid audio file."


class AudioProcessingError(ServiceError):
    """Raised when uploaded audio cannot be decoded or processed."""

    status_code = 400
    default_message = "Audio processing failed."


class ResourceNotFoundError(ServiceError):
    """Raised when a requested file or record does not exist."""

    status_code = 404
    default_message = "Requested resource was not found."


class EmotionDetectionError(ServiceError):
    """Raised when emotion inference fails."""

    status_code = 500
    default_message = "Emotion detection failed."


class DatabaseOperationError(ServiceError):
    """Raised when a database write or query fails."""

    status_code = 500
    default_message = "Database operation failed."


class InsightGenerationError(ServiceError):
    """Raised when insight generation fails."""

    status_code = 500
    default_message = "Insight generation failed."
