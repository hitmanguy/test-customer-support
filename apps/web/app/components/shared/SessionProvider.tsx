'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'agent' | 'company';
}

interface SessionContextType {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  isAuthenticated: false,
  setUser: () => {},
  logout: () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    // Create a session for new users
    const isNewUser = !localStorage.getItem('visited');
    if (isNewUser) {
      localStorage.setItem('visited', 'true');
      // Don't set user - they need to sign up first
      return;
    }

    // Check for existing session
    const sessionUser = localStorage.getItem('user');
    if (sessionUser) {
      try {
        setUser(JSON.parse(sessionUser));
      } catch {
        localStorage.removeItem('user');
      }
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
    router.push('/');
  };

  return (
    <SessionContext.Provider 
      value={{
        user,
        isAuthenticated: !!user,
        setUser: (newUser) => {
          setUser(newUser);
          if (newUser) {
            localStorage.setItem('user', JSON.stringify(newUser));
          }
        },
        logout
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}