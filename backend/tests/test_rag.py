import models
import rag
from database import SessionLocal

from conftest import SAMPLE_RESUME


def test_sections_are_detected_and_header_becomes_profile():
    names = [name for name, _ in rag.split_sections(SAMPLE_RESUME)]
    assert names == ["Profile", "Summary", "Experience", "Projects", "Skills", "Education"]


def test_heading_detection_ignores_body_lines():
    assert rag._heading("TECHNICAL SKILLS") == "Technical Skills"
    assert rag._heading("Work experience:") == "Work Experience"
    assert rag._heading("Deployed services on Kubernetes with Helm and GitHub Actions.") is None
    assert rag._heading("Experience (2019 - 2023)") is None
    assert rag._heading("jane@example.com | github.com/jane") is None


def test_long_sections_are_split_with_overlap_and_size_limit():
    lines = [f"Line {i}: shipped feature number {i} with tests, metrics and a rollout plan." for i in range(40)]
    chunks = rag.chunk_resume("EXPERIENCE\n" + "\n".join(lines), max_chars=400, overlap=120)

    assert len(chunks) > 3
    assert all(c.section == "Experience" for c in chunks)
    assert all(len(c.content) <= 400 for c in chunks)
    for first, second in zip(chunks, chunks[1:]):
        assert first.content.splitlines()[-1] == second.content.splitlines()[0]


def test_overlong_single_line_is_broken_up():
    sentence = "Designed and operated a multi-region event pipeline with exactly-once delivery. "
    chunks = rag.chunk_resume("PROJECTS\n" + sentence * 40, max_chars=300, overlap=0)
    assert len(chunks) > 5
    assert all(len(c.content) <= 300 for c in chunks)


def test_empty_text_gives_no_chunks():
    assert rag.chunk_resume("") == []


def test_index_and_vector_search(client, account, fake_embeddings):
    indexed = client.post(f"/resumes/{account.resume_id}/index", headers=account.headers)
    assert indexed.status_code == 200
    assert indexed.json() == {"chunks": 6, "embedded": True}

    search = client.get(f"/resumes/{account.resume_id}/search", params={"q": "Kubernetes Helm deployment"}, headers=account.headers)
    body = search.json()
    assert body["method"] == "vector"
    assert "Kubernetes" in body["results"][0]["content"]
    assert ("RETRIEVAL_QUERY", 1) in fake_embeddings


def test_keyword_fallback_without_embeddings(client, account, no_embeddings):
    indexed = client.post(f"/resumes/{account.resume_id}/index", headers=account.headers)
    assert indexed.json() == {"chunks": 6, "embedded": False}

    search = client.get(f"/resumes/{account.resume_id}/search", params={"q": "Redis caching latency"}, headers=account.headers)
    body = search.json()
    assert body["method"] == "keyword"
    assert "Redis caching" in body["results"][0]["content"]


def test_ensure_indexed_retries_missing_embeddings(account, monkeypatch, fake_embeddings):
    db = SessionLocal()
    try:
        resume = db.get(models.Resume, account.resume_id)
        db.add(models.ResumeChunk(resume_id=resume.id, chunk_index=0, section="Profile", content="stale", embedding=None))
        db.commit()

        assert rag.ensure_indexed(db, resume) == {"chunks": 6, "embedded": True}
        # Already complete: no new embedding calls.
        before = len(fake_embeddings)
        assert rag.ensure_indexed(db, resume) == {"chunks": 6, "embedded": True}
        assert len(fake_embeddings) == before
    finally:
        db.close()


def test_resume_search_is_scoped_to_owner(client, account_factory, fake_embeddings):
    owner, stranger = account_factory(), account_factory()
    response = client.get(f"/resumes/{owner.resume_id}/search", params={"q": "python"}, headers=stranger.headers)
    assert response.status_code == 404


def test_deleting_a_resume_removes_its_chunks(client, account, fake_embeddings):
    client.post(f"/resumes/{account.resume_id}/index", headers=account.headers)
    assert client.delete(f"/resumes/{account.resume_id}", headers=account.headers).status_code == 200

    db = SessionLocal()
    try:
        assert db.query(models.ResumeChunk).filter(models.ResumeChunk.resume_id == account.resume_id).count() == 0
    finally:
        db.close()
