"use client";

import { useActionState } from "react";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import type { MessageView } from "../../modules/messaging/types";
import type { Result } from "../../lib/result";

export function MessageThread({
  conversationId,
  messages,
  selfIsStaff,
  replyAction,
  placeholder = "Write a message…",
}: {
  conversationId: string;
  messages: MessageView[];
  selfIsStaff: boolean;
  replyAction: (prevState: Result<null> | null, formData: FormData) => Promise<Result<null>>;
  placeholder?: string;
}) {
  const [state, formAction, isPending] = useActionState(replyAction, null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-stone-400">No messages yet.</p>
        ) : (
          messages.map((message) => {
            const isSelf = message.senderIsStaff === selfIsStaff;
            return (
              <div key={message.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[70%] ${
                    isSelf ? "bg-brand-700 text-white" : "bg-stone-100 text-stone-800"
                  }`}
                >
                  <p className="whitespace-pre-line">{message.body}</p>
                  <p className={`mt-1 text-[11px] ${isSelf ? "text-brand-100/80" : "text-stone-400"}`}>
                    {message.senderName} ·{" "}
                    {message.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}
        <div className="flex items-end gap-2">
          <textarea
            name="body"
            rows={2}
            placeholder={placeholder}
            required
            disabled={isPending}
            className="w-full min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 shadow-soft outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
          <Button type="submit" disabled={isPending} className="shrink-0">
            {isPending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </div>
  );
}
