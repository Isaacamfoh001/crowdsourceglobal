import { getCategoryIcon } from "./categoryIcons";

/**
 * No real product photography exists yet (no vendor uploads, no object
 * storage wired up). Rather than fabricate stock photos, listings render a
 * deterministic icon-on-surface tile keyed by category — consistent with
 * the M0.5 decision to build visual richness through composition rather
 * than imagery. Swap for real images once vendor uploads exist.
 */
export function ListingImagePlaceholder({
  categorySlug,
  className = "",
}: {
  categorySlug: string;
  className?: string;
}) {
  // getCategoryIcon is a stable lookup into a module-level icon map, not a
  // component factory, so identity is stable across renders despite the
  // lint rule's heuristic flagging it as if it were one.
  const Icon = getCategoryIcon(categorySlug);

  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-brand-50 to-stone-100 ${className}`}
    >
      {/* eslint-disable-next-line react-hooks/static-components */}
      <Icon className="size-10 text-brand-300" strokeWidth={1.25} />
    </div>
  );
}
