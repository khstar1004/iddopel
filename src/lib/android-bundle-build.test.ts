import { describe, expect, it } from "vitest";
// @ts-ignore - This test exercises the Node Android bundle verifier directly.
import { resolveAndroidUploadSigningConfig } from "../../scripts/verify-android-bundle-build.mjs";

const envKey = (...parts: string[]) => parts.join("_");
const keystoreBase64Key = envKey("GOOGLE", "PLAY", "UPLOAD", "KEYSTORE", "BASE64");
const keystorePathKey = envKey("GOOGLE", "PLAY", "UPLOAD", "KEYSTORE", "PATH");
const keystorePasswordKey = envKey("GOOGLE", "PLAY", "UPLOAD", "KEYSTORE", "PASSWORD");
const keyAliasKey = envKey("GOOGLE", "PLAY", "UPLOAD", "KEY", "ALIAS");
const keyPasswordKey = envKey("GOOGLE", "PLAY", "UPLOAD", "KEY", "PASSWORD");

describe("android release bundle verifier", () => {
  it("allows local unsigned release bundle compile checks by default", () => {
    const signing = resolveAndroidUploadSigningConfig({});

    expect(signing).toMatchObject({
      required: false,
      configured: false,
      source: "none"
    });
    expect(signing.missing).toContain("GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64 or GOOGLE_PLAY_UPLOAD_KEYSTORE_PATH");
  });

  it("fails release signing readiness when production mode requires upload signing", () => {
    const signing = resolveAndroidUploadSigningConfig({ ANDROID_RELEASE_SIGNING_REQUIRED: "true" });

    expect(signing.required).toBe(true);
    expect(signing.configured).toBe(false);
    expect(signing.missing).toEqual(
      expect.arrayContaining([
        "GOOGLE_PLAY_UPLOAD_KEYSTORE_BASE64 or GOOGLE_PLAY_UPLOAD_KEYSTORE_PATH",
        "GOOGLE_PLAY_UPLOAD_KEYSTORE_PASSWORD",
        "GOOGLE_PLAY_UPLOAD_KEY_ALIAS",
        "GOOGLE_PLAY_UPLOAD_KEY_PASSWORD"
      ])
    );
  });

  it("accepts CI-friendly base64 upload keystore settings", () => {
    const signing = resolveAndroidUploadSigningConfig({
      STORE_RELEASE_CHECK: "true",
      [keystoreBase64Key]: "bm90LWEtcmVhbC1rZXlzdG9yZQ==",
      [keystorePasswordKey]: "not-a-real-store-password",
      [keyAliasKey]: "upload",
      [keyPasswordKey]: "not-a-real-key-password"
    });

    expect(signing).toEqual({
      required: true,
      configured: true,
      source: "base64",
      missing: []
    });
  });

  it("accepts local upload keystore path settings", () => {
    const signing = resolveAndroidUploadSigningConfig({
      MOBILE_RELEASE_CHECK: "true",
      [keystorePathKey]: "C:/local/signing/upload-key.jks",
      [keystorePasswordKey]: "not-a-real-store-password",
      [keyAliasKey]: "upload",
      [keyPasswordKey]: "not-a-real-key-password"
    });

    expect(signing).toEqual({
      required: true,
      configured: true,
      source: "path",
      missing: []
    });
  });
});
