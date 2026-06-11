import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, LockKeyhole, Radar, ShieldCheck } from "lucide-react";
import { getGuideUrl, getSeoGuide, seoGuides } from "@/lib/seo-guides";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return seoGuides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getSeoGuide(slug);
  if (!guide) return {};

  return {
    title: guide.title,
    description: guide.description,
    alternates: {
      canonical: getGuideUrl(guide.slug)
    },
    keywords: [guide.primaryKeyword, ...guide.secondaryKeywords],
    openGraph: {
      title: guide.title,
      description: guide.description,
      type: "article",
      locale: "ko_KR",
      url: getGuideUrl(guide.slug)
    }
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getSeoGuide(slug);
  if (!guide) notFound();

  const relatedGuides = seoGuides.filter((item) => item.slug !== guide.slug).slice(0, 3);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `${guide.primaryKeyword}는 사람 찾기 기능인가요?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: "아니요. ID 도플갱어는 사용자가 입력한 아이디 문자열의 공개 사용 현황만 점검하며 동일인 여부를 판정하지 않습니다."
        }
      },
      {
        "@type": "Question",
        name: "어떤 정보는 검색할 수 없나요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "실명, 전화번호, 이메일, 주민번호 형식, 위치 추정, 게시글 내용, 프로필 사진 검색은 지원하지 않습니다."
        }
      }
    ]
  };

  return (
    <main className="guide-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="container topbar">
        <a className="brand-mark" href="/" aria-label="ID 도플갱어 홈">
          <span className="brand-icon">
            <Radar size={19} aria-hidden />
          </span>
          <span>ID 도플갱어</span>
        </a>
        <nav className="nav-links" aria-label="가이드 링크">
          <a href="/">홈</a>
          <a href="/toss">토스 인앱</a>
          <a href="/responsible-use">책임 있는 사용</a>
        </nav>
      </header>

      <section className="container guide-hero" aria-labelledby="guide-title">
        <div>
          <span className="eyebrow">
            <ShieldCheck size={15} aria-hidden />
            {guide.primaryKeyword}
          </span>
          <h1 id="guide-title">{guide.h1}</h1>
          <p>{guide.description}</p>
          <div className="guide-actions">
            <a className="primary-button" href="/#scan">
              {guide.cta}
              <ArrowRight size={18} aria-hidden />
            </a>
            <a className="ghost-button" href="/responsible-use">
              안전 정책 보기
            </a>
          </div>
        </div>
        <aside className="guide-summary" aria-label="점검 요약">
          <div className="score-pill" data-tone="high">
            공개 username 점검
          </div>
          <strong>{guide.primaryKeyword}</strong>
          <span>{guide.secondaryKeywords.join(" · ")}</span>
        </aside>
      </section>

      <section className="section light-section">
        <div className="container guide-grid">
          <article className="panel">
            <h2>언제 쓰나요?</h2>
            <p>{guide.scenario}</p>
          </article>
          <article className="panel">
            <h2>무료 결과에서 보는 것</h2>
            <p>{guide.resultCopy}</p>
          </article>
          <article className="panel">
            <h2>안전한 범위</h2>
            <p>{guide.safetyCopy}</p>
          </article>
        </div>
      </section>

      {guide.comparison ? (
        <section className="section light-section">
          <div className="container">
            <div className="section-header">
              <div>
                <h2>비교 요약</h2>
                <p>
                  {guide.comparison.competitorName}의 강점은 인정하면서, ID 도플갱어가 더 잘 맞는 사용 상황을 분리했습니다.
                </p>
              </div>
              <a className="ghost-button" href={guide.comparison.sourceUrl} target="_blank" rel="noopener noreferrer">
                공식 자료 확인
                <ArrowRight size={16} aria-hidden />
              </a>
            </div>
            <div className="comparison-grid">
              <article className="panel comparison-panel">
                <h3>{guide.comparison.competitorName}가 잘 맞는 경우</h3>
                <p>{guide.comparison.bestForCompetitor}</p>
                <ul className="guide-list">
                  {guide.comparison.competitorStrengths.map((item) => (
                    <li key={item}>
                      <span>{item}</span>
                      <CheckCircle2 size={16} aria-hidden />
                    </li>
                  ))}
                </ul>
              </article>
              <article className="panel comparison-panel">
                <h3>ID 도플갱어가 더 잘 맞는 경우</h3>
                <p>{guide.comparison.bestForIdDoppelganger}</p>
                <ul className="guide-list">
                  {guide.comparison.idDoppelgangerAdvantages.map((item) => (
                    <li key={item}>
                      <span>{item}</span>
                      <CheckCircle2 size={16} aria-hidden />
                    </li>
                  ))}
                </ul>
              </article>
            </div>
            <div className="comparison-note" role="note">
              <strong>정직한 한계</strong>
              <span>{guide.comparison.honestLimit}</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section light-section">
        <div className="container results-grid">
          <section className="panel">
            <h2>리포트 구성</h2>
            <ul className="guide-list" style={{ marginTop: 14 }}>
              {["ID 도플갱어 점수", "공개 계정 후보 수", "국가·카테고리 분포", "방치 계정 정리 가이드"].map((item) => (
                <li key={item}>
                  <span>{item}</span>
                  <CheckCircle2 size={16} aria-hidden />
                </li>
              ))}
              <li>
                <span>전체 URL과 PDF/HTML 리포트</span>
                <LockKeyhole size={16} aria-hidden />
              </li>
            </ul>
          </section>
          <section className="panel">
            <h2>관련 가이드</h2>
            <div className="result-list">
              {relatedGuides.map((item) => (
                <a className="result-row" href={getGuideUrl(item.slug)} key={item.slug}>
                  <div>
                    <h3>{item.primaryKeyword}</h3>
                    <p>{item.description}</p>
                  </div>
                  <ArrowRight size={18} aria-hidden />
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="section light-section">
        <div className="container results-grid">
          <section className="panel">
            <h2>{guide.primaryKeyword}는 사람 찾기 기능인가요?</h2>
            <p>
              아니요. ID 도플갱어는 사용자가 입력한 아이디 문자열의 공개 사용 현황만 점검하며 동일인 여부를 판정하지 않습니다.
            </p>
          </section>
          <section className="panel">
            <h2>어떤 정보는 검색할 수 없나요?</h2>
            <p>
              실명, 전화번호, 이메일, 주민번호 형식, 위치 추정, 게시글 내용, 프로필 사진 검색은 지원하지 않습니다.
            </p>
          </section>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <span>© 2026 ID 도플갱어</span>
          <div className="footer-links">
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관</a>
            <a href="/responsible-use">책임 있는 사용</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
