import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf(output_path: str):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        alignment=0,
        spaceAfter=6,
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b'),
        spaceAfter=14,
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Heading2'],
        fontSize=13,
        leading=17,
        textColor=colors.HexColor('#1e3a8a'),
        spaceBefore=14,
        spaceAfter=6,
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=8,
    )

    bold_clause = ParagraphStyle(
        'BoldClause',
        parent=body_style,
        textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold',
    )

    story = []

    # Title & Header
    story.append(Paragraph("CLOUD INFRASTRUCTURE SERVICE LEVEL AGREEMENT", title_style))
    story.append(Paragraph("Contract Reference: <b>SLA-2026-CLOUD-001</b> • Effective Cycle: 2026 Monthly Retainer • Base Fee: <b>$100.00 USD</b>", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563eb'), spaceAfter=14))

    # Parties
    parties_text = (
        "This Service Level Agreement (\"Agreement\") is entered into between <b>Acme Cloud Services LLC</b> (\"Provider\") "
        "and <b>FinTech Enterprises Inc.</b> (\"Customer\"). This document defines measurable performance commitments, "
        "remedies, and automated PayPal settlement execution rules."
    )
    story.append(Paragraph(parties_text, body_style))
    story.append(Spacer(1, 8))

    # Section 1
    story.append(Paragraph("1. Performance Commitments & Service Thresholds", h2_style))
    story.append(Paragraph(
        "<b>1.1 Availability Target:</b> Provider guarantees that the API Gateway services will maintain a Monthly Uptime Percentage of at least <b>99.9%</b> during each calendar billing cycle.",
        body_style
    ))
    story.append(Paragraph(
        "<b>1.2 Latency Benchmark:</b> 95th percentile (p95) API response latency shall not exceed <b>300 ms</b> as measured across all external client transactions.",
        body_style
    ))
    story.append(Paragraph(
        "<b>1.3 Monitoring Window:</b> Compliance is continuously measured through automated HTTP synthetic health checks sampled every 60 seconds against designated service endpoints.",
        body_style
    ))

    story.append(Spacer(1, 6))

    # Section 2 - Table of Credits
    story.append(Paragraph("2. Deterministic Service Credits & Payment Adjustment", h2_style))
    story.append(Paragraph(
        "In the event of an SLA breach, Customer is entitled to financial remedies applied directly against the initial $100.00 payment authorization hold:",
        body_style
    ))

    table_data = [
        ["Service Metric", "Contractual Target", "Observed Breach Threshold", "Service Credit Percentage", "Adjusted Credit Amount"],
        ["Monthly Uptime", ">= 99.9%", "< 99.9%", "25% of Base Fee", "$25.00 USD"],
        ["Response Latency", "<= 300 ms", "> 300 ms", "15% of Base Fee", "$15.00 USD"],
        ["Severe Outage", ">= 99.0%", "< 95.0%", "50% of Base Fee", "$50.00 USD"],
    ]

    t = Table(table_data, colWidths=[1.4 * inch, 1.3 * inch, 1.4 * inch, 1.4 * inch, 1.2 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#eff6ff')), # highlight 25% row
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    # Section 3
    story.append(Paragraph("3. Payment Authorization & Final PayPal Settlement", h2_style))
    story.append(Paragraph(
        "<b>3.1 Initial Authorization Hold:</b> Customer authorizes a <b>$100.00 USD</b> payment hold via PayPal (intent=AUTHORIZE) at the inception of the service cycle.",
        body_style
    ))
    story.append(Paragraph(
        "<b>3.2 Breach & Credit Deduction:</b> Upon verification of an uptime breach below 99.9%, the settlement rules engine calculates a <b>$25.00 USD</b> SLA credit.",
        body_style
    ))
    story.append(Paragraph(
        "<b>3.3 Final Capture Execution:</b> Following designated human review, PayPal captures exactly <b>$75.00 USD</b> with <code>final_capture: true</code>. The uncaptured <b>$25.00 USD</b> authorization balance is automatically released to the Customer.",
        body_style
    ))

    story.append(Spacer(1, 10))

    # Section 4 - Signatures
    story.append(Paragraph("4. Authorization & Signatures", h2_style))
    
    sig_data = [
        [
            Paragraph("<b>Provider Representative:</b><br/>Acme Cloud Infrastructure Team<br/>Date: January 1, 2026<br/>Status: Verified Digital Key", body_style),
            Paragraph("<b>Customer Representative:</b><br/>FinTech Procurement Officer<br/>Date: January 1, 2026<br/>Status: Approved via Webhook", body_style),
        ]
    ]
    sig_table = Table(sig_data, colWidths=[3.3 * inch, 3.3 * inch])
    sig_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#94a3b8')),
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(sig_table)

    doc.build(story)
    print(f"✅ Generated mock SLA PDF: {output_path}")

if __name__ == '__main__':
    generate_pdf('samples/pay_for_performance_demo_sla.pdf')
    generate_pdf('frontend/public/sample_sla_contract.pdf')
