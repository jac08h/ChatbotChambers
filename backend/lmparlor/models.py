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


class ChatbotConfig(BaseModel):
    model: str
    system_prompt: str


class SessionConfig(BaseModel):
    chatbot_a: ChatbotConfig
    chatbot_b: ChatbotConfig
    shared_system_prompt: str
    max_turns: int = 50


class Message(BaseModel):
    chatbot: Literal["a", "b"]
    model: str
    content: str
    turn: int
