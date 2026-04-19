import asyncio
import logging
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Literal, Tuple, Union

from app.models import (
    CLAUDE_CODE_MODELS,
    CODEX_MODELS,
    LITELLM_PROVIDERS,
    ChatbotConfig,
    Message,
    SessionConfig,
)
from app.provider_state import ProviderState, create_provider_state, get_capabilities
from app.providers.claude_code import call_claude_code
from app.providers.codex_cli import call_codex
from app.providers.mock import MOCK_MODELS, call_mock
from app.providers.litellm_provider import call_litellm

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent / "prompts"

PREAMBLE = (PROMPTS_DIR / "preamble.md").read_text().strip()
PREAMBLE_A = (PROMPTS_DIR / "preamble_a.md").read_text().strip()
PREAMBLE_B = (PROMPTS_DIR / "preamble_b.md").read_text().strip()

_LITELLM_MODELS = [
    model
    for provider in LITELLM_PROVIDERS.values()
    for model in provider["models"]
]

ALL_MODELS = dict(_LITELLM_MODELS + CLAUDE_CODE_MODELS + CODEX_MODELS + MOCK_MODELS)


def _resolve_model_name(model_id: str) -> str:
    return ALL_MODELS.get(model_id, "")


class Generating:
    def __init__(self, chatbot: Literal["a", "b"]) -> None:
        self.chatbot = chatbot


class EmptyMessage:
    def __init__(self, chatbot: Literal["a", "b"]) -> None:
        self.chatbot = chatbot


async def run_conversation(
    config: SessionConfig,
    pause_event: asyncio.Event,
    stop_event: asyncio.Event,
    cancel_event: asyncio.Event | None = None,
    provider_states: Dict[str, ProviderState] | None = None,
) -> AsyncGenerator[Union[Generating, EmptyMessage, Message], None]:
    if cancel_event is None:
        cancel_event = asyncio.Event()

    if provider_states is None:
        provider_states = {
            "a": create_provider_state(config.chatbot_a.provider),
            "b": create_provider_state(config.chatbot_b.provider),
        }

    history: List[Tuple[str, str]] = []
    turn = 0
    labels = {"a": config.chatbot_a.name, "b": config.chatbot_b.name}

    chatbots = [
        ("a", config.chatbot_a, PREAMBLE_A),
        ("b", config.chatbot_b, PREAMBLE_B),
    ]

    logger.info(
        "Conversation started: a=%s (%s/%s), b=%s (%s/%s)",
        config.chatbot_a.name,
        config.chatbot_a.provider,
        config.chatbot_a.model,
        config.chatbot_b.name,
        config.chatbot_b.provider,
        config.chatbot_b.model,
    )

    while True:
        for chatbot_id, chatbot_config, individual_preamble in chatbots:
            while True:
                if stop_event.is_set():
                    logger.info("Conversation stopped at turn %d", turn)
                    return

                await pause_event.wait()

                if stop_event.is_set():
                    logger.info("Conversation stopped at turn %d", turn)
                    return

                logger.debug(
                    "Generating response for chatbot %s (turn %d)", chatbot_id, turn
                )
                yield Generating(chatbot=chatbot_id)

                system_prompt = _build_system_prompt(
                    individual_preamble,
                    config.shared_system_prompt,
                    chatbot_config.system_prompt,
                )
                messages = _build_messages(history, chatbot_id, labels)
                state = provider_states[chatbot_id]

                cancel_event.clear()
                llm_task = asyncio.create_task(
                    _call_llm(chatbot_config, system_prompt, messages, state)
                )
                cancel_wait = asyncio.create_task(cancel_event.wait())

                done, pending = await asyncio.wait(
                    [llm_task, cancel_wait],
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass

                if cancel_wait in done:
                    if stop_event.is_set():
                        logger.info("Conversation stopped at turn %d", turn)
                        return
                    logger.debug("Generation cancelled for chatbot %s", chatbot_id)
                    continue

                content, _ = llm_task.result()

                if not content or not content.strip():
                    logger.warning(
                        "Empty response from chatbot %s (%s) at turn %d",
                        chatbot_id,
                        chatbot_config.model,
                        turn,
                    )
                    yield EmptyMessage(chatbot=chatbot_id)
                    continue

                logger.debug(
                    "Received response from chatbot %s (turn %d, %d chars)",
                    chatbot_id,
                    turn,
                    len(content),
                )
                history.append((chatbot_id, content))
                yield Message(
                    chatbot=chatbot_id,
                    name=chatbot_config.name,
                    model=chatbot_config.model,
                    model_name=_resolve_model_name(chatbot_config.model),
                    content=content,
                    turn=turn,
                    thinking="",
                )

                if "/leave" in content:
                    logger.info(
                        "Chatbot %s left the conversation at turn %d", chatbot_id, turn
                    )
                    return

                break

        turn += 1


async def _call_llm(
    chatbot_config: ChatbotConfig,
    system_prompt: str,
    messages: List[dict],
    provider_state: ProviderState | None = None,
) -> Tuple[str, str]:
    logger.debug(
        "Calling LLM provider=%s model=%s message_count=%d",
        chatbot_config.provider,
        chatbot_config.model,
        len(messages),
    )
    if chatbot_config.provider == "mock":
        return await call_mock(
            model=chatbot_config.model,
            system_prompt=system_prompt,
            messages=messages,
        )
    elif chatbot_config.provider == "claude_code":
        content = await call_claude_code(
            model=chatbot_config.model,
            system_prompt=system_prompt,
            messages=messages,
            provider_state=provider_state,
        )
        return content, ""
    elif chatbot_config.provider == "codex":
        content = await call_codex(
            model=chatbot_config.model,
            system_prompt=system_prompt,
            messages=messages,
            provider_state=provider_state,
        )
        return content, ""
    elif chatbot_config.provider in LITELLM_PROVIDERS:
        return await call_litellm(
            provider=chatbot_config.provider,
            model=chatbot_config.model,
            system_prompt=system_prompt,
            messages=messages,
            provider_state=provider_state,
        )
    else:
        raise ValueError("Unknown provider: %s" % chatbot_config.provider)


def _build_system_prompt(individual_preamble: str, shared: str, individual: str) -> str:
    parts = [
        p
        for p in [PREAMBLE, individual_preamble, shared.strip(), individual.strip()]
        if p
    ]
    return "\n\n".join(parts)


def _build_messages(
    history: List[Tuple[str, str]], chatbot_id: str, labels: Dict[str, str]
) -> List[dict]:
    messages = []
    for speaker, content in history:
        label = labels[speaker]
        messages.append({"role": "assistant", "content": "%s: %s" % (label, content)})
    return messages
