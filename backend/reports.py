from io import BytesIO
import re
from typing import List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

def clean_markdown_for_pdf(text: str) -> str:
    """Translate basic markdown formatting to ReportLab-friendly HTML tags."""
    if not text:
        return "No explanation provided."
    
    # Replace bold indicators
    text = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", text)
    # Replace headers
    text = re.sub(r"### (.*?)\n", r"<b>\1</b><br/>", text)
    text = re.sub(r"#### (.*?)\n", r"<i>\1</i><br/>", text)
    # Convert double newlines to breaks
    text = text.replace("\n\n", "<br/><br/>")
    text = text.replace("\n", "<br/>")
    
    # Basic sanitize to prevent XML parsing failures
    # Replace raw ampersands with entities, but avoid double encoding
    text = re.sub(r"&(?![a-zA-Z0-9#]+;)", "&amp;", text)
    
    return text

def build_pdf_report(url: str, risk: str, score: int, issues: List[str], ai_explanation: str) -> BytesIO:
    """Build a professional cybersecurity report PDF in memory."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        name="ReportTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=15,
        alignment=TA_LEFT
    )
    
    subtitle_style = ParagraphStyle(
        name="ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        textColor=colors.HexColor("#475569"),
        spaceAfter=25
    )
    
    heading_style = ParagraphStyle(
        name="SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=15,
        spaceAfter=8,
        borderPadding=(0, 0, 2, 0),
        borderColor=colors.HexColor("#cbd5e1"),
        borderWidth=0.5
    )
    
    body_style = ParagraphStyle(
        name="ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155")
    )
    
    issue_style = ParagraphStyle(
        name="ReportIssue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#b91c1c")
    )
    
    # Risk banner settings
    if risk == "LOW":
        banner_bg = colors.HexColor("#f0fdf4")
        banner_text = colors.HexColor("#166534")
    elif risk == "MEDIUM":
        banner_bg = colors.HexColor("#fff7ed")
        banner_text = colors.HexColor("#c2410c")
    elif risk == "HIGH":
        banner_bg = colors.HexColor("#fef2f2")
        banner_text = colors.HexColor("#991b1b")
    else:  # CRITICAL
        banner_bg = colors.HexColor("#fff1f2")
        banner_text = colors.HexColor("#9f1239")
        
    story = []
    
    # Header block
    story.append(Paragraph("Aegis Personal AI Cybersecurity Assistant", title_style))
    story.append(Paragraph(f"Web Security Vulnerability Assessment Report - Generated on {colors.HexColor('#0f172a')}", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Summary Table (URL, Score, Risk)
    data = [
        [
            Paragraph("<b>Target URL:</b>", body_style),
            Paragraph(f"<a href='{url}'>{url}</a>", body_style)
        ],
        [
            Paragraph("<b>Security Score:</b>", body_style),
            Paragraph(f"<b>{score} / 100</b>", body_style)
        ],
        [
            Paragraph("<b>Threat Classification:</b>", body_style),
            Paragraph(f"<font color='{banner_text.hexval()}'><b>{risk} RISK</b></font>", body_style)
        ]
    ]
    
    summary_table = Table(data, colWidths=[150, 380])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Detected Issues Section
    story.append(Paragraph("Detected Vulnerabilities & Warnings", heading_style))
    if not issues:
        story.append(Paragraph("No critical issues or warnings detected during scanning. The host configuration adheres to basic web safety metrics.", body_style))
    else:
        issue_data = []
        for i, issue in enumerate(issues, start=1):
            issue_data.append([
                Paragraph(f"<b>{i}.</b>", issue_style),
                Paragraph(issue, issue_style)
            ])
        
        issue_table = Table(issue_data, colWidths=[20, 510])
        issue_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('PADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(issue_table)
    story.append(Spacer(1, 20))
    
    # AI Threat Analysis & Remediations
    story.append(Paragraph("AI Security Analysis & Remediations", heading_style))
    formatted_ai = clean_markdown_for_pdf(ai_explanation)
    story.append(Paragraph(formatted_ai, body_style))
    
    # Footer disclaimer
    story.append(Spacer(1, 40))
    disclaimer_style = ParagraphStyle(
        name="ReportDisclaimer",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        textColor=colors.HexColor("#94a3b8"),
        alignment=TA_CENTER
    )
    story.append(Paragraph("Disclaimer: This report is generated using heuristic security rules and LLM models. It does not replace a comprehensive manual penetration test or formal code auditing.", disclaimer_style))
    
    doc.build(story)
    buffer.seek(0)
    return buffer
