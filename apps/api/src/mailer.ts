import { env } from "./env"

export type Mail = { to: string; subject: string; text: string }

/**
 * Outgoing email. There is no provider yet. Mail can carry secrets (invite
 * links are bearer tokens), so its content is only printed when
 * MAIL_TRANSPORT=console is set explicitly, never by default.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (env.MAIL_TRANSPORT === "console") {
    console.info(`[mail] to=${mail.to} subject=${mail.subject}\n${mail.text}`)
  }
}
