"""Schemas for student academic dashboard and faculty/admin management APIs."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class SubjectResultSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    code: Optional[str] = Field(default=None, max_length=40)
    marks: float = Field(..., ge=0.0, le=100.0)
    grade: Optional[str] = Field(default=None, max_length=4)
    attendance: Optional[float] = Field(default=None, ge=0.0, le=100.0)


class SemesterResultSchema(BaseModel):
    semester: str = Field(..., min_length=1, max_length=20)
    sgpa: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    subjects: List[SubjectResultSchema] = Field(default_factory=list)


class SgpaTrendPointSchema(BaseModel):
    semester: str = Field(..., min_length=1, max_length=20)
    sgpa: float = Field(..., ge=0.0, le=10.0)


class SubjectPerformanceSchema(BaseModel):
    name: str
    average_marks: float = Field(..., ge=0.0, le=100.0)
    attempts: int = Field(..., ge=1)


class AttendanceSummarySchema(BaseModel):
    overall_percentage: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    below_threshold: bool = False
    threshold: float = Field(default=75.0, ge=0.0, le=100.0)


class StudentTaskSchema(BaseModel):
    title: str = Field(..., min_length=1, max_length=240)
    due_date: Optional[str] = Field(default=None, max_length=40)
    priority: Literal["low", "medium", "high"] = "medium"


class DashboardInsightSchema(BaseModel):
    type: Literal["risk", "improvement", "upcoming", "strength"]
    title: str
    description: str
    action: Optional[str] = None


class StudentProfileSummarySchema(BaseModel):
    id: str
    email: str
    role: Literal["student", "faculty", "admin"]
    name: Optional[str] = None
    college_id: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[str] = None


class AcademicResultsSummarySchema(BaseModel):
    latest_semester: Optional[str] = None
    latest_sgpa: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    cgpa: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    total_subjects: int = Field(default=0, ge=0)
    subjects: List[SubjectResultSchema] = Field(default_factory=list)


class PerformanceAnalyticsSchema(BaseModel):
    sgpa_trend: List[SgpaTrendPointSchema] = Field(default_factory=list)
    strong_subjects: List[SubjectPerformanceSchema] = Field(default_factory=list)
    weak_subjects: List[SubjectPerformanceSchema] = Field(default_factory=list)
    attendance_summary: AttendanceSummarySchema


class StudentDashboardEmptyStatesSchema(BaseModel):
    results: bool
    analytics: bool
    insights: bool


class StudentDashboardResponseSchema(BaseModel):
    profile: StudentProfileSummarySchema
    results_summary: AcademicResultsSummarySchema
    analytics: PerformanceAnalyticsSchema
    insights: List[DashboardInsightSchema] = Field(default_factory=list)
    pending_tasks: List[StudentTaskSchema] = Field(default_factory=list)
    empty_states: StudentDashboardEmptyStatesSchema


class UpsertAcademicRecordRequestSchema(BaseModel):
    semester_results: List[SemesterResultSchema] = Field(default_factory=list)
    sgpa_trend: List[SgpaTrendPointSchema] = Field(default_factory=list)
    cgpa: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    attendance_overall: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    pending_tasks: List[StudentTaskSchema] = Field(default_factory=list)


class StudentAcademicRecordSchema(BaseModel):
    student_id: str
    student_email: Optional[str] = None
    student_name: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[str] = None
    semester_results: List[SemesterResultSchema] = Field(default_factory=list)
    sgpa_trend: List[SgpaTrendPointSchema] = Field(default_factory=list)
    cgpa: Optional[float] = Field(default=None, ge=0.0, le=10.0)
    attendance_overall: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    pending_tasks: List[StudentTaskSchema] = Field(default_factory=list)
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class FacultyStudentSummarySchema(BaseModel):
    student_id: str
    student_email: Optional[str] = None
    student_name: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[str] = None
    cgpa: Optional[float] = None
    attendance_overall: Optional[float] = None
    updated_at: Optional[datetime] = None


class FacultyStudentListResponseSchema(BaseModel):
    count: int = Field(..., ge=0)
    students: List[FacultyStudentSummarySchema] = Field(default_factory=list)


class BulkUploadErrorSchema(BaseModel):
    row: int = Field(..., ge=1)
    message: str


class BulkUploadResponseSchema(BaseModel):
    processed_count: int = Field(..., ge=0)
    updated_records: int = Field(..., ge=0)
    errors: List[BulkUploadErrorSchema] = Field(default_factory=list)
