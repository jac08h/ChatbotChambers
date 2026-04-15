import asyncio
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Literal, Tuple, Union

from app.providers.claude_code import call_claude_code
from app.providers.codex_cli import call_codex
from app.models import ChatbotConfig, Message, SessionConfig
from app.providers.openrouter import call_openrouter

PROMPTS_DIR = Path(__file__).parent / "prompts"

PREAMBLE = (PROMPTS_DIR / "preamble.md").read_text().strip()
PREAMBLE_A = (PROMPTS_DIR / "preamble_a.md").read_text().strip()
PREAMBLE_B = (PROMPTS_DIR / "preamble_b.md").read_text().strip()


class Generating:
    def __init__(self, chatbot: Literal["a", "b"]) -> None:
        self.chatbot = chatbot


class EmptyMessage:
    def __init__(self, chatbot: Literal["a", "b"]) -> None:
        self.chatbot = chatbot


async def run_conversation(
    config: SessionConfig,
    api_key: str,
    pause_event: asyncio.Event,
    stop_event: asyncio.Event,
    cancel_event: asyncio.Event | None = None,
) -> AsyncGenerator[Union[Generating, EmptyMessage, Message], None]:
    if cancel_event is None:
        cancel_event = asyncio.Event()

    history: List[Tuple[str, str]] = []
    turn = 0
    labels = {"a": config.chatbot_a.name, "b": config.chatbot_b.name}

    chatbots = [
        ("a", config.chatbot_a, PREAMBLE_A),
        ("b", config.chatbot_b, PREAMBLE_B),
    ]

    while True:
        for chatbot_id, chatbot_config, individual_preamble in chatbots:
            while True:
                if stop_event.is_set():
                    return

                await pause_event.wait()

                if stop_event.is_set():
                    return

                yield Generating(chatbot=chatbot_id)

                system_prompt = _build_system_prompt(
                    individual_preamble,
                    config.shared_system_prompt,
                    chatbot_config.system_prompt,
                )
                messages = _build_messages(history, chatbot_id, labels)

                cancel_event.clear()
                llm_task = asyncio.create_task(
                    _call_llm(chatbot_config, system_prompt, messages, api_key)
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
                        return
                    continue

                content, thinking = llm_task.result()

                if not content or not content.strip():
                    yield EmptyMessage(chatbot=chatbot_id)
                    continue

                history.append((chatbot_id, content))
                yield Message(
                    chatbot=chatbot_id,
                    name=chatbot_config.name,
                    model=chatbot_config.model,
                    content=content,
                    turn=turn,
                    thinking=thinking,
                )

                if content.strip() == "/leave":
                    return

                break

        turn += 1


async def _call_llm(
    chatbot_config: ChatbotConfig,
    system_prompt: str,
    messages: List[dict],
    api_key: str,
) -> Tuple[str, str]:
    if chatbot_config.provider == "claude_code":
        content = await call_claude_code(
            model=chatbot_config.model,
            system_prompt=system_prompt,
            messages=messages,
        )
        return content, ""
    elif chatbot_config.provider == "codex":
        content = await call_codex(
            model=chatbot_config.model,
            system_prompt=system_prompt,
            messages=messages,
        )
        return content, ""
    else:
        return await call_openrouter(
            model=chatbot_config.model,
            system_prompt=system_prompt,
            messages=messages,
            api_key=api_key,
        )


def _build_system_prompt(
    individual_preamble: str, shared: str, individual: str
) -> str:
    parts = [p for p in [PREAMBLE, individual_preamble, shared.strip(), individual.strip()] if p]
    return "\n\n".join(parts)


def _build_messages(
    history: List[Tuple[str, str]], chatbot_id: str, labels: Dict[str, str]
) -> List[dict]:
    messages = []
    for speaker, content in history:
        label = labels[speaker]
        messages.append({"role": "assistant", "content": "%s: %s" % (label, content)})
    return messages
