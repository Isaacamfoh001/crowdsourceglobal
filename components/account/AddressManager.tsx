"use client";

import { useActionState, useState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import { AddressFormFields } from "./AddressFormFields";
import { createAddressAction, updateAddressAction, deleteAddressAction, setDefaultAddressAction } from "../../lib/actions/addresses";
import type { AddressView } from "../../modules/addresses/types";

function AddressCard({ address }: { address: AddressView }) {
  const [editing, setEditing] = useState(false);
  const [editState, editAction, editPending] = useActionState(updateAddressAction, null);

  if (editing) {
    return (
      <form action={editAction} className="rounded-xl border border-ivory-300 p-4">
        <input type="hidden" name="addressId" value={address.id} />
        {editState && !editState.ok ? <FormMessage tone="error">{editState.error}</FormMessage> : null}
        <AddressFormFields defaults={address} disabled={editPending} />
        <div className="mt-4 flex gap-2">
          <Button type="submit" size="sm" disabled={editPending}>
            {editPending ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded-xl border border-ivory-300 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-espresso-950">
            {address.label || "Address"}
            {address.isDefault ? (
              <span className="rounded-full bg-champagne-200 px-2 py-0.5 text-xs font-medium text-espresso-900">Default</span>
            ) : null}
          </p>
          <p className="mt-1 text-sm text-espresso-900/65">{address.recipientName}</p>
          <p className="text-sm text-espresso-900/65">
            {address.addressLine1}
            {address.addressLine2 ? `, ${address.addressLine2}` : ""}
          </p>
          <p className="text-sm text-espresso-900/65">
            {address.city}, {address.region}
          </p>
          <p className="text-sm text-espresso-900/50">{address.phone}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <button type="button" onClick={() => setEditing(true)} className="font-medium text-espresso-800 hover:underline">
          Edit
        </button>
        {!address.isDefault ? (
          <form action={setDefaultAddressAction}>
            <input type="hidden" name="addressId" value={address.id} />
            <button type="submit" className="font-medium text-espresso-800 hover:underline">
              Set as default
            </button>
          </form>
        ) : null}
        <form action={deleteAddressAction}>
          <input type="hidden" name="addressId" value={address.id} />
          <button type="submit" className="font-medium text-danger-600 hover:underline">
            Delete
          </button>
        </form>
      </div>
    </div>
  );
}

function NewAddressForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(createAddressAction, null);
  return (
    <form action={formAction} className="rounded-xl border border-dashed border-ivory-400 p-4">
      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state && state.ok ? <FormMessage tone="success">Address saved.</FormMessage> : null}
      <AddressFormFields disabled={isPending} />
      <div className="mt-4 flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save address"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AddressManager({ addresses }: { addresses: AddressView[] }) {
  const [showNew, setShowNew] = useState(addresses.length === 0);

  return (
    <div className="flex flex-col gap-4">
      {addresses.map((address) => (
        <AddressCard key={address.id} address={address} />
      ))}

      {showNew ? (
        <NewAddressForm onDone={() => setShowNew(false)} />
      ) : (
        <Button type="button" variant="outline" onClick={() => setShowNew(true)} className="w-fit">
          Add new address
        </Button>
      )}
    </div>
  );
}
