import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { HttpError } from "@/lib/session";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_EXT = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
]);

export async function saveUpload(file: File, folder = "files") {
  if (!file || file.size <= 0) throw new HttpError(400, "Choose a file to upload", "VALIDATION");
  if (file.size > MAX_BYTES) throw new HttpError(400, "File must be 12 MB or smaller", "VALIDATION");
  const ext = path.extname(file.name || "").toLowerCase() || guessExt(file.type);
  if (!ALLOWED_EXT.has(ext)) {
    throw new HttpError(400, "Upload a PDF, image, Word, Excel or text file", "VALIDATION");
  }
  const safeFolder = folder.replace(/[^a-z0-9_-]/gi, "") || "files";
  const id = crypto.randomUUID();
  const safeName = (file.name || `file${ext}`).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const rel = `/uploads/${safeFolder}/${id}-${safeName}`;
  const abs = path.join(process.cwd(), "public", rel.replaceAll("/", path.sep));
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return { url: rel, filename: file.name || safeName, size: file.size };
}

function guessExt(mime: string) {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return "";
}
