'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { jwtDecode } from 'jwt-decode';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'agent' | 'company';
  image?: string;
  picture?: string;
  verified: boolean;
  companyId?: string;
  authType?: 'local' | 'google';
  requiresKnowledgeBase?: boolean;
}

interface JwtPayload {
  exp: number;
  iat: number;
  id: string;
  email: string;
  role: 'customer' | 'agent' | 'company';
  requiresKnowledgeBase?: boolean;
}

interface AuthStore {
  token: string | null;
  user: User | null;
  selectedCompanyId: string | null;
  isLoading: boolean;
  isTokenExpired: () => boolean;
  getTokenExpiryTime: () => number;
  getTokenRemainingTime: () => number;
  setAuth: (token: string, user: User) => void;
  setSelectedCompany: (companyId: string) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      selectedCompanyId: null,
      isLoading: true,
      
      isTokenExpired: () => {
        const token = get().token;
        if (!token) return true;
        
        try {
          const decodedToken = jwtDecode<JwtPayload>(token);
          const currentTime = Date.now() / 1000;
          
          
          return decodedToken.exp < currentTime + 300;
        } catch (error) {
          console.error('Error decoding token:', error);
          return true;
        }
      },
      
      getTokenExpiryTime: () => {
        const token = get().token;
        if (!token) return 0;
        
        try {
          const decodedToken = jwtDecode<JwtPayload>(token);
          return decodedToken.exp;
        } catch (error) {
          return 0;
        }
      },
      
      getTokenRemainingTime: () => {
        const token = get().token;
        if (!token) return 0;
        
        try {
          const decodedToken = jwtDecode<JwtPayload>(token);
          const currentTime = Math.floor(Date.now() / 1000);
          return Math.max(0, decodedToken.exp - currentTime);
        } catch (error) {
          return 0;
        }
      },
      
      setAuth: (token, user) => {
        
        const selectedCompanyId = user.companyId || get().selectedCompanyId;
        set({ token, user, selectedCompanyId, isLoading: false });
      },
      
      setSelectedCompany: (companyId) => set({ selectedCompanyId: companyId }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      logout: () => {
        
        set({ token: null, user: null, selectedCompanyId: null, isLoading: false });
        
        
        if (typeof window !== 'undefined') {
          
          localStorage.removeItem('auth-storage');
          
          
          const authKeys = ['auth_state', 'auth_redirect_path', 'last_auth_check'];
          authKeys.forEach(key => sessionStorage.removeItem(key));
          
          
          document.cookie.split(';').forEach(cookie => {
            const [name] = cookie.trim().split('=');
            if (name.includes('auth') || name.includes('token')) {
              
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
            }
          });
          
          
          try {
            const cacheKeys = Object.keys(localStorage);
            cacheKeys.forEach(key => {
              if (key.includes('query-cache')) {
                localStorage.removeItem(key);
              }
            });
          } catch (e) {
            console.warn('Failed to clear cache data', e);
          }
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => {
        
        return typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        };
      }),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        selectedCompanyId: state.selectedCompanyId,
      }),
    }
  )
);