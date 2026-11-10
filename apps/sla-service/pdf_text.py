"""Turn PDF bytes into text, one entry per page, so every quote can be traced to its page."""
import io

import pdfplumber

MAX_PAGES = 50  # Keeps one upload from using up the free LLM quota.
MIN_TEXT_CHARS = 20  # Less than this across the whole file means a scanned or empty PDF.


class PdfError(ValueError):
    """The upload can't be used. The message is safe to show to the user."""


def extract_pages(pdf_bytes: bytes) -> dict[int, str]:
    """Return {page_number: text}, with page numbers starting at 1 like a PDF viewer."""
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            if len(pdf.pages) > MAX_PAGES:
                raise PdfError(f"PDF has {len(pdf.pages)} pages; the limit is {MAX_PAGES}.")
            pages = {i: page.extract_text() or "" for i, page in enumerate(pdf.pages, 1)}
    except PdfError:
        raise
    except Exception as err:  # pdfplumber raises many types for broken or encrypted files.
        raise PdfError("Could not read this file as a PDF.") from err

    if sum(len(text.strip()) for text in pages.values()) < MIN_TEXT_CHARS:
        # ponytail: no OCR, so scanned PDFs are rejected; add OCR if real uploads need it.
        raise PdfError("No readable text found. This may be a scanned PDF.")
    return pages
