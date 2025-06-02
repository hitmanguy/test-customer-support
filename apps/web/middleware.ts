import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('authToken')?.value;
  
  // Define public paths that don't require authentication
  const publicPaths = [
    '/login', 
    '/register', 
    '/verify-email', 
    '/', 
    '/auth/google/callback',
    '/forgot-password',
    '/reset-password',
  ];
  
  // Static assets and API requests should pass through
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/trpc') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/i)
  ) {
    return NextResponse.next();
  }
  
  // Check if the path is public
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  // For auth callback from Google OAuth, allow and don't redirect
  if (pathname.startsWith('/auth/google/callback')) {
    return NextResponse.next();
  }

  // If user is on a protected route without auth, redirect to login
  if (!token && !isPublicPath) {
    // Store the original URL to redirect back after login
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', encodeURI(pathname));
    
    // Add a message to indicate why the user was redirected
    url.searchParams.set('message', 'Please log in to continue');
    
    return NextResponse.redirect(url);
  }

  // If token exists, check if it's valid
  if (token) {
    try {
      // Check token expiration
      const isTokenExpired = checkTokenExpiration(token);
      
      // If token is expired and not on a public path, redirect to login
      if (isTokenExpired && !isPublicPath) {
        const response = NextResponse.redirect(new URL('/login?message=Your session has expired. Please log in again.', request.url));
        // Remove the expired token
        response.cookies.delete('authToken');
        return response;
      }
      
      // If user is authenticated and tries to access auth pages, redirect to dashboard
      if (!isTokenExpired && (pathname === '/login' || pathname === '/register')) {
        // Extract user role from token for better redirection
        const userRole = extractRoleFromToken(token);
        if (userRole) {
          return NextResponse.redirect(new URL(`/${userRole}`, request.url));
        }
        // Default fallback if role extraction fails
        return NextResponse.redirect(new URL('/customer', request.url));
      }
    } catch (error) {
      // If token parsing fails, clear the token and redirect to login
      const response = NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
      response.cookies.delete('authToken');
      return response;
    }
  }

  return NextResponse.next();
}

// Check token expiration
function checkTokenExpiration(token: string): boolean {
  try {
    // Extract payload from JWT
    const payload = extractPayloadFromToken(token);
    if (!payload || !payload.exp) return true;
    
    // Check if token is expired (with a small buffer)
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // Assume expired if we can't verify
  }
}

// Helper function to extract payload from JWT token
function extractPayloadFromToken(token: string): any {
  try {
    // Simple JWT payload extraction (middle part of token)
    const base64Url = token.split('.')[1];
    if (!base64Url) throw new Error('Invalid token format');
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(
      typeof window !== 'undefined' 
        ? window.atob(base64) 
        : Buffer.from(base64, 'base64').toString()
    );
  } catch (error) {
    console.error('Failed to extract payload from token', error);
    return null;
  }
}

// Helper function to extract role from JWT token
function extractRoleFromToken(token: string): string | null {
  const payload = extractPayloadFromToken(token);
  return payload?.role || null;
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
