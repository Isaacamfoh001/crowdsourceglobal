"use client";

import { beginApplicationReviewAction } from "../../lib/actions/admin";

export function BeginReviewButton({ applicationId }: { applicationId: string }) {
  return (
    <form action={beginApplicationReviewAction}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <button
        type="submit"
        className="w-fit text-sm font-medium text-stone-600 underline decoration-stone-300 hover:text-stone-900"
      >
        Mark as under review
      </button>
    </form>
  );
}
