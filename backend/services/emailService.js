const nodemailer = require('nodemailer');

const FALLBACK_RESEND_KEY = '';
const smtpDispatchLogs = [];

function getResendApiKey() {
  return (process.env.RESEND_API_KEY || FALLBACK_RESEND_KEY || '').trim();
}

function getResendFromAddress() {
  return (process.env.RESEND_FROM_EMAIL || '').trim() || 'LifeLink Blood AI <onboarding@resend.dev>';
}

function getSmtpConfig() {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  if (!user || !pass) return null;

  const port = Number(process.env.SMTP_PORT) || 465;
  const host = (process.env.SMTP_HOST || '').trim() || 'smtp.gmail.com';
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  const from = (process.env.SMTP_FROM || '').trim() || `LifeLink Blood AI <${user}>`;
  return { host, port, secure, user, pass, from };
}

function getEmailProviderStatus() {
  return {
    resendConfigured: Boolean(getResendApiKey()),
    resendCustomFrom: Boolean((process.env.RESEND_FROM_EMAIL || '').trim()),
    smtpConfigured: Boolean(getSmtpConfig()),
  };
}

/**
 * Record an SMTP email dispatch in memory so notification logs display both Resend and SMTP dispatches.
 */
function recordSmtpLog({ id, to, from, subject }) {
  smtpDispatchLogs.unshift({
    id: id || `smtp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    to: Array.isArray(to) ? to : [to],
    from,
    subject,
    created_at: new Date().toISOString(),
    last_event: 'delivered',
    provider: 'smtp',
  });
  if (smtpDispatchLogs.length > 100) {
    smtpDispatchLogs.length = 100;
  }
}

/**
 * Send an email via configured SMTP transport (e.g. Gmail App Password / custom SMTP relay).
 */
async function sendViaSmtp({ toEmail, subject, html }) {
  const cfg = getSmtpConfig();
  if (!cfg) {
    return {
      success: false,
      deliveryStatus: 'smtp_unconfigured',
      statusCode: 403,
      message: 'SMTP credentials (SMTP_USER / SMTP_PASS) are not configured.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
    });

    const info = await transporter.sendMail({
      from: cfg.from,
      to: toEmail,
      subject,
      html,
    });

    const messageId = info?.messageId || null;
    recordSmtpLog({ id: messageId, to: toEmail, from: cfg.from, subject });
    console.log(`[SMTP Email Success]: Delivered to ${toEmail}. Message ID: ${messageId}`);

    return {
      success: true,
      deliveryStatus: 'delivered',
      provider: 'smtp',
      id: messageId,
      to: toEmail,
      subject,
    };
  } catch (err) {
    console.error('[SMTP Email Error]:', err?.message || err);
    return {
      success: false,
      deliveryStatus: 'failed',
      provider: 'smtp',
      statusCode: 502,
      message: err?.message || 'SMTP transport failed to deliver email.',
    };
  }
}

/**
 * Dispatch an email via Resend first; fall back to configured SMTP transport when Resend rejects unverified recipients.
 */
async function dispatchEmail({ toEmail, subject, html }) {
  const resendKey = getResendApiKey();
  let resendErrorMsg = 'RESEND_API_KEY is missing.';
  let resendStatus = 500;

  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: getResendFromAddress(),
          to: toEmail,
          subject,
          html,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`[Resend Email Success]: Delivered to ${toEmail}. Resend Email ID: ${data?.id}`);
        return {
          success: true,
          deliveryStatus: 'delivered',
          provider: 'resend',
          id: data?.id || null,
          to: toEmail,
          subject,
        };
      }

      resendStatus = res.status;
      resendErrorMsg = data?.message || data?.error || `Resend returned HTTP ${res.status}`;
      console.warn(`[Resend Email Notice]: ${resendErrorMsg}`);
    } catch (err) {
      resendStatus = 502;
      resendErrorMsg = err?.message || 'Network failure reaching Resend API';
      console.error('[Resend Email Exception]:', resendErrorMsg);
    }
  }

  // Fallback to SMTP transport when configured so any external email address receives mail
  if (getSmtpConfig()) {
    const smtpResult = await sendViaSmtp({ toEmail, subject, html });
    if (smtpResult.success) {
      return smtpResult;
    }
    return {
      success: false,
      deliveryStatus: 'failed',
      statusCode: smtpResult.statusCode || 502,
      message: `Resend rejected recipient (${resendErrorMsg}); SMTP fallback also failed (${smtpResult.message}).`,
    };
  }

  return {
    success: false,
    deliveryStatus: 'restricted_to_registered_domain',
    statusCode: resendStatus,
    needsSmtpCredentials: true,
    message: `${resendErrorMsg} Configure SMTP_USER and SMTP_PASS (e.g., Gmail App Password) in server/.env or verify a domain at resend.com/domains to send to any email address.`,
  };
}

function normalizeBaseUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, '');
  return `https://${trimmed}`.replace(/\/+$/, '');
}

function getAppBaseUrl(overrideUrl) {
  const vercelHost =
    process.env.VERCEL_ENV === 'production'
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
      : process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;

  const candidate =
    overrideUrl ||
    process.env.CLIENT_URL ||
    process.env.APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    vercelHost ||
    `http://localhost:${process.env.PORT || 5000}`;
  return normalizeBaseUrl(candidate);
}

/**
 * Send an authentication token via Resend Email API or SMTP
 * @param {string} toEmail - Recipient email address
 * @param {string} token - 6-digit verification token
 * @param {string} role - User role (hospital, blood_bank, donor)
 * @param {string} [name] - User or organization name
 * @param {string} [baseUrl] - Optional public request origin for login link
 */
async function sendAuthTokenEmail(toEmail, token, role = 'user', name = '', baseUrl = '') {
  const roleLabels = {
    hospital: 'Hospital Command',
    blood_bank: 'Blood Bank Facility',
    donor: 'Volunteer Blood Donor',
  };
  const roleName = roleLabels[role] || 'LifeLink Healthcare';

  const loginLink = `${getAppBaseUrl(baseUrl)}/login?email=${encodeURIComponent(toEmail)}&token=${encodeURIComponent(token)}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>LifeLink Authentication Token</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F5F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F5F5F5; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #ECECEC;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #B71C1C 0%, #7F0000 100%); padding: 32px 30px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(255,255,255,0.15); width: 48px; height: 48px; line-height: 48px; border-radius: 12px; font-size: 24px; margin-bottom: 12px;">
                🩸
              </div>
              <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Life<span style="color: #FFCDD2;">Link</span></h1>
              <p style="margin: 6px 0 0; color: #FFCDD2; font-size: 13px; font-weight: 500;">Blood AI &ndash; Smart Blood Management System</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 30px;">
              <h2 style="margin: 0 0 10px; color: #1F2937; font-size: 18px; font-weight: 700;">
                Your Secure Authentication Token
              </h2>
              <p style="margin: 0 0 24px; color: #4B5563; font-size: 14px; line-height: 1.6;">
                Hello${name ? ' ' + name : ''}, an authentication request was initiated for your <strong>${roleName}</strong> account associated with <span style="color: #B71C1C; font-weight: 600;">${toEmail}</span>.
              </p>

              <!-- Token Box -->
              <div style="background-color: #FEF2F2; border: 2px dashed #B71C1C; border-radius: 16px; padding: 24px 20px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px; color: #991B1B; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">
                  One-Time Verification Passcode
                </p>
                <div style="font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 38px; font-weight: 900; color: #B71C1C; letter-spacing: 8px;">
                  ${token}
                </div>
                <p style="margin: 10px 0 0; color: #6B7280; font-size: 12px;">
                  ⏱ Valid for <strong>10 minutes</strong>. Do not share this code with anyone.
                </p>
              </div>

              <!-- One click link -->
              <div style="text-align: center; margin: 30px 0 10px;">
                <a href="${loginLink}" style="display: inline-block; background-color: #B71C1C; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 10px rgba(183, 28, 28, 0.25);">
                  Sign In Directly With One Click &rarr;
                </a>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #F3F4F6; color: #9CA3AF; font-size: 12px; line-height: 1.5;">
                <p style="margin: 0;">If you did not request this email, you can safely ignore it. Your account remains protected.</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px 30px; text-align: center; border-top: 1px solid #ECECEC;">
              <p style="margin: 0; color: #9CA3AF; font-size: 11px;">
                &copy; ${new Date().getFullYear()} LifeLink Blood AI &bull; Healthcare Emergency Transfusion Network
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const subject = `🩸 ${token} is your LifeLink Authentication Token`;
  return dispatchEmail({
    toEmail,
    subject,
    html: htmlContent,
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CATEGORY_BADGES = {
  emergency_request: { label: 'EMERGENCY BLOOD REQUEST', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  donor_alert: { label: 'URGENT DONOR ALERT', bg: '#fff1f2', color: '#be123c', border: '#fda4af' },
  donor_accepted: { label: 'DONOR RESPONSE CONFIRMED', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  status_update: { label: 'REQUEST STATUS UPDATE', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  inventory_alert: { label: 'INVENTORY EXPIRY / STOCK ALERT', bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  system_alert: { label: 'LIFELINK NOTIFICATION', bg: '#f8fafc', color: '#334155', border: '#cbd5e1' },
};

/**
 * Send a transactional notification email via Resend API.
 */
async function sendNotificationEmail({
  toEmail,
  recipientName = '',
  title,
  message,
  category = 'system_alert',
  actionUrl = '',
  actionLabel = 'Open LifeLink Portal',
  metadata = {},
}) {
  const resendKey = getResendApiKey();
  if (!resendKey && !getSmtpConfig()) {
    return {
      success: false,
      deliveryStatus: 'missing_key',
      statusCode: 500,
      message: 'Neither RESEND_API_KEY nor SMTP credentials are configured on the server.',
    };
  }

  if (!toEmail || !String(toEmail).includes('@')) {
    return {
      success: false,
      deliveryStatus: 'invalid_email',
      statusCode: 400,
      message: 'Valid recipient email address is required.',
    };
  }

  const badge = CATEGORY_BADGES[category] || CATEGORY_BADGES.system_alert;
  const clientBaseUrl = getAppBaseUrl();
  const resolvedUrl = actionUrl
    ? (actionUrl.startsWith('http') ? actionUrl : `${clientBaseUrl}${actionUrl}`)
    : `${clientBaseUrl}/dashboard`;

  const metadataRows = Object.entries(metadata || {})
    .filter(([, val]) => val !== undefined && val !== null && String(val).trim() !== '')
    .map(
      ([key, val]) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px; font-weight: 600;">${escapeHtml(key)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-size: 13px; font-weight: 700;">${escapeHtml(val)}</td>
        </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:32px auto;padding:0 16px;">
    <div style="background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
      <div style="background:linear-gradient(135deg,#e11d48 0%,#be123c 100%);padding:24px 28px;color:#ffffff;">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">LifeLink Blood AI • Resend Alert</div>
        <h1 style="margin:8px 0 0 0;font-size:20px;line-height:1.3;font-weight:800;">${escapeHtml(title)}</h1>
      </div>
      <div style="padding:28px;">
        <span style="display:inline-block;padding:5px 12px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.04em;background:${badge.bg};color:${badge.color};border:1px solid ${badge.border};">
          ${badge.label}
        </span>
        ${recipientName ? `<p style="margin:18px 0 6px 0;font-size:14px;color:#475569;">Hello <strong style="color:#0f172a;">${escapeHtml(recipientName)}</strong>,</p>` : '<div style="height:14px;"></div>'}
        <p style="margin:6px 0 18px 0;font-size:15px;line-height:1.6;color:#1e293b;">${escapeHtml(message)}</p>
        ${metadataRows ? `<table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;overflow:hidden;margin-bottom:22px;border:1px solid #e2e8f0;">${metadataRows}</table>` : ''}
        <a href="${escapeHtml(resolvedUrl)}" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:12px;">
          ${escapeHtml(actionLabel)}
        </a>
        <p style="margin:24px 0 0 0;padding-top:16px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;">
          Dispatched automatically by LifeLink Blood AI via Resend API.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();

  return dispatchEmail({
    toEmail,
    subject: `🩸 ${title}`,
    html,
  });
}

/**
 * Retrieve sent email notifications and delivery statuses from Resend API (merged with SMTP fallback dispatches).
 */
async function fetchResendEmails(limit = 30) {
  const resendKey = getResendApiKey();
  let resendEmails = [];
  let resendError = null;

  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
        },
      });

      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        resendEmails = (Array.isArray(payload?.data) ? payload.data : []).map((item) => ({
          id: item.id,
          to: Array.isArray(item.to) ? item.to : [item.to].filter(Boolean),
          from: item.from,
          subject: item.subject,
          created_at: item.created_at,
          last_event: item.last_event || 'sent',
          provider: 'resend',
        }));
      } else {
        resendError = payload?.message || `Resend returned HTTP ${res.status}`;
      }
    } catch (err) {
      resendError = err?.message || 'Failed to query Resend emails endpoint';
    }
  } else {
    resendError = 'RESEND_API_KEY is not configured.';
  }

  const combined = [...smtpDispatchLogs, ...resendEmails]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, limit);

  if (combined.length === 0 && resendError && !getSmtpConfig()) {
    return {
      success: false,
      data: [],
      message: resendError,
    };
  }

  return {
    success: true,
    data: combined,
  };
}

/**
 * Persist a notification record in Supabase and dispatch it via Resend email when an email is available.
 */
async function notifyUserWithResend({
  supabase,
  user,
  title,
  message,
  type = 'system_alert',
  referenceId = null,
  actionUrl = '',
  actionLabel = 'Open LifeLink Portal',
  metadata = {},
}) {
  let dbInserted = false;
  if (supabase && user?.id) {
    const row = {
      user_id: user.id,
      title,
      message,
      type,
      is_read: false,
    };
    if (referenceId) {
      row.reference_id = referenceId;
    }
    const { error } = await supabase.from('notifications').insert(row);
    if (!error) {
      dbInserted = true;
    } else {
      console.error('Supabase notification insert error:', error.message);
    }
  }

  let emailResult = null;
  if (user?.email) {
    emailResult = await sendNotificationEmail({
      toEmail: user.email,
      recipientName: user.name || '',
      title,
      message,
      category: type,
      actionUrl,
      actionLabel,
      metadata,
    });
  }

  return { dbInserted, emailResult };
}

module.exports = {
  sendAuthTokenEmail,
  sendNotificationEmail,
  fetchResendEmails,
  notifyUserWithResend,
  getEmailProviderStatus,
  getAppBaseUrl,
};
