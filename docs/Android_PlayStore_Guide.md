# 🤖 Android Play Store Deployment Guide

To deploy MyLifeDock to the Google Play Store, we must generate a Signed Android App Bundle (`.aab`).

## 1. Generate the Keystore
Open PowerShell in the `android/app` directory and generate your signing key:
```powershell
keytool -genkey -v -keystore mylifedock-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias mylifedock
```
*(Store this `.jks` file securely in your own encrypted vault! If you lose it, you cannot push updates to the Play Store).*

## 2. Configure gradle.properties
In `android/gradle.properties`, append these lines:
```properties
MYLIFEDOCK_RELEASE_STORE_FILE=mylifedock-release-key.jks
MYLIFEDOCK_RELEASE_KEY_ALIAS=mylifedock
MYLIFEDOCK_RELEASE_STORE_PASSWORD=your_password_here
MYLIFEDOCK_RELEASE_KEY_PASSWORD=your_password_here
```

## 3. Update build.gradle
In `android/app/build.gradle`, add the release signing config:
```groovy
android {
    signingConfigs {
        release {
            if (project.hasProperty('MYLIFEDOCK_RELEASE_STORE_FILE')) {
                storeFile file(MYLIFEDOCK_RELEASE_STORE_FILE)
                storePassword MYLIFEDOCK_RELEASE_STORE_PASSWORD
                keyAlias MYLIFEDOCK_RELEASE_KEY_ALIAS
                keyPassword MYLIFEDOCK_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

## 4. Build the AAB
Run this from the root of the app directory:
```powershell
npm run build
npx cap sync android
cd android
./gradlew bundleRelease
```

The final file will be located at `android/app/build/outputs/bundle/release/app-release.aab`. Upload this file to the Google Play Console!
