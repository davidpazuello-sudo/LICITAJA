from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from slugify import slugify

from app.services.ia_service import PropostaComercialPayload


def build_proposta_comercial_filename(orgao: str, numero_controle: str) -> str:
    base = slugify(f"proposta_{orgao}_{numero_controle}", separator="_")
    return f"{base or 'proposta_comercial'}.pdf"


def build_proposta_comercial_pdf(
    *,
    orgao: str,
    numero_controle: str,
    numero_processo: str | None,
    modalidade: str | None,
    proposta: PropostaComercialPayload,
) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="LicitaHeading",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#0F1724"),
            alignment=TA_LEFT,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="LicitaBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            textColor=colors.HexColor("#334155"),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="LicitaSection",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.HexColor("#2563EB"),
            spaceBefore=8,
            spaceAfter=6,
        )
    )

    story = []

    header = Table(
        [[
            Paragraph("<b>LicitaAI</b><br/><font size='9' color='#64748B'>Assistente de oportunidade</font>", styles["LicitaBody"]),
            Paragraph("<b>PROPOSTA COMERCIAL</b>", styles["LicitaHeading"]),
        ]],
        colWidths=[70 * mm, 100 * mm],
    )
    header.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#1E3A8A")),
                ("TEXTCOLOR", (0, 0), (0, 0), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#D7E3FF")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 8))

    metadata = Table(
        [
            ["Orgao", orgao],
            ["Numero de controle", numero_controle],
            ["Numero do processo", numero_processo or "Nao informado"],
            ["Modalidade", modalidade or "Nao informada"],
        ],
        colWidths=[42 * mm, 128 * mm],
    )
    metadata.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EEF4FF")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0F1724")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#D7E3FF")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(metadata)
    story.append(Spacer(1, 12))

    story.append(Paragraph(proposta.titulo, styles["LicitaHeading"]))
    for label, value in [
        ("Destinatario", proposta.destinatario),
        ("Abertura", proposta.abertura),
        ("Escopo", proposta.escopo),
        ("Aderencia tecnica", proposta.aderencia_tecnica),
        ("Documentacao tecnica", proposta.documentacao_tecnica),
        ("Observacoes", proposta.observacoes),
        ("Fechamento", proposta.fechamento),
    ]:
        story.append(Paragraph(label, styles["LicitaSection"]))
        story.append(Paragraph(_normalize_pdf_text(value), styles["LicitaBody"]))

    if proposta.itens_destaque:
        story.append(Paragraph("Itens de destaque", styles["LicitaSection"]))
        for item in proposta.itens_destaque:
            story.append(Paragraph(f"• {_normalize_pdf_text(item)}", styles["LicitaBody"]))

    doc.build(story)
    return buffer.getvalue()


def _normalize_pdf_text(value: str | None) -> str:
    return (value or "Nao informado").replace("\n", "<br/>")
