import { readFileSync } from "fs";
import { join } from "path";
import { formatInr2, round2 } from "@/lib/money";
import { formatIstDate } from "@/lib/time";
import { invoiceKindLabel, type InvoicePdfInput } from "@/lib/invoice-format";

function ascii(value: string) {
  return value.replace(/₹/g, "Rs.").replace(/[^\x20-\x7E]/g, (ch) => (ch === "·" ? "-" : " "));
}

function pdfEscape(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text: string, width: number) {
  const words = ascii(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function jpegSize(buf: Buffer) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return { width: 972, height: 141 };
}

function loadLogoJpeg() {
  try {
    const bytes = readFileSync(join(process.cwd(), "public", "social72-logo.jpg"));
    return { bytes, ...jpegSize(bytes) };
  } catch {
    return null;
  }
}

function assemblePdf(objects: Buffer[]) {
  const header = Buffer.from("%PDF-1.4\n", "latin1");
  const chunks: Buffer[] = [header];
  const offsets = [0];
  let size = header.length;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(size);
    const obj = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), objects[i], Buffer.from("\nendobj\n", "latin1")]);
    chunks.push(obj);
    size += obj.length;
  }
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, "latin1"));
  return Buffer.concat(chunks);
}

export function buildInvoicePdf(inv: InvoicePdfInput) {
  const half = round2((inv.subtotal * (inv.gstPct / 100)) / 2);
  const logo = loadLogoJpeg();
  const ops: string[] = [];
  let y = 800;

  const text = (font: "F1" | "F2", size: number, x: number, str: string) => {
    ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(str)}) Tj ET`);
  };

  if (logo) {
    const displayH = 28;
    const displayW = (logo.width / logo.height) * displayH;
    ops.push(`q ${displayW.toFixed(2)} 0 0 ${displayH} 48 ${y - displayH} cm /Im1 Do Q`);
    y -= displayH + 8;
  } else {
    text("F2", 18, 48, "Social72");
    y -= 16;
  }
  text("F1", 9, 48, "Digital marketing & technology");
  y -= 28;
  text("F2", 16, 48, invoiceKindLabel(inv.kind));
  y -= 18;
  text("F1", 10, 48, `No. ${inv.number}    Status: ${inv.status}`);
  y -= 14;
  text("F1", 10, 48, `Issue: ${formatIstDate(inv.issueDate)}    Due: ${formatIstDate(inv.dueDate)}`);
  y -= 28;
  text("F2", 11, 48, "Bill to");
  y -= 14;
  text("F1", 11, 48, inv.client.name);
  y -= 13;
  if (inv.client.contactName) {
    text("F1", 9, 48, inv.client.contactName);
    y -= 12;
  }
  const contactBits = [inv.client.contactEmail, inv.client.contactPhone].filter(Boolean).join("  ");
  if (contactBits) {
    text("F1", 9, 48, contactBits);
    y -= 12;
  }
  if (inv.client.gstin) {
    text("F1", 9, 48, `GSTIN: ${inv.client.gstin}`);
    y -= 12;
  }
  if (inv.engagement) {
    text("F1", 9, 48, `Project: ${inv.engagement.name}`);
    y -= 12;
  }

  y -= 16;
  ops.push("0.85 0.8 0.72 rg");
  ops.push(`48 ${y - 4} 499 18 re f`);
  ops.push("0 0 0 rg");
  y += 2;
  text("F2", 9, 56, "Description");
  text("F2", 9, 350, "Qty");
  text("F2", 9, 400, "Rate");
  text("F2", 9, 480, "Amount");
  y -= 22;

  for (const line of inv.lines) {
    const descLines = wrap(line.description, 48);
    for (const [i, d] of descLines.entries()) {
      text("F1", 9, 56, d);
      if (i === 0) {
        text("F1", 9, 350, String(line.qty));
        text("F1", 9, 400, formatInr2(line.rate));
        text("F1", 9, 480, formatInr2(line.amount));
      }
      y -= 13;
    }
    y -= 4;
  }

  y -= 10;
  if (inv.discountAmt) {
    text("F1", 10, 360, "Gross");
    text("F1", 10, 470, `Rs. ${formatInr2(inv.gross || inv.subtotal + inv.discountAmt)}`);
    y -= 14;
    text("F1", 10, 360, "Discount");
    text("F1", 10, 470, `Rs. ${formatInr2(inv.discountAmt)}`);
    y -= 14;
  }
  text("F1", 10, 360, "Taxable");
  text("F1", 10, 470, `Rs. ${formatInr2(inv.subtotal)}`);
  y -= 14;
  text("F1", 10, 360, `CGST (${inv.gstPct / 2}%)`);
  text("F1", 10, 470, `Rs. ${formatInr2(half)}`);
  y -= 14;
  text("F1", 10, 360, `SGST (${inv.gstPct / 2}%)`);
  text("F1", 10, 470, `Rs. ${formatInr2(half)}`);
  y -= 16;
  text("F2", 12, 360, "Total");
  text("F2", 12, 470, `Rs. ${formatInr2(inv.total)}`);
  y -= 16;
  text("F1", 10, 360, "Paid");
  text("F1", 10, 470, `Rs. ${formatInr2(inv.paid)}`);
  y -= 14;
  text("F2", 11, 360, "Balance due");
  text("F2", 11, 470, `Rs. ${formatInr2(inv.outstanding)}`);

  if (inv.notes) {
    y -= 28;
    text("F2", 10, 48, "Notes");
    y -= 14;
    for (const n of wrap(inv.notes, 90)) {
      text("F1", 9, 48, n);
      y -= 12;
    }
  }

  y = 48;
  text("F1", 8, 48, "This is a computer-generated document from Social72 CRM.");

  const content = Buffer.from(ops.join("\n"), "latin1");
  const pageResources = logo
    ? "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Im1 7 0 R >> >> /Contents 4 0 R >>"
    : "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>";
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1"),
    Buffer.from(pageResources, "latin1"),
    Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "latin1"), content, Buffer.from("\nendstream", "latin1")]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "latin1"),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", "latin1"),
  ];
  if (logo) {
    objects.push(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`,
          "latin1",
        ),
        logo.bytes,
        Buffer.from("\nendstream", "latin1"),
      ]),
    );
  }
  return assemblePdf(objects);
}
