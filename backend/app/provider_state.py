import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

PROVIDER_CACHE_CAPABILITIES: Dict[str, Dict[str, Any]] = {
    "openrouter": {
        "cache_type": "prefix",
        "supports_resume": False,
    },
    "github_copilot": {
        "cache_type": "prefix",
        "supports_resume": False,
    },
    "claude_code": {
        "cache_type": "session",
        "supports_resume": True,
    },
    "codex": {
        "cache_type": "session",
        "supports_resume": True,
    },
    "mock": {
        "cache_type": "none",
        "supports_resume": False,
    },
}

REPO_ROOT = Path(__file__).parent.parent.parent
PROVIDER_SESSIONS_DIR = REPO_ROOT / ".cache" / "provider_sessions"


@dataclass
class ProviderState:
    provider: str
    session_id: Optional[str] = None
    initialized: bool = False
    storage_path: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "provider": self.provider,
            "session_id": self.session_id,
            "initialized": self.initialized,
            "storage_path": self.storage_path,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProviderState":
        return cls(
            provider=data["provider"],
            session_id=data.get("session_id"),
            initialized=data.get("initialized", False),
            storage_path=data.get("storage_path"),
            metadata=data.get("metadata", {}),
        )


def get_capabilities(provider: str) -> Dict[str, Any]:
    return PROVIDER_CACHE_CAPABILITIES.get(provider, {"cache_type": "none", "supports_resume": False})


def create_provider_state(provider: str) -> ProviderState:
    caps = get_capabilities(provider)
    state = ProviderState(provider=provider)
    if caps["supports_resume"]:
        storage_dir = PROVIDER_SESSIONS_DIR / provider
        storage_dir.mkdir(parents=True, exist_ok=True)
        state.storage_path = str(storage_dir)
    return state
