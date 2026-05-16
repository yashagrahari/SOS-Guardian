import os
import secrets
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from starlette.middleware.sessions import SessionMiddleware

from sos_core import DetectionResult, detect_emergency

load_dotenv()

STATIC_DIR = Path(__file__).parent / "static"
app = FastAPI(title="SOS Guardian", description="Live conversation emergency monitor")
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", secrets.token_hex(32)),
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class LoginRequest(BaseModel):
    email: EmailStr


class AnalyzeRequest(BaseModel):
    messages: List[str]


def _current_user(request: Request) -> str | None:
    return request.session.get("email")


@app.get("/")
async def index(request: Request):
    if not _current_user(request):
        return FileResponse(STATIC_DIR / "login.html")
    return FileResponse(STATIC_DIR / "dashboard.html")


@app.get("/api/me")
async def me(request: Request):
    email = _current_user(request)
    if not email:
        raise HTTPException(status_code=401, detail="Not logged in")
    return {"email": email}


@app.post("/api/login")
async def login(body: LoginRequest, request: Request):
    request.session["email"] = body.email.lower().strip()
    return {"email": request.session["email"]}


@app.post("/api/logout")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@app.post("/api/analyze", response_model=DetectionResult)
async def analyze(body: AnalyzeRequest, request: Request):
    email = _current_user(request)
    if not email:
        raise HTTPException(status_code=401, detail="Not logged in")

    messages = [m.strip() for m in body.messages if m and m.strip()]
    if not messages:
        raise HTTPException(status_code=400, detail="No messages to analyze")

    return await detect_emergency(email, messages)
