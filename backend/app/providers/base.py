from abc import ABC, abstractmethod
from typing import List, Tuple


class Provider(ABC):
    @abstractmethod
    async def call(
        self,
        model: str,
        system_prompt: str,
        messages: List[dict],
        api_key: str = "",
    ) -> Tuple[str, str]:
        ...
