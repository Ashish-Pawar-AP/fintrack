import { config } from '../config.js';

let transport;
// Sends via SMTP when SMTP_HOST is set. In development without SMTP the email is printed to the console.
// In production without SMTP nothing is sent and nothing sensitive is logged.
export async function sendMail({ to, subject, text }) {
  if (!process.env.SMTP_HOST) {
    if (config.prod) { console.warn('[mail] SMTP is not configured; email not sent'); return false; }
    console.log(`\n[mail:dev] to=${to}\n${subject}\n${text}\n`);
    return true;
  }
  if (!transport) {
    const { default: nodemailer } = await import('nodemailer');
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
  return true;
}
