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

/**
 * Dev/test adapter — zero configuration required, matches every prior
 * milestone's behavior. Prints an unmistakable, greppable banner (every
 * line prefixed `[DEV EMAIL]`) rather than a single console.log call —
 * M25.1.1 finding: a plain multi-line log easily gets lost when it lands
 * between several interleaved `GET/POST ... 200` request-log lines in a
 * busy dev terminal, or is filtered out entirely by a `| grep GET\|POST`-
 * style pipe some developers run on their dev server output.
 */
class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    const url = message.text.match(/https?:\/\/\S+/)?.[0];
    const lines = [
      "",
      "[DEV EMAIL] ================================================",
      `[DEV EMAIL] to=${message.to}`,
      `[DEV EMAIL] subject="${message.subject}"`,
      ...(url ? [`[DEV EMAIL] link: ${url}`] : []),
      "[DEV EMAIL] ------------------------------------------------",
      ...message.text.split("\n").map((line) => `[DEV EMAIL] ${line}`),
      "[DEV EMAIL] ================================================",
      "",
    ];
    console.log(lines.join("\n"));
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
    // Never logs the key itself — see the M25.1.1 finding above: a
    // developer expecting console output but silently running against
    // resend (e.g. EMAIL_PROVIDER inherited from a shell profile rather
    // than .env) should see that immediately at startup, not infer it from
    // a missing log line.
    console.log(`[email] provider=resend from="${env.EMAIL_FROM}" — emails are sent for real, not printed here.`);
    return new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  console.log("[email] provider=console — verification/reset links print to this terminal as [DEV EMAIL] blocks.");
  return new ConsoleEmailProvider();
}

export const emailProvider: EmailProvider = buildProvider();
