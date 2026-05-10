import { Resend } from "resend";
import { config } from "../config.js";

const resend = config.email.resendApiKey ? new Resend(config.email.resendApiKey) : null;

async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.warn("[email] Resend not configured — skipping:", subject);
    return { id: "email_disabled", skipped: true };
  }

  return resend.emails.send({
    from: config.email.from,
    to,
    subject,
    html,
  });
}

function baseTemplate({ title, preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:480px;background:#111;border-radius:20px;overflow:hidden;border:1px solid #1f1f1f;">
      <!-- Header -->
      <tr><td style="padding:32px 32px 0;text-align:center;">
        <div style="display:inline-block;background:#22c55e;border-radius:12px;padding:10px 18px;margin-bottom:20px;">
          <span style="color:#000;font-weight:800;font-size:18px;letter-spacing:-0.5px;">Vaultline</span>
        </div>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:0 32px 32px;">
        ${body}
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:20px 32px;border-top:1px solid #1f1f1f;text-align:center;">
        <p style="margin:0;font-size:12px;color:#555;line-height:1.6;">
          You're receiving this because you have a Vaultline account.<br/>
          &copy; ${new Date().getFullYear()} Vaultline. All rights reserved.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export function sendVerificationEmail(user, verifyUrl) {
  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Verify your email</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#888;line-height:1.6;">Click the button below to confirm your Vaultline account. This link expires in 15 minutes.</p>
    <a href="${verifyUrl}" style="display:block;background:#22c55e;color:#000;text-decoration:none;font-weight:700;font-size:16px;text-align:center;padding:16px;border-radius:14px;margin-bottom:20px;">
      Verify email address
    </a>
    <p style="margin:0;font-size:13px;color:#555;text-align:center;">If you didn't create a Vaultline account, you can ignore this email.</p>
  `;
  return sendEmail({
    to: user.email,
    subject: "Verify your Vaultline email",
    html: baseTemplate({ title: "Verify your email", preheader: "Click to confirm your Vaultline account.", body }),
  });
}

export function sendReceiptEmail({ to, title, amount, libraryUrl }) {
  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">You're unlocked 🔓</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#888;line-height:1.6;">Your purchase is confirmed and saved permanently to your library.</p>
    <div style="background:#1a1a1a;border-radius:14px;padding:20px;margin-bottom:24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:14px;color:#888;">Drop</td>
          <td style="font-size:14px;color:#fff;font-weight:600;text-align:right;">${title}</td>
        </tr>
        <tr><td colspan="2" style="padding:10px 0;"><div style="border-top:1px solid #2a2a2a;"></div></td></tr>
        <tr>
          <td style="font-size:14px;color:#888;">Amount charged</td>
          <td style="font-size:18px;color:#22c55e;font-weight:800;text-align:right;">${amount}</td>
        </tr>
        <tr><td colspan="2" style="padding:4px 0;"></td></tr>
        <tr>
          <td style="font-size:14px;color:#888;">Access</td>
          <td style="font-size:14px;color:#fff;text-align:right;">Permanent unlock</td>
        </tr>
      </table>
    </div>
    <a href="${libraryUrl}" style="display:block;background:#22c55e;color:#000;text-decoration:none;font-weight:700;font-size:16px;text-align:center;padding:16px;border-radius:14px;">
      Open your library
    </a>
  `;
  return sendEmail({
    to,
    subject: `Receipt: ${title}`,
    html: baseTemplate({ title: `Receipt: ${title}`, preheader: `You unlocked ${title} for ${amount}. Open your library.`, body }),
  });
}

export function sendSupportNotice(ticket) {
  const body = `
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#fff;">New support ticket</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#888;">A user submitted a support request.</p>
    <div style="background:#1a1a1a;border-radius:14px;padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.5px;">From</p>
      <p style="margin:0 0 16px;font-size:15px;color:#fff;">${ticket.email}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Subject</p>
      <p style="margin:0 0 16px;font-size:15px;color:#fff;font-weight:600;">${ticket.subject}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Message</p>
      <p style="margin:0;font-size:15px;color:#ccc;line-height:1.6;white-space:pre-wrap;">${ticket.message}</p>
    </div>
  `;
  return sendEmail({
    to: config.email.support,
    subject: `[Support] ${ticket.subject}`,
    html: baseTemplate({ title: "Support ticket", preheader: `New ticket from ${ticket.email}: ${ticket.subject}`, body }),
  });
}

export function sendNewDropNotification({ to, creatorHandle, dropTitle, storefrontUrl }) {
  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">New drop from @${creatorHandle} 🔒</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#888;line-height:1.6;">A creator you follow just published new locked content.</p>
    <div style="background:#1a1a1a;border-radius:14px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:13px;color:#888;">New drop</p>
      <p style="margin:0;font-size:17px;color:#fff;font-weight:700;">${dropTitle}</p>
    </div>
    <a href="${storefrontUrl}" style="display:block;background:#22c55e;color:#000;text-decoration:none;font-weight:700;font-size:16px;text-align:center;padding:16px;border-radius:14px;">
      View on Vaultline
    </a>
  `;
  return sendEmail({
    to,
    subject: `@${creatorHandle} just dropped something new`,
    html: baseTemplate({ title: "New drop", preheader: `@${creatorHandle} published: ${dropTitle}`, body }),
  });
}
