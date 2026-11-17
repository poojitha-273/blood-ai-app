import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'hospital' | 'donor';
  phone?: string;
  blood_group?: string;
  city?: string;
  state?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (email: string, token: string) => Promise<void>;
  sendEmailToken: (email: string, role?: string) => Promise<any>;
  register: (data: Record<string, unknown>) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const userData = await authAPI.getProfile() as User;
          setUser(userData);
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    loadUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    const response = await authAPI.login({ email, password }) as any;
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user);
  };

  const loginWithToken = async (email: string, verifyToken: string) => {
    const response = await authAPI.verifyToken(email, verifyToken) as any;
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user);
  };

  const sendEmailToken = async (email: string, role?: string) => {
    return await authAPI.sendToken(email, role);
  };

  const register = async (data: Record<string, unknown>) => {
    const response = await authAPI.register(data) as any;
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    setToken(response.token);
    setUser(response.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, loginWithToken, sendEmailToken, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
