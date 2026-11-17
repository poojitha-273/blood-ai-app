import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Blood Bank role and dashboard have been completely removed.
 * LifeLink operates exclusively on two user roles: HOSPITAL and DONOR.
 * Any incoming traffic to /blood-bank is cleanly redirected to /hospital.
 */
const BloodBankDashboard: React.FC = () => {
  return <Navigate to="/hospital" replace />;
};

export default BloodBankDashboard;
