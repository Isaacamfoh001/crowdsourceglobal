"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import { BeautyServiceForm } from "./BeautyServiceForm";
import { toggleBeautyServiceActiveAction } from "../../lib/actions/beauty-professionals";
import type { VendorServiceView } from "../../modules/beauty-services/types";

type Category = { id: string; name: string; slug: string };

export function BeautyServiceRow({ service, categories }: { service: VendorServiceView; categories: Category[] }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="px-5 py-4">
        <BeautyServiceForm service={service} categories={categories} onDone={() => setEditing(false)} />
        <button type="button" onClick={() => setEditing(false)} className="mt-2 text-xs font-medium text-espresso-900/50 underline">
          Cancel
        </button>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-espresso-950">{service.name}</p>
        <p className="text-xs text-espresso-900/50">
          {service.category.name}
          {service.startingPrice ? ` · From GH₵ ${service.startingPrice}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge tone={service.active ? "success" : "neutral"}>{service.active ? "Active" : "Hidden"}</StatusBadge>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <form action={toggleBeautyServiceActiveAction}>
          <input type="hidden" name="serviceId" value={service.id} />
          <input type="hidden" name="active" value={String(!service.active)} />
          <Button type="submit" variant="outline" size="sm">
            {service.active ? "Hide" : "Unhide"}
          </Button>
        </form>
      </div>
    </li>
  );
}
