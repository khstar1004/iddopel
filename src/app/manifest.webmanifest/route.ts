import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "ID 도플갱어",
    short_name: "ID도플갱어",
    description: "아이디 공개 계정 후보와 정밀 리포트",
    start_url: "/",
    display: "standalone",
    background_color: "#090A0F",
    theme_color: "#090A0F",
    lang: "ko-KR",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  });
}
