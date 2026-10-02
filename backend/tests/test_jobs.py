import gemini
import skill_gap

JOB_TEXT = """Senior Backend Engineer - Payments
We are looking for an engineer to build reliable payment services.
Requirements: Python, Go, Kubernetes, Redis. GraphQL is a plus.
You will own services end to end and mentor others."""


def _minimal_pdf(text: str) -> bytes:
    """A one-page PDF with a line of text, with a correct xref table."""
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return bytes(out)


def _create_job(client, account, **form):
    return client.post("/job-descriptions", data={"text": JOB_TEXT, **form}, headers=account.headers)


def test_create_list_get_and_delete_job(client, account):
    created = _create_job(client, account, company="Acme")
    assert created.status_code == 201
    job = created.json()
    assert job["title"] == "Senior Backend Engineer - Payments"
    assert job["company"] == "Acme"

    listed = client.get("/job-descriptions", headers=account.headers).json()
    assert [j["id"] for j in listed] == [job["id"]]
    assert client.get(f"/job-descriptions/{job['id']}", headers=account.headers).json()["content"] == JOB_TEXT

    assert client.delete(f"/job-descriptions/{job['id']}", headers=account.headers).status_code == 200
    assert client.get(f"/job-descriptions/{job['id']}", headers=account.headers).status_code == 404


def test_job_from_pdf_upload(client, account):
    pdf = _minimal_pdf("Platform Engineer. Must know Terraform, AWS, Kubernetes and Python for automation work.")
    response = client.post(
        "/job-descriptions",
        data={"title": "Platform Engineer"},
        files={"file": ("job.pdf", pdf, "application/pdf")},
        headers=account.headers,
    )
    assert response.status_code == 201, response.text
    assert response.json()["filename"] == "job.pdf"
    assert "Terraform" in response.json()["content"]


def test_job_validation(client, account):
    assert _create_job(client, account, text="too short").status_code == 400
    not_pdf = client.post(
        "/job-descriptions", files={"file": ("job.txt", b"hello", "text/plain")}, headers=account.headers
    )
    assert not_pdf.status_code == 400


def test_jobs_are_private(client, account_factory):
    owner, stranger = account_factory(), account_factory()
    job_id = _create_job(client, owner).json()["id"]
    assert client.get(f"/job-descriptions/{job_id}", headers=stranger.headers).status_code == 404
    assert client.get("/job-descriptions", headers=stranger.headers).json() == []


def test_gap_analysis_scores_and_caches(client, account, fake_llm):
    job_id = _create_job(client, account).json()["id"]
    body = {"resume_id": account.resume_id, "job_description_id": job_id}

    first = client.post("/gap-analyses", json=body, headers=account.headers)
    assert first.status_code == 200
    result = first.json()
    # must-haves weigh 2, partial earns half: (2 + 1 + 0 + 0 + 1) / (2+2+2+1+1) = 50%
    assert result["match_score"] == 50.0
    assert result["matched"] == ["Python", "Redis"]
    assert result["partial"] == ["Kubernetes"]
    assert result["missing"] == ["Go", "GraphQL"]
    assert result["must_have_coverage"] == {"met": 1, "total": 3}
    assert "Deployed services on Kubernetes" in fake_llm.prompts("gap_analysis")[0]

    again = client.post("/gap-analyses", json=body, headers=account.headers)
    assert again.json()["id"] == result["id"]
    assert fake_llm.count("gap_analysis") == 1

    client.post("/gap-analyses", json={**body, "refresh": True}, headers=account.headers)
    assert fake_llm.count("gap_analysis") == 2

    fetched = client.get("/gap-analyses", params=body, headers=account.headers)
    assert fetched.json()["match_score"] == 50.0


def test_gap_analysis_requires_ownership_and_existing_result(client, account_factory, fake_llm):
    owner, stranger = account_factory(), account_factory()
    job_id = _create_job(client, owner).json()["id"]
    body = {"resume_id": owner.resume_id, "job_description_id": job_id}

    assert client.get("/gap-analyses", params=body, headers=owner.headers).status_code == 404
    assert client.post("/gap-analyses", json=body, headers=stranger.headers).status_code == 404


def test_gap_analysis_surfaces_ai_failures_as_502(client, account, fake_llm):
    def broken(prompt):
        raise gemini.AIServiceError()

    fake_llm.handlers["gap_analysis"] = broken
    job_id = _create_job(client, account).json()["id"]
    response = client.post(
        "/gap-analyses", json={"resume_id": account.resume_id, "job_description_id": job_id}, headers=account.headers
    )
    assert response.status_code == 502
    assert response.json()["correlation_id"] == response.headers["X-Correlation-ID"]


def test_score_requirements_edge_cases():
    assert skill_gap.score_requirements([]) == 0.0
    assert skill_gap._normalize("Nice to have", ("must_have", "nice_to_have"), "x") == "nice_to_have"
    assert skill_gap._normalize("unknown", ("strong", "partial", "missing"), "missing") == "missing"
