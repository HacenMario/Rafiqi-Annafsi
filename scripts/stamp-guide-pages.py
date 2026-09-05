#!/usr/bin/env python3
"""Stamp page numbers on rafiqi guide: skip cover (p1) and ending (last page).
Body pages get Arabic numerals 1..N centered at bottom. Then set metadata."""
import io
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

SRC = "/home/z/my-project/download/rafiqi-nafsi-guide/rafiqi-platform-guide.pdf"
reader = PdfReader(SRC)
writer = PdfWriter()
n = len(reader.pages)

for i, page in enumerate(reader.pages):
    if i == 0 or i == n - 1:
        writer.add_page(page)  # cover + ending: no number
        continue
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setFont("Helvetica", 9.5)
    c.setFillColorRGB(0.373, 0.447, 0.404)  # #5f7267 muted green
    c.drawCentredString(A4[0] / 2, 18, str(i))  # body numbering starts at 1
    c.save()
    buf.seek(0)
    overlay = PdfReader(buf).pages[0]
    page.merge_page(overlay)
    writer.add_page(page)

writer.add_metadata({
    "/Title": "منصة رفيقي النفسي — دليل تعريفي للمختصين والشركاء",
    "/Author": "فريق منصة رفيقي النفسي",
    "/Subject": "دليل ثنائي اللغة (عربي/فرنسي) يشرح مميزات منصة الدعم النفسي للمتضررين وفوائدها للمختصين",
    "/Creator": "Z.ai",
    "/Keywords": "رفيقي النفسي، دعم نفسي، الجزائر، صحة نفسية، Guide, soutien psychologique",
})

with open(SRC, "wb") as f:
    writer.write(f)
print(f"stamped {n - 2} body pages (2..{n - 1}) as 1..{n - 2}; metadata set")
