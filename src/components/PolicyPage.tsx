import Link from "next/link";
import type { ReactNode } from "react";
import { BrandIcon } from "./BrandIcon";

export function PolicyPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="light-section brand-surface" style={{ minHeight: "100vh", padding: "24px 0 64px" }}>
      <div className="container">
        <header className="topbar">
          <Link className="brand-mark" href="/" style={{ color: "#191f28" }}>
            <BrandIcon />
            <span>ID 도플갱어</span>
          </Link>
          <nav className="nav-links" aria-label="정책 링크">
            <Link href="/privacy">개인정보</Link>
            <Link href="/terms">이용약관</Link>
            <Link href="/responsible-use">책임 있는 사용</Link>
          </nav>
        </header>
        <article className="panel" style={{ maxWidth: 840, margin: "32px auto 0" }}>
          <h1 style={{ marginTop: 0 }}>{title}</h1>
          <div style={{ display: "grid", gap: 20, lineHeight: 1.75 }}>{children}</div>
        </article>
      </div>
    </main>
  );
}
