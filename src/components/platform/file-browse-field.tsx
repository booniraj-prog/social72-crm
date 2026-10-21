"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { controlClass } from "@/components/platform/form-field";

export function FileBrowseField({
  name,
  defaultUrl = "",
  accept,
  folder = "files",
  preview,
  onChange,
}: {
  name: string;
  defaultUrl?: string;
  accept?: string;
  folder?: string;
  preview?: boolean;
  onChange?: (url: string) => void;
}) {
  const [url, setUrl] = useState(defaultUrl);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function setFileUrl(next: string) {
    setUrl(next);
    onChange?.(next);
  }

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("file", file);
    body.set("folder", folder);
    const res = await fetch("/api/uploads", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Could not upload file");
      return;
    }
    setFileUrl(json.url);
    setFilename(json.filename ?? file.name);
  }

  const image = preview && url && /\.(png|jpe?g|webp|gif)$/i.test(url);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} />
      <input type="hidden" name={`${name}Name`} value={filename} />
      <label
        className="action-icon action-icon-browse cursor-pointer"
        title={busy ? "Uploading…" : "Browse file"}
        aria-label={busy ? "Uploading…" : "Browse file"}
        data-tooltip={busy ? "Uploading…" : "Browse file"}
      >
        <Upload className="h-4 w-4" strokeWidth={1.9} />
        <input
          type="file"
          className="sr-only"
          accept={accept}
          disabled={busy}
          onChange={(e) => void onPick(e.target.files?.[0])}
        />
      </label>
      {image ? <img src={url} alt="" className="h-16 w-16 rounded-full object-cover" /> : null}
      {url && !image ? (
        <a className="block text-xs text-copper underline" href={url} target="_blank" rel="noreferrer">
          {filename || url}
        </a>
      ) : null}
      <input
        type="url"
        placeholder="Or paste a file URL"
        value={url.startsWith("http") ? url : ""}
        onChange={(e) => setFileUrl(e.target.value)}
        className={controlClass(false, "h-9")}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
