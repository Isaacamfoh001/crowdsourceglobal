-- DropIndex
DROP INDEX "message_conversationId_idx";

-- CreateIndex
CREATE INDEX "conversation_status_updatedAt_idx" ON "conversation"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "message_conversationId_createdAt_idx" ON "message"("conversationId", "createdAt");
