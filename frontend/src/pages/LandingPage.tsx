import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Droplets, Activity, Users, Clock, MapPin, Shield, Award, ChevronDown, Menu, X, ArrowRight, Phone, Mail, Globe } from 'lucide-react';

const LandingPage: React.FC = () => {
  const [mobileMenu, setMobileMenu] = useState(false);
  const navigate = useNavigate();

  const stats = [
    { number: '10,000+', label: 'Lives Saved', icon: Heart },
    { number: '500+', label: 'Hospitals Connected', icon: Activity },
    { number: '2,000+', label: 'Active Donors', icon: Users },
    { number: '100%', label: 'Safety Verified', icon: Shield },
  ];

  const features = [
    { icon: Activity, title: 'AI Demand Predictions', description: 'Smart blood demand forecasting using advanced analytics to prevent shortages.' },
    { icon: Shield, title: 'Physical Screening', description: 'Automated donor physical health assessments and eligibility verification.' },
    { icon: MapPin, title: 'Direct Hospital Matching', description: 'Instantly connect hospital blood requisitions with compatible community donors.' },
    { icon: Heart, title: 'Verified Donations', description: 'Streamlined donor arrivals, clinical screening assessments, and donation records.' },
    { icon: Users, title: 'Emergency Donor Network', description: 'Immediate notifications to verified community donors for urgent blood needs.' },
    { icon: Award, title: 'Reward System', description: 'Points and badges for donors to recognize and encourage lifesaving donations.' },
  ];

  const steps = [
    { step: '1', title: 'Register', description: 'Sign up as a hospital or donor on our smart healthcare platform.' },
    { step: '2', title: 'Request', description: 'Hospitals post emergency blood requisitions with patient priority.' },
    { step: '3', title: 'Assess & Donate', description: 'Eligible donors respond and complete clinical physical screening at hospital.' },
    { step: '4', title: 'Save Lives', description: 'Blood donations replenish hospital stock and save critical lives.' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-red-800 rounded-xl flex items-center justify-center">
                <Droplets className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                Life<span className="text-red-800">Link</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#home" className="text-gray-600 hover:text-red-800 transition-colors font-medium">Home</a>
              <a href="#about" className="text-gray-600 hover:text-red-800 transition-colors font-medium">About Us</a>
              <a href="#features" className="text-gray-600 hover:text-red-800 transition-colors font-medium">Features</a>
              <a href="#process" className="text-gray-600 hover:text-red-800 transition-colors font-medium">Process</a>
              <a href="#contact" className="text-gray-600 hover:text-red-800 transition-colors font-medium">Contact</a>
              <Link to="/login" className="px-5 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors font-medium">
                Login
              </Link>
            </div>

            <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2">
              {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="md:hidden bg-white border-t shadow-lg">
            <div className="px-4 py-3 space-y-3">
              <a href="#home" className="block text-gray-600 hover:text-red-800 font-medium" onClick={() => setMobileMenu(false)}>Home</a>
              <a href="#about" className="block text-gray-600 hover:text-red-800 font-medium" onClick={() => setMobileMenu(false)}>About Us</a>
              <a href="#features" className="block text-gray-600 hover:text-red-800 font-medium" onClick={() => setMobileMenu(false)}>Features</a>
              <a href="#process" className="block text-gray-600 hover:text-red-800 font-medium" onClick={() => setMobileMenu(false)}>Process</a>
              <a href="#contact" className="block text-gray-600 hover:text-red-800 font-medium" onClick={() => setMobileMenu(false)}>Contact</a>
              <Link to="/login" className="block w-full text-center px-5 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 font-medium">Login</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="home" className="pt-16 min-h-screen flex items-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-red-50"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-red-100 rounded-full opacity-30 blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-red-200 rounded-full opacity-20 blur-3xl"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fadeIn">
              <div className="inline-flex items-center gap-2 bg-red-100 text-red-800 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                <Heart className="w-4 h-4" />
                Blood AI – Smart Blood Management
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
                Every Drop of Blood Can{' '}
                <span className="text-red-800 relative">
                  Save a Life
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                    <path d="M2 10C50 2 100 2 150 6C200 10 250 4 298 8" stroke="#B71C1C" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                </span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                LifeLink connects hospitals and verified donors through AI-powered technology. 
                Get real-time emergency blood alerts, donor assessments, and smart matching to save lives faster.
              </p>
              <div className="flex flex-wrap gap-4 mb-10">
                <button onClick={() => navigate('/register/hospital')} className="px-6 py-3 bg-red-800 text-white rounded-xl hover:bg-red-900 transition-all shadow-lg shadow-red-200 flex items-center gap-2 font-semibold">
                  <Activity className="w-5 h-5" />
                  Register as Hospital
                </button>
                <button onClick={() => navigate('/register/donor')} className="px-6 py-3 bg-white text-red-800 border-2 border-red-200 rounded-xl hover:bg-red-50 transition-all flex items-center gap-2 font-semibold">
                  <Users className="w-5 h-5" />
                  Register as Donor
                </button>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="relative bg-gradient-to-br from-red-800 to-red-900 rounded-3xl p-8 text-white shadow-2xl">
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Droplets className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-6">Save Lives, One Drop at a Time</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-white/10 rounded-xl">
                    <Heart className="w-8 h-8 text-red-200 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Emergency Matching</p>
                      <p className="text-red-200 text-xs">AI-powered donor-hospital matching</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-white/10 rounded-xl">
                    <Shield className="w-8 h-8 text-red-200 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Verified Donor Network</p>
                      <p className="text-red-200 text-xs">FDA-compliant eligibility screening</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-white/10 rounded-xl">
                    <Award className="w-8 h-8 text-red-200 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Donor Reward Program</p>
                      <p className="text-red-200 text-xs">Earn points for every verified donation</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-red-700/50">
                  <p className="text-sm text-red-200">Join thousands of verified donors making a difference every day.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <a href="#about" className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-8 h-8 text-red-800" />
        </a>
      </section>

      {/* Stats */}
      <section className="py-16 bg-red-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <stat.icon className="w-8 h-8 mx-auto mb-3 opacity-80" />
                <div className="text-3xl font-bold mb-1">{stat.number}</div>
                <div className="text-red-200 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-red-800 font-semibold text-sm uppercase tracking-wider">About Us</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-2 mb-4">Revolutionizing Blood Management</h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">
              LifeLink is an AI-powered platform that bridges the gap between blood supply and demand, 
              ensuring every patient gets the blood they need, when they need it.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="p-8 rounded-2xl bg-gradient-to-br from-red-50 to-white border border-red-100">
              <div className="w-14 h-14 bg-red-800 rounded-xl flex items-center justify-center mb-4">
                <Activity className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">For Hospitals</h3>
              <p className="text-gray-600">Post emergency requisitions, review donor health reports, conduct physical donor assessments, and access AI-predicted demand insights.</p>
            </div>
            <div className="p-8 rounded-2xl bg-gradient-to-br from-red-50 to-white border border-red-100">
              <div className="w-14 h-14 bg-red-800 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">For Donors</h3>
              <p className="text-gray-600">Register, receive emergency hospital alerts, attend clinical screening, earn rewards, and track your complete lifesaving donation history.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-red-800 font-semibold text-sm uppercase tracking-wider">Features</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-2 mb-4">Powerful Features for Everyone</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-gray-100">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-red-800" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-red-800 font-semibold text-sm uppercase tracking-wider">How It Works</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-2 mb-4">Blood Donation Process</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="text-center relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-red-200">
                    <ArrowRight className="absolute right-0 -top-2 w-4 h-4 text-red-400" />
                  </div>
                )}
                <div className="w-16 h-16 bg-red-800 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg shadow-red-200">
                  {step.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-red-800 to-red-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Heart className="w-16 h-16 mx-auto mb-6 opacity-80" />
          <h2 className="text-4xl font-bold mb-4">Ready to Save Lives?</h2>
          <p className="text-red-200 text-lg mb-8">Join our network of hospitals and donors. Every connection saves a life.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register" className="px-8 py-3 bg-white text-red-800 rounded-xl font-semibold hover:bg-red-50 transition-colors shadow-lg">
              Get Started Today
            </Link>
            <Link to="/login" className="px-8 py-3 border-2 border-white text-white rounded-xl font-semibold hover:bg-white/10 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-red-800 font-semibold text-sm uppercase tracking-wider">Contact</span>
            <h2 className="text-4xl font-bold text-gray-900 mt-2 mb-4">Get In Touch</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
              <Phone className="w-8 h-8 text-red-800 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Phone</h3>
              <p className="text-gray-600 text-sm">+1 (800) LIFELINK</p>
            </div>
            <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
              <Mail className="w-8 h-8 text-red-800 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
              <p className="text-gray-600 text-sm">support@lifelink.health</p>
            </div>
            <div className="text-center p-6 bg-white rounded-2xl shadow-sm">
              <Globe className="w-8 h-8 text-red-800 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Website</h3>
              <p className="text-gray-600 text-sm">www.lifelink.health</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-red-800 rounded-lg flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold">LifeLink</span>
              </div>
              <p className="text-gray-400 text-sm">AI-powered blood management system connecting hospitals and donors.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <a href="#home" className="block hover:text-white transition-colors">Home</a>
                <a href="#about" className="block hover:text-white transition-colors">About</a>
                <a href="#features" className="block hover:text-white transition-colors">Features</a>
                <a href="#contact" className="block hover:text-white transition-colors">Contact</a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Register</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <Link to="/register/hospital" className="block hover:text-white transition-colors">Hospital</Link>
                <Link to="/register/donor" className="block hover:text-white transition-colors">Donor</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <a href="#" className="block hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="block hover:text-white transition-colors">Terms of Service</a>
                <a href="#" className="block hover:text-white transition-colors">HIPAA Compliance</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>&copy; {new Date().getFullYear()} LifeLink – Blood AI Smart Blood Management System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
