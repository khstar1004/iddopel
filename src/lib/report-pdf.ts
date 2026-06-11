import { existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { categoryLabels, countryLabels, riskLabels } from "./labels";
import type { ScanJob, ScanResult } from "./types";

const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansCJKkr-Regular.otf");
const pageWidth = 595.28;
const margin = 42;

export async function buildPdfReport(scan: ScanJob, results: ScanResult[]): Promise<Buffer> {
  if (!existsSync(fontPath)) {
    throw new Error("REPORT_FONT_MISSING");
  }

  const doc = new PDFDocument({
    size: "A4",
    margin,
    font: fontPath,
    compress: true,
    info: {
      Title: `${scan.username} ID 도플갱어 리포트`,
      Author: "ID 도플갱어",
      Subject: "Username exposure report"
    }
  });

  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font(fontPath);
  drawHeader(doc, scan);
  drawScores(doc, scan);
  drawResultList(doc, results);
  drawFooter(doc);
  doc.end();

  return completed;
}

function drawHeader(doc: PDFKit.PDFDocument, scan: ScanJob) {
  doc
    .fillColor("#191f28")
    .fontSize(21)
    .text(`${scan.username} ID 도플갱어 리포트`, { width: pageWidth - margin * 2 })
    .moveDown(0.45)
    .fontSize(9)
    .fillColor("#6b7684")
    .text(`생성일 ${formatDate(scan.finishedAt ?? scan.createdAt)} · 리포트 보관 만료 ${formatDate(scan.expiresAt)}`)
    .moveDown(0.9)
    .fontSize(10)
    .text("이 결과는 아이디 문자열의 공개 사용 현황이며, 발견된 계정들이 동일인이라는 뜻은 아니에요.", {
      width: pageWidth - margin * 2,
      lineGap: 2
    })
    .moveDown(1);
}

function drawScores(doc: PDFKit.PDFDocument, scan: ScanJob) {
  const startX = margin;
  const y = doc.y;
  const gap = 8;
  const cardWidth = (pageWidth - margin * 2 - gap * 3) / 4;
  const cards = [
    ["공개 흔적", `${scan.foundCount}개`],
    ["희소성", `${scan.rarityScore}점`],
    ["노출도", `${scan.exposureScore}점`],
    ["사칭 가능성", `${scan.impersonationScore}점`]
  ];

  for (const [index, [label, value]] of cards.entries()) {
    const x = startX + index * (cardWidth + gap);
    doc.roundedRect(x, y, cardWidth, 58, 6).strokeColor("#dfe3e8").stroke();
    doc.fillColor("#6b7684").fontSize(8).text(label, x + 10, y + 11, { width: cardWidth - 20 });
    doc.fillColor("#191f28").fontSize(15).text(value, x + 10, y + 29, { width: cardWidth - 20 });
  }

  doc.y = y + 78;
}

function drawResultList(doc: PDFKit.PDFDocument, results: ScanResult[]) {
  doc.fillColor("#191f28").fontSize(14).text("발견된 공개 흔적", { width: pageWidth - margin * 2 });
  doc.moveDown(0.5);

  if (results.length === 0) {
    doc.fillColor("#6b7684").fontSize(10).text("현재 발견된 공개 흔적이 없어요.");
    return;
  }

  for (const result of results) {
    ensureSpace(doc, 92);
    const y = doc.y;
    doc.roundedRect(margin, y, pageWidth - margin * 2, 82, 6).strokeColor("#e5e8eb").stroke();
    doc.fillColor("#191f28").fontSize(11).text(result.platform, margin + 12, y + 10, { width: 210 });
    doc
      .fillColor("#4e5968")
      .fontSize(8)
      .text(`${categoryLabels[result.category]} · ${countryLabels[result.country] ?? result.country} · ${riskLabels[result.riskLevel]}`, {
        width: 210
      });
    doc.fillColor("#3182f6").fontSize(8).text(result.url, margin + 12, y + 42, { width: 240, lineGap: 1 });
    doc.fillColor("#333d4b").fontSize(8.5).text(result.cleanupHint, margin + 270, y + 12, {
      width: pageWidth - margin * 2 - 292,
      lineGap: 2
    });
    doc.y = y + 94;
  }
}

function drawFooter(doc: PDFKit.PDFDocument) {
  const footer = "실명, 전화번호, 이메일, 주민번호 검색은 지원하지 않습니다. 공개 사용자명 문자열만 점검합니다.";
  const pages = doc.bufferedPageRange();

  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    doc.switchToPage(index);
    doc
      .fillColor("#8b95a1")
      .fontSize(7.5)
      .text(footer, margin, 806, { width: pageWidth - margin * 2, align: "center" });
  }
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight: number) {
  if (doc.y + neededHeight > 786) {
    doc.addPage();
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}
