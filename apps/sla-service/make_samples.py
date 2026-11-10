"""Generate the fake SLA PDFs in /samples. Run: python make_samples.py

All companies here are made up. Each page is a list of paragraphs or table rows.
"""
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

OUT = Path(__file__).resolve().parent.parent / "samples"

CLEAN = [
    [
        "# Acme Hosting - Service Level Agreement",
        "This agreement covers the Acme Web Hosting service provided by Acme Hosting. "
        "All measurements are taken per calendar month in the UTC timezone.",
        "## 1. Commitments",
        "Acme Hosting guarantees a Monthly Uptime Percentage of at least 99.9% for the Service.",
        "The 95th percentile response time of the Service will not exceed 300 milliseconds in any calendar month.",
    ],
    [
        "## 2. Service Credits",
        "If the Monthly Uptime Percentage falls below 99.9%, Customer receives a service credit of 10% of the monthly fee.",
        "Total credits in any calendar month will not exceed 30% of the monthly fee.",
        "## 3. Exclusions",
        "Scheduled maintenance of up to 4 hours per month is excluded from downtime.",
    ],
]

# The demo contract: 97% uptime falls in the 25% tier, so $100 becomes a $75 capture.
TIERED = [
    [
        "# Nimbus API Cloud - Service Level Agreement",
        "This agreement covers the Nimbus Payments API plan provided by Nimbus API Cloud. "
        "Performance is measured per calendar month in the UTC timezone.",
        "## 1. Uptime Commitment",
        "Nimbus API Cloud guarantees that the Service will have a Monthly Uptime Percentage of at least 99.9%.",
    ],
    [
        "## 2. Latency Commitment",
        "The p95 latency of API requests will not exceed 500 milliseconds in any calendar month.",
        "## 3. Service Credit Tiers",
        "Service credits are a percentage of the monthly fee. Only the single highest applicable tier applies.",
        [
            ["Monthly Uptime Percentage", "Service Credit"],
            ["99.0% to below 99.9%", "10%"],
            ["95.0% to below 99.0%", "25%"],
            ["Below 95.0%", "50%"],
        ],
    ],
    [
        "## 4. Credit Cap",
        "Total service credits for a calendar month will not exceed 50% of the monthly fee.",
        "## 5. Exclusions",
        "Scheduled maintenance of up to 2 hours per month is excluded from downtime.",
    ],
]

# Deliberately bad: vague wording, a contradiction, no cap and open-ended exclusions.
TRICKY = [
    [
        "# Cirrus Data Services - Service Level Agreement",
        "This agreement covers the Cirrus Storage service provided by Cirrus Data Services.",
        "## 1. Availability",
        "Provider will use commercially reasonable efforts to maintain high availability, "
        "and targets uptime of 99.5% in a typical month.",
        "Latency will generally be low under normal operating conditions.",
    ],
    [
        "## 2. Guarantee",
        "Provider guarantees 99.9% uptime for each calendar month.",
        "## 3. Service Credits",
        "Customers experiencing significant downtime may be eligible for an appropriate "
        "service credit at Provider's sole discretion.",
        "If uptime falls below 98%, a credit of up to 15% may apply.",
    ],
    [
        "## 4. Exclusions",
        "Scheduled maintenance of up to 8 hours per month is excluded from downtime.",
        "Force majeure events and network issues outside Provider's reasonable control are also excluded.",
        "Emergency maintenance, as determined by Provider, is excluded from downtime.",
    ],
]


def build(path: Path, pages: list[list]) -> None:
    styles = getSampleStyleSheet()
    story = []
    for index, page in enumerate(pages):
        if index:
            story.append(PageBreak())
        for block in page:
            if isinstance(block, list):
                table = Table(block, colWidths=[260, 120])
                table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey)]))
                story.append(table)
            elif block.startswith("# "):
                story.append(Paragraph(block[2:], styles["Title"]))
            elif block.startswith("## "):
                story.append(Paragraph(block[3:], styles["Heading2"]))
            else:
                story.append(Paragraph(block, styles["BodyText"]))
            story.append(Spacer(1, 8))
    SimpleDocTemplate(str(path), pagesize=letter).build(story)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    build(OUT / "clean_sla.pdf", CLEAN)
    build(OUT / "tiered_sla.pdf", TIERED)
    build(OUT / "tricky_sla.pdf", TRICKY)
    print(f"Wrote 3 PDFs to {OUT}")
