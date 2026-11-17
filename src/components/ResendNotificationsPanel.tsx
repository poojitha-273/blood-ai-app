import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Mail,
  RefreshCw,
  Send,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type?: string;
  source?: 'supabase' | 'resend';
  delivery_status?: string;
  is_read?: boolean;
  created_at?: string;
}

interface ResendLogItem {
  id: string;
  to: string[];
  from: string;
  subject: string;
  created_at: string;
  last_event: string;
  category?: string;
  is_read?: boolean;
}

interface ResendNotificationsPanelProps {
  portalTitle: string;
  portalSubtitle?: string;
  defaultCategory?: string;
}

const EVENT_STYLES: Record<string, string> = {
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  opened: 'bg-blue-50 text-blue-700 border-blue-200',
  clicked: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  sent: 'bg-amber-50 text-amber-700 border-amber-200',
  bounced: 'bg-red-50 text-red-700 border-red-200',
  delivery_delayed: 'bg-orange-50 text-orange-700 border-orange-200',
};

export const ResendNotificationsPanel: React.FC<ResendNotificationsPanelProps> = ({
  portalTitle,
  portalSubtitle = 'Real-time portal alerts & email delivery tracking via Resend API',
  defaultCategory = 'system_alert',
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'inbox' | 'resend'>('inbox');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [resendLogs, setResendLogs] = useState<ResendLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendError, setResendError] = useState('');

  // Dispatch notification state
  const [toEmail, setToEmail] = useState(user?.email || '');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user?.email && !toEmail) {
      setToEmail(user.email);
    }
  }, [user?.email, toEmail]);

  const loadNotifications = async () => {
    setLoading(true);
    setResendError('');
    try {
      const [inboxRes, resendRes] = await Promise.allSettled([
        notificationAPI.getAll(),
        notificationAPI.getResendLogs(30),
      ]);

      if (inboxRes.status === 'fulfilled') {
        const items = Array.isArray(inboxRes.value) ? inboxRes.value : [];
        setNotifications(items);
      }

      if (resendRes.status === 'fulfilled') {
        const payload = resendRes.value as any;
        setResendLogs(Array.isArray(payload?.emails) ? payload.emails : []);
      } else {
        setResendError(
          (resendRes.reason as Error)?.message || 'Unable to retrieve Resend API email feed.'
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
      );
    } catch (err: any) {
      toast.error(err?.message || 'Could not mark notification as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (err: any) {
      toast.error(err?.message || 'Could not update notifications');
    }
  };

  const handleSendEmailNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail.trim() || !title.trim() || !message.trim()) {
      toast.error('Please enter recipient email, subject title, and alert message.');
      return;
    }

    setSending(true);
    try {
      const res = (await notificationAPI.sendEmailNotification({
        toEmail: toEmail.trim(),
        recipientName: user?.name || '',
        title: title.trim(),
        message: message.trim(),
        type: category,
      })) as any;

      toast.success(res?.message || `Notification delivered to ${toEmail.trim()} via Resend`);
      setTitle('');
      setMessage('');
      await loadNotifications();
    } catch (err: any) {
      toast.error(err?.message || 'Resend rejected email notification');
    } finally {
      setSending(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">{portalTitle}</h2>
          <p className="text-xs text-gray-500 mt-1">{portalSubtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadNotifications}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Resend Feed
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#B71C1C] hover:bg-red-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark All Read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Send Live Notification via Resend */}
      <form
        onSubmit={handleSendEmailNotification}
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-[#B71C1C] flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Dispatch Email Notification via Resend</h3>
              <p className="text-[11px] text-gray-500">
                Sends live transactional alerts using server RESEND_API_KEY and syncs notification logs
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
            Resend API Connected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Recipient Email</label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/30"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Alert Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Urgent O- Inventory Notice"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/30"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/30"
            >
              <option value="emergency_request">Emergency Blood Request</option>
              <option value="donor_alert">Donor Alert</option>
              <option value="status_update">Dispatch / Request Update</option>
              <option value="inventory_alert">Inventory / Expiry Alert</option>
              <option value="system_alert">System Notification</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write alert details to deliver via Resend..."
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/30"
            required
          />
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#B71C1C] hover:bg-red-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {sending ? 'Sending...' : 'Send via Resend'}
          </button>
        </div>
      </form>

      {/* Tabs: Portal Inbox vs Live Resend API Feed */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('inbox')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'inbox'
              ? 'bg-[#B71C1C] text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Portal & Email Inbox ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('resend')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'resend'
              ? 'bg-[#B71C1C] text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Resend Delivery Feed ({resendLogs.length})
        </button>
      </div>

      {resendError && activeTab === 'resend' && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{resendError}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 flex items-center justify-center gap-2 text-xs font-semibold text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin text-[#B71C1C]" />
          Fetching notifications and Resend API delivery statuses...
        </div>
      ) : activeTab === 'inbox' ? (
        notifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center space-y-2">
            <Bell className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-700">No portal notifications for {user?.email || 'your account'} yet</p>
            <p className="text-xs text-gray-500">
              Send an email alert above or switch to the Resend Delivery Feed tab to inspect all emails dispatched via Resend.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`bg-white rounded-2xl p-5 shadow-sm border flex items-start gap-4 transition-colors ${
                  n.is_read ? 'border-gray-100' : 'border-red-200 bg-red-50/20'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 text-[#B71C1C] flex items-center justify-center flex-shrink-0">
                  {n.source === 'resend' ? <Mail className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-gray-900 text-sm">{n.title}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                        {n.source === 'resend' ? 'Resend Email' : 'Portal + Resend'}
                      </span>
                      {n.delivery_status && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            EVENT_STYLES[n.delivery_status] || 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {n.delivery_status}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {n.created_at ? new Date(n.created_at).toLocaleString() : 'Just now'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{n.message}</p>
                </div>
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n.id)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      ) : resendLogs.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center space-y-2">
          <Mail className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="text-sm font-bold text-gray-700">No Resend emails returned yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resendLogs.map((email) => (
            <div
              key={email.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#B71C1C] flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-gray-900 text-sm">{email.subject}</h4>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${
                        EVENT_STYLES[email.last_event] || 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {email.last_event}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {new Date(email.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  To: <span className="font-semibold text-gray-800">{email.to.join(', ')}</span> • From: {email.from}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
