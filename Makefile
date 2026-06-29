.PHONY: backend-dev frontend-dev tauri-dev lint test clean

BACKEND_DIR = backend
FRONTEND_DIR = frontend

## Backend

backend-dev:
	cd $(BACKEND_DIR) && pip install -r requirements.txt && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

backend-install:
	cd $(BACKEND_DIR) && pip install -r requirements.txt

backend-test:
	cd $(BACKEND_DIR) && python -m pytest tests/ -v

## Frontend

frontend-install:
	cd $(FRONTEND_DIR) && npm install

frontend-dev:
	cd $(FRONTEND_DIR) && npm run dev

## Tauri

tauri-dev:
	cd $(FRONTEND_DIR) && npm run tauri dev

tauri-build:
	cd $(FRONTEND_DIR) && npm run tauri build

## Docker

docker-up:
	docker compose up --build

## Lint

lint:
	cd $(BACKEND_DIR) && python -m pip install ruff && ruff check app/ tests/

## Clean

clean:
	rm -rf $(BACKEND_DIR)/data/*.db
	rm -rf $(BACKEND_DIR)/__pycache__
	rm -rf $(BACKEND_DIR)/app/__pycache__
	rm -rf $(FRONTEND_DIR)/dist
	rm -rf $(FRONTEND_DIR)/node_modules
