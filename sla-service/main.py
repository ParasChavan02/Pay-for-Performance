"""The HTTP API. Run: uvicorn main:app --reload --port 8000"""
from fastapi import FastAPI, HTTPException, UploadFile

from extract import LLMError, extract_sla
from pdf_text import PdfError
from schema import SLAResult

MAX_UPLOAD_BYTES = 10 * 1024 * 1024

app = FastAPI(title="Pay-for-Performance SLA Intelligence")


@app.get("/health")
def health() -> dict:
    return {"status": "healthy"}


# ponytail: no login, so anyone with the URL can use our Gemini quota; add a shared key once it's public.
@app.post("/sla/extract", response_model=SLAResult)
def extract(file: UploadFile) -> SLAResult:
    pdf_bytes = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(pdf_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "PDF is larger than 10 MB.")
    try:
        return extract_sla(pdf_bytes)
    except PdfError as err:
        raise HTTPException(422, str(err)) from err
    except LLMError as err:
        raise HTTPException(502, str(err)) from err
