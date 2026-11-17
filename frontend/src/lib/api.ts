// Blood AI - API Client with Dynamic Host & Platform Resolution
// Automatically resolves the proper backend for Android physical devices, emulators, and local web browsers.

const DEFAULT_LAN_API = 'http://192.168.1.13:5000/api';
const DEFAULT_EMULATOR_API = 'http://10.0.2.2:5000/api';
const DEFAULT_BROWSER_API = '/api';

export function getApiBaseUrl(): string {
  // 1. User manual override (stored in localStorage)
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('bloodai_api_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }

  // 2. Vite environment variable
  const envUrl = (import.meta.env.VITE_API_URL as string)?.trim();
  if (envUrl && !envUrl.includes('blood-ai-mocha.vercel.app')) {
    return envUrl.replace(/\/+$/, '');
  }

  // 3. Runtime environment detection:
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const isCapacitor = (window as any).Capacitor !== undefined || protocol === 'capacitor:' || protocol === 'ionic:';

    // If running in a browser on localhost / 127.0.0.1
    if (!isCapacitor && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return DEFAULT_BROWSER_API;
    }

    // If running in a browser on LAN IP
    if (!isCapacitor && (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.'))) {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${protocol}//${hostname}${port}/api`;
    }

    // If running on Android Capacitor:
    // Default to laptop LAN IP, emulator fallback
    return DEFAULT_LAN_API;
  }

  return DEFAULT_LAN_API;
}

export function setCustomApiUrl(url: string) {
  if (typeof window !== 'undefined') {
    const cleaned = url.trim().replace(/\/+$/, '');
    localStorage.setItem('bloodai_api_url', cleaned);
    window.dispatchEvent(new CustomEvent('bloodai_api_changed', { detail: cleaned }));
  }
}

export function resetApiUrl() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('bloodai_api_url');
    window.dispatchEvent(new CustomEvent('bloodai_api_changed', { detail: getApiBaseUrl() }));
  }
}

export async function testApiConnection(testUrl?: string): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  const targetBase = testUrl ? testUrl.trim().replace(/\/+$/, '') : getApiBaseUrl();
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${targetBase}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, message: `Connected (${latencyMs}ms)`, latencyMs };
    }
    return { ok: false, message: `Server returned HTTP ${res.status}` };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, message: 'Connection timed out (4s)' };
    }
    return { ok: false, message: err?.message || 'Server unreachable' };
  }
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

let activeFallbackUrl: string | null = null;

async function apiCall<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const token = localStorage.getItem('token');
  
  const config: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  let baseUrl = activeFallbackUrl || getApiBaseUrl();
  let fullUrl = `${baseUrl}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(fullUrl, config);
  } catch (networkErr: any) {
    // If the primary URL failed with a network error, attempt smart fallback for emulator / LAN
    console.warn(`[API] Failed to reach ${fullUrl}:`, networkErr?.message || networkErr);

    const candidates = [DEFAULT_LAN_API, DEFAULT_EMULATOR_API, DEFAULT_BROWSER_API, 'http://localhost:5000/api'];
    let fallbackWorked = false;

    for (const cand of candidates) {
      if (cand === baseUrl) continue;
      try {
        const testRes = await fetch(`${cand}/health`, { method: 'GET' });
        if (testRes.ok) {
          console.log(`[API] Switched active API base to fallback: ${cand}`);
          activeFallbackUrl = cand;
          baseUrl = cand;
          fullUrl = `${cand}${endpoint}`;
          response = await fetch(fullUrl, config);
          fallbackWorked = true;
          break;
        }
      } catch {
        // Try next candidate
      }
    }

    if (!fallbackWorked) {
      throw new Error(`Cannot connect to Blood AI server at ${baseUrl}. Ensure backend server is running on port 5000 and phone is on the same Wi-Fi.`);
    }
  }

  if (!response!.ok) {
    const errorData = await response!.json().catch(() => ({ error: 'Request failed' }));
    const msg = errorData.error || (errorData.errors ? Object.values(errorData.errors)[0] : `Request failed with HTTP ${response!.status}`);
    const err = new Error(String(msg)) as any;
    if (errorData.errors) err.errors = errorData.errors;
    throw err;
  }

  return response!.json();
}

export interface RegisteredDonor {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  blood_group: string;
  latitude: number | null;
  longitude: number | null;
  hasLocation: boolean;
  locationSource: 'gps' | 'address' | 'none';
  reward_points: number;
  is_verified: boolean;
  created_at: string;
  distanceKm: number | null;
}

export interface RegisteredDonorsResponse {
  totalRegistered: number;
  withLocationCount: number;
  withoutLocationCount: number;
  donors: RegisteredDonor[];
}

// Auth API
export const authAPI = {
  register: (data: Record<string, unknown>) => apiCall('/auth/register', { method: 'POST', body: data }),
  login: (data: { email: string; password: string }) => apiCall('/auth/login', { method: 'POST', body: data }),
  sendToken: (email: string, role?: string) =>
    apiCall<{ message: string; email: string; deliveryStatus: string; provider?: 'resend' | 'smtp'; resendId?: string | null }>('/auth/send-token', {
      method: 'POST',
      body: { email, role },
    }),
  verifyToken: (email: string, token: string) => apiCall<{ message: string; token: string; user: any }>('/auth/verify-token', { method: 'POST', body: { email, token } }),
  getProfile: () => apiCall('/auth/profile'),
  updateLocation: (latitude: number, longitude: number, city?: string, state?: string) =>
    apiCall('/auth/location', { method: 'PATCH', body: { latitude, longitude, city, state } }),
  geocode: (query: string) =>
    apiCall<Array<{ label: string; fullName: string; city: string; state: string; lat: number; lng: number }>>(
      `/auth/geocode?q=${encodeURIComponent(query)}`
    ),
  reverseGeocode: (lat: number, lng: number) =>
    apiCall<{ label: string; city: string; state: string; lat: number; lng: number }>(
      `/auth/reverse-geocode?lat=${lat}&lng=${lng}`
    ),
};

// Hospital API
export const hospitalAPI = {
  getDashboard: () => apiCall('/hospital/dashboard'),
  getRegisteredDonors: (params?: { lat?: number; lng?: number; bloodGroup?: string }) => {
    const qs = new URLSearchParams();
    if (params?.lat !== undefined && params?.lng !== undefined) {
      qs.set('lat', String(params.lat));
      qs.set('lng', String(params.lng));
    }
    if (params?.bloodGroup) qs.set('bloodGroup', params.bloodGroup);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiCall<RegisteredDonorsResponse>(`/hospital/registered-donors${suffix}`);
  },
  getDonorResponses: () => apiCall<any[]>('/hospital/donor-responses'),
  getDonorHealthReport: (donorId: string) => apiCall<any>(`/hospital/donor-health-report/${donorId}`),
  markDonorReached: (responseId: string) =>
    apiCall<any>(`/hospital/donor-responses/${responseId}/reached`, { method: 'POST' }),
  recordScreening: (responseId: string, data: Record<string, unknown>) =>
    apiCall<any>(`/hospital/donor-responses/${responseId}/screening`, { method: 'POST', body: data }),
  updateDonationStage: (responseId: string, data: { action: 'start' | 'complete'; donation_type?: string; units_collected?: number }) =>
    apiCall<any>(`/hospital/donor-responses/${responseId}/donation`, { method: 'POST', body: data }),
  verifyDonation: (responseId: string, data: { units_verified?: number; donation_type?: string; points_to_award?: number; notes?: string }) =>
    apiCall<any>(`/hospital/donor-responses/${responseId}/verify`, { method: 'POST', body: data }),
};

// Blood Request API
export const bloodRequestAPI = {
  create: (data: Record<string, unknown>) => apiCall('/blood-requests', { method: 'POST', body: data }),
  getAll: () => apiCall<any[]>('/blood-requests'),
  getDonorRequests: () => apiCall<any[]>('/blood-requests/donor-requests'),
  update: (id: string, data: Record<string, unknown>) => apiCall(`/blood-requests/${id}`, { method: 'PATCH', body: data }),
  respond: (id: string, action: string) => apiCall(`/blood-requests/${id}/respond`, { method: 'POST', body: { action } }),
  predictDemand: () => apiCall('/blood-requests/predict-demand'),
};

// Notification API
export const notificationAPI = {
  getAll: () => apiCall<any[]>('/notifications'),
  getResendLogs: (limit = 30) => apiCall<{ source: string; total: number; emails: any[] }>(`/notifications/resend?limit=${limit}`),
  sendEmailNotification: (data: {
    toEmail: string;
    recipientName?: string;
    title: string;
    message: string;
    type?: string;
    actionUrl?: string;
  }) => apiCall('/notifications/send-email', { method: 'POST', body: data }),
  markRead: (id: string) => apiCall(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => apiCall('/notifications/read-all', { method: 'PATCH' }),
};

// Donor API
export const donorAPI = {
  getDashboard: () => apiCall<any>('/donor/dashboard'),
  updateProfile: (data: Record<string, unknown>) => apiCall<any>('/donor/profile', { method: 'PATCH', body: data }),
  getDonations: () => apiCall<any[]>('/donor/donations'),
  getResponses: () => apiCall<any[]>('/donor/responses'),
  getHealthProfile: () => apiCall<any>('/donor/health-profile'),
  saveHealthProfile: (data: Record<string, unknown>) => apiCall<any>('/donor/health-profile', { method: 'POST', body: data }),
  getHealthReport: () => apiCall<any>('/donor/health-report'),
};
