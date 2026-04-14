.PHONY: dev stop

dev:
	cd backend && uv run --project . uvicorn lmparlor.main:app --reload --port 8001 &
	cd frontend && pnpm dev &
	@echo "Backend and frontend running. Press Ctrl+C to stop."

stop:
	pkill -f uvicorn
	pkill -f "vite.*frontend"
