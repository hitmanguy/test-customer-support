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
          
          // Check if token is expired (with 5 minute buffer to allow refresh)
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
        // If user has a companyId, automatically set it as selected
        const selectedCompanyId = user.companyId || get().selectedCompanyId;
        set({ token, user, selectedCompanyId, isLoading: false });
      },
      
      setSelectedCompany: (companyId) => set({ selectedCompanyId: companyId }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      logout: () => {
        // Clear all auth data
        set({ token: null, user: null, selectedCompanyId: null, isLoading: false });
        
        // Clear localStorage and sessionStorage
        if (typeof window !== 'undefined') {
          // Clear auth storage
          localStorage.removeItem('auth-storage');
          
          // Clear all auth related session storage
          const authKeys = ['auth_state', 'auth_redirect_path', 'last_auth_check'];
          authKeys.forEach(key => sessionStorage.removeItem(key));
          
          // Remove any cookies related to authentication
          document.cookie.split(';').forEach(cookie => {
            const [name] = cookie.trim().split('=');
            if (name.includes('auth') || name.includes('token')) {
              // Clear cookie with various combinations to ensure removal
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
              document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`;
            }
          });
          
          // Clear any application specific caches
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
        // Only use localStorage in browser environment
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