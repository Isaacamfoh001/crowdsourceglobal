import { env } from "./env";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailProvider = {
  send(message: EmailMessage): Promise<void>;
};

/** Dev/test adapter — zero configuration required, matches every prior milestone's behavior. */
class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(`[email] to=${message.to} subject="${message.subject}"\n${message.text}`);
  }
}

/**
 * Resend adapter via plain `fetch` against their HTTP API — no SDK
 * dependency added for a single POST endpoint. Never logs the API key.
 */
class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // Never include the API key; response bodies from Resend don't echo it.
      throw new Error(`Resend send failed (${response.status}): ${body.slice(0, 300)}`);
    }
  }
}

function buildProvider(): EmailProvider {
  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      throw new Error(
        "EMAIL_PROVIDER=resend requires both RESEND_API_KEY and EMAIL_FROM to be set. " +
          "Set EMAIL_PROVIDER=console for local development instead.",
      );
    }
    return new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  return new ConsoleEmailProvider();
}

export const emailProvider: EmailProvider = buildProvider();
