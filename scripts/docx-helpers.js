// docx-helpers.js — RTL Arabic docx builders (per docx skill design-system.md)
const {
  Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType, TableLayoutType,
} = require("docx");

// ---------- FG-1 Forest Mint palette (design-system.md) ----------
const PAL = {
  bg: "0C1F1A", accent: "3DDBB5",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "2A7A65", headerText: "FFFFFF", accentLine: "2A7A65", innerLine: "C5D8D0", surface: "EDF5F2" },
  h1: "1A3C2A", h2: "2D6B4A", body: "000000", fr: "595959", muted: "808080", kick: "6B7C72",
};

const AR_FONT = { ascii: "Arial", hAnsi: "Arial", cs: "Arial", eastAsia: "Arial" };

// ---------- borders ----------
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ---------- design-system title layout helpers ----------
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."\u060C\u061B\u061F. \t-_\u2014\u2013\u00B7/"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  // Arabic chars are narrower than CJK: use pt*12 twips per char (empirical for Arial Arabic)
  const charWidth = (pt) => pt * 12;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (13 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (12 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ---------- run builders ----------
function arRun(text, o = {}) {
  const size = o.size || 24;
  return new TextRun({
    text, rightToLeft: true, font: AR_FONT,
    size, sizeComplexScript: o.szCs || size,
    bold: o.bold || false,
    color: o.color || PAL.body,
  });
}
function frRun(text, o = {}) {
  const size = o.size || 21;
  return new TextRun({ text, font: AR_FONT, size, bold: o.bold || false, color: o.color || PAL.fr });
}

// ---------- paragraph builders ----------
function arPara(runs, o = {}) {
  return new Paragraph({
    bidirectional: true,
    ...(o.heading ? { heading: o.heading } : {}),
    ...(o.align ? { alignment: o.align } : {}),
    ...(o.indent ? { indent: o.indent } : {}),
    ...(o.shading ? { shading: o.shading } : {}),
    ...(o.border ? { border: o.border } : {}),
    ...(o.numbering ? { numbering: o.numbering } : {}),
    ...(o.keepNext ? { keepNext: true } : {}),
    spacing: { line: 312, before: o.before || 0, after: o.after === undefined ? 120 : o.after, ...(o.lineRule ? { lineRule: o.lineRule, line: o.line || 312 } : {}) },
    children: runs,
  });
}
function frPara(text, o = {}) {
  return new Paragraph({
    alignment: o.align || AlignmentType.LEFT,
    ...(o.indent ? { indent: o.indent } : {}),
    ...(o.border ? { border: o.border } : {}),
    ...(o.keepNext ? { keepNext: true } : {}),
    spacing: { line: 312, before: o.before || 0, after: o.after === undefined ? 120 : o.after },
    children: [frRun(text, o)],
  });
}

// ---------- structural builders ----------
function kicker(text, o = {}) {
  return arPara([arRun(text, { bold: true, size: 20, color: PAL.kick })], {
    after: 60, keepNext: true, ...(o.center ? { align: AlignmentType.CENTER } : {}),
  });
}
function h1(text) {
  return arPara([arRun(text, { bold: true, size: 32, color: PAL.h1 })], {
    heading: HeadingLevel.HEADING_1, after: 100, keepNext: true,
    line: 380, lineRule: "atLeast",
  });
}
function h2(text) {
  return arPara([arRun(text, { bold: true, size: 28, color: PAL.h2 })], {
    heading: HeadingLevel.HEADING_2, before: 260, after: 120, keepNext: true,
    line: 340, lineRule: "atLeast",
  });
}
function frTitle(text) {
  // French chapter subtitle with light divider under the whole header block
  return frPara(text, {
    after: 260, keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.innerLine, space: 10 } },
  });
}

// "ماذا يعني لك هذا؟" benefit callout — shaded paragraph with start-side (right) accent bar
function benefitBox(restText) {
  return arPara(
    [arRun("ماذا يعني لك هذا؟ ", { bold: true, color: PAL.h2 }), arRun(restText)],
    {
      before: 60, after: 160,
      shading: { type: ShadingType.CLEAR, fill: PAL.table.surface },
      border: { right: { style: BorderStyle.SINGLE, size: 12, color: PAL.table.accentLine, space: 6 } },
    }
  );
}

// Pledge box — single-cell shaded table
function pledgeBox(titleAr, bodyAr, bodyFr) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "C9DCCF" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "C9DCCF" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "C9DCCF" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "C9DCCF" },
      insideHorizontal: NB, insideVertical: NB,
    },
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: "E6F0E9" },
        margins: { top: 160, bottom: 160, left: 220, right: 220 },
        width: { size: 100, type: WidthType.PERCENTAGE },
        children: [
          arPara([arRun(titleAr, { bold: true, size: 26, color: PAL.h1 })], { after: 100 }),
          arPara([arRun(bodyAr)], { align: AlignmentType.JUSTIFIED, after: 100 }),
          frPara(bodyFr, { after: 20 }),
        ],
      })],
    })],
  });
}

// ---------- zebra table (FG-1 tokens) ----------
function zebraCell(paras, widthPct, fill) {
  return new TableCell({
    children: paras,
    shading: { type: ShadingType.CLEAR, fill },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    width: { size: widthPct, type: WidthType.PERCENTAGE },
  });
}
function zebraTable({ headers, rows, widths }) {
  const T = PAL.table;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: T.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: T.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: T.innerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((paras, i) => zebraCell(paras, widths[i], T.headerBg)),
      }),
      ...rows.map((r, ri) => new TableRow({
        cantSplit: true,
        children: r.map((paras, i) => zebraCell(paras, widths[i], ri % 2 === 0 ? T.surface : "FFFFFF")),
      })),
    ],
  });
}
function headerCellAr(text) {
  return [arPara([arRun(text, { bold: true, color: PAL.table.headerText, size: 22 })], { align: AlignmentType.CENTER, after: 0 })];
}

module.exports = {
  PAL, AR_FONT, NB, noBorders, allNoBorders,
  splitTitleLines, calcTitleLayout, calcCoverSpacing,
  arRun, frRun, arPara, frPara,
  kicker, h1, h2, frTitle, benefitBox, pledgeBox, zebraTable, headerCellAr,
};
