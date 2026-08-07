#!/usr/bin/env python3
"""
Build the printable guide from src/content/guide.json.

Same source as the in-app guide (src/app/shared/GuideScreen.tsx), so the PDF
and the app can never say different things.

    pip install reportlab
    python3 scripts/build-guide-pdf.py

Writes docs/AntRep-Guide.pdf.
"""

import io
import json
import pathlib
import re

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Frame,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "content" / "guide.json"
SHOTS = ROOT / "public" / "guide"
OUT_DIR = ROOT / "docs"
OUT = OUT_DIR / "AntRep-Guide.pdf"

# Screenshots are captured at 2x for the app; the PDF only needs enough pixels
# to stay sharp in print, and downscaling keeps the file a sane size.
SHOT_MAX_PX = 900
PHONE_SHOT_MM = 80
WIDE_SHOT_MM = 150

INK = colors.HexColor("#16181D")
MUTED = colors.HexColor("#6B7280")
ACCENT = colors.HexColor("#5B7FC7")
LINE = colors.HexColor("#DDE1E8")
ZEBRA = colors.HexColor("#F5F7FA")
TIP_BG = colors.HexColor("#EFF3FB")

MARGIN = 20 * mm


def esc(text):
    """Escape for reportlab's mini-HTML, and keep quotes readable."""
    out = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return re.sub(r'"([^"]*)"', r"“\1”", out)


def styles():
    base = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body",
        parent=base["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=15.5,
        textColor=INK,
        spaceAfter=7,
        alignment=TA_LEFT,
    )
    return {
        "body": body,
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=body, fontName="Helvetica-Bold", fontSize=30,
            leading=34, spaceAfter=10,
        ),
        "cover_sub": ParagraphStyle(
            "CoverSub", parent=body, fontSize=12.5, leading=19, textColor=MUTED, spaceAfter=6,
        ),
        "part": ParagraphStyle(
            "Part", parent=body, fontName="Helvetica-Bold", fontSize=20,
            leading=25, spaceBefore=0, spaceAfter=3,
        ),
        "audience": ParagraphStyle(
            "Audience", parent=body, fontName="Helvetica-Bold", fontSize=8.5,
            leading=12, textColor=ACCENT, spaceAfter=8,
        ),
        "intro": ParagraphStyle(
            "Intro", parent=body, fontSize=11, leading=17, textColor=MUTED, spaceAfter=12,
        ),
        "section": ParagraphStyle(
            "Section", parent=body, fontName="Helvetica-Bold", fontSize=13,
            leading=17, spaceBefore=12, spaceAfter=5,
        ),
        "cell": ParagraphStyle("Cell", parent=body, fontSize=9, leading=13, spaceAfter=0),
        "cell_head": ParagraphStyle(
            "CellHead", parent=body, fontName="Helvetica-Bold", fontSize=8,
            leading=11, textColor=MUTED, spaceAfter=0,
        ),
        "cell_key": ParagraphStyle(
            "CellKey", parent=body, fontName="Helvetica-Bold", fontSize=9,
            leading=13, spaceAfter=0,
        ),
        "tip": ParagraphStyle(
            "Tip", parent=body, fontSize=9.5, leading=14, spaceAfter=0,
            leftIndent=8, rightIndent=8, spaceBefore=0,
        ),
        "toc": ParagraphStyle("Toc", parent=body, fontSize=11, leading=20, spaceAfter=0),
    }


def build_table(spec, st, width):
    head = [Paragraph(esc(c), st["cell_head"]) for c in spec["head"]]
    rows = [
        [
            Paragraph(esc(c), st["cell_key"] if i == 0 else st["cell"])
            for i, c in enumerate(row)
        ]
        for row in spec["rows"]
    ]

    cols = len(spec["head"])
    if cols == 2:
        widths = [width * 0.33, width * 0.67]
    elif cols == 3:
        widths = [width * 0.20, width * 0.22, width * 0.58]
    else:
        widths = [width / cols] * cols

    table = Table([head] + rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, 0), 0.7, LINE),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, LINE),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
    ]
    for i in range(1, len(rows) + 1):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    table.setStyle(TableStyle(style))
    return table


def build_shot(name, width):
    """One screenshot, scaled to fit and framed so it reads as a screen."""
    source = SHOTS / f"{name}.png"
    if not source.exists():
        print(f"  ! missing screenshot: {name}.png")
        return None

    with PILImage.open(source) as img:
        img = img.convert("RGB")
        if max(img.size) > SHOT_MAX_PX:
            ratio = SHOT_MAX_PX / max(img.size)
            img = img.resize(
                (round(img.width * ratio), round(img.height * ratio)), PILImage.LANCZOS
            )
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=82, optimize=True)
        buffer.seek(0)
        aspect = img.height / img.width

    # Phone-width captures stay phone-sized; the wide analytics ones get the
    # full column, or their tables would be unreadable.
    target = PHONE_SHOT_MM if aspect > 1.4 else WIDE_SHOT_MM
    draw_w = min(target * mm, width)
    flowable = Image(buffer, width=draw_w, height=draw_w * aspect)
    flowable.hAlign = "CENTER"

    frame = Table([[flowable]], hAlign="CENTER")
    frame.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFBFC")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return frame, draw_w * aspect + 16


def build_tip(text, st, width):
    inner = Paragraph(f"<b>Tip —</b> {esc(text)}", st["tip"])
    box = Table([[inner]], colWidths=[width], hAlign="LEFT")
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), TIP_BG),
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#C9D6EE")),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return box


def main():
    guide = json.loads(SOURCE.read_text(encoding="utf-8"))
    st = styles()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    width = A4[0] - 2 * MARGIN
    doc = BaseDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=18 * mm,
        title=guide["title"],
        author="AntRep",
        subject=guide["subtitle"],
    )

    frame = Frame(
        MARGIN, 18 * mm, width, A4[1] - MARGIN - 18 * mm, id="body",
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )

    def furniture(canvas, _doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        if canvas.getPageNumber() > 1:
            canvas.drawString(MARGIN, 11 * mm, guide["title"])
            canvas.drawRightString(A4[0] - MARGIN, 11 * mm, str(canvas.getPageNumber()))
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=furniture)])

    story = []

    # Cover
    story.append(Spacer(1, 55 * mm))
    story.append(Paragraph(esc(guide["title"]), st["cover_title"]))
    story.append(Paragraph(esc(guide["subtitle"]), st["cover_sub"]))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(esc(guide["edition"]), st["audience"]))
    story.append(Spacer(1, 14 * mm))

    story.append(Paragraph("What's inside", st["section"]))
    for part in guide["parts"]:
        story.append(
            Paragraph(
                f"<b>{esc(part['title'])}</b>  <font color='#6B7280'>{esc(part['audience'])}</font>",
                st["toc"],
            )
        )
    story.append(PageBreak())

    for index, part in enumerate(guide["parts"]):
        # Parts flow on rather than each forcing a fresh page — a forced break
        # leaves a near-empty page whenever a part runs a little over.
        if index > 0:
            story.append(CondPageBreak(70 * mm))
            story.append(Spacer(1, 8 * mm))
        story.append(Paragraph(esc(part["title"]), st["part"]))
        story.append(Paragraph(esc(part["audience"]).upper(), st["audience"]))
        story.append(Paragraph(esc(part["intro"]), st["intro"]))

        for section in part["sections"]:
            block = [Paragraph(esc(section["title"]), st["section"])]

            for line in section.get("body", []):
                block.append(Paragraph(esc(line), st["body"]))

            steps = section.get("steps", [])
            if steps:
                block.append(
                    ListFlowable(
                        [ListItem(Paragraph(esc(s), st["body"]), leftIndent=16) for s in steps],
                        bulletType="1",
                        bulletFontName="Helvetica-Bold",
                        bulletFontSize=10,
                        leftIndent=16,
                    )
                )
                block.append(Spacer(1, 6))

            if section.get("table"):
                block.append(build_table(section["table"], st, width))
                block.append(Spacer(1, 8))

            for line in section.get("body2", []):
                block.append(Paragraph(esc(line), st["body"]))

            for shot in section.get("shots", []):
                built = build_shot(shot, width)
                if built is not None:
                    flowable, needed = built
                    # Move the screenshot to the next page only when it truly
                    # won't fit, so its own text still fills the page it left.
                    block.append(Spacer(1, 4))
                    block.append(CondPageBreak(needed))
                    block.append(flowable)
                    block.append(Spacer(1, 10))

            if section.get("tip"):
                block.append(build_tip(section["tip"], st, width))
                block.append(Spacer(1, 8))

            # Keep a heading with at least the start of its content; the
            # CondPageBreak above handles the screenshots.
            story.append(KeepTogether(block[:2]) if len(block) > 1 else block[0])
            story.extend(block[2:])

    doc.build(story)
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
