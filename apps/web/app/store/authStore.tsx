'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'agent' | 'company';
  image?: string;
  verified: boolean;
}

interface AuthStore {
  token: string | null;
  user: User | null;
  selectedCompanyId: string | null;
  setAuth: (token: string, user: User) => void;
  setSelectedCompany: (companyId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      selectedCompanyId: null,
      setAuth: (token, user) => set({ token, user }),
      setSelectedCompany: (companyId) => set({ selectedCompanyId: companyId }),
      logout: () => {
        // Clear all auth data
        set({ token: null, user: null, selectedCompanyId: null });
        
        // Clear localStorage
        localStorage.removeItem('auth-storage');
        
        // Clear any other auth-related storage
        sessionStorage.removeItem('auth_state');
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        selectedCompanyId: state.selectedCompanyId,
      }),
    }
  )
);