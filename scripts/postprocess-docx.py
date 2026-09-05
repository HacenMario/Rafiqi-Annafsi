# -*- coding: utf-8 -*-
"""Post-process rafiqi-platform-guide.docx:
1. Patch footer PAGE field instrText -> PAGE \\* arabic \\* MERGEFORMAT (WPS compat)
2. Strip empty <w:pgNumType/> if emitted in document.xml
"""
import zipfile, shutil, re, sys

SRC = "/home/z/my-project/download/rafiqi-nafsi-guide/rafiqi-platform-guide.docx"
TMP = SRC + ".tmp"

zin = zipfile.ZipFile(SRC, "r")
zout = zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED)

patched_footer = 0
stripped_pgnum = 0

for item in zin.infolist():
    data = zin.read(item.filename)
    if item.filename.startswith("word/footer") and item.filename.endswith(".xml"):
        xml = data.decode("utf-8")
        new_xml, n = re.subn(
            r'(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)',
            r'\1 PAGE \\* arabic \\* MERGEFORMAT \2',
            xml,
        )
        if n:
            patched_footer += n
            data = new_xml.encode("utf-8")
    elif item.filename == "word/document.xml":
        xml = data.decode("utf-8")
        new_xml, n = re.subn(r'<w:pgNumType\s*/>', '', xml)
        if n:
            stripped_pgnum = n
            data = new_xml.encode("utf-8")
    zout.writestr(item, data)

zin.close()
zout.close()
shutil.move(TMP, SRC)
print(f"footer PAGE fields patched: {patched_footer}; empty pgNumType stripped: {stripped_pgnum}")
