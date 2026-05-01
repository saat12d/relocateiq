# RelocateIQ
CS 130 Group 8 Project Spring 2026
RelocateIQ: Smarter Relocation by Commute

## Project Structure

- `frontend`: React single page application
- `backend`: Python FastAPI service

## Frontend Setup (React)

1. `cd frontend`
2. `npm install`
3. `npm run dev`

Frontend runs at `http://localhost:5173`.

## Backend Setup (Python)

1. `cd backend`
2. `python3 -m venv .venv`
3. `source .venv/bin/activate`
4. `pip install -r requirements.txt`
5. `cp .env.example .env`
6. `uvicorn app.main:app --reload --port 8000`

Backend runs at `http://localhost:8000`.
