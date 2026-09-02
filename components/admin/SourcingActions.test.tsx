import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssignStaffForm, PrepareQuoteForm } from "./SourcingActions";
import { ok } from "../../lib/result";

/**
 * M25.2 Part 2 regression — physical-device finding: an admin picks
 * themselves in the assignment dropdown and clicks Save, the write
 * genuinely persists (confirmed against the real dev DB — see the M25.2
 * report), but the dropdown visibly snaps back to "Unassigned" right after
 * a successful save, making it look like the assignment was lost.
 *
 * Root cause: the `<select>` was uncontrolled (`defaultValue`), and React
 * 19 automatically resets uncontrolled `<form action={fn}>` fields to
 * their ORIGINAL mount-time value after the action succeeds (see
 * https://react.dev/reference/react-dom/components/form — "Resetting
 * fields after submission"). That's the right default for a fresh
 * "add a comment"-style form; here, where the field is an *existing*
 * value being edited, it silently discards the just-saved selection. Since
 * this is a real React behavior (not Next.js/mocking-specific), a jsdom
 * component test with the real `useActionState`/form-action machinery
 * reproduces it faithfully — no server or DB needed.
 */
vi.mock("../../lib/actions/sourcing", () => ({
  assignStaffAction: vi.fn(),
  moveToUnderReviewAction: vi.fn(),
  moveToSourcingAction: vi.fn(),
  requestClarificationAction: vi.fn(),
  addSourcingOptionAction: vi.fn(),
  removeSourcingOptionAction: vi.fn(),
  setAllocationsAction: vi.fn(),
  prepareQuoteAction: vi.fn(),
  markUnableToSourceAction: vi.fn(),
}));

import { assignStaffAction } from "../../lib/actions/sourcing";

const staff = [
  { id: "staff-1", name: "Ama Ops (OPS_ADMIN)" },
  { id: "staff-2", name: "Kojo Ops (OPS_ADMIN)" },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Mirrors the real app: a successful Server Action's `revalidatePath` call
 * delivers a fresh `assignedStaffId` prop from the Server Component parent
 * in the SAME transition as the action settling (Next.js: "Server Functions
 * ... updates the UI immediately"). This harness models that by updating
 * its own state — the new source of truth — from inside the mocked action,
 * so the prop change and the pending->false transition commit together,
 * just as they do against the real backend (verified live against the dev
 * DB for this exact component).
 */
function Harness({ initialAssignedStaffId }: { initialAssignedStaffId: string | null }) {
  const [assignedStaffId, setAssignedStaffId] = useState(initialAssignedStaffId);
  vi.mocked(assignStaffAction).mockImplementation(async (_prev, formData) => {
    setAssignedStaffId(String(formData.get("staffId") || "") || null);
    return ok(null);
  });
  return <AssignStaffForm id="req-1" staff={staff} assignedStaffId={assignedStaffId} />;
}

describe("AssignStaffForm — assignment persistence display (M25.2 Part 2)", () => {
  it("keeps the newly-assigned staff member selected after a successful save, instead of resetting to Unassigned", async () => {
    render(<Harness initialAssignedStaffId={null} />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");

    fireEvent.change(select, { target: { value: "staff-1" } });
    expect(select.value).toBe("staff-1");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    expect(assignStaffAction).toHaveBeenCalledTimes(1);
    // The regression: React calls the native HTMLFormElement.reset() on
    // every successful form-action submit, which silently snaps this
    // <select> back to its first <option> ("Unassigned") — bypassing React
    // entirely, so merely controlling the value isn't enough on its own.
    expect(select.value).toBe("staff-1");
  });

  it("reflects a server-driven prop change (e.g. after revalidation) even without further interaction", () => {
    const { rerender } = render(<AssignStaffForm id="req-1" staff={staff} assignedStaffId={null} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");

    rerender(<AssignStaffForm id="req-1" staff={staff} assignedStaffId="staff-2" />);
    expect(select.value).toBe("staff-2");
  });

  it("supports explicitly unassigning back to empty after a successful save", async () => {
    render(<Harness initialAssignedStaffId="staff-1" />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("staff-1");

    fireEvent.change(select, { target: { value: "" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save/i }));
    });

    expect(select.value).toBe("");
  });
});

describe("PrepareQuoteForm — markup pricing prefill (M25.2 Part 6)", () => {
  it("fills in the suggested customer unit price once it arrives, even though the field was already mounted with none", () => {
    // Mirrors the real admin page: PrepareQuoteForm is already on the page
    // (allocationCost, currency) before allocations are saved, so
    // pricingSuggestion starts null and only becomes non-null once the
    // admin allocates supply and the page re-renders with it — all without
    // a full reload of this already-mounted component.
    const { container, rerender } = render(<PrepareQuoteForm id="req-1" allocationCost={0} currency="GHS" pricingSuggestion={null} />);
    const unitPriceInput = container.querySelector('input[name="unitPrice"]') as HTMLInputElement;
    expect(unitPriceInput.value).toBe("");

    rerender(
      <PrepareQuoteForm
        id="req-1"
        allocationCost={160000}
        currency="GHS"
        pricingSuggestion={{
          factoryUnitPrice: 32,
          factoryQuantity: 5000,
          factorySubtotal: 160000,
          markupPercent: 15,
          customerUnitPrice: 36.8,
          customerSubtotal: 184000,
          currency: "GHS",
        }}
      />,
    );

    expect(unitPriceInput.value).toBe("36.8");
  });
});
