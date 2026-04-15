from abc import ABC, abstractmethod
from typing import List, Tuple


class Provider(ABC):
    """Abstract base class for LLM provider integrations.

    Subclasses implement ``call`` to send a prompt to a specific LLM service
    and return the generated response along with any extracted thinking text.
    """

    @abstractmethod
    async def call(
        self,
        model: str,
        system_prompt: str,
        messages: List[dict],
        api_key: str = "",
    ) -> Tuple[str, str]:
        """Send a prompt to the provider and return (content, thinking)."""
        ...
