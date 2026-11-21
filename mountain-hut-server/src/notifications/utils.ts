export const dayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Rome",
  dateStyle: "full",
});

export const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Rome",
  timeStyle: "short",
});

export const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function renderPasswordResetEmail(
  resetUrl: string,
  name: string,
): { text: string; html: string } {
  const safeName = esc(name);
  const safeUrl = esc(resetUrl);

  const text = [
    `Hi ${name},`,
    "",
    "We received a request to reset your Mountain Hut password.",
    "Click the link below (valid for 24 hours):",
    "",
    resetUrl,
    "",
    "If you did not request a password reset, you can safely ignore this email.",
    "",
    "— Mountain Hut Team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;color:#1c1917;max-width:480px;margin:auto;padding:24px">
  <h2 style="color:#16a34a">Mountain Hut — Password Reset</h2>
  <p>Hi ${safeName},</p>
  <p>We received a request to reset your password. Click the button below — the link expires in <strong>24 hours</strong>.</p>
  <p style="text-align:center;margin:32px 0">
    <a href="${safeUrl}"
       style="background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
      Reset password
    </a>
  </p>
  <p style="font-size:0.85em;color:#78716c">
    Or copy this link into your browser:<br/>
    <a href="${safeUrl}" style="color:#16a34a">${safeUrl}</a>
  </p>
  <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
  <p style="font-size:0.8em;color:#a8a29e">
    If you did not request a password reset, you can safely ignore this email.
  </p>
</body>
</html>`;

  return { text, html };
}

export function renderPasswordChangedConfirmationEmail(
  name: string,
): { text: string; html: string } {
  const safeName = esc(name);

  const text = [
    `Hi ${name},`,
    "",
    "Your password has been changed successfully.",
    "",
    "If you made this change, no further action is required.",
    "If you did NOT change your password, please contact the hut immediately to secure your account.",
    "",
    "— Mountain Hut Team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;color:#1c1917;max-width:480px;margin:auto;padding:24px">
  <h2 style="color:#16a34a">Mountain Hut — Password Changed</h2>
  <p>Hi ${safeName},</p>
  <p>Your password has been changed successfully.</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:24px 0;color:#166534">
    <strong>Password updated successfully.</strong> You can now log in using your new credentials.
  </div>
  <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
  <p style="font-size:0.8em;color:#a8a29e">
    If you did not perform this change, please contact us immediately to protect your account.
  </p>
</body>
</html>`;

  return { text, html };
}

export function renderTemporaryAccountEmail(
  name: string,
  tempPassword: string,
  resetUrl: string,
): { text: string; html: string } {
  const safeName = esc(name);
  const safePassword = esc(tempPassword);
  const safeUrl = esc(resetUrl);

  const text = [
    `Hi ${name},`,
    "",
    "An account has been created for you at Mountain Hut.",
    `Your temporary password is: ${tempPassword}`,
    "",
    "For security reasons, you must change your temporary password before you can book tables or manage your reservations.",
    "Click the link below (valid for 24 hours):",
    "",
    resetUrl,
    "",
    "Once you set your new password, your account will be activated as a full Hiker account.",
    "",
    "— Mountain Hut Team",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="font-family:sans-serif;color:#1c1917;max-width:480px;margin:auto;padding:24px">
  <h2 style="color:#16a34a">Mountain Hut — Temporary Account Created</h2>
  <p>Hi ${safeName},</p>
  <p>An account has been created for you at Mountain Hut. You can log in using your temporary password:</p>
  <div style="background:#f5f5f4;border:1px solid #e7e5e4;border-radius:8px;padding:14px;margin:20px 0;font-family:monospace;font-size:1.25em;text-align:center;letter-spacing:1px;color:#1c1917">
    <strong>${safePassword}</strong>
  </div>
  <p>Before you can book tables or use your account online, you must set a permanent password. Click the button below:</p>
  <p style="text-align:center;margin:32px 0">
    <a href="${safeUrl}"
       style="background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
      Set your permanent password
    </a>
  </p>
  <p style="font-size:0.85em;color:#78716c">
    Or copy this link into your browser:<br/>
    <a href="${safeUrl}" style="color:#16a34a">${safeUrl}</a>
  </p>
  <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
  <p style="font-size:0.8em;color:#a8a29e">
    Once updated, your account will be automatically upgraded to a regular Hiker account.
  </p>
</body>
</html>`;

  return { text, html };
}
