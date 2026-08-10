#!/usr/bin/env python3
"""
Build the printable guide from src/content/guide.json.

Same source as the in-app guide (src/app/shared/GuideScreen.tsx), so the PDF
and the app can never say different things.

    pip install reportlab
    python3 scripts/build-guide-pdf.py

Writes output/pdf/AntRep-Onboarding-Guide.pdf.
"""

import json
import pathlib

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Frame,
    Flowable,
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
from PIL import Image as PILImage

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src" / "content" / "guide.json"
SHOTS = ROOT / "public" / "guide"
OUT_DIR = ROOT / "output" / "pdf"
OUT = OUT_DIR / "AntRep-Onboarding-Guide.pdf"

INK = colors.HexColor("#16181D")
MUTED = colors.HexColor("#6B7280")
ACCENT = colors.HexColor("#5B7FC7")
LINE = colors.HexColor("#DDE1E8")
ZEBRA = colors.HexColor("#F5F7FA")
TIP_BG = colors.HexColor("#EFF3FB")

MARGIN = 20 * mm


def esc(text):
    """Escape for reportlab's mini-HTML."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


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
        "caption": ParagraphStyle(
            "Caption", parent=body, fontSize=7.5, leading=10.5,
            textColor=MUTED, spaceAfter=0, alignment=TA_LEFT,
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


VISUAL_HEIGHTS = {
    "portal-map": 48,
    "sign-in": 64,
    "athlete-plans": 57,
    "athlete-home": 72,
    "start-workout": 62,
    "set-logger": 61,
    "progress-overview": 70,
    "coach-invite": 58,
    "coach-assign": 65,
    "coach-athlete": 67,
    "athlete-tabs": 29,
    "coach-tabs": 29,
    "save-model": 38,
}


class NativeUiVisual(Flowable):
    """A small vector reconstruction of AntRep UI - never a raster capture."""

    def __init__(self, spec, width, st):
        super().__init__()
        self.spec = spec
        self.width = width
        self.st = st
        self.art_height = VISUAL_HEIGHTS.get(spec["id"], 48) * mm
        self.caption_height = 18

    def wrap(self, avail_width, _avail_height):
        self.width = min(self.width, avail_width)
        return self.width, self.art_height + self.caption_height

    def _text(self, c, x, y, text, size=8, bold=False, color=INK):
        c.setFillColor(color)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(x, y, text)

    def _pill(self, c, x, y, text, primary=False, width=None):
        width = width or max(38, 12 + len(text) * 4.6)
        c.setFillColor(ACCENT if primary else colors.white)
        c.setStrokeColor(ACCENT if primary else LINE)
        c.roundRect(x, y, width, 18, 9, fill=1, stroke=1)
        c.setFillColor(colors.white if primary else INK)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(x + width / 2, y + 6, text)

    def _marker(self, c, x, y, number):
        c.setFillColor(ACCENT)
        c.circle(x, y, 7, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 7)
        c.drawCentredString(x, y - 2.5, str(number))

    def _card(self, c, x, y, width, height, fill=colors.white):
        c.setFillColor(fill)
        c.setStrokeColor(LINE)
        c.roundRect(x, y, width, height, 9, fill=1, stroke=1)

    def _row(self, c, x, y, width, title, sub="", number=None, action=None):
        self._card(c, x, y, width, 34)
        text_x = x + 10
        if number:
            self._marker(c, x + 13, y + 17, number)
            text_x = x + 27
        self._text(c, text_x, y + 19, title, 8, True)
        if sub:
            self._text(c, text_x, y + 8, sub, 6.5, False, MUTED)
        if action:
            self._pill(c, x + width - 52, y + 8, action, True, 43)

    def _tabs(self, c, items, active, x, y, width):
        c.setFillColor(ZEBRA)
        c.roundRect(x, y, width, 23, 8, fill=1, stroke=0)
        cell = width / len(items)
        for i, item in enumerate(items):
            if item == active:
                c.setFillColor(colors.white)
                c.roundRect(x + i * cell + 2, y + 2, cell - 4, 19, 6, fill=1, stroke=0)
            self._text(c, x + i * cell + 5, y + 8, item, 6.2, item == active, INK if item == active else MUTED)

    def _draw_visual(self, c, visual_id, x, y, width, height):
        if visual_id == "portal-map":
            gap = 34
            card_w = (width - gap) / 2
            self._card(c, x, y + 12, card_w, height - 24)
            self._card(c, x + card_w + gap, y + 12, card_w, height - 24)
            self._text(c, x + 14, y + height - 35, "ATHLETE PORTAL", 10, True)
            self._text(c, x + 14, y + height - 51, "Train - log - review", 8, False, MUTED)
            self._text(c, x + card_w + gap + 14, y + height - 35, "COACH PORTAL", 10, True)
            self._text(c, x + card_w + gap + 14, y + height - 51, "Plan - follow - coach", 8, False, MUTED)
            self._text(c, x + card_w + 4, y + height / 2, "<->", 10, True, ACCENT)
            return
        if visual_id == "sign-in":
            card_w = min(width * 0.58, 230)
            left = x + (width - card_w) / 2
            self._card(c, left, y + 8, card_w, height - 16)
            self._text(c, left + 14, y + height - 31, "Welcome back", 11, True)
            self._row(c, left + 12, y + height - 73, card_w - 24, "you@example.com")
            self._row(c, left + 12, y + height - 112, card_w - 24, "password")
            self._pill(c, left + 12, y + 28, "Sign in", True, (card_w - 30) / 2)
            self._pill(c, left + 18 + (card_w - 30) / 2, y + 28, "Create account", False, (card_w - 30) / 2)
            self._text(c, left + card_w / 2 - 32, y + 12, "Explore the demo", 7, True, ACCENT)
            return
        if visual_id in ("athlete-tabs", "coach-tabs"):
            items = ["Home", "Plans", "Coach", "Progress", "Library", "Settings"] if visual_id == "athlete-tabs" else ["Athletes", "Plans", "Exercises", "My training", "Settings"]
            self._tabs(c, items, items[0], x, y + 8, width)
            return
        if visual_id == "athlete-plans":
            self._text(c, x, y + height - 15, "FROM YOUR COACH", 7, True, MUTED)
            self._row(c, x, y + height - 54, width, "Hypertrophy block A", "Coach Sam - 4 weeks", 1, "Sync")
            self._text(c, x, y + height - 70, "MY PLANS", 7, True, MUTED)
            self._row(c, x, y + 7, width, "Weekend plan", "2 days - 8 exercises", 2)
            return
        if visual_id == "athlete-home":
            self._row(c, x, y + height - 37, width, "Today", "Use arrows or tap the date", 1)
            self._card(c, x, y + 43, width, height - 86)
            self._text(c, x + 12, y + height - 62, "Push day", 10, True)
            self._text(c, x + 12, y + height - 75, "Monday - 6 exercises", 7, False, MUTED)
            self._pill(c, x + width - 66, y + height - 78, "Another day", False, 56)
            self._row(c, x + 10, y + 52, width - 20, "Push day", "1/6 exercises", 2, "Start")
            self._row(c, x, y + 3, width, "Extra work", "Anything outside the plan", 3, "Log")
            return
        if visual_id == "start-workout":
            card_w = min(width * 0.72, 280)
            left = x + (width - card_w) / 2
            self._card(c, left, y + 5, card_w, height - 10)
            self._text(c, left + 12, y + height - 24, "Start workout?", 10, True)
            self._row(c, left + 10, y + height - 66, card_w - 20, "Start workout", "Live timer", 1)
            self._row(c, left + 10, y + height - 105, card_w - 20, "Start another day", "Move planned work", 2)
            self._row(c, left + 10, y + 12, card_w - 20, "Just log", "No timer", 3)
            return
        if visual_id == "set-logger":
            self._card(c, x, y + 5, width, height - 10)
            self._text(c, x + 14, y + height - 28, "Flat bench press", 10, True)
            self._text(c, x + 14, y + height - 42, "3 x 10-12 - rest 90 sec", 7, False, MUTED)
            labels = ["SET", "KG", "REPS", "RPE"]
            values = ["1", "52.5", "10", "8"]
            col = (width - 28) / 4
            for i, label in enumerate(labels):
                self._text(c, x + 14 + i * col, y + height - 65, label, 6.5, True, MUTED)
                self._card(c, x + 10 + i * col, y + 38, col - 5, 27, ZEBRA)
                self._text(c, x + 20 + i * col, y + 48, values[i], 9, True)
            self._pill(c, x + width / 2 - 30, y + 12, "+ Add set", False, 60)
            return
        if visual_id == "progress-overview":
            self._pill(c, x, y + height - 22, "Overall", True, 48)
            self._pill(c, x + 54, y + height - 22, "Hypertrophy A", False, 70)
            self._marker(c, x + 136, y + height - 13, 1)
            self._tabs(c, ["Overview", "Plans", "Days", "Exercises"], "Overview", x, y + height - 51, width)
            stats = [("25", "day streak"), ("87k", "kg lifted"), ("32", "sessions")]
            stat_w = (width - 12) / 3
            for i, (value, label) in enumerate(stats):
                sx = x + i * (stat_w + 6)
                self._card(c, sx, y + height - 91, stat_w, 32)
                self._text(c, sx + 10, y + height - 73, value, 10, True)
                self._text(c, sx + 10, y + height - 84, label, 6.5, False, MUTED)
            self._card(c, x, y + 5, width, height - 103)
            heights = [18, 30, 24, 40, 34, 52, 21]
            bar_w = (width - 32) / len(heights)
            for i, bar_h in enumerate(heights):
                c.setFillColor(ACCENT)
                c.roundRect(x + 14 + i * bar_w, y + 23, bar_w - 5, bar_h, 2, fill=1, stroke=0)
            self._text(c, x + 14, y + 10, "Training volume - last 8 weeks", 6.5, True, MUTED)
            return
        if visual_id == "coach-invite":
            self._row(c, x, y + height - 42, width, "Invite an athlete", "Code expires in 28 minutes", 1)
            self._pill(c, x + width - 74, y + height - 34, "TRY-DMO", False, 62)
            self._text(c, x, y + height - 59, "2 LINKED", 7, True, MUTED)
            self._row(c, x, y + 5, width, "Alex Reps", "Trained today - 1/4 this week", 2)
            return
        if visual_id == "coach-assign":
            self._tabs(c, ["Overview", "Progress", "Assign", "Coaching"], "Assign", x, y + height - 25, width)
            self._text(c, x, y + height - 41, "ASSIGNED BY YOU", 7, True, MUTED)
            self._row(c, x, y + height - 80, width, "Strength foundation", "Waiting for athlete to sync", 1)
            self._text(c, x, y + height - 96, "SEND ANOTHER PLAN", 7, True, MUTED)
            self._row(c, x, y + 6, width, "Hypertrophy block A", "4 weeks - 24 exercises", 2, "Assign")
            return
        if visual_id == "coach-athlete":
            self._text(c, x, y + height - 22, "Alex Reps", 11, True)
            self._text(c, x, y + height - 35, "Level 6 - 25-day streak", 7, False, MUTED)
            self._tabs(c, ["Overview", "Progress", "Assign", "Coaching"], "Overview", x, y + height - 66, width)
            half = (width - 6) / 2
            self._card(c, x, y + 53, half, 36)
            self._text(c, x + 12, y + 72, "1 of 4", 10, True)
            self._text(c, x + 12, y + 60, "sessions this week", 6.5, False, MUTED)
            self._card(c, x + half + 6, y + 53, half, 36)
            self._text(c, x + half + 18, y + 72, "On track", 10, True)
            self._text(c, x + half + 18, y + 60, "No urgent flags", 6.5, False, MUTED)
            self._row(c, x, y + 7, width, "Latest: Push day", "6 exercises - 18 sets", 1)
            return
        if visual_id == "save-model":
            half = (width - 8) / 2
            self._row(c, x, y + 7, half, "Workout logging", "Saved while you type", 1)
            self._row(c, x + half + 8, y + 7, half, "Plans and settings", "Press Save before leaving", 2, "Save")

    def draw(self):
        c = self.canv
        c.saveState()
        c.setFillColor(colors.HexColor("#F7F8FA"))
        c.setStrokeColor(LINE)
        c.roundRect(0, self.caption_height, self.width, self.art_height, 11, fill=1, stroke=1)
        pad = 10
        self._draw_visual(c, self.spec["id"], pad, self.caption_height + pad, self.width - 2 * pad, self.art_height - 2 * pad)
        self._text(c, 3, 4, self.spec["caption"], 6.8, False, MUTED)
        c.restoreState()


def build_visual(spec, st, width):
    return NativeUiVisual(spec, width, st)


def build_screenshot(spec, st, width):
    """Frame a current demo screenshot with its shared guide caption."""
    source = SHOTS / f"{spec['name']}.png"
    if not source.exists():
        raise FileNotFoundError(f"Guide screenshot not found: {source}")

    with PILImage.open(source) as image:
        aspect = image.height / image.width

    draw_width = min(70 * mm if aspect > 1.4 else 150 * mm, width)
    screenshot = Image(str(source), width=draw_width, height=draw_width * aspect)
    screenshot.hAlign = "CENTER"
    caption = Paragraph(esc(spec["caption"]), st["caption"])
    frame = Table([[screenshot], [caption]], colWidths=[draw_width + 10], hAlign="CENTER")
    frame.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F7F8FA")),
                ("TOPPADDING", (0, 0), (0, 0), 5),
                ("BOTTOMPADDING", (0, 0), (0, 0), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 1), (0, 1), 6),
                ("BOTTOMPADDING", (0, 1), (0, 1), 6),
                ("LINEABOVE", (0, 1), (0, 1), 0.5, LINE),
            ]
        )
    )
    return frame, draw_width * aspect + 42


def build_tip(text, st, width):
    inner = Paragraph(f"<b>Tip:</b> {esc(text)}", st["tip"])
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

            for screenshot_spec in section.get("screenshots", []):
                screenshot, needed = build_screenshot(screenshot_spec, st, width)
                block.append(Spacer(1, 4))
                block.append(CondPageBreak(needed))
                block.append(screenshot)
                block.append(Spacer(1, 10))

            if section.get("tip"):
                block.append(build_tip(section["tip"], st, width))
                block.append(Spacer(1, 8))

            # Keep the heading with the first paragraph. Each screenshot gets
            # its own fit check above, so captions never split from the image.
            story.append(KeepTogether(block[:2]) if len(block) > 1 else block[0])
            story.extend(block[2:])

    doc.build(story)
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
