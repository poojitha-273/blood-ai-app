import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HospitalDashboard from './pages/hospital/HospitalDashboard';
import DonorDashboard from './pages/donor/DonorDashboard';

const DashboardRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  switch (user.role) {
    case 'hospital': return <Navigate to="/hospital" />;
    case 'donor': return <Navigate to="/donor" />;
    default: return <Navigate to="/" />;
  }
};

function App() {
  const appRoutes = (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" toastOptions={{
          duration: 4000,
          style: { background: '#333', color: '#fff' }
        }} />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/register/:role" element={<RegisterPage />} />
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route path="/hospital/*" element={
            <ProtectedRoute allowedRoles={['hospital']}>
              <HospitalDashboard />
            </ProtectedRoute>
          } />
          {/* Blood Bank role removed: redirect any legacy /blood-bank URLs cleanly to hospital */}
          <Route path="/blood-bank/*" element={<Navigate to="/hospital" replace />} />
          <Route path="/donor/*" element={
            <ProtectedRoute allowedRoles={['donor']}>
              <DonorDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );

  if (!GOOGLE_MAPS_API_KEY) {
    return appRoutes;
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['marker']}>
      {appRoutes}
    </APIProvider>
  );
}

export default App;
