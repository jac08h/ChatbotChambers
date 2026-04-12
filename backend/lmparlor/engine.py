import asyncio
from pathlib import Path
from typing import AsyncGenerator, AsyncIterator, Dict, List, Literal, Tuple, Union

from lmparlor.claude_code import stream_claude_code
from lmparlor.codex_cli import stream_codex
from lmparlor.models import Message, SessionConfig
from lmparlor.openrouter import stream_openrouter

PROMPTS_DIR = Path(__file__).parent / "prompts"

PREAMBLE = (PROMPTS_DIR / "preamble.md").read_text().strip()
PREAMBLE_A = (PROMPTS_DIR / "preamble_a.md").read_text().strip()
PREAMBLE_B = (PROMPTS_DIR / "preamble_b.md").read_text().strip()


class Generating:
    def __init__(self, chatbot: Literal["a", "b"]) -> None:
        self.chatbot = chatbot


class Streaming:
    def __init__(self, message: Message) -> None:
        self.message = message


async def run_conversation(
    config: SessionConfig,
    api_key: str,
    pause_event: asyncio.Event,
    stop_event: asyncio.Event,
    interrupt_event: asyncio.Event,
) -> AsyncGenerator[Union[Generating, Streaming, Message], None]:
    history: List[Tuple[str, str]] = []
    turn = 0
    chatbot_index = 0
    labels = {"a": config.chatbot_a.name, "b": config.chatbot_b.name}

    chatbots = [
        ("a", config.chatbot_a, PREAMBLE_A),
        ("b", config.chatbot_b, PREAMBLE_B),
    ]

    while True:
        if stop_event.is_set():
            return

        await pause_event.wait()

        if stop_event.is_set():
            return

        chatbot_id, chatbot_config, individual_preamble = chatbots[chatbot_index]
        yield Generating(chatbot=chatbot_id)

        system_prompt = _build_system_prompt(
            individual_preamble,
            config.shared_system_prompt,
            chatbot_config.system_prompt,
        )
        messages = _build_messages(history, chatbot_id, labels)
        stream = _build_response_stream(
            chatbot_config.provider,
            chatbot_config.model,
            system_prompt,
            messages,
            api_key,
        )
        content = ""
        thinking = ""
        interrupted = False
        interrupt_event.clear()

        try:
            while True:
                next_chunk_task = asyncio.create_task(anext(stream))
                interrupt_task = asyncio.create_task(interrupt_event.wait())
                done, pending = await asyncio.wait(
                    [next_chunk_task, interrupt_task],
                    return_when=asyncio.FIRST_COMPLETED,
                )

                for task in pending:
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass

                if interrupt_task in done:
                    interrupted = True
                    try:
                        await next_chunk_task
                    except (StopAsyncIteration, asyncio.CancelledError):
                        pass
                    break

                try:
                    content, thinking = next_chunk_task.result()
                except StopAsyncIteration:
                    break

                yield Streaming(
                    Message(
                        chatbot=chatbot_id,
                        name=chatbot_config.name,
                        model=chatbot_config.model,
                        content=content,
                        turn=turn,
                        thinking=thinking,
                    )
                )
        finally:
            await _close_stream(stream)

        if interrupted:
            if stop_event.is_set():
                return
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

        chatbot_index = (chatbot_index + 1) % len(chatbots)
        if chatbot_index == 0:
            turn += 1


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
        role = "assistant" if speaker == chatbot_id else "user"
        label = labels[speaker]
        messages.append({"role": role, "content": "%s: %s" % (label, content)})
    return messages


def _build_response_stream(
    provider: str,
    model: str,
    system_prompt: str,
    messages: List[dict],
    api_key: str,
) -> AsyncIterator[Tuple[str, str]]:
    if provider == "claude_code":
        return _wrap_content_only_stream(stream_claude_code(model, system_prompt, messages))
    if provider == "codex":
        return _wrap_content_only_stream(stream_codex(model, system_prompt, messages))
    return stream_openrouter(model, system_prompt, messages, api_key)


async def _wrap_content_only_stream(
    stream: AsyncIterator[str],
) -> AsyncGenerator[Tuple[str, str], None]:
    async for content in stream:
        yield content, ""


async def _close_stream(stream: AsyncIterator[Tuple[str, str]]) -> None:
    close = getattr(stream, "aclose", None)
    if close is None:
        return
    try:
        await close()
    except RuntimeError:
        return
