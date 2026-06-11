import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.iddoppelganger.app",
  appName: "ID 도플갱어",
  webDir: "native-web",
  ios: {
    path: "ios",
    scheme: "App",
    buildOptions: {
      signingStyle: "automatic",
      exportMethod: "app-store-connect"
    }
  },
  android: {
    path: "android"
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
