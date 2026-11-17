import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Droplets, Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ServerConnectionBadge } from '../components/ServerSettingsModal';
import toast from 'react-hot-toast';

const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success('Sign in successful! Welcome to LifeLink.');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = (role: string) => {
    const demoAccounts: Record<string, { email: string; password: string }> = {
      hospital: { email: 'hospital@demo.com', password: 'demo123' },
      donor: { email: 'donor@demo.com', password: 'demo123' },
    };

    const account = demoAccounts[role];
    if (account) {
      setEmail(account.email);
      setPassword(account.password);
      setError('');
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center px-4 py-8 sm:p-6">
      <div className="w-full max-w-md mx-auto">
        {/* Logo Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center gap-3 group">
            <div className="w-12 h-12 bg-[#B71C1C] rounded-2xl flex items-center justify-center shadow-lg shadow-red-200 transition-transform group-hover:scale-105">
              <Droplets className="w-7 h-7 text-white" aria-hidden="true" />
            </div>
            <span className="text-3xl font-black text-gray-900 tracking-tight">
              Life<span className="text-[#B71C1C]">Link</span>
            </span>
          </Link>
          <p className="text-xs text-gray-500 font-semibold mt-2 tracking-wide">
            Smart Healthcare Blood Management
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-red-100/40 p-6 sm:p-8 border border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">Sign In</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Access your hospital or donor account</p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-[#B71C1C] rounded-full text-xs font-bold border border-red-100 whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> Secure Auth
            </span>
          </div>

          {error && (
            <div role="alert" aria-live="polite" className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Simple Clean Form: Email + Password */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-bold text-gray-700">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/30 focus:border-[#B71C1C] transition-all font-medium bg-white"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-bold text-gray-700">
                  Password
                </label>
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[48px] pl-10 pr-11 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/30 focus:border-[#B71C1C] transition-all font-medium bg-white"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] px-4 py-3 bg-[#B71C1C] hover:bg-[#991B1B] text-white rounded-xl font-bold transition-all shadow-md shadow-red-200/70 disabled:opacity-50 text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Demo Accounts Bar */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Quick Demo Accounts
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => demoLogin('hospital')}
                className="px-4 py-2.5 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-[#B71C1C] rounded-xl text-xs font-bold transition-colors border border-gray-100 flex items-center justify-center gap-1.5"
              >
                Hospital Demo
              </button>
              <button
                type="button"
                onClick={() => demoLogin('donor')}
                className="px-4 py-2.5 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-[#B71C1C] rounded-xl text-xs font-bold transition-colors border border-gray-100 flex items-center justify-center gap-1.5"
              >
                Donor Demo
              </button>
            </div>
          </div>

          {/* Footer Register Link */}
          <div className="mt-6 text-center text-xs text-gray-500">
            Don't have an account yet?{' '}
            <Link to="/register" className="font-bold text-[#B71C1C] hover:underline">
              Create an Account
            </Link>
          </div>

          {/* Server Connection Indicator */}
          <div className="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span className="text-[11px] font-medium text-gray-400">Server Host:</span>
            <ServerConnectionBadge />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
