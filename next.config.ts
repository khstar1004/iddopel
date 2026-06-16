import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.tosspayments.com https://stdpay.inicis.com https://stdux.inicis.com https://pagead2.googlesyndication.com",
  "style-src 'self' 'unsafe-inline' https://stdpay.inicis.com https://stdux.inicis.com",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.tosspayments.com https://stdpay.inicis.com https://stgstdpay.inicis.com https://fcstdpay.inicis.com https://ksstdpay.inicis.com https://stdux.inicis.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://*.adtrafficquality.google ws: wss: http://localhost:* http://127.0.0.1:*",
  "frame-src 'self' https://pay.toss.im https://*.tosspayments.com https://stdpay.inicis.com https://*.inicis.com https://stdux.inicis.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
  "form-action 'self' https://stdpay.inicis.com https://*.inicis.com https://stdux.inicis.com",
  "upgrade-insecure-requests"
].join("; ");

function securityHeaders(crossOriginOpenerPolicy: "same-origin" | "same-origin-allow-popups") {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Cross-Origin-Opener-Policy", value: crossOriginOpenerPolicy },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()"
    }
  ];
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders("same-origin")
      },
      {
        source: "/checkout/:path*",
        headers: securityHeaders("same-origin-allow-popups")
      },
      {
        source: "/payment/:path*",
        headers: securityHeaders("same-origin-allow-popups")
      }
    ];
  }
};

export default nextConfig;
