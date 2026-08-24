"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";

/**
 * Fetches the PDF via the authenticated route handler and saves it through a
 * blob URL, rather than a plain <a href> — a raw link would surface the
 * route's JSON error body as a broken download with no way to retry in-page
 * (M15.1 §10 error handling).
 */
export function DownloadQuoteButton({ quotationId, reference }: { quotationId: string; reference: string }) {
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");

  async function handleDownload() {
    setStatus("pending");
    try {
      const response = await fetch(`/api/quotations/${quotationId}/pdf`);
      if (!response.ok) {
        setStatus("error");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `CrownSourceGlobal-Quotation-${reference}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <Button variant="outline" size="lg" fullWidth onClick={handleDownload} disabled={status === "pending"}>
        {status === "pending" ? (
          <Loader2 className="size-4 shrink-0 animate-spin" strokeWidth={2} />
        ) : (
          <Download className="size-4 shrink-0" strokeWidth={2} />
        )}
        {status === "pending" ? "Preparing…" : "Download quotation"}
      </Button>
      {status === "error" ? (
        <div className="mt-3">
          <FormMessage tone="error">Couldn&apos;t generate the PDF right now. Please try again.</FormMessage>
        </div>
      ) : null}
    </div>
  );
}
