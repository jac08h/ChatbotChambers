.PHONY: dev stop

dev:
	cd backend && uv run uvicorn app.main:app --reload --port 8001 &
	cd frontend && pnpm dev &
	@echo "Backend and frontend running. Use 'make stop' to stop."

stop:
	@lsof -ti:8001 | xargs -r kill 2>/dev/null || true
	@lsof -ti:5173 | xargs -r kill 2>/dev/null || true
	@echo "Stopped."
