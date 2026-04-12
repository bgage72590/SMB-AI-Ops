"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

export function CsvImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setError("Please upload a .csv file.");
      return;
    }

    setError(null);
    setResult(null);
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Import failed. Check your CSV format.");
        return;
      }
      setResult(data);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent/5"
            : "border-border hover:border-fg-subtle"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          className="hidden"
        />

        <div className="text-fg-muted mb-3">
          <svg
            className="w-8 h-8 mx-auto mb-2 text-fg-subtle"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-sm">
            Drag and drop a CSV file, or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-accent hover:underline font-medium"
            >
              browse
            </button>
          </p>
          <p className="text-xs text-fg-subtle mt-1">
            Requires <strong>name</strong> and <strong>email</strong> columns.
            Optional: company, phone, notes.
          </p>
        </div>
      </div>

      {uploading && (
        <div className="text-sm text-fg-muted animate-pulse text-center">
          Importing contacts...
        </div>
      )}

      {error && (
        <div className="text-sm text-danger bg-danger-soft border border-danger/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <div className="font-medium text-fg text-sm">
            Import complete
          </div>
          <p className="text-sm text-fg-muted mt-1">
            {result.imported} contact{result.imported !== 1 ? "s" : ""} imported
            {result.skipped > 0 && (
              <>, {result.skipped} skipped (duplicates or errors)</>
            )}
          </p>
        </div>
      )}

      <p className="text-xs text-fg-subtle">
        Existing contacts with the same email will be updated, not duplicated.
        Export from Google Contacts, Mailchimp, or any CRM as CSV.
      </p>
    </div>
  );
}
