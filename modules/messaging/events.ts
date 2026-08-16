/**
 * Single extension point for anything that should happen after a Message is
 * durably persisted — a future in-app/email notification dispatch, or a
 * future realtime broadcast (WebSocket/SSE/managed realtime). PostgreSQL is
 * the source of truth regardless of what, if anything, hooks in here.
 *
 * Deliberately a no-op in M3 — no notification or realtime infrastructure
 * exists yet. Call this AFTER the persistence transaction commits, never
 * from inside it: a future delivery failure (a flaky email provider, a
 * disconnected realtime channel) must never roll back or block a message
 * that was already successfully saved. The natural M3-appropriate next step
 * would be enqueuing a row on the existing DB-backed BackgroundJob table
 * (docs/architecture/overview.md) — not a broker — but that's future work,
 * not something to build speculatively now.
 */
export function onMessagePersisted(_message: { id: string; conversationId: string; senderIsStaff: boolean }): void {
  // No-op — see doc comment above.
}
