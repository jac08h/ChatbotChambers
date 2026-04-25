from typing import Any, Dict, List, Literal, Tuple

from pydantic import BaseModel

LITELLM_PROVIDERS: Dict[str, Any] = {
    "openrouter": {
        "label": "OpenRouter",
        "docs_url": "https://docs.litellm.ai/docs/providers/openrouter",
        "available_in_hosted": True,
        "models": [],
    },
    "github_copilot": {
        "label": "GitHub Copilot",
        "docs_url": "https://docs.litellm.ai/docs/providers/github_copilot",
        "available_in_hosted": False,
        "models": [
            ("github_copilot/gpt-4o", "GPT-4o"),
            ("github_copilot/gpt-5-mini", "GPT-5 Mini"),
        ],
    },
}

CLAUDE_CODE_MODELS: List[Tuple[str, str]] = [
    ("claude-haiku-4-5", "Haiku 4.5"),
    ("claude-sonnet-4-6", "Sonnet 4.6"),
    ("claude-opus-4-7", "Opus 4.7"),
]

CODEX_MODELS: List[Tuple[str, str]] = [
    ("gpt-5.4", "GPT-5.4"),
    ("gpt-5.4-mini", "GPT-5.4 Mini"),
]


class ChatbotConfig(BaseModel):
    name: str
    model: str
    system_prompt: str
    provider: Literal[
        "openrouter",
        "github_copilot",
        "claude_code",
        "codex",
        "mock",
    ] = "openrouter"
    enable_thinking: bool = False


class SessionConfig(BaseModel):
    chatbot_a: ChatbotConfig
    chatbot_b: ChatbotConfig
    shared_system_prompt: str


class Settings(BaseModel):
    chatbot_a: ChatbotConfig
    chatbot_b: ChatbotConfig
    shared_system_prompt: str


class RenameRequest(BaseModel):
    title: str


class ScenarioRenameRequest(BaseModel):
    name: str


class ScenarioCreateRequest(BaseModel):
    name: str
    config: SessionConfig


class Message(BaseModel):
    chatbot: Literal["a", "b"]
    name: str
    model: str
    model_name: str = ""
    content: str
    turn: int
    thinking: str = ""
