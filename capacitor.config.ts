import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mylifedock.app',
  appName: 'MyLifeDock',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.appdata'],
      serverClientId: '350340206913-cka41qrr5efnqbi2i353c7mnb68so1hk.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
