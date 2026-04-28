class PipelineConfigurationError(RuntimeError):
    """Raised when required runtime configuration is missing or invalid."""


class PipelineStageError(RuntimeError):
    """Raised when a pipeline stage fails to execute successfully."""
