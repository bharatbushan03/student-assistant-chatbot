"""Schemas for the admin student oversight dashboard."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.academics import NoticeSchema, StudentDashboardResponseSchema


class AdminStudentRowSchema(BaseModel):
    student_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[str] = None
    cgpa: Optional[float] = None
    latest_sgpa: Optional[float] = None
    attendance_overall: Optional[float] = None
    pending_task_count: int = 0
    status: Literal["on_track", "at_risk", "missing_record"]


class AdminPlatformSchema(BaseModel):
    llm_provider: str
    llm_model: str
    vector_db: str
    pinecone_index: str


class AdminOverviewSchema(BaseModel):
    total_students: int = Field(..., ge=0)
    records_on_file: int = Field(..., ge=0)
    missing_records: int = Field(..., ge=0)
    at_risk_count: int = Field(..., ge=0)
    on_track_count: int = Field(..., ge=0)
    average_cgpa: Optional[float] = None
    average_attendance: Optional[float] = None
    at_risk_students: List[AdminStudentRowSchema] = Field(default_factory=list)
    platform: AdminPlatformSchema


class AdminStudentListSchema(BaseModel):
    count: int = Field(..., ge=0)
    students: List[AdminStudentRowSchema] = Field(default_factory=list)


class CreateNoticeRequestSchema(BaseModel):
    title: str = Field(..., min_length=3, max_length=140)
    body: str = Field(..., min_length=3, max_length=2000)
    audience: Literal["all", "students"] = "students"


class NoticeListSchema(BaseModel):
    count: int = Field(..., ge=0)
    notices: List[NoticeSchema] = Field(default_factory=list)


class ProvisionAccountRequestSchema(BaseModel):
    email: str = Field(..., min_length=5, max_length=160)
    password: str = Field(..., min_length=8, max_length=128)
    role: Literal["faculty", "admin"]
    name: Optional[str] = Field(default=None, max_length=120)


class ProvisionAccountResponseSchema(BaseModel):
    id: str
    email: str
    role: Literal["faculty", "admin"]
    name: Optional[str] = None
    created_at: datetime


class AdminStudentDashboardSchema(StudentDashboardResponseSchema):
    """Same payload a student sees, returned for faculty and admin preview."""
