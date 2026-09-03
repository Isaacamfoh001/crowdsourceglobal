import { env } from "./env";

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  /** Only safe, non-sensitive identifiers — see modules/notifications/dto or the worker's doc comment for what this carries. */
  data: Record<string, unknown>;
};

export type PushSendResult = {
  to: string;
  ok: boolean;
  /** True only when the provider reports this specific token as permanently invalid (uninstalled app, revoked registration) — the worker uses this to remove the PushDevice row. Never set for a transient failure. */
  deviceNotRegistered: boolean;
  error?: string;
};

export type PushProvider = {
  /** One provider call per worker job — up to `Notifications.Expo.PUSH_NOTIFICATION_CHUNK_LIMIT` (100) messages; the worker never exceeds that. Returns exactly one result per input message, same order. */
  send(messages: PushMessage[]): Promise<PushSendResult[]>;
};

/**
 * Dev/test adapter — zero configuration required, matches EMAIL_PROVIDER's
 * ConsoleEmailProvider convention exactly. Never fabricates a
 * DeviceNotRegistered outcome — there is no real provider here to report
 * one, so every message "succeeds" for logging purposes.
 */
class ConsolePushProvider implements PushProvider {
  async send(messages: PushMessage[]): Promise<PushSendResult[]> {
    for (const message of messages) {
      console.log(
        [
          "",
          "[DEV PUSH] ================================================",
          `[DEV PUSH] to=${message.to}`,
          `[DEV PUSH] title="${message.title}"`,
          `[DEV PUSH] body="${message.body}"`,
          `[DEV PUSH] data=${JSON.stringify(message.data)}`,
          "[DEV PUSH] ================================================",
          "",
        ].join("\n"),
      );
    }
    return messages.map((message) => ({ to: message.to, ok: true, deviceNotRegistered: false }));
  }
}

type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

/**
 * Expo's push service via plain `fetch` — no `expo-server-sdk` dependency
 * added for a single POST endpoint, same "no SDK for one HTTP call"
 * convention as ResendEmailProvider. No API key is required by Expo
 * itself; EXPO_ACCESS_TOKEN, if configured, is sent as a bearer token
 * (Expo's "Enhanced Security for Push Notifications").
 */
class ExpoPushProvider implements PushProvider {
  constructor(private readonly accessToken: string | undefined) {}

  async send(messages: PushMessage[]): Promise<PushSendResult[]> {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify(
        messages.map((message) => ({ to: message.to, title: message.title, body: message.body, data: message.data })),
      ),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new Error(`Expo push send failed (${response.status}): ${bodyText.slice(0, 300)}`);
    }

    const payload = (await response.json()) as { data?: ExpoTicket[] };
    const tickets = payload.data ?? [];

    return messages.map((message, index) => {
      const ticket = tickets[index];
      if (!ticket || ticket.status === "ok") {
        return { to: message.to, ok: true, deviceNotRegistered: false };
      }
      return {
        to: message.to,
        ok: false,
        deviceNotRegistered: ticket.details?.error === "DeviceNotRegistered",
        error: ticket.message,
      };
    });
  }
}

function buildProvider(): PushProvider {
  if (env.PUSH_PROVIDER === "expo") {
    console.log("[push] provider=expo — pushes are sent for real via Expo's push service, not printed here.");
    return new ExpoPushProvider(env.EXPO_ACCESS_TOKEN);
  }
  console.log("[push] provider=console — pushes print to this terminal as [DEV PUSH] blocks.");
  return new ConsolePushProvider();
}

export const pushProvider: PushProvider = buildProvider();
