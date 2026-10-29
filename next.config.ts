import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // firebase-admin y google-auth-library se cargan tal cual en el servidor.
  serverExternalPackages: ['firebase-admin', 'google-auth-library'],
  poweredByHeader: false,
};

export default nextConfig;
