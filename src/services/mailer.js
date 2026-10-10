import nodemailer from 'nodemailer';

/**
 * Outbound email (password resets). Uses SMTP when configured — Hostinger mailboxes work with
 * smtp.hostinger.com:465. With no SMTP settings it logs the message, which is how local
 * development reads reset links.
 *
 * @param {import('../config.js').Config} config
 * @param {{info:Function, warn:Function}} log
 * @param {object} [transportOverride] injected in tests
 */
export function createMailer(config, log, transportOverride) {
  const { smtp } = config;
  const configured = Boolean(smtp.host && smtp.user && smtp.pass);
  const transport =
    transportOverride ||
    (configured ? nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: { user: smtp.user, pass: smtp.pass } }) : null);

  return {
    configured: configured || Boolean(transportOverride),
    async send({ to, subject, text, html, headers }) {
      if (!transport) {
        log.warn('mail.not_configured', { to, subject, preview: text.slice(0, 500) });
        return { delivered: false };
      }
      await transport.sendMail({ from: smtp.from, to, subject, text, html, headers });
      return { delivered: true };
    }
  };
}
