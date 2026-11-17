import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, User, Heart, Bell, LogOut, Menu,
  Award, Droplets, Clock, Calendar, CheckCircle, Star,
  Shield, AlertTriangle, FileText, Check, X as XIcon,
  RefreshCw, ChevronRight, Sparkles, Info, Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { donorAPI, bloodRequestAPI, authAPI } from '../../lib/api';
import { ResendNotificationsPanel } from '../../components/ResendNotificationsPanel';
import { ServerConnectionBadge } from '../../components/ServerSettingsModal';
import toast from 'react-hot-toast';

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/donor', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { path: '/donor/health-profile', icon: Heart, label: 'My Health Profile & Eligibility' },
    { path: '/donor/profile', icon: User, label: 'Profile & Verification' },
    { path: '/donor/emergency', icon: AlertTriangle, label: 'Nearby Emergency Needs' },
    { path: '/donor/history', icon: FileText, label: 'Donation History' },
    { path: '/donor/rewards', icon: Award, label: 'Rewards & Badges' },
    { path: '/donor/notifications', icon: Bell, label: 'Alerts & Reminders' },
  ];

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname === path || (path !== '/donor' && location.pathname.startsWith(path));
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Brand */}
          <div className="p-6 border-b border-gray-100">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#B71C1C] rounded-xl flex items-center justify-center shadow-md shadow-red-200">
                <Droplets className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 tracking-tight">Life<span className="text-[#B71C1C]">Link</span></h1>
                <p className="text-xs text-gray-500 font-medium">Donor Portal</p>
              </div>
            </Link>
          </div>

          {/* Donor Profile Header Card */}
          <div className="p-4 mx-4 mt-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-100 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#B71C1C] rounded-xl flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0">
                <Heart className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'Blood Donor'}</p>
                <p className="text-xs text-[#B71C1C] font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                  {user?.blood_group ? `Group: ${user.blood_group}` : 'Group: Not Set'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
            {menuItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                  isActive(item.path, item.exact)
                    ? 'bg-[#B71C1C] text-white shadow-lg shadow-red-200'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Sign Out */}
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-red-50 hover:text-[#B71C1C] transition-all w-full text-sm font-medium"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

// ─── Dashboard Overview ────────────────────────────────────────────────────────
const DashboardOverview: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responsesMap, setResponsesMap] = useState<Record<string, string>>({});

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await donorAPI.getDashboard();
      setData(d);
      if (d.responses && Array.isArray(d.responses)) {
        const rMap: Record<string, string> = {};
        d.responses.forEach((r: any) => {
          if (r.blood_request_id) {
            rMap[r.blood_request_id] = r.action || 'responded';
          }
        });
        setResponsesMap(rMap);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load donor dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleAccept = async (req: any) => {
    if (respondingId) return;

    // CLINICAL BUSINESS RULE: Prevent repeated donation within mandatory rest interval
    if (data?.next_eligible_date && new Date(data.next_eligible_date) > new Date()) {
      const d = new Date(data.next_eligible_date);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const formattedDate = `${dd}/${mm}/${yyyy}`;
      toast.error(
        `You are currently not eligible to donate blood because your previous donation was recent. Your next estimated eligible donation date is ${formattedDate}.`,
        { duration: 7000 }
      );
      return;
    }

    setRespondingId(req.id);
    try {
      await bloodRequestAPI.respond(req.id, 'accept');
      setResponsesMap(prev => ({ ...prev, [req.id]: 'accept' }));
      toast.success(`You accepted the request from ${req.hospital_name || 'the hospital'}. The hospital has been notified.`);
      loadDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept request');
    } finally {
      setRespondingId(null);
    }
  };

  const handleDecline = async (req: any) => {
    if (respondingId) return;
    setRespondingId(req.id);
    try {
      await bloodRequestAPI.respond(req.id, 'decline');
      setResponsesMap(prev => ({ ...prev, [req.id]: 'reject' }));
      toast('Request declined. The hospital has been notified.', { icon: 'ℹ️' });
      loadDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline request');
    } finally {
      setRespondingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-200 border-t-[#B71C1C]" />
        <p className="text-gray-500 font-medium text-sm">Loading donor dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-[#B71C1C]" />
        </div>
        <div>
          <p className="text-gray-900 font-bold text-lg">Unable to Load Dashboard</p>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
        </div>
        <button
          onClick={loadDashboard}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#B71C1C] text-white rounded-xl font-semibold hover:bg-red-800 transition-colors text-sm shadow-sm"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const totalDonations = data?.total_donations ?? 0;
  const rewardPoints = data?.reward_points ?? 0;
  const badges = data?.badges ?? [];
  const nextEligibleDate = data?.next_eligible_date;
  const isEligible = !nextEligibleDate || new Date(nextEligibleDate) <= new Date();

  // Active emergency requests (filter out declined ones, keep accepted with state)
  const emergencyRequests = data?.emergency_requests ?? [];
  const activeUnrespondedRequests = emergencyRequests.filter((r: any) => !responsesMap[r.id]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#B71C1C] via-red-900 to-rose-950 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> LifeLink Donor Network
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Welcome, {user?.name || data?.profile?.name || 'Blood Donor'}!
          </h2>
          <p className="text-red-100 text-sm mt-1 max-w-xl">
            {user?.blood_group || data?.profile?.blood_group ? (
              <>Your registered blood group is <strong>{user?.blood_group || data?.profile?.blood_group}</strong>. Every verified donation saves up to 3 lives.</>
            ) : (
              <>Your account is active. Please complete your profile to register your blood group for emergency alerts.</>
            )}
          </p>
        </div>

        <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-center min-w-[150px]">
          <p className="text-xs uppercase font-bold text-red-200">Donation Status</p>
          {totalDonations === 0 ? (
            <div className="mt-1">
              <span className="text-lg font-black text-white">Ready to Donate</span>
              <p className="text-[11px] text-red-200 mt-0.5">No prior donations</p>
            </div>
          ) : isEligible ? (
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="text-lg font-black text-white">Eligible Today</span>
            </div>
          ) : (
            <div className="mt-1">
              <span className="text-sm font-bold text-yellow-200">Rest Period</span>
              <p className="text-xs text-red-200 mt-0.5">
                Eligible: {new Date(nextEligibleDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Genuine Highlights / Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mb-3">
            <Droplets className="w-5 h-5 text-[#B71C1C]" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{totalDonations}</p>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Verified Donations</p>
          {totalDonations > 0 ? (
            <p className="text-[11px] text-emerald-600 font-bold mt-1">~{totalDonations * 3} Lives Impacted</p>
          ) : (
            <p className="text-[11px] text-gray-400 font-medium mt-1">First donation awaits</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
            <Star className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{rewardPoints}</p>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Reward Points</p>
          {rewardPoints > 0 ? (
            <p className="text-[11px] text-purple-600 font-bold mt-1">Earned via Donations</p>
          ) : (
            <p className="text-[11px] text-gray-400 font-medium mt-1">Awarded on verified donation</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mb-3">
            <Award className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{badges.length}</p>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Badges Earned</p>
          {badges.length > 0 ? (
            <p className="text-[11px] text-amber-600 font-bold mt-1">Active Achiever</p>
          ) : (
            <p className="text-[11px] text-gray-400 font-medium mt-1">Unlocked by donating</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-base font-extrabold text-gray-900 truncate">
            {user?.blood_group || data?.profile?.blood_group || 'Not Set'}
          </p>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Blood Group</p>
          {!(user?.blood_group || data?.profile?.blood_group) ? (
            <Link to="/donor/profile" className="text-[11px] text-red-700 font-bold mt-1 block hover:underline">
              Set in Profile &rarr;
            </Link>
          ) : (
            <p className="text-[11px] text-emerald-700 font-bold mt-1">Profile Complete</p>
          )}
        </div>
      </div>

      {/* ─── My Clinical Donation Eligibility & Status ─── */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-red-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-[#B71C1C]" />
              My Clinical Health & Donation Eligibility
            </h3>
            <p className="text-xs text-gray-500">Official medical screening metrics & rest interval tracking</p>
          </div>
          <Link
            to="/donor/health-profile"
            className="px-4 py-2 bg-[#B71C1C] hover:bg-red-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
          >
            <FileText className="w-4 h-4" /> Manage Health Profile & Report &rarr;
          </Link>
        </div>

        {/* 4 Prominent Indicators Required by Clinical Guidelines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Last Donation Date */}
          <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1">
              <Calendar className="w-4 h-4 text-red-600" />
              1. Last Donation Date
            </div>
            <p className="text-base font-extrabold text-gray-900">
              {data?.last_donation_date ? new Date(data.last_donation_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'None on record'}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {data?.last_donation_date ? 'Verified clinical donation' : 'First-time registered donor'}
            </p>
          </div>

          {/* 2. Next Estimated Eligible Date */}
          <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1">
              <Clock className="w-4 h-4 text-amber-600" />
              2. Next Estimated Eligible Date
            </div>
            <p className="text-base font-extrabold text-gray-900">
              {data?.next_eligible_date
                ? new Date(data.next_eligible_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                : isEligible ? 'Eligible Today' : 'Pending Profile'}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {data?.donation_interval_days ? `${data.donation_interval_days} days interval requirement` : 'Interval determined by donation type'}
            </p>
          </div>

          {/* 3. Current Eligibility Status */}
          <div className={`p-4 rounded-2xl border ${
            data?.eligibility_status === 'Eligible After Hospital Assessment'
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : data?.eligibility_status === 'Temporarily Deferred'
              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
              : 'bg-rose-50/70 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-2 text-xs font-bold mb-1 opacity-80">
              <Shield className="w-4 h-4" />
              3. Current Eligibility Status
            </div>
            <p className="text-sm font-black leading-tight">
              {data?.eligibility_status || 'Awaiting Assessment'}
            </p>
            <p className="text-[11px] mt-1 line-clamp-1 opacity-80">
              {data?.eligibility_reason || 'Final eligibility determined by hospital staff'}
            </p>
          </div>

          {/* 4. Health Profile Completion Status */}
          <div className={`p-4 rounded-2xl border ${
            data?.health_profile?.report_status === 'submitted'
              ? 'bg-blue-50/70 border-blue-200 text-blue-900'
              : 'bg-orange-50/70 border-orange-200 text-orange-900'
          }`}>
            <div className="flex items-center gap-2 text-xs font-bold mb-1 opacity-80">
              <CheckCircle className="w-4 h-4" />
              4. Health Profile Status
            </div>
            <p className="text-sm font-black leading-tight">
              {data?.health_profile?.report_status === 'submitted' ? 'Submitted & Active' : 'Action Required'}
            </p>
            <Link to="/donor/health-profile" className="text-[11px] underline font-bold mt-1 block">
              {data?.health_profile?.report_status === 'submitted' ? 'View Official Report' : 'Complete Questionnaire'}
            </Link>
          </div>
        </div>

        {/* Clinical Disclaimer Note */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <p>
            <strong>Mandatory Medical Notice:</strong> Preliminary screening does not declare a donor fit to donate blood. Final clinical eligibility is determined in person at the hospital through physical screening (Hemoglobin test, Blood Pressure, Pulse, and Temperature checks).
          </p>
        </div>
      </div>

      {/* ─── Active Emergency Assessment Workflow Banner (If Responded) ─── */}
      {(() => {
        const acceptedResp = (data?.responses || []).find((r: any) => r.action === 'accept');
        if (!acceptedResp) return null;
        const stage = acceptedResp.current_stage || acceptedResp.assessment?.status || 'accepted';

        const stagesList = [
          { key: 'accepted', label: '1. Request Accepted', desc: 'Hospital alerted; proceed to hospital' },
          { key: 'reached', label: '2. Arrival Confirmed', desc: 'Checked in by hospital staff' },
          { key: 'screened', label: '3. Physical Screening', desc: 'Weight, BP, Hb, Pulse & Temp' },
          { key: 'eligible', label: '4. Clinical Decision', desc: 'Cleared as medically fit' },
          { key: 'donation_started', label: '5. Donation Process', desc: 'Collection in progress' },
          { key: 'verified', label: '6. Verified (+150 Pts)', desc: 'Donation verified & completed' },
        ];

        const stageOrder = ['accepted', 'reached', 'screened', 'eligible', 'donation_started', 'donation_completed', 'verified'];
        const currentIdx = stage === 'deferred' || stage === 'not_eligible' ? 3 : stageOrder.indexOf(stage);

        return (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="px-3 py-1 bg-[#B71C1C] text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                  Active Clinical Workflow
                </span>
                <h3 className="text-lg font-black text-gray-900 mt-2">
                  Emergency Donation in Progress: {acceptedResp.blood_requests?.hospital_name || 'Hospital Request'}
                </h3>
                <p className="text-xs text-gray-600">
                  Request Ref: <span className="font-mono font-bold text-gray-800">{acceptedResp.blood_requests?.request_id || acceptedResp.blood_request_id}</span> • 
                  Blood Group: <strong className="text-red-700">{acceptedResp.blood_requests?.blood_group || user?.blood_group}</strong>
                </p>
              </div>

              {stage === 'deferred' || stage === 'not_eligible' ? (
                <div className="px-4 py-2 bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold">
                  Temporarily Deferred by Medical Staff
                </div>
              ) : stage === 'verified' ? (
                <div className="px-4 py-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-700" /> Donation Verified (+150 Pts)
                </div>
              ) : (
                <div className="px-4 py-2 bg-white text-gray-800 border border-gray-200 rounded-xl text-xs font-bold shadow-xs">
                  Stage: <span className="text-[#B71C1C] uppercase">{stage.replace('_', ' ')}</span>
                </div>
              )}
            </div>

            {/* Stepper Display */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2">
              {stagesList.map((stg, i) => {
                const isPassed = currentIdx >= i;
                const isCurrent = currentIdx === i;
                return (
                  <div
                    key={stg.key}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      isCurrent
                        ? 'bg-[#B71C1C] text-white border-red-700 shadow-md font-bold'
                        : isPassed
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-white text-gray-400 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-center mb-1">
                      {isPassed && !isCurrent ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <span className="text-[10px] uppercase font-bold">{i + 1}</span>
                      )}
                    </div>
                    <p className="text-xs font-bold truncate">{stg.label.split('. ')[1]}</p>
                    <p className={`text-[10px] mt-0.5 line-clamp-2 ${isCurrent ? 'text-red-100' : 'text-gray-500'}`}>
                      {stg.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Doctor Screening Results Banner if screened */}
            {acceptedResp.assessment?.screening_hemoglobin && (
              <div className="p-3 bg-white/80 rounded-xl border border-gray-200 text-xs text-gray-700 flex flex-wrap gap-4">
                <span>Weight: <strong>{acceptedResp.assessment.screening_weight} kg</strong></span>
                <span>BP: <strong>{acceptedResp.assessment.screening_blood_pressure}</strong></span>
                <span>Hb: <strong>{acceptedResp.assessment.screening_hemoglobin} g/dL</strong></span>
                <span>Pulse: <strong>{acceptedResp.assessment.screening_pulse} bpm</strong></span>
                <span>Temp: <strong>{acceptedResp.assessment.screening_temperature} °F</strong></span>
                {acceptedResp.assessment.assessed_by && (
                  <span className="text-gray-500">Screened by: <em>{acceptedResp.assessment.assessed_by}</em></span>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Emergency Requests Broadcast Feed */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-red-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#B71C1C]" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">Hospital Emergency Requests</h3>
              <p className="text-xs text-gray-500">Live clinical blood requests from registered hospitals</p>
            </div>
          </div>
          <button
            onClick={loadDashboard}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            title="Refresh requests"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Rest Interval Active Warning Banner */}
        {!isEligible && nextEligibleDate && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-amber-900">Mandatory Donation Rest Interval Active</p>
              <p className="text-amber-800 mt-0.5">
                You are currently not eligible to donate blood because your previous donation was recent. Your next estimated eligible donation date is{' '}
                <strong className="underline">
                  {(() => {
                    const d = new Date(nextEligibleDate);
                    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                  })()}
                </strong>.
              </p>
            </div>
          </div>
        )}

        {emergencyRequests.length === 0 ? (
          <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-gray-100">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-gray-700 text-sm">No Active Emergency Requests</p>
            <p className="text-xs text-gray-400 mt-1">
              All hospital blood requests are currently fulfilled. You will be notified when an urgent need arises.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {emergencyRequests.map((req: any) => {
              const userResponse = responsesMap[req.id];
              const isResponding = respondingId === req.id;
              const isCritical = req.priority === 'critical';

              return (
                <div
                  key={req.id}
                  className={`p-5 rounded-2xl border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    isCritical ? 'bg-red-50/40 border-red-200' : 'bg-gray-50/60 border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-[#B71C1C] text-white rounded-2xl flex flex-col items-center justify-center font-black flex-shrink-0 shadow-md">
                      <span className="text-lg leading-none">{req.blood_group}</span>
                      <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5">Need</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-gray-900 text-base">{req.hospital_name || 'Partner Hospital'}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase text-white ${
                          isCritical ? 'bg-red-600' : req.priority === 'high' ? 'bg-orange-500' : 'bg-yellow-600'
                        }`}>
                          {req.priority || 'Urgent'}
                        </span>
                        {req.status === 'donor_alert' && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold uppercase">
                            Donor Alert
                          </span>
                        )}
                      </div>
                      {req.patient_condition && (
                        <p className="text-xs text-gray-600 mt-1 font-medium">{req.patient_condition}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        <span className="font-semibold text-gray-700">{req.units_required} Unit(s)</span> requested
                        {req.request_id && <span className="ml-2 font-mono text-gray-400">• Ref: {req.request_id}</span>}
                      </p>
                    </div>
                  </div>

                  {/* ONLY TWO ACTIONS: ACCEPT or DECLINE */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {userResponse === 'accept' ? (
                      <span className="px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                        <Check className="w-4 h-4 text-emerald-600" /> Accepted
                      </span>
                    ) : userResponse === 'reject' || userResponse === 'decline' ? (
                      <span className="px-4 py-2 bg-gray-100 text-gray-500 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                        <XIcon className="w-4 h-4 text-gray-400" /> Declined
                      </span>
                    ) : (
                      <>
                        {!isEligible ? (
                          <button
                            onClick={() => handleAccept(req)}
                            className="px-4 py-2 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                            title="Ineligible (Recent Donation Rest Period)"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Ineligible (Rest Period)
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAccept(req)}
                            disabled={!!respondingId}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                          >
                            {isResponding ? <span className="animate-spin">↻</span> : <Check className="w-4 h-4" />}
                            Accept
                          </button>
                        )}
                        <button
                          onClick={() => handleDecline(req)}
                          disabled={!!respondingId}
                          className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <XIcon className="w-4 h-4" /> Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Badges Section */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Your Earned Achievements</h3>
          <Link to="/donor/rewards" className="text-xs text-[#B71C1C] font-semibold hover:underline flex items-center gap-1">
            View All Badges &rarr;
          </Link>
        </div>

        {badges.length === 0 ? (
          <div className="p-6 bg-gray-50/60 rounded-2xl border border-gray-100 text-center">
            <Award className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">No Badges Earned Yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
              Badges are unlocked through verified blood donations. Complete your first donation to earn the First Drop Hero badge.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {badges.map((badge: any, i: number) => (
              <div key={i} className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex items-center gap-4">
                <span className="text-3xl">{badge.icon || '🏅'}</span>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{badge.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── My Health Profile & Donation Eligibility ─────────────────────────────────
const HealthProfileAndEligibilityPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'questionnaire' | 'report'>('questionnaire');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<any>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    dob: '',
    age: '',
    gender: 'Male',
    blood_group: '',
    height_cm: '',
    weight_kg: '',
    phone: '',
    has_donated_before: false,
    last_donation_date: '',
    previous_donation_type: 'Whole Blood',
    previous_complications: '',
    recent_donation_notes: '',
    has_medical_conditions: false,
    medical_conditions_details: '',
    taking_medications: false,
    medications_details: '',
    recent_fever_illness: false,
    fever_illness_details: '',
    relevant_medical_history: '',
    consent_acknowledged: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileData, reportData] = await Promise.all([
        donorAPI.getHealthProfile().catch(() => null),
        donorAPI.getHealthReport().catch(() => null),
      ]);

      if (profileData) {
        setFormData({
          full_name: profileData.full_name || user?.name || '',
          dob: profileData.dob ? profileData.dob.substring(0, 10) : '',
          age: profileData.age ? String(profileData.age) : '',
          gender: profileData.gender || 'Male',
          blood_group: profileData.blood_group || user?.blood_group || '',
          height_cm: profileData.height_cm ? String(profileData.height_cm) : '',
          weight_kg: profileData.weight_kg ? String(profileData.weight_kg) : '',
          phone: profileData.phone || user?.phone || '',
          has_donated_before: Boolean(profileData.has_donated_before),
          last_donation_date: profileData.last_donation_date ? profileData.last_donation_date.substring(0, 10) : '',
          previous_donation_type: profileData.previous_donation_type || 'Whole Blood',
          previous_complications: profileData.previous_complications || '',
          recent_donation_notes: profileData.recent_donation_notes || '',
          has_medical_conditions: Boolean(profileData.has_medical_conditions),
          medical_conditions_details: profileData.medical_conditions_details || '',
          taking_medications: Boolean(profileData.taking_medications),
          medications_details: profileData.medications_details || '',
          recent_fever_illness: Boolean(profileData.recent_fever_illness),
          fever_illness_details: profileData.fever_illness_details || '',
          relevant_medical_history: profileData.relevant_medical_history || '',
          consent_acknowledged: true,
        });
      } else if (user) {
        setFormData(prev => ({
          ...prev,
          full_name: user.name || '',
          blood_group: user.blood_group || '',
          phone: user.phone || '',
        }));
      }

      if (reportData) {
        setReport(reportData);
      }
    } catch {
      toast.error('Failed to load health profile data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.blood_group) {
      toast.error('Please select your blood group');
      return;
    }
    if (!formData.weight_kg || Number(formData.weight_kg) < 45) {
      toast.error('Weight must be at least 45 kg for clinical blood donation eligibility');
      return;
    }

    setSaving(true);
    try {
      await donorAPI.saveHealthProfile(formData);
      toast.success('Health profile saved and structured report generated!');
      await loadData();
      setActiveTab('report');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save health profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-200 border-t-[#B71C1C]" />
        <p className="text-gray-500 font-medium text-sm">Loading Health Profile & Medical Screening Records...</p>
      </div>
    );
  }

  // Calculate dynamic rest interval based on donation type
  const intervalMap: Record<string, number> = {
    'Whole Blood': 56,
    'Platelets': 7,
    'Plasma': 28,
    'Double Red Cells': 112,
  };
  const currentInterval = intervalMap[formData.previous_donation_type] || 56;
  const lastDonationDateObj = formData.last_donation_date ? new Date(formData.last_donation_date) : null;
  const nextEligibleDateObj = lastDonationDateObj ? new Date(lastDonationDateObj.getTime() + currentInterval * 24 * 60 * 60 * 1000) : null;
  const isPastRestInterval = !nextEligibleDateObj || Date.now() >= nextEligibleDateObj.getTime();

  let derivedEligibilityStatus = 'Awaiting Hospital Assessment';
  let statusBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';

  if (!formData.weight_kg || Number(formData.weight_kg) < 45) {
    derivedEligibilityStatus = 'Ineligible (Weight < 45kg)';
    statusBadgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
  } else if (!isPastRestInterval) {
    derivedEligibilityStatus = 'Temporarily Deferred';
    statusBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
  } else if (formData.recent_fever_illness) {
    derivedEligibilityStatus = 'Temporarily Deferred';
    statusBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
  } else if (formData.blood_group && isPastRestInterval) {
    derivedEligibilityStatus = 'Eligible After Hospital Assessment';
    statusBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
            MY HEALTH PROFILE &amp; DONATION ELIGIBILITY
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Clinical health declaration, medical screening questionnaire, and structured hospital report.
          </p>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-1.5 bg-gray-100 p-1 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('questionnaire')}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
              activeTab === 'questionnaire'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Questionnaire Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all text-center whitespace-nowrap ${
              activeTab === 'report'
                ? 'bg-[#B71C1C] text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Official Report
          </button>
        </div>
      </div>

      {/* 4 Prominent Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <p className="text-[11px] uppercase font-bold text-gray-500 tracking-wider">1. Last Donation Date</p>
          <p className="text-lg font-black text-gray-900 mt-1">
            {formData.last_donation_date ? new Date(formData.last_donation_date).toLocaleDateString() : 'None Recorded'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {formData.has_donated_before ? `${formData.previous_donation_type} donation` : 'New donor registration'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <p className="text-[11px] uppercase font-bold text-gray-500 tracking-wider">2. Next Estimated Eligible Date</p>
          <p className="text-lg font-black text-gray-900 mt-1">
            {nextEligibleDateObj ? nextEligibleDateObj.toLocaleDateString() : 'Eligible Today'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {currentInterval} days rest interval for {formData.previous_donation_type}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <p className="text-[11px] uppercase font-bold text-gray-500 tracking-wider">3. Current Eligibility Status</p>
          <div className="mt-1">
            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black border ${statusBadgeColor}`}>
              {derivedEligibilityStatus}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Preliminary screening determination</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <p className="text-[11px] uppercase font-bold text-gray-500 tracking-wider">4. Health Profile Status</p>
          <p className="text-lg font-black text-emerald-700 mt-1 flex items-center gap-1.5">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            {report?.report_status === 'submitted' ? 'Report Active' : 'Draft / In Progress'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Mandatory Clinical Safety Disclaimer Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <AlertTriangle className="w-6 h-6 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-950 text-sm">
              IMPORTANT CLINICAL SAFETY NOTICE &amp; REGULATORY LIMITATION
            </h4>
            <p className="text-xs text-amber-900 leading-relaxed">
              <strong>Under no circumstances does this health questionnaire alone declare a donor fit to donate blood.</strong> This questionnaire serves exclusively as a preliminary screening and self-declaration. Final clinical donation eligibility must always be determined in person by authorized hospital clinical staff through:
            </p>
            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-amber-800 list-disc list-inside pt-1">
              <li>In-person physical screening (weight, pulse, temperature)</li>
              <li>Fingerstick Hemoglobin level laboratory test</li>
              <li>Clinical Blood Pressure check</li>
              <li>Confidential medical history &amp; vein inspection</li>
            </ul>
          </div>
        </div>
      </div>

      {/* TAB 1: Questionnaire Form */}
      {activeTab === 'questionnaire' && (
        <form onSubmit={handleSave} className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-gray-200 space-y-6 sm:space-y-8">
          {/* Section 1: Personal Information */}
          <div className="space-y-4">
            <div className="border-b border-gray-100 pb-2">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-[#B71C1C]" />
                1. PERSONAL INFORMATION
              </h3>
              <p className="text-xs text-gray-500">Demographic baseline data for clinical records.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                  placeholder="e.g. Johnathan Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dob}
                  onChange={e => {
                    const dobVal = e.target.value;
                    let ageVal = formData.age;
                    if (dobVal) {
                      const diff = Date.now() - new Date(dobVal).getTime();
                      const calculatedAge = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
                      ageVal = String(calculatedAge);
                    }
                    setFormData({ ...formData, dob: dobVal, age: ageVal });
                  }}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Age (Years) *</label>
                <input
                  type="number"
                  required
                  min={18}
                  max={65}
                  value={formData.age}
                  onChange={e => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                  placeholder="18 - 65"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={e => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Blood Group *</label>
                <select
                  required
                  value={formData.blood_group}
                  onChange={e => setFormData({ ...formData, blood_group: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-red-700 focus:ring-2 focus:ring-red-400 focus:outline-none"
                >
                  <option value="">Select Blood Group</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Contact Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Height (cm)</label>
                <input
                  type="number"
                  min={120}
                  max={230}
                  value={formData.height_cm}
                  onChange={e => setFormData({ ...formData, height_cm: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                  placeholder="e.g. 175"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Current Weight (kg) *</label>
                <input
                  type="number"
                  required
                  min={40}
                  max={200}
                  value={formData.weight_kg}
                  onChange={e => setFormData({ ...formData, weight_kg: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-red-400 focus:outline-none"
                  placeholder="Min 45 kg required"
                />
                <span className="text-[10px] text-gray-500 mt-0.5 block">Clinical minimum weight is 45-50 kg</span>
              </div>
            </div>
          </div>

          {/* Section 2: Donation Information */}
          <div className="space-y-4">
            <div className="border-b border-gray-100 pb-2">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Droplets className="w-5 h-5 text-[#B71C1C]" />
                2. DONATION INFORMATION
              </h3>
              <p className="text-xs text-gray-500">History of prior blood donations and mandatory rest interval determination.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Have you donated blood before?</label>
                <div className="flex gap-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="has_donated_before"
                      checked={formData.has_donated_before}
                      onChange={() => setFormData({ ...formData, has_donated_before: true })}
                      className="text-[#B71C1C] focus:ring-red-500"
                    />
                    Yes, I have donated blood
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 cursor-pointer">
                    <input
                      type="radio"
                      name="has_donated_before"
                      checked={!formData.has_donated_before}
                      onChange={() => setFormData({ ...formData, has_donated_before: false, last_donation_date: '' })}
                      className="text-[#B71C1C] focus:ring-red-500"
                    />
                    No, I am a first-time donor
                  </label>
                </div>
              </div>

              {formData.has_donated_before && (
                <div className="grid md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Last Blood Donation Date</label>
                    <input
                      type="date"
                      value={formData.last_donation_date}
                      onChange={e => setFormData({ ...formData, last_donation_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Previous Donation Type</label>
                    <select
                      value={formData.previous_donation_type}
                      onChange={e => setFormData({ ...formData, previous_donation_type: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                    >
                      <option value="Whole Blood">Whole Blood (56 days rest interval)</option>
                      <option value="Platelets">Platelets / Apheresis (7 days rest interval)</option>
                      <option value="Plasma">Plasma (28 days rest interval)</option>
                      <option value="Double Red Cells">Double Red Blood Cells (112 days rest interval)</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Did you experience any previous donation-related complications?
                    </label>
                    <input
                      type="text"
                      value={formData.previous_complications}
                      onChange={e => setFormData({ ...formData, previous_complications: e.target.value })}
                      placeholder="e.g. Fainting, lightheadedness, excessive bruising (or leave blank if none)"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Health Screening Questionnaire */}
          <div className="space-y-4">
            <div className="border-b border-gray-100 pb-2">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#B71C1C]" />
                3. HEALTH QUESTIONNAIRE &amp; MEDICAL SCREENING
              </h3>
              <p className="text-xs text-gray-500">Confidential clinical screening questions to safeguard donor and recipient health.</p>
            </div>

            <div className="space-y-4 divide-y divide-gray-100">
              {/* Question 1: Existing conditions */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-gray-800">
                    1. Do you have any existing chronic or acute medical conditions?
                  </p>
                  <div className="flex gap-4 flex-shrink-0">
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="has_medical_conditions"
                        checked={formData.has_medical_conditions}
                        onChange={() => setFormData({ ...formData, has_medical_conditions: true })}
                        className="text-[#B71C1C]"
                      />
                      Yes
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="has_medical_conditions"
                        checked={!formData.has_medical_conditions}
                        onChange={() => setFormData({ ...formData, has_medical_conditions: false, medical_conditions_details: '' })}
                        className="text-[#B71C1C]"
                      />
                      No
                    </label>
                  </div>
                </div>
                {formData.has_medical_conditions && (
                  <input
                    type="text"
                    value={formData.medical_conditions_details}
                    onChange={e => setFormData({ ...formData, medical_conditions_details: e.target.value })}
                    placeholder="Describe conditions (e.g. Asthma, Hypertension, Diabetes, Thyroid, Cardiac)..."
                    className="w-full mt-2 px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
                  />
                )}
              </div>

              {/* Question 2: Medications */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-gray-800">
                    2. Are you currently taking any prescription medications?
                  </p>
                  <div className="flex gap-4 flex-shrink-0">
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="taking_medications"
                        checked={formData.taking_medications}
                        onChange={() => setFormData({ ...formData, taking_medications: true })}
                        className="text-[#B71C1C]"
                      />
                      Yes
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="taking_medications"
                        checked={!formData.taking_medications}
                        onChange={() => setFormData({ ...formData, taking_medications: false, medications_details: '' })}
                        className="text-[#B71C1C]"
                      />
                      No
                    </label>
                  </div>
                </div>
                {formData.taking_medications && (
                  <input
                    type="text"
                    value={formData.medications_details}
                    onChange={e => setFormData({ ...formData, medications_details: e.target.value })}
                    placeholder="List medications (e.g. Blood thinners, Aspirin, Antibiotics, Insulin)..."
                    className="w-full mt-2 px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
                  />
                )}
              </div>

              {/* Question 3: Recent fever or illness */}
              <div className="pt-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      3. Have you experienced fever, cold, sore throat, or illness in the past 28 days?
                    </p>
                    <span className="text-[11px] text-amber-700 font-medium">
                      Note: Recent fever requires a standard 28-day temporary deferral.
                    </span>
                  </div>
                  <div className="flex gap-4 flex-shrink-0">
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="recent_fever_illness"
                        checked={formData.recent_fever_illness}
                        onChange={() => setFormData({ ...formData, recent_fever_illness: true })}
                        className="text-[#B71C1C]"
                      />
                      Yes
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="recent_fever_illness"
                        checked={!formData.recent_fever_illness}
                        onChange={() => setFormData({ ...formData, recent_fever_illness: false, fever_illness_details: '' })}
                        className="text-[#B71C1C]"
                      />
                      No
                    </label>
                  </div>
                </div>
                {formData.recent_fever_illness && (
                  <input
                    type="text"
                    value={formData.fever_illness_details}
                    onChange={e => setFormData({ ...formData, fever_illness_details: e.target.value })}
                    placeholder="Details of recent illness, approximate recovery date..."
                    className="w-full mt-2 px-3.5 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
                  />
                )}
              </div>

              {/* Question 4: Other relevant medical history */}
              <div className="pt-3">
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  4. Other relevant medical history, past surgeries, tattoos, or recent vaccinations
                </label>
                <textarea
                  rows={2}
                  value={formData.relevant_medical_history}
                  onChange={e => setFormData({ ...formData, relevant_medical_history: e.target.value })}
                  placeholder="e.g. Minor dental procedure 2 weeks ago, no major surgeries, no tattoos in last 6 months..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Certified self-declaration. Saving generates a structured clinical report.</span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-[#B71C1C] hover:bg-red-800 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Saving Medical Profile...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" /> Save Health Profile &amp; Generate Report
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Structured Health Report */}
      {activeTab === 'report' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-gray-200 space-y-6">
          {/* Official Document Banner */}
          <div className="border-b-2 border-red-700 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#B71C1C] text-white flex items-center justify-center font-black text-sm">
                  LL
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">
                  LIFELINK CLINICAL DONOR HEALTH REPORT
                </h3>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Official structured medical self-declaration document prepared for hospital review.
              </p>
            </div>

            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-black border ${statusBadgeColor}`}>
                {derivedEligibilityStatus}
              </span>
              <p className="text-[11px] text-gray-400 font-mono mt-1">
                Report ID: {report?.donor_id || user?.id || 'LL-REP-PENDING'}
              </p>
            </div>
          </div>

          {/* Demographic & Clinical Metrics Table */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 text-xs">
              <p className="font-bold text-gray-900 uppercase text-[10px] tracking-wider mb-2 text-[#B71C1C]">
                Donor Demographics &amp; Contact
              </p>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">Legal Name:</span>
                <span className="font-bold text-gray-900">{formData.full_name || user?.name || 'Registered Donor'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">Blood Group:</span>
                <span className="font-black text-red-700 text-sm">{formData.blood_group || user?.blood_group || 'Not recorded'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">Age / Gender:</span>
                <span className="font-bold text-gray-900">{formData.age || '—'} yrs / {formData.gender}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">Height / Weight:</span>
                <span className="font-bold text-gray-900">{formData.height_cm || '—'} cm / {formData.weight_kg || '—'} kg</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Phone / Email:</span>
                <span className="font-bold text-gray-900">{formData.phone || user?.phone || '—'}</span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 text-xs">
              <p className="font-bold text-gray-900 uppercase text-[10px] tracking-wider mb-2 text-[#B71C1C]">
                Donation Background &amp; Rest Interval
              </p>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">Prior Donation History:</span>
                <span className="font-bold text-gray-900">{formData.has_donated_before ? 'Experienced Donor' : 'First-time Donor'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">Last Donation Date:</span>
                <span className="font-bold text-gray-900">
                  {formData.last_donation_date ? new Date(formData.last_donation_date).toLocaleDateString() : 'None Recorded'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">Previous Donation Type:</span>
                <span className="font-bold text-gray-900">{formData.previous_donation_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500">Required Rest Interval:</span>
                <span className="font-bold text-gray-900">{currentInterval} Days</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Next Estimated Eligible Date:</span>
                <span className="font-black text-emerald-700">
                  {nextEligibleDateObj ? nextEligibleDateObj.toLocaleDateString() : 'Eligible Today'}
                </span>
              </div>
            </div>
          </div>

          {/* Questionnaire Responses Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider text-[#B71C1C]">
              Medical Screening Responses Summary
            </h4>
            <div className="border border-gray-200 rounded-2xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Screening Question</th>
                    <th className="px-4 py-2.5 w-24">Response</th>
                    <th className="px-4 py-2.5">Clinical Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-800">Existing Medical Conditions</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded font-bold ${formData.has_medical_conditions ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {formData.has_medical_conditions ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formData.medical_conditions_details || 'None reported'}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-800">Current Medications</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded font-bold ${formData.taking_medications ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {formData.taking_medications ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formData.medications_details || 'None reported'}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-800">Recent Fever / Illness (Past 28 Days)</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded font-bold ${formData.recent_fever_illness ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {formData.recent_fever_illness ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formData.fever_illness_details || 'None reported'}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-800">Previous Complications</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded font-bold ${formData.previous_complications ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {formData.previous_complications ? 'YES' : 'NO'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formData.previous_complications || 'None reported'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Verification Footer */}
          <div className="pt-4 border-t border-gray-200 text-xs text-gray-500 space-y-2">
            <p>
              <strong>Consent &amp; Transmission Notice:</strong> This health report is synchronized with the LifeLink emergency network and will be transmitted to evaluating hospitals upon accepting an emergency request.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <span className="font-mono text-[11px] text-gray-400">
                Generated: {new Date().toLocaleString()} • Report Status: SUBMITTED
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('questionnaire')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold transition-colors"
              >
                Edit Health Information
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Donor Profile & Verification ──────────────────────────────────────────────
const DonorProfile: React.FC = () => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    state: '',
    blood_group: '',
    address: '',
  });

  const loadProfile = useCallback(async () => {
    try {
      const profile = await authAPI.getProfile() as any;
      if (profile) {
        setFormData({
          name: profile.name || '',
          phone: profile.phone || '',
          city: profile.city || '',
          state: profile.state || '',
          blood_group: profile.blood_group || '',
          address: profile.address || '',
        });
      }
    } catch {
      // Fallback to user context
      if (user) {
        setFormData({
          name: user.name || '',
          phone: user.phone || '',
          city: user.city || '',
          state: user.state || '',
          blood_group: user.blood_group || '',
          address: '',
        });
      }
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await donorAPI.updateProfile(formData);
      toast.success('Donor profile updated successfully.');
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Donor Profile & Verification</h2>
          <p className="text-gray-500 text-sm">Manage your contact information, blood group, and account details.</p>
        </div>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 ${
            editing ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-[#B71C1C] text-white hover:bg-red-800'
          }`}
        >
          {saving ? 'Saving...' : editing ? 'Save Profile' : 'Edit Information'}
        </button>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
        {/* Verification Status Banner */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-950">Verified Donor Account</p>
              <p className="text-xs text-emerald-700">Account ID: <span className="font-mono">{user?.id || 'Registered'}</span></p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full">
            Active
          </span>
        </div>

        {/* Input Fields */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Full Legal Name</label>
            <input
              type="text"
              disabled={!editing}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Blood Group</label>
            <select
              disabled={!editing}
              value={formData.blood_group}
              onChange={e => setFormData({ ...formData, blood_group: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 disabled:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <option value="">Select blood group</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
            <input
              type="text"
              disabled={!editing}
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">City</label>
            <input
              type="text"
              disabled={!editing}
              value={formData.city}
              onChange={e => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">State / Region</label>
            <input
              type="text"
              disabled={!editing}
              value={formData.state}
              onChange={e => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">Street Address</label>
            <input
              type="text"
              disabled={!editing}
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter your street address"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm disabled:bg-gray-50 disabled:text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
        </div>

        {/* Informative Note */}
        <div className="pt-4 border-t border-gray-100 flex items-start gap-3 text-xs text-gray-500">
          <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p>
            Your address and contact information are used exclusively to coordinate emergency blood donation requests. Your data is stored securely and never shared with third parties.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Emergency Requests Full Page ──────────────────────────────────────────────
const EmergencyRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [donorData, setDonorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responsesMap, setResponsesMap] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [requestsData, dashData] = await Promise.all([
        bloodRequestAPI.getDonorRequests(),
        donorAPI.getDashboard().catch(() => null)
      ]);
      setRequests(requestsData || []);
      setDonorData(dashData);
      const rMap: Record<string, string> = {};
      (requestsData || []).forEach((r: any) => {
        if (r.donor_already_responded) {
          rMap[r.id] = 'responded';
        }
      });
      setResponsesMap(rMap);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load emergency requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const nextEligibleDate = donorData?.next_eligible_date;
  const isWithinRestInterval = Boolean(nextEligibleDate && new Date(nextEligibleDate) > new Date());
  let formattedEligibleDate = '';
  if (nextEligibleDate) {
    const d = new Date(nextEligibleDate);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    formattedEligibleDate = `${dd}/${mm}/${yyyy}`;
  }

  const handleAccept = async (req: any) => {
    if (respondingId) return;

    // CLINICAL BUSINESS RULE: Prevent repeated donation within mandatory rest interval
    if (isWithinRestInterval) {
      toast.error(
        `You are currently not eligible to donate blood because your previous donation was recent. Your next estimated eligible donation date is ${formattedEligibleDate}.`,
        { duration: 7000 }
      );
      return;
    }

    setRespondingId(req.id);
    try {
      await bloodRequestAPI.respond(req.id, 'accept');
      setResponsesMap(prev => ({ ...prev, [req.id]: 'accept' }));
      toast.success(`You accepted the request from ${req.hospital_name || 'the hospital'}. The hospital has been notified.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept request');
    } finally {
      setRespondingId(null);
    }
  };

  const handleDecline = async (req: any) => {
    if (respondingId) return;
    setRespondingId(req.id);
    try {
      await bloodRequestAPI.respond(req.id, 'decline');
      setResponsesMap(prev => ({ ...prev, [req.id]: 'reject' }));
      toast('Request declined. The hospital has been notified.', { icon: 'ℹ️' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline request');
    } finally {
      setRespondingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-[#B71C1C]" />
        <p className="text-gray-500 font-medium text-xs">Loading requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">Nearby Emergency Needs</h2>
          <p className="text-gray-500 text-sm">Active hospital blood requests eligible for your response.</p>
        </div>
        <button
          onClick={loadRequests}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Rest Interval Active Alert Banner */}
      {isWithinRestInterval && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-amber-900 shadow-sm">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-extrabold text-amber-900">Rest Interval Active — Repeated Donation Blocked</p>
            <p className="text-amber-800 text-xs mt-0.5">
              You are currently not eligible to donate blood because your previous donation was recent. Your next estimated eligible donation date is{' '}
              <strong className="underline font-bold text-amber-950">{formattedEligibleDate}</strong>.
            </p>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-700">No Emergency Requests</h3>
          <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
            There are currently no open emergency requests matching your profile. You will receive an alert as soon as a request is created.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req: any) => {
            const userResponse = responsesMap[req.id];
            const isResponding = respondingId === req.id;
            const isCritical = req.priority === 'critical';

            return (
              <div
                key={req.id}
                className={`bg-white p-6 rounded-2xl border-2 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                  isCritical ? 'border-red-300 bg-red-50/20' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-[#B71C1C] text-white rounded-2xl flex flex-col items-center justify-center font-black flex-shrink-0 shadow-md">
                    <span className="text-xl leading-none">{req.blood_group}</span>
                    <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5">Need</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900 text-lg">{req.hospital_name || 'Hospital'}</h4>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase text-white ${
                        isCritical ? 'bg-red-600' : req.priority === 'high' ? 'bg-orange-500' : 'bg-yellow-600'
                      }`}>
                        {req.priority || 'Urgent'}
                      </span>
                    </div>
                    {req.patient_condition && (
                      <p className="text-sm text-gray-600 mt-1">{req.patient_condition}</p>
                    )}
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                      <span>Units Needed: <span className="font-bold text-gray-700">{req.units_required}</span></span>
                      <span>Blood Group: <span className="font-bold text-red-700">{req.blood_group}</span></span>
                      {req.request_id && <span>Reference: <span className="font-mono">{req.request_id}</span></span>}
                    </div>
                  </div>
                </div>

                {/* ONLY TWO ACTION BUTTONS: ACCEPT and DECLINE */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {userResponse === 'accept' ? (
                    <span className="px-5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                      <Check className="w-4 h-4 text-emerald-600" /> Accepted
                    </span>
                  ) : userResponse === 'reject' || userResponse === 'decline' ? (
                    <span className="px-5 py-2.5 bg-gray-100 text-gray-500 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                      <XIcon className="w-4 h-4 text-gray-400" /> Declined
                    </span>
                  ) : (
                    <>
                      {isWithinRestInterval ? (
                        <button
                          onClick={() => handleAccept(req)}
                          className="px-5 py-3 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                          title={`Ineligible until ${formattedEligibleDate}`}
                        >
                          <Clock className="w-4 h-4 text-amber-600" />
                          Ineligible (Rest Period)
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAccept(req)}
                          disabled={!!respondingId}
                          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
                        >
                          {isResponding ? <span className="animate-spin">↻</span> : <Check className="w-4 h-4" />}
                          Accept
                        </button>
                      )}
                      <button
                        onClick={() => handleDecline(req)}
                        disabled={!!respondingId}
                        className="px-5 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <XIcon className="w-4 h-4" /> Decline
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Donation History Page ─────────────────────────────────────────────────────
const DonationHistory: React.FC = () => {
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await donorAPI.getDonations();
        setDonations(data || []);
      } catch {
        toast.error('Failed to fetch donation history');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-[#B71C1C]" />
        <p className="text-gray-500 font-medium text-xs">Loading donation history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900">Your Complete Donation History</h2>
        <p className="text-gray-500 text-sm">Certified ledger of all verified clinical blood donations.</p>
      </div>

      {donations.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Droplets className="w-8 h-8 text-red-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-700">No Donations Yet</h3>
          <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">
            You haven't donated blood yet. Your donation history will appear here after your first verified donation.
          </p>
          <Link
            to="/donor/emergency"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-[#B71C1C] text-white rounded-xl font-semibold hover:bg-red-800 transition-colors text-xs shadow-sm"
          >
            <AlertTriangle className="w-4 h-4" /> View Emergency Needs
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase text-left border-b border-gray-100">
                  <th className="px-6 py-4">Donation Date</th>
                  <th className="px-6 py-4">Hospital Partner</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Units</th>
                  <th className="px-6 py-4">Verification Status</th>
                  <th className="px-6 py-4">Reward Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {donations.map((d: any, index: number) => (
                  <tr key={d.id || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {d.donation_date ? new Date(d.donation_date).toLocaleDateString() : 'Pending'}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">
                      {d.hospital_name || d.location || 'LifeLink Network Facility'}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-red-800">
                      {d.donation_category || d.notes || 'Whole Blood'}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">{d.units || 1} Unit</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        d.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                        d.verification_status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {d.verification_status ? d.verification_status.toUpperCase() : 'VERIFIED'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {d.reward_points_awarded > 0 ? (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs">
                          +{d.reward_points_awarded} Pts
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Rewards & Badges Page ─────────────────────────────────────────────────────
const RewardsBadges: React.FC = () => {
  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await donorAPI.getDashboard();
        setDashData(data);
      } catch {
        toast.error('Failed to load rewards data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-200 border-t-[#B71C1C]" />
        <p className="text-gray-500 font-medium text-xs">Loading rewards...</p>
      </div>
    );
  }

  const rewardPoints = dashData?.reward_points ?? 0;
  const earnedBadges = dashData?.badges ?? [];
  const totalDonations = dashData?.total_donations ?? 0;

  const allBadgeCatalog = [
    {
      title: 'First Drop Hero',
      icon: '🩸',
      desc: 'Make your first verified blood donation',
      requirement: '1 verified donation',
      isUnlocked: totalDonations >= 1
    },
    {
      title: 'Regular Responder',
      icon: '⭐',
      desc: 'Complete 5 verified blood donations',
      requirement: '5 verified donations',
      isUnlocked: totalDonations >= 5
    },
    {
      title: 'Life Saver Champion',
      icon: '🏆',
      desc: 'Complete 10 verified blood donations',
      requirement: '10 verified donations',
      isUnlocked: totalDonations >= 10
    },
    {
      title: 'Universal Angel',
      icon: '👑',
      desc: 'Verified universal donor (O-) with completed donation',
      requirement: 'O- blood group + 1 donation',
      isUnlocked: dashData?.profile?.blood_group === 'O-' && totalDonations >= 1
    },
    {
      title: 'Emergency STAT Hero',
      icon: '🚨',
      desc: 'Complete a verified emergency blood donation',
      requirement: '1 verified emergency donation',
      isUnlocked: earnedBadges.some((b: any) => b.name === 'Emergency STAT Hero')
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-gray-900">Rewards & Badges</h2>
        <p className="text-gray-500 text-sm">Reward points and achievement badges are earned exclusively through verified donations.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Points Card */}
        <div className="p-6 bg-gradient-to-r from-amber-500 to-amber-700 text-white rounded-3xl shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <Star className="w-8 h-8 text-yellow-200" />
            <div>
              <p className="text-xs uppercase font-bold text-amber-100">Reward Balance</p>
              <h3 className="text-3xl font-black">{rewardPoints} Points</h3>
            </div>
          </div>
          {rewardPoints === 0 ? (
            <p className="text-xs text-amber-100">
              You currently have 0 reward points. Points are awarded upon completion and verification of blood donations.
            </p>
          ) : (
            <p className="text-xs text-amber-100">
              Reward points are redeemable with partner healthcare facilities for health screenings and wellness vouchers.
            </p>
          )}
        </div>

        {/* Milestone Tracker */}
        <div className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm">
          <h4 className="font-bold text-gray-900 text-base mb-3">Donation Milestones</h4>
          <div className="space-y-3">
            {[1, 5, 10].map(milestone => {
              const reached = totalDonations >= milestone;
              const pct = Math.min(100, Math.round((totalDonations / milestone) * 100));
              return (
                <div key={milestone}>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className={reached ? 'text-gray-900' : 'text-gray-500'}>
                      {milestone} Donation{milestone > 1 ? 's' : ''} Milestone
                    </span>
                    <span className={reached ? 'text-emerald-600' : 'text-gray-400'}>
                      {reached ? 'Completed' : `${totalDonations} / ${milestone}`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${reached ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Badges Gallery */}
      <div>
        <h3 className="text-base font-bold text-gray-900 mb-4">Badges Gallery</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {allBadgeCatalog.map((b, i) => (
            <div
              key={i}
              className={`p-5 rounded-2xl border transition-all ${
                b.isUnlocked
                  ? 'bg-white border-amber-300 shadow-sm'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">{b.icon}</span>
                {b.isUnlocked ? (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                    Unlocked
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </div>
              <h4 className="font-bold text-gray-900 text-sm">{b.title}</h4>
              <p className="text-xs text-gray-500 mt-1">{b.desc}</p>
              <p className={`text-[11px] font-bold mt-3 ${b.isUnlocked ? 'text-amber-700' : 'text-gray-400'}`}>
                Requirement: {b.requirement}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Alerts & Reminders ────────────────────────────────────────────────────────
const NotificationsPage: React.FC = () => (
  <ResendNotificationsPanel
    portalTitle="Alerts & Reminders"
    portalSubtitle="Live emergency blood broadcasts, hospital request confirmations, and account updates"
    defaultCategory="donor_alert"
  />
);

// ─── Main Donor Container ──────────────────────────────────────────────────────
const DonorDashboard: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:ml-64">
        {/* Header - Mobile Responsive LifeLink branding */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-xl shrink-0 text-gray-700"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-gray-900 whitespace-nowrap leading-tight">
                Donor Portal
              </h2>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium whitespace-nowrap truncate max-w-[110px] sm:max-w-xs leading-tight">
                {user?.name || 'Registered Blood Donor'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ServerConnectionBadge />
            <Link
              to="/donor/emergency"
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-[#B71C1C] hover:bg-red-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 whitespace-nowrap"
              title="Emergency Needs"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Emergency Needs</span>
            </Link>
            <Link
              to="/donor/notifications"
              className="relative p-2 sm:p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 transition-colors shrink-0"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
          <Routes>
            <Route index element={<DashboardOverview />} />
            <Route path="health-profile" element={<HealthProfileAndEligibilityPage />} />
            <Route path="profile" element={<DonorProfile />} />
            <Route path="emergency" element={<EmergencyRequestsPage />} />
            <Route path="history" element={<DonationHistory />} />
            <Route path="rewards" element={<RewardsBadges />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default DonorDashboard;
