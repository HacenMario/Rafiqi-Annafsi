# -*- coding: utf-8 -*-
"""Extract structured text content from rafiqi-platform-guide.html for Word conversion."""
import re, html as htmllib

SRC = "/home/z/my-project/download/rafiqi-nafsi-guide/rafiqi-platform-guide.html"
with open(SRC, encoding="utf-8") as f:
    raw = f.read()

# Body only (after </style>)
body = raw.split("</style>", 1)[1]
body = body.split("</body>")[0]

# Drop script/svg internals
body = re.sub(r"<svg[\s\S]*?</svg>", "", body)

# Mark structural elements before stripping
body = re.sub(r'<div class="chapter-header[^"]*"[^>]*>', "\n\n===CHAPTER-HEADER===\n", body)
body = re.sub(r'<h1[^>]*class="[^"]*page-start[^"]*"[^>]*>', "\n\n===H1-PAGESTART=== ", body)
body = re.sub(r"<h1[^>]*>", "\n\n===H1=== ", body)
body = re.sub(r"<h2[^>]*>", "\n\n===H2=== ", body)
body = re.sub(r"<h3[^>]*>", "\n\n===H3=== ", body)
body = re.sub(r'<p class="qa-q"[^>]*>', "\n\n===QAQ=== ", body)
body = re.sub(r'<p class="qa-a"[^>]*>', "\n\n===QAA=== ", body)
body = re.sub(r'<p class="benefit"[^>]*>', "\n\n===BENEFIT=== ", body)
body = re.sub(r'<div class="pledge">', "\n\n===PLEDGE-BOX===\n", body)
body = re.sub(r'<div class="pledge-title">', "\n===PLEDGE-TITLE=== ", body)
body = re.sub(r'<div class="type-card"[^>]*>', "\n\n===TYPE-CARD===\n", body)
body = re.sub(r'<div class="feat-title">', "\n[FEAT-TITLE] ", body)
body = re.sub(r'<span class="feat-fr">', "\n[FEAT-FR] ", body)
body = re.sub(r'<div class="feat-how">', "\n[FEAT-HOW] ", body)
body = re.sub(r'<div class="step-card"[^>]*>', "\n\n===STEP-CARD===\n", body)
body = re.sub(r'<div class="chip">', "\n[CHIP] ", body)
body = re.sub(r"<tr>", "\n[TR] ", body)
body = re.sub(r"<t[dh][^>]*>", " | ", body)
body = re.sub(r"<br\s*/?>", "\n", body)
body = re.sub(r"</p>", "\n", body)
body = re.sub(r"</div>", "\n", body)
body = re.sub(r"<li>", "\n- ", body)

# Strip remaining tags
text = re.sub(r"<[^>]+>", "", body)
text = htmllib.unescape(text)

# Collapse whitespace
text = re.sub(r"[ \t]+", " ", text)
text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
lines = [ln.strip() for ln in text.split("\n")]
out = "\n".join(ln for ln in lines if ln)

with open("/home/z/my-project/scripts/guide-content.txt", "w", encoding="utf-8") as f:
    f.write(out)
print("chars:", len(out))
print(out[:1500])
