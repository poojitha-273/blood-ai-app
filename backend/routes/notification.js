const express = require('express');
const supabase = require('../config/supabase');
const { authenticateToken } = require('../middleware/auth');
const {
  sendNotificationEmail,
  fetchResendEmails,
  notifyUserWithResend,
} = require('../services/emailService');

const readResendIds = new Set();

function sanitizeResendSubject(subject) {
  if (!subject) return 'LifeLink Notification';
  if (/\d{6}\s+is your LifeLink Authentication Token/i.test(subject)) {
    return '🔐 LifeLink Authentication Token Dispatched via Resend';
  }
  return subject;
}

function isAuthTokenSubject(subject) {
  return /\d{6}\s+is your LifeLink Authentication Token/i.test(subject || '');
}

const router = express.Router();

// Get notifications (Supabase + live Resend email notifications via RESEND_API_KEY)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const dbNotifications = (data || []).map((n) => ({
      ...n,
      source: 'supabase',
    }));

    const userEmail = (req.user?.email || '').toLowerCase();
    let resendDerived = [];
    const resendResult = await fetchResendEmails(30);
    if (resendResult.success) {
      resendDerived = resendResult.data
        .filter((email) => !isAuthTokenSubject(email.subject))
        .filter((email) => {
          const recipients = (email.to || []).map((r) => String(r).toLowerCase());
          return userEmail && recipients.includes(userEmail);
        })
        .filter((email) => {
          const normalizedSubject = email.subject.replace(/^🩸\s*/, '').trim().toLowerCase();
          return !dbNotifications.some(
            (n) => (n.title || '').trim().toLowerCase() === normalizedSubject
          );
        })
        .map((email) => ({
          id: `resend-${email.id}`,
          user_id: req.user.id,
          title: email.subject.replace(/^🩸\s*/, ''),
          message: `Dispatched via Resend (${email.last_event || 'sent'}) to ${email.to.join(', ')}`,
          type: 'resend_email',
          source: 'resend',
          delivery_status: email.last_event || 'sent',
          resend_id: email.id,
          is_read: readResendIds.has(`${req.user.id}:${email.id}`),
          created_at: email.created_at,
        }));
    }

    const merged = [...dbNotifications, ...resendDerived].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    res.json(merged);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    if (String(req.params.id).startsWith('resend-')) {
      const resendId = String(req.params.id).replace(/^resend-/, '');
      readResendIds.add(`${req.user.id}:${resendId}`);
      return res.json({ id: req.params.id, is_read: true });
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    if (error) throw error;

    const resendResult = await fetchResendEmails(30);
    if (resendResult.success) {
      for (const email of resendResult.data) {
        readResendIds.add(`${req.user.id}:${email.id}`);
      }
    }

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Retrieve all notification emails directly from Resend API (RESEND_API_KEY)
router.get('/resend', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 50);
    const result = await fetchResendEmails(limit);

    if (!result.success) {
      return res.status(502).json({
        error: result.message || 'Failed to fetch notifications from Resend API',
        emails: [],
      });
    }

    const sanitized = result.data.map((item) => ({
      ...item,
      subject: sanitizeResendSubject(item.subject),
      category: isAuthTokenSubject(item.subject) ? 'auth_token' : 'notification',
      is_read: readResendIds.has(`${req.user.id}:${item.id}`),
    }));

    res.json({
      source: 'resend_api',
      total: sanitized.length,
      emails: sanitized,
    });
  } catch (err) {
    console.error('Fetch Resend logs error:', err);
    res.status(500).json({ error: 'Server error fetching Resend emails' });
  }
});

// Send a notification email via Resend API and record it in notifications
router.post('/send-email', authenticateToken, async (req, res) => {
  try {
    const {
      toEmail,
      recipientName = '',
      recipientUserId = null,
      title,
      message,
      type = 'system_alert',
      actionUrl = '/dashboard',
      metadata = {},
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Notification title and message are required.' });
    }

    const targetEmail = (toEmail || req.user?.email || '').trim().toLowerCase();
    if (!targetEmail) {
      return res.status(400).json({ error: 'Target email address is required.' });
    }

    let targetUser = null;
    if (recipientUserId) {
      const { data } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('id', recipientUserId)
        .single();
      targetUser = data;
    } else {
      const { data } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('email', targetEmail)
        .single();
      targetUser = data;
    }

    const effectiveUser = targetUser || {
      id: targetEmail === (req.user?.email || '').toLowerCase() ? req.user.id : null,
      name: recipientName || req.user?.name || 'LifeLink User',
      email: targetEmail,
    };

    const { dbInserted, emailResult } = await notifyUserWithResend({
      supabase,
      user: effectiveUser,
      title,
      message,
      type,
      actionUrl,
      metadata: {
        Sender: req.user?.name || req.user?.email || 'LifeLink Portal',
        ...metadata,
      },
    });

    if (!emailResult?.success) {
      return res.status(emailResult?.statusCode || 400).json({
        error: emailResult?.message || 'Could not deliver notification email.',
        deliveryStatus: emailResult?.deliveryStatus || 'failed',
        dbInserted,
      });
    }

    const providerLabel = emailResult.provider === 'smtp' ? 'SMTP' : 'Resend';
    res.status(201).json({
      message: `Notification email delivered to ${targetEmail} via ${providerLabel}.`,
      resendId: emailResult.id,
      deliveryStatus: emailResult.deliveryStatus,
      provider: emailResult.provider || 'resend',
      dbInserted,
    });
  } catch (err) {
    console.error('Send Resend notification error:', err);
    res.status(500).json({ error: 'Server error dispatching Resend notification' });
  }
});

module.exports = router;
