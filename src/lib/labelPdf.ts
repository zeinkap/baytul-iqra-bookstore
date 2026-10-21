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

const PT_PER_MM = 72 / 25.4;

export interface LabelPdfOptions {
  /**
   * Blank space above the QR code's own quiet zone, in millimetres (default 5). Label printers often feed a
   * little off and apps may crop the page's edge, so raise this if the top of your printed label looks cut off.
   */
  topPaddingMm?: number;
}

/** Greedy word wrap with no line limit. */
function wrapAll(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ').filter(Boolean)) {
    const attempt = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(attempt, size) <= maxWidth || !line) line = attempt;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Picks the largest title size that fits on at most two lines (none wider than the label). Long titles shrink a
 * little first; a title still too long at the smallest size is cut after two lines and ends in "...".
 */
function fitTitle(text: string, font: PDFFont, maxSize: number, minSize: number, maxWidth: number, maxHeight: number) {
  const lineHeight = 1.05;
  for (let size = maxSize; size >= minSize - 0.001; size -= 0.2) {
    const lines = wrapAll(text, font, size, maxWidth);
    const fitsWidth = lines.every((l) => font.widthOfTextAtSize(l, size) <= maxWidth);
    if (lines.length <= 2 && fitsWidth && lines.length * size * lineHeight <= maxHeight) return { size, lines, lineHeight };
  }
  return { size: minSize, lines: wrap(text, font, minSize, maxWidth, 2), lineHeight };
}

/**
 * One square label per PDF page (default 2 x 2 inch): black vector QR code, book title, "Scan to buy".
 * Pure black on white so thermal label printers print it crisply.
 */
export async function buildLabelsPdf(labels: LabelInput[], sizeInches = 2, options: LabelPdfOptions = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const size = sizeInches * PT_PER_INCH;
  const topPad = (options.topPaddingMm ?? 5) * PT_PER_MM; // extra white above the code
  const sidePad = size * 0.05;
  const bottomPad = size * 0.045;
  const quietModules = 4; // QR spec: keep a 4-module white border around the code
  const qrArea = size * 0.66; // QR code plus its quiet zone

  for (const label of labels) {
    const page = pdf.addPage([size, size]);
    const qr = QRCode.create(label.url, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const moduleSize = qrArea / (count + quietModules * 2);
    const qrLeft = (size - qrArea) / 2 + quietModules * moduleSize;
    const qrTop = size - topPad - quietModules * moduleSize; // y of the top edge of the first module row

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

    const cta = 'Scan to buy';
    const ctaSize = size * 0.047;
    // Title block sits between the QR code's quiet zone and the "Scan to buy" line
    const titleTop = size - topPad - qrArea;
    const titleBottom = bottomPad + ctaSize + size * 0.02;
    const title = toLatin(label.title, bold) || 'Book';
    const fit = fitTitle(title, bold, size * 0.058, size * 0.046, size - sidePad * 2, titleTop - titleBottom);
    let y = titleTop + fit.size * 0.1;
    for (const line of fit.lines) {
      y -= fit.size * fit.lineHeight;
      page.drawText(line, { x: (size - bold.widthOfTextAtSize(line, fit.size)) / 2, y, size: fit.size, font: bold, color: rgb(0, 0, 0) });
    }
    page.drawText(cta, {
      x: (size - regular.widthOfTextAtSize(cta, ctaSize)) / 2,
      y: bottomPad,
      size: ctaSize,
      font: regular,
      color: rgb(0, 0, 0),
    });
  }

  return pdf.save();
}
