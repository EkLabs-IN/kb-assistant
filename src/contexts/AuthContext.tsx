import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, UserRole, ROLE_CONFIGS } from '@/types/roles';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  getRoleConfig: () => typeof ROLE_CONFIGS[UserRole] | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users for each role
const DEMO_USERS: Record<UserRole, User> = {
  qa: {
    id: 'usr-qa-001',
    name: 'Sarah Chen',
    email: 'sarah.chen@pharma.com',
    role: 'qa',
    department: 'Quality Assurance',
    lastLogin: new Date().toISOString()
  },
  qc: {
    id: 'usr-qc-001',
    name: 'Michael Torres',
    email: 'michael.torres@pharma.com',
    role: 'qc',
    department: 'Quality Control',
    lastLogin: new Date().toISOString()
  },
  production: {
    id: 'usr-prod-001',
    name: 'Jennifer Walsh',
    email: 'jennifer.walsh@pharma.com',
    role: 'production',
    department: 'Manufacturing',
    lastLogin: new Date().toISOString()
  },
  regulatory: {
    id: 'usr-reg-001',
    name: 'David Kim',
    email: 'david.kim@pharma.com',
    role: 'regulatory',
    department: 'Regulatory Affairs',
    lastLogin: new Date().toISOString()
  },
  sales: {
    id: 'usr-sales-001',
    name: 'Amanda Foster',
    email: 'amanda.foster@pharma.com',
    role: 'sales',
    department: 'Business Development',
    lastLogin: new Date().toISOString()
  },
  management: {
    id: 'usr-mgmt-001',
    name: 'Robert Martinez',
    email: 'robert.martinez@pharma.com',
    role: 'management',
    department: 'Executive Leadership',
    lastLogin: new Date().toISOString()
  },
  admin: {
    id: 'usr-admin-001',
    name: 'IT Administrator',
    email: 'admin@pharma.com',
    role: 'admin',
    department: 'Information Technology',
    lastLogin: new Date().toISOString()
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, password: string, role: UserRole): Promise<boolean> => {
    // Simulated authentication - in production, this would validate against backend
    // For demo purposes, any non-empty password works
    if (password.length < 1) {
      return false;
    }

    const demoUser = { ...DEMO_USERS[role], email, lastLogin: new Date().toISOString() };
    setUser(demoUser);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const getRoleConfig = useCallback(() => {
    if (!user) return null;
    return ROLE_CONFIGS[user.role];
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout,
      getRoleConfig
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
