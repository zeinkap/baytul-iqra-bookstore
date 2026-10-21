import QRCode from 'qrcode';
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';

export interface LabelInput {
  url: string;
  title: string;
}

const PT_PER_INCH = 72;

/** Standard PDF fonts only cover Latin-1: strip accents (Mawlānā -> Mawlana) and drop anything else. */
function toLatin(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  const cleaned = text
    .replace(/[‘’ʻʼʿ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return [...cleaned].filter((ch) => supported.has(ch.codePointAt(0)!)).join('').replace(/\s+/g, ' ').trim();
}

/** Greedy word wrap to at most `maxLines`, ending the last line with "..." if the title is cut. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number): string[] {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const attempt = line ? `${line} ${words[i]}` : words[i];
    if (font.widthOfTextAtSize(attempt, size) <= maxWidth) {
      line = attempt;
      continue;
    }
    if (line) lines.push(line);
    line = words[i];
    if (lines.length === maxLines - 1) {
      // Last allowed line: take everything left and trim it to fit
      line = words.slice(i).join(' ');
      break;
    }
  }
  if (line) lines.push(line);
  const last = lines.length - 1;
  if (last >= 0 && font.widthOfTextAtSize(lines[last], size) > maxWidth) {
    let t = lines[last];
    while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
    lines[last] = `${t.trimEnd()}...`;
  }
  return lines.slice(0, maxLines);
}

/**
 * One square label per PDF page (default 2 x 2 inch): black vector QR code, book title, "Scan to buy".
 * Pure black on white so thermal label printers print it crisply.
 */
export async function buildLabelsPdf(labels: LabelInput[], sizeInches = 2): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const size = sizeInches * PT_PER_INCH;
  const margin = size * 0.04;
  const quietModules = 4; // QR spec: keep a 4-moduleSize white border around the code

  for (const label of labels) {
    const page = pdf.addPage([size, size]);
    const qr = QRCode.create(label.url, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const qrArea = size * 0.74; // QR code plus its quiet zone
    const moduleSize = qrArea / (count + quietModules * 2);
    const qrLeft = (size - qrArea) / 2 + quietModules * moduleSize;
    const qrTop = size - margin - quietModules * moduleSize; // y of the top edge of the first moduleSize row

    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (!qr.modules.get(row, col)) continue;
        // Slight overlap (+0.15pt) avoids hairline gaps between modules in some PDF renderers
        page.drawRectangle({
          x: qrLeft + col * moduleSize,
          y: qrTop - (row + 1) * moduleSize,
          width: moduleSize + 0.15,
          height: moduleSize + 0.15,
          color: rgb(0, 0, 0),
        });
      }
    }

    const textWidth = size - margin * 2;
    const title = toLatin(label.title, bold) || 'Book';
    const lines = wrap(title, bold, size * 0.062, textWidth, 2);
    let y = size - margin - qrArea + size * 0.02;
    for (const line of lines) {
      const w = bold.widthOfTextAtSize(line, size * 0.062);
      y -= size * 0.07;
      page.drawText(line, { x: (size - w) / 2, y, size: size * 0.062, font: bold, color: rgb(0, 0, 0) });
    }
    const cta = 'Scan to buy';
    const ctaSize = size * 0.05;
    page.drawText(cta, {
      x: (size - regular.widthOfTextAtSize(cta, ctaSize)) / 2,
      y: margin * 0.9,
      size: ctaSize,
      font: regular,
      color: rgb(0, 0, 0),
    });
  }

  return pdf.save();
}
