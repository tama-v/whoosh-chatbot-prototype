from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Language = Literal["id", "en"]
ComplaintCategory = Literal[
    "lost_and_found",
    "ticket_issue",
    "boarding_issue",
    "station_facility",
    "train_service",
    "other",
]
ComplaintStatus = Literal["submitted_to_demo_system", "under_review", "resolved", "closed"]
Priority = Literal["low", "medium", "high"]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None
    language: Language = "id"
    input_type: Literal["text", "voice"] = "text"


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=200)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=8, max_length=200)


class VoiceRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    language: Language = "id"
    voice_id: str = Field(default="auto", max_length=60)


class ComplaintAnalyzeRequest(BaseModel):
    description: str = Field(min_length=5, max_length=4000)
    travel_date: date | None = None
    station: str | None = Field(default=None, max_length=120)
    train_info: str | None = Field(default=None, max_length=120)


class ComplaintCreate(BaseModel):
    category: ComplaintCategory
    description: str = Field(min_length=10, max_length=4000)
    travel_date: date | None = None
    station: str | None = Field(default=None, max_length=120)
    train_info: str | None = Field(default=None, max_length=120)
    contact: str | None = Field(default=None, max_length=160)
    priority: Priority = "medium"
    summary: str | None = Field(default=None, max_length=1000)


class ComplaintUpdate(BaseModel):
    status: ComplaintStatus
