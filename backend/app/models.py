from typing import Any, Dict, List, Literal, Tuple

from pydantic import BaseModel

LITELLM_PROVIDERS: Dict[str, Any] = {
    "openai": {
        "label": "OpenAI",
        "docs_url": "https://docs.litellm.ai/docs/providers/openai",
        "models": [
            ("openai/gpt-4o", "GPT-4o"),
            ("openai/gpt-4o-mini", "GPT-4o Mini"),
            ("openai/o3-mini", "o3 Mini"),
            ("openai/o4-mini", "o4 Mini"),
        ],
    },
    "anthropic": {
        "label": "Anthropic",
        "docs_url": "https://docs.litellm.ai/docs/providers/anthropic",
        "models": [
            ("anthropic/claude-opus-4-20250514", "Claude Opus 4"),
            ("anthropic/claude-sonnet-4-20250514", "Claude Sonnet 4"),
            ("anthropic/claude-3-7-sonnet-20250219", "Claude 3.7 Sonnet"),
            ("anthropic/claude-3-5-sonnet-20241022", "Claude 3.5 Sonnet"),
        ],
    },
    "gemini": {
        "label": "Gemini",
        "docs_url": "https://docs.litellm.ai/docs/providers/gemini",
        "models": [
            ("gemini/gemini-2.5-flash-preview-04-17", "Gemini 2.5 Flash"),
            ("gemini/gemini-2.0-flash", "Gemini 2.0 Flash"),
            ("gemini/gemini-1.5-pro-latest", "Gemini 1.5 Pro"),
            ("gemini/gemini-1.5-flash", "Gemini 1.5 Flash"),
        ],
    },
    "github_copilot": {
        "label": "GitHub Copilot",
        "docs_url": "https://docs.litellm.ai/docs/providers/github_copilot",
        "models": [
            ("github_copilot/gpt-4", "GPT-4"),
        ],
    },
}

CLAUDE_CODE_MODELS: List[Tuple[str, str]] = [
    ("claude-sonnet-4-6", "Sonnet 4.6"),
    ("claude-opus-4-6", "Opus 4.6"),
    ("claude-haiku-4-5-20251001", "Haiku 4.5"),
]

CODEX_MODELS: List[Tuple[str, str]] = [
    ("gpt-5.4", "gpt-5.4 (default)"),
    ("gpt-5.4-mini", "gpt-5.4-mini"),
    ("gpt-5.3-codex", "gpt-5.3-codex"),
    ("gpt-5.2-codex", "gpt-5.2-codex"),
    ("gpt-5.2", "gpt-5.2"),
    ("gpt-5.1-codex-max", "gpt-5.1-codex-max"),
    ("gpt-5.1-codex-mini", "gpt-5.1-codex-mini"),
]


class ChatbotConfig(BaseModel):
    name: str
    model: str
    system_prompt: str
    provider: Literal["openai", "anthropic", "gemini", "github_copilot", "claude_code", "codex", "mock"] = "openai"
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
