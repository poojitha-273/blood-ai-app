import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Droplets, User, Mail, Lock, Phone, MapPin, Building, Eye, EyeOff, AlertCircle, Activity, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ServerConnectionBadge } from '../components/ServerSettingsModal';
import toast from 'react-hot-toast';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const RegisterPage: React.FC = () => {
  const { role: urlRole } = useParams();
  const initialRole = urlRole === 'blood_bank' ? 'hospital' : urlRole || '';
  const [role, setRole] = useState<string>(initialRole);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', phone: '', address: '', city: '', state: '',
    bloodGroup: '',
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
    }
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (!formData.name || formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters.';
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!formData.password || formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }
    const digits = formData.phone.replace(/\D/g, '');
    if (digits.length < 7) {
      errors.phone = 'Please enter a valid phone number (at least 7 digits).';
    }
    if (!formData.city || formData.city.trim().length < 2) {
      errors.city = 'City must be at least 2 characters.';
    }
    if (!formData.state || formData.state.trim().length < 2) {
      errors.state = 'State must be at least 2 characters.';
    }
    if (!formData.address || formData.address.trim().length < 5 || !/[a-zA-Z]/.test(formData.address)) {
      errors.address = 'Please enter a valid address (at least 5 characters with letters).';
    }
    if (role === 'donor' && !formData.bloodGroup) {
      errors.bloodGroup = 'Please select your blood group.';
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setLoading(true);

    try {
      await register({ ...formData, role });
      toast.success('Account created successfully! Welcome to LifeLink.');
      navigate('/dashboard');
    } catch (err: any) {
      if (err.errors && typeof err.errors === 'object') {
        setFieldErrors(err.errors);
      }
      setError(err.message || 'Registration failed');
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-12 h-12 bg-red-800 rounded-xl flex items-center justify-center">
                <Droplets className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Life<span className="text-red-800">Link</span></span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Role</h2>
            <p className="text-gray-500 mb-8">Select how you want to use LifeLink</p>

            <div className="space-y-4">
              <button onClick={() => setRole('hospital')} className="w-full p-6 border-2 border-gray-200 rounded-2xl hover:border-red-800 hover:bg-red-50 transition-all text-left flex items-center gap-4 group">
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Activity className="w-7 h-7 text-blue-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Hospital</h3>
                  <p className="text-sm text-gray-500">Create emergency blood requests, donor assessments & physical screenings</p>
                </div>
              </button>

              <button onClick={() => setRole('donor')} className="w-full p-6 border-2 border-gray-200 rounded-2xl hover:border-red-800 hover:bg-red-50 transition-all text-left flex items-center gap-4 group">
                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <Users className="w-7 h-7 text-purple-700" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Donor / Public</h3>
                  <p className="text-sm text-gray-500">Donate blood, undergo screening & respond to hospital needs</p>
                </div>
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account? <Link to="/login" className="text-red-800 font-semibold hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const roleLabels: Record<string, string> = { hospital: 'Hospital', donor: 'Donor' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-red-800 rounded-xl flex items-center justify-center">
              <Droplets className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">Life<span className="text-red-800">Link</span></span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setRole('')} className="text-gray-400 hover:text-gray-600">&larr;</button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Register as {roleLabels[role]}</h2>
              <p className="text-gray-500 text-sm">Fill in your details to create an account</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {role === 'donor' ? 'Full Name' : 'Organization Name'}
              </label>
              <div className="relative">
                {role === 'donor' ? <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /> : <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />}
                <input type="text" value={formData.name} onChange={(e) => updateField('name', e.target.value)} className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${fieldErrors.name ? 'border-red-500' : 'border-gray-200'}`} placeholder={role === 'donor' ? 'John Doe' : 'Organization name'} />
              </div>
              {fieldErrors.name && <p className="text-red-600 text-xs mt-1">{fieldErrors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${fieldErrors.email ? 'border-red-500' : 'border-gray-200'}`} placeholder="you@example.com" />
              </div>
              {fieldErrors.email && <p className="text-red-600 text-xs mt-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} value={formData.password} onChange={(e) => updateField('password', e.target.value)} className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${fieldErrors.password ? 'border-red-500' : 'border-gray-200'}`} placeholder="Min 6 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-red-600 text-xs mt-1">{fieldErrors.password}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${fieldErrors.phone ? 'border-red-500' : 'border-gray-200'}`} placeholder="+1 234 567 8900" />
              </div>
              {fieldErrors.phone && <p className="text-red-600 text-xs mt-1">{fieldErrors.phone}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input type="text" value={formData.city} onChange={(e) => updateField('city', e.target.value)} className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${fieldErrors.city ? 'border-red-500' : 'border-gray-200'}`} placeholder="City" />
                {fieldErrors.city && <p className="text-red-600 text-xs mt-1">{fieldErrors.city}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input type="text" value={formData.state} onChange={(e) => updateField('state', e.target.value)} className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${fieldErrors.state ? 'border-red-500' : 'border-gray-200'}`} placeholder="State" />
                {fieldErrors.state && <p className="text-red-600 text-xs mt-1">{fieldErrors.state}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <textarea value={formData.address} onChange={(e) => updateField('address', e.target.value)} className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none ${fieldErrors.address ? 'border-red-500' : 'border-gray-200'}`} rows={2} placeholder="Full address" />
              </div>
              {fieldErrors.address && <p className="text-red-600 text-xs mt-1">{fieldErrors.address}</p>}
            </div>

            {role === 'donor' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                <select value={formData.bloodGroup} onChange={(e) => updateField('bloodGroup', e.target.value)} className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white ${fieldErrors.bloodGroup ? 'border-red-500' : 'border-gray-200'}`}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
                {fieldErrors.bloodGroup && <p className="text-red-600 text-xs mt-1">{fieldErrors.bloodGroup}</p>}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full py-3 bg-red-800 text-white rounded-xl font-semibold hover:bg-red-900 transition-colors disabled:opacity-50 mt-2">
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account? <Link to="/login" className="text-red-800 font-semibold hover:underline">Sign In</Link>
          </p>

          <div className="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span className="text-[11px] font-medium text-gray-400">Server Host:</span>
            <ServerConnectionBadge />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
