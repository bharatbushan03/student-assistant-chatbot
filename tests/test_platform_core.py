"""Unit tests for Nemotron response cleanup and admin student oversight."""

from app.services.llm import LLMClient, strip_model_reasoning
from app.services.student_oversight import (
    build_student_directory,
    classify_academic_status,
    filter_directory,
    summarize_directory,
)


def test_strip_closed_think_block():
    raw = "<think>checking the fee table</think>\nThe B.Tech fee is published on the admissions page."
    assert strip_model_reasoning(raw) == "The B.Tech fee is published on the admissions page."


def test_strip_unclosed_think_block():
    raw = "Answer first.<think>still reasoning"
    assert strip_model_reasoning(raw) == "Answer first."


def test_content_skips_reasoning_parts():
    content = [
        {"type": "reasoning", "text": "hidden chain"},
        {"type": "text", "text": "Visible answer"},
    ]
    assert LLMClient._content_to_text(content) == "Visible answer"


def test_query_embedding_uses_nvidia_api(monkeypatch):
    from app.config.settings import get_settings
    from app.services.embeddings import NvidiaEmbeddingClient, get_embedding_model

    created = {}

    class Row:
        def __init__(self, index, embedding):
            self.index = index
            self.embedding = embedding

    class FakeEmbeddings:
        def create(self, **kwargs):
            created.update(kwargs)
            return type("Response", (), {"data": [Row(0, [0.1, 0.2])]})()

    class FakeOpenAI:
        def __init__(self, **kwargs):
            created["init"] = kwargs
            self.embeddings = FakeEmbeddings()

    monkeypatch.setattr("app.services.embeddings.OpenAI", FakeOpenAI)
    get_settings.cache_clear()
    get_embedding_model.cache_clear()

    result = NvidiaEmbeddingClient().encode("What is the fee?")

    assert result.tolist() == [0.1, 0.2]
    assert created["model"] == "nvidia/nv-embedqa-e5-v5"
    assert created["extra_body"]["input_type"] == "query"
    assert "integrate.api.nvidia.com" in created["init"]["base_url"]
    get_embedding_model.cache_clear()
    get_settings.cache_clear()


def test_directory_marks_risk_and_missing_records():
    users = [
        {
            "_id": "1",
            "role": "student",
            "email": "2024a6r009@mietjammu.in",
            "name": "Asha",
            "college_id": "2024A6R009",
            "semester": "4",
            "section": "A",
        },
        {
            "_id": "2",
            "role": "student",
            "email": "2024a6r010@mietjammu.in",
            "name": "Rohit",
            "college_id": "2024A6R010",
            "semester": "4",
            "section": "A",
        },
    ]
    records = [
        {
            "student_id": "2024A6R009",
            "student_email": "2024a6r009@mietjammu.in",
            "cgpa": 5.4,
            "attendance_overall": 70,
            "sgpa_trend": [{"semester": "4", "sgpa": 5.4}],
        }
    ]

    rows = build_student_directory(users, records)
    by_id = {row["student_id"]: row for row in rows}

    assert by_id["2024A6R009"]["status"] == "at_risk"
    assert by_id["2024A6R010"]["status"] == "missing_record"
    assert classify_academic_status(
        has_record=True,
        cgpa=8.1,
        attendance=90,
        latest_sgpa_value=8.2,
    ) == "on_track"

    summary = summarize_directory(rows)
    assert summary["total_students"] == 2
    assert summary["at_risk_count"] == 1
    assert summary["missing_records"] == 1

    filtered = filter_directory(rows, query="asha", status="at_risk")
    assert len(filtered) == 1
    assert filtered[0]["name"] == "Asha"
