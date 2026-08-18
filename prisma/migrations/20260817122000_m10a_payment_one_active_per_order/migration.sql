-- Enforces "at most one active (non-terminal) Payment attempt per Order" at
-- the database level — the actual guard against a double-click/double-tab
-- race creating two concurrent Moolre initiations for the same Order.
-- Partial unique indexes aren't expressible in prisma/schema.prisma; this
-- exists in the database only (documented on the Payment model doc comment).
CREATE UNIQUE INDEX "payment_one_active_per_order" ON "payment"("orderId") WHERE "status" IN ('INITIATED', 'PENDING');
