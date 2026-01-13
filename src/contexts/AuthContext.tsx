import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole, ROLE_CONFIGS } from '@/types/roles';
import { SignUpData } from '@/components/auth/SignUpForm';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Session, AuthError } from '@supabase/supabase-js';

/**
 * Authentication Context Type
 * Defines all authentication-related methods and state
 */
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  hasSelectedDataSource: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signUp: (data: SignUpData) => Promise<boolean>;
  verifyOTP: (email: string, otp: string) => Promise<boolean>;
  resendOTP: (email: string) => Promise<void>;
  logout: () => void;
  selectDataSource: () => void;
  getRoleConfig: () => typeof ROLE_CONFIGS[UserRole] | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Demo users for each role (for backwards compatibility when Supabase is not configured)
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

/**
 * Maps department name to appropriate user role
 */
function mapDepartmentToRole(department: string): UserRole {
  const roleMap: Record<string, UserRole> = {
    'Quality Assurance': 'qa',
    'Quality Control': 'qc',
    'Manufacturing': 'production',
    'Regulatory Affairs': 'regulatory',
    'Research & Development': 'qc',
    'Business Development': 'sales',
    'Executive Leadership': 'management',
    'Information Technology': 'admin',
    'Supply Chain': 'production',
    'Clinical Operations': 'qc',
    'Others': 'qa', // Default role for Others
  };
  return roleMap[department] || 'qa';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hasSelectedDataSource, setHasSelectedDataSource] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingVerification, setPendingVerification] = useState<{
    email: string;
    name: string;
    phone?: string;
    department: string;
  } | null>(null);

  /**
   * Initialize authentication state from Supabase session
   * Runs on mount to restore logged-in user
   */
  useEffect(() => {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.warn('⚠️  Supabase not configured. Using demo mode.');
      setIsLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserFromSession(session);
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserFromSession(session);
      } else {
        setUser(null);
        setHasSelectedDataSource(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Loads user data from Supabase session
   */
  const loadUserFromSession = async (session: Session) => {
    const supabaseUser = session.user;
    
    // Get user metadata
    const metadata = supabaseUser.user_metadata;
    const role = mapDepartmentToRole(metadata.department || 'Others');

    const user: User = {
      id: supabaseUser.id,
      name: metadata.name || metadata.full_name || 'User',
      email: supabaseUser.email || '',
      role: role,
      department: metadata.department || 'Others',
      lastLogin: new Date().toISOString(),
    };

    setUser(user);
  };

  /**
   * Login function - authenticates user with Supabase
   */
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      // Check if Supabase is configured
      if (!isSupabaseConfigured()) {
        // Fallback to demo mode
        console.warn('Using demo mode - Supabase not configured');
        const demoUser = Object.values(DEMO_USERS).find(
          (u) => u.email.toLowerCase() === email.toLowerCase()
        );
        if (demoUser && password.length >= 1) {
          setUser({ ...demoUser, lastLogin: new Date().toISOString() });
          return true;
        }
        return false;
      }

      // Authenticate with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error.message);
        return false;
      }

      if (data.session) {
        await loadUserFromSession(data.session);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login exception:', error);
      return false;
    }
  }, []);

  /**
   * Sign up function - registers new user with Supabase
   * Creates account and sends confirmation email with OTP
   */
  const signUp = useCallback(async (data: SignUpData): Promise<boolean> => {
    try {
      // Check if Supabase is configured
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured. Please add your credentials to .env file.');
      }

      // Store signup data for after email verification
      setPendingVerification({
        email: data.email,
        name: data.name,
        phone: data.phone,
        department: data.department,
      });

      // Create user account with email confirmation
      // Supabase will automatically send a confirmation email with 6-digit OTP
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            full_name: data.name,
            phone: data.phone,
            department: data.department,
            role: mapDepartmentToRole(data.department),
          },
          // Don't specify emailRedirectTo for OTP flow
        },
      });

      if (signUpError) {
        console.error('Sign-up error:', signUpError.message);
        throw new Error(signUpError.message);
      }

      if (!authData.user) {
        throw new Error('Sign-up failed. Please try again.');
      }

      // Check if email confirmation is required
      if (authData.user && !authData.user.email_confirmed_at) {
        console.log('✅ Sign-up successful! Verification code sent to:', data.email);
        console.log('⚠️  Check your email (including spam folder) for the 6-digit OTP code');
        return true;
      }

      // If auto-confirmed (shouldn't happen), load user immediately
      if (authData.session) {
        await loadUserFromSession(authData.session);
        setPendingVerification(null);
      }

      return true;
    } catch (error) {
      console.error('Sign-up exception:', error);
      throw error;
    }
  }, []);

  /**
   * Verify OTP function - validates email confirmation code
   * This confirms the user's email and allows them to sign in
   */
  const verifyOTP = useCallback(
    async (email: string, otp: string): Promise<boolean> => {
      try {
        // Check if Supabase is configured
        if (!isSupabaseConfigured()) {
          throw new Error('Supabase is not configured.');
        }

        // Verify the email confirmation token
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: otp,
          type: 'email', // This confirms the email and allows login
        });

        if (error) {
          console.error('OTP verification error:', error.message);
          
          // Provide user-friendly error messages
          if (error.message.includes('expired')) {
            throw new Error('This code has expired. Please request a new one.');
          } else if (error.message.includes('invalid') || error.message.includes('Token')) {
            throw new Error('Invalid code. Please check and try again.');
          } else {
            throw new Error(error.message);
          }
        }

        // Check if verification was successful
        if (data.session) {
          await loadUserFromSession(data.session);
          setPendingVerification(null);
          console.log('✅ Email verified successfully! You are now logged in.');
          return true;
        }

        // If no session but user exists, verification succeeded
        if (data.user) {
          console.log('✅ Email verified! You can now sign in with your credentials.');
          setPendingVerification(null);
          return true;
        }

        throw new Error('Verification failed. Please try again.');
      } catch (error) {
        console.error('OTP verification exception:', error);
        throw error;
      }
    },
    []
  );

  /**
   * Resend OTP function - requests new OTP from Supabase
   */
  const resendOTP = useCallback(async (email: string): Promise<void> => {
    try {
      // Check if Supabase is configured
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured.');
      }

      // Resend OTP via Supabase
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        console.error('Resend OTP error:', error.message);
        throw new Error(error.message);
      }

      console.log('✅ New OTP sent to:', email);
    } catch (error) {
      console.error('Resend OTP exception:', error);
      throw error;
    }
  }, []);

  /**
   * Logout function - signs out from Supabase
   */
  const logout = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
      }
      setUser(null);
      setHasSelectedDataSource(false);
      setPendingVerification(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const selectDataSource = useCallback(() => {
    setHasSelectedDataSource(true);
  }, []);

  const getRoleConfig = useCallback(() => {
    if (!user) return null;
    return ROLE_CONFIGS[user.role];
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      hasSelectedDataSource,
      login,
      signUp,
      verifyOTP,
      resendOTP,
      logout,
      selectDataSource,
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
