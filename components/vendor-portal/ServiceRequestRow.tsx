"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import { acceptServiceRequestAction, declineServiceRequestAction } from "../../lib/actions/beauty-professionals";
import type { BadgeTone } from "../ui/Badge";
import type { ServiceRequestView } from "../../modules/service-requests/types";

const STATUS_TONE: Record<string, BadgeTone> = {
  SUBMITTED: "gold",
  PROVIDER_ACCEPTED: "success",
  PROVIDER_DECLINED: "danger",
  CANCELLED: "neutral",
};

/** A pending request shows accept/decline actions; a resolved one shows only its status — no re-decision allowed (prisma/schema.prisma's ServiceRequestStatus doc comment). */
export function ServiceRequestRow({ request }: { request: ServiceRequestView }) {
  const [declining, setDeclining] = useState(false);

  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-espresso-950">
            {request.service.name} — {request.customer.name}
          </p>
          <p className="text-xs text-espresso-900/50">
            Preferred {new Date(request.preferredDate).toLocaleDateString()}
            {request.preferredTimeNote ? ` · ${request.preferredTimeNote}` : ""} · {request.locationMode === "PROVIDER_LOCATION" ? "At your location" : "At customer's location"}
          </p>
          {request.locationDetails ? <p className="mt-1 text-xs text-espresso-900/50">{request.locationDetails}</p> : null}
          {request.notes ? <p className="mt-1 text-xs text-espresso-900/65">&ldquo;{request.notes}&rdquo;</p> : null}
        </div>
        <StatusBadge tone={STATUS_TONE[request.status] ?? "neutral"} className="w-fit shrink-0">
          {request.status.replaceAll("_", " ")}
        </StatusBadge>
      </div>

      {request.status === "SUBMITTED" ? (
        declining ? (
          <form action={declineServiceRequestAction} className="flex flex-col gap-2 rounded-lg border border-ivory-300 p-3">
            <input type="hidden" name="requestId" value={request.id} />
            <label htmlFor={`decline-reason-${request.id}`} className="text-xs font-medium text-espresso-800">
              Reason (optional, shown to the customer)
            </label>
            <textarea id={`decline-reason-${request.id}`} name="reason" rows={2} className="w-full rounded-lg border border-ivory-400 px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="danger">
                Confirm decline
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setDeclining(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex gap-2">
            <form action={acceptServiceRequestAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <Button type="submit" size="sm">
                Accept
              </Button>
            </form>
            <Button size="sm" variant="outline" onClick={() => setDeclining(true)}>
              Decline
            </Button>
          </div>
        )
      ) : null}
    </li>
  );
}
