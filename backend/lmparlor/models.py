from typing import List, Literal, Tuple

from pydantic import BaseModel

MODELS: List[Tuple[str, str]] = [
    ("anthropic/claude-sonnet-4-5", "Claude Sonnet 4.5"),
    ("openai/gpt-4o", "GPT-4o"),
    ("openai/gpt-4o-mini", "GPT-4o Mini"),
    ("google/gemini-3.1-flash-lite-preview", "Gemini 3.1 Flash Lite"),
    ("google/gemini-2.5-flash", "Gemini 2.5 Flash"),
    ("google/gemini-2.5-pro", "Gemini 2.5 Pro"),
    ("meta-llama/llama-4-maverick", "Llama 4 Maverick"),
    ("deepseek/deepseek-chat-v3-0324", "DeepSeek V3"),
    ("mistralai/mistral-large-2411", "Mistral Large"),
]

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
    provider: Literal["openrouter", "claude_code", "codex"] = "openrouter"


class SessionConfig(BaseModel):
    chatbot_a: ChatbotConfig
    chatbot_b: ChatbotConfig
    shared_system_prompt: str
    max_turns: int = 50


class Message(BaseModel):
    chatbot: Literal["a", "b"]
    name: str
    model: str
    content: str
    turn: int
    thinking: str = ""
