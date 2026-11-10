import io
from pathlib import Path

import pytest
from reportlab.pdfgen import canvas

from pdf_text import PdfError, extract_pages

SAMPLES = Path(__file__).resolve().parent.parent / "samples"
if not SAMPLES.exists():
    SAMPLES = Path(__file__).resolve().parents[2] / "samples"


def test_keeps_each_clause_on_its_own_page():
    pages = extract_pages((SAMPLES / "tiered_sla.pdf").read_bytes())
    assert sorted(pages) == [1, 2, 3]
    assert "at least" in pages[1] and "95.0% to below 99.0% 25%" not in pages[1]
    assert "95.0% to below 99.0% 25%" in pages[2]
    assert "will not exceed 50%" in pages[3]


def test_rejects_a_file_that_is_not_a_pdf():
    with pytest.raises(PdfError, match="Could not read"):
        extract_pages(b"this is not a pdf")


def test_rejects_a_pdf_with_no_text():
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer)
    pdf.showPage()
    pdf.save()
    with pytest.raises(PdfError, match="No readable text"):
        extract_pages(buffer.getvalue())
