import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'owner' | 'admin' | 'manager' | 'kitchen' | 'waiter' | 'server' | 'customer';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  getDashboardPath: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Returns the default dashboard path based on the user's highest-priority role */
function resolveDashboard(roles: AppRole[]): string {
  if (roles.includes('owner')) return '/owner';
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('manager')) return '/admin';
  if (roles.includes('kitchen')) return '/kitchen';
  if (roles.includes('waiter')) return '/waiter';
  if (roles.includes('server')) return '/waiter';
  return '/account';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const roleRequest = useRef(0);
  const activeUserId = useRef<string | null>(null);

  const fetchRoles = async (userId: string) => {
    const request = ++roleRequest.current;
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      if (request !== roleRequest.current || activeUserId.current !== userId) return;
      if (error) console.error('Failed to load account roles:', error.message);
      setRoles((data ?? []).map(r => r.role as AppRole));
    } finally {
      if (request === roleRequest.current && activeUserId.current === userId) setLoading(false);
    }
  };

  useEffect(() => {
    let disposed = false;
    let receivedAuthEvent = false;
    const applySession = (nextSession: Session | null) => {
      if (disposed) return;
      const nextId = nextSession?.user.id ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextId !== activeUserId.current) {
        roleRequest.current++;
        activeUserId.current = nextId;
        setRoles([]);
      }
      if (nextId) {
        // Set loading before sign-in returns and the form navigates.
        setLoading(true);
        setTimeout(() => { if (!disposed && activeUserId.current === nextId) void fetchRoles(nextId); }, 0);
      } else {
        setRoles([]);
        setLoading(false);
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      applySession(nextSession);
    });
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      // A late initial-session lookup must not overwrite a newer sign-in.
      if (!receivedAuthEvent) applySession(initialSession);
    });
    return () => {
      disposed = true;
      // This ref is a request generation counter; invalidate pending responses.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      roleRequest.current++;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (r: AppRole[]) => r.some(role => roles.includes(role));
  const getDashboardPath = () => resolveDashboard(roles);

  return (
    <AuthContext.Provider value={{ session, user, roles, loading, signIn, signUp, signOut, hasRole, hasAnyRole, getDashboardPath }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
