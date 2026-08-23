"use client";

import { beginApplicationReviewAction } from "../../lib/actions/admin";

export function BeginReviewButton({ applicationId }: { applicationId: string }) {
  return (
    <form action={beginApplicationReviewAction}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <button
        type="submit"
        className="w-fit text-sm font-medium text-espresso-900/65 underline decoration-ivory-400 hover:text-espresso-950"
      >
        Mark as under review
      </button>
    </form>
  );
}
