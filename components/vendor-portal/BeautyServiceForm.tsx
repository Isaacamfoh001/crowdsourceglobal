"use client";

import { useActionState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import { MoneyInput } from "../ui/MoneyInput";
import { FormMessage } from "../ui/FormMessage";
import { createBeautyServiceAction, updateBeautyServiceAction } from "../../lib/actions/beauty-professionals";
import type { VendorServiceView } from "../../modules/beauty-services/types";

type Category = { id: string; name: string; slug: string };

/** Same small create/edit form for a single BeautyService — mirrors NewListingForm's shape at a fraction of the size (no inventory/shipping fields — a service has none, prisma/schema.prisma's section header). */
export function BeautyServiceForm({ service, categories, onDone }: { service?: VendorServiceView; categories: Category[]; onDone?: () => void }) {
  const action = service ? updateBeautyServiceAction : createBeautyServiceAction;
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <form
      action={async (formData) => {
        await formAction(formData);
        onDone?.();
      }}
      className="flex flex-col gap-4"
    >
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {service ? <input type="hidden" name="serviceId" value={service.id} /> : null}

      <Input label="Service name" name="name" defaultValue={service?.name ?? ""} placeholder="e.g. Bridal Makeup" required disabled={isPending} />
      <Textarea label="Description (optional)" name="description" defaultValue={service?.description ?? ""} disabled={isPending} rows={2} />

      <Select label="Category" name="categoryId" defaultValue={service?.category.id ?? ""} required disabled={isPending}>
        <option value="" disabled>
          Choose a category
        </option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>

      <MoneyInput label="Starting price (optional)" name="startingPrice" defaultValue={service?.startingPrice ?? ""} hint="Shown to customers as “From GH₵ X”." />

      <Button type="submit" size="sm" className="w-fit" disabled={isPending}>
        {isPending ? "Saving…" : service ? "Save service" : "Add service"}
      </Button>
    </form>
  );
}
