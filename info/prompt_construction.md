# Prompt Construction

## System Prompt Layers (in order)

Built in `engine._build_system_prompt()`:

1. **PREAMBLE** (`preamble.md`) — shared base rules
2. **Individual preamble** (`preamble_a.md` or `preamble_b.md`) — bot identity
3. **Shared system prompt** — user-provided, applies to both bots
4. **Individual system prompt** — user-provided, specific to this bot

Sections joined with `"\n\n"`. Empty strings filtered out.
