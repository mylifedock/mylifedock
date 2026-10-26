import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mylifedock.app',
  appName: 'MyLifeDock',
  webDir: 'dist',
  plugins: {
    SocialLogin: {
      // Only Google sign-in (for Drive backup) is bundled; the other providers'
      // SDKs, including Facebook's, are left out of the Android and iOS apps.
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
      logLevel: 1,
    },
  },
};

export default config;
