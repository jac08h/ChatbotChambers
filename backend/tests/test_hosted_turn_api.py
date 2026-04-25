import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from api.turn import app


class MockStream:
    def __init__(self, chunks):
        self._chunks = chunks

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._chunks:
            raise StopAsyncIteration
        return self._chunks.pop(0)


def make_chunk(content: str):
    return SimpleNamespace(
        choices=[SimpleNamespace(delta=SimpleNamespace(content=content))]
    )


async def test_hosted_turn_streams_result():
    stream = MockStream([make_chunk("Hello"), make_chunk(" world")])
    with patch("api.turn.litellm.acompletion", AsyncMock(return_value=stream)):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="https://example.vercel.app"
        ) as client:
            response = await client.post(
                "/api/turn",
                headers={"origin": "https://example.vercel.app"},
                json={
                    "system_prompt": "You are helpful",
                    "messages": [{"speaker": "a", "content": "Hello"}],
                    "model": "openai/gpt-4.1-mini",
                    "openrouter_key": "sk-or-v1-test",
                },
            )

    assert response.status_code == 200
    assert '"type": "result"' in response.text
    assert '"content": "Hello world"' in response.text


async def test_hosted_turn_rejects_cross_origin_requests():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="https://example.vercel.app"
    ) as client:
        response = await client.post(
            "/api/turn",
            headers={"origin": "https://evil.com"},
            json={
                "system_prompt": "You are helpful",
                "messages": [],
                "model": "openai/gpt-4.1-mini",
                "openrouter_key": "sk-or-v1-test",
            },
        )

    assert response.status_code == 403
