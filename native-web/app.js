const config = window.IDD_APP_CONFIG || {};
const apiBaseUrl = String(config.apiBaseUrl || "").replace(/\/$/, "");
const state = {
  scanId: null,
  redeeming: false
};

const form = document.querySelector("#scan-form");
const submit = document.querySelector("#submit");
const usernameInput = document.querySelector("#username");
const acknowledge = document.querySelector("#acknowledge");
const resultPanel = document.querySelector("#result-panel");
const toast = document.querySelector("#toast");
const deleteScan = document.querySelector("#delete-scan");
const purchaseReport = document.querySelector("#purchase-report");
const restoreReport = document.querySelector("#restore-report");

document.querySelector("#privacy-link").href = config.privacyUrl || "#";
document.querySelector("#terms-link").href = config.termsUrl || "#";
document.querySelector("#support-link").href = config.supportUrl || "#";
updateReportControls();

usernameInput.addEventListener("input", updateSubmitState);
acknowledge.addEventListener("change", updateSubmitState);
updateSubmitState();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!apiBaseUrl || apiBaseUrl.includes("YOUR_PRODUCTION_DOMAIN")) {
    showToast("앱 API 도메인을 먼저 설정해야 해요.");
    return;
  }

  const data = new FormData(form);
  const username = String(data.get("username") || "").trim();
  const purpose = String(data.get("purpose") || "SELF_CHECK");
  const validationError = validateUsername(username);

  if (!acknowledge.checked) {
    showToast("정당한 목적 확인이 필요해요.");
    return;
  }

  if (validationError) {
    showToast(validationError);
    return;
  }

  submit.disabled = true;
  submit.textContent = "점검 중";

  try {
    const response = await fetch(`${apiBaseUrl}/api/scans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, purpose, mode: "QUICK" })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message || "점검을 완료하지 못했어요.");
    renderSummary(body);
    showToast("점검이 완료됐어요.");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "점검을 완료하지 못했어요.");
  } finally {
    submit.textContent = "내 아이디 흔적 찾기";
    updateSubmitState();
  }
});

deleteScan.addEventListener("click", async () => {
  if (!state.scanId || !apiBaseUrl || apiBaseUrl.includes("YOUR_PRODUCTION_DOMAIN")) return;

  try {
    await fetch(`${apiBaseUrl}/api/scans/${encodeURIComponent(state.scanId)}`, { method: "DELETE" });
    state.scanId = null;
    resultPanel.classList.add("hidden");
    document.querySelector("#preview-results").replaceChildren();
    updateReportControls();
    showToast("점검 기록을 삭제했어요.");
  } catch {
    showToast("삭제를 완료하지 못했어요.");
  }
});

purchaseReport.addEventListener("click", () => redeemNativePurchase("purchase"));
restoreReport.addEventListener("click", () => redeemNativePurchase("restore"));

function renderSummary(summary) {
  state.scanId = summary.scanId;
  const previewResults = Array.isArray(summary.previewResults) ? summary.previewResults : [];
  const lockedCount = Math.max(0, Number(summary.foundCount || 0) - previewResults.length);
  const resultRows = previewResults.length ? previewResults.map(renderResult) : [renderEmptyResult()];
  if (lockedCount > 0) resultRows.push(renderLockedTeaser(lockedCount));

  document.querySelector("#result-username").textContent = summary.username;
  document.querySelector("#found-count").textContent = `${summary.foundCount}개`;
  document.querySelector("#rarity-score").textContent = `${summary.rarityScore}점`;
  document.querySelector("#exposure-score").textContent = `${summary.exposureScore}점`;
  document.querySelector("#impersonation-score").textContent = `${summary.impersonationScore}점`;
  document.querySelector("#preview-results").replaceChildren(...resultRows);
  updateReportControls();
  resultPanel.classList.remove("hidden");
  resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function redeemNativePurchase(action) {
  const bridge = getNativeBillingBridge();
  const methodName = action === "restore" ? "restoreDetailedReport" : "purchaseDetailedReport";
  const method = bridge?.[methodName];

  if (!state.scanId || !config.paymentsEnabled || typeof method !== "function") {
    showToast("스토어 결제 브리지를 연결해야 해요.");
    return;
  }

  state.redeeming = true;
  updateReportControls();

  try {
    const purchase = await method.call(bridge, {
      scanId: state.scanId,
      appleProductId: config.appleDetailedReportProductId || "detailed_report",
      googlePlayProductId: config.googlePlayDetailedReportProductId || "detailed_report"
    });
    const entitlement = await redeemEntitlement(purchase);
    await completeNativePurchase(bridge, purchase);
    const reportUrl = resolveReportUrl(entitlement.reportUrl);
    showToast("정밀 리포트를 열고 있어요.");
    window.setTimeout(() => window.location.assign(reportUrl), 80);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "정밀 리포트 구매를 완료하지 못했어요.");
  } finally {
    state.redeeming = false;
    updateReportControls();
  }
}

async function completeNativePurchase(bridge, purchase) {
  if (typeof bridge?.completeDetailedReportPurchase !== "function") return;
  await bridge.completeDetailedReportPurchase({
    provider: purchase?.provider,
    productId: purchase?.productId || config.googlePlayDetailedReportProductId || "detailed_report",
    purchaseToken: purchase?.purchaseToken,
    transactionId: purchase?.transactionId
  });
}

async function redeemEntitlement(purchase) {
  const normalized = normalizePurchase(purchase);
  const response = await fetch(`${apiBaseUrl}${normalized.path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalized.body)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error?.message || "정밀 리포트 권한을 확인하지 못했어요.");
  }
  if (!body?.reportUrl) {
    throw new Error("정밀 리포트 주소를 받지 못했어요.");
  }
  return body;
}

function normalizePurchase(purchase) {
  if (!purchase || typeof purchase !== "object") {
    throw new Error("스토어 구매 정보를 확인하지 못했어요.");
  }

  const provider = String(purchase.provider || "").toUpperCase();
  const scanId = state.scanId;

  if (provider === "APP_STORE" || purchase.transactionId) {
    const transactionId = String(purchase.transactionId || "");
    if (!transactionId) throw new Error("App Store 거래 정보를 확인하지 못했어요.");
    return {
      path: "/api/mobile/entitlements/apple",
      body: { scanId, transactionId }
    };
  }

  if (provider === "GOOGLE_PLAY" || purchase.purchaseToken) {
    const productId = String(purchase.productId || config.googlePlayDetailedReportProductId || "");
    const purchaseToken = String(purchase.purchaseToken || "");
    if (!productId || !purchaseToken) throw new Error("Google Play 구매 정보를 확인하지 못했어요.");
    return {
      path: "/api/mobile/entitlements/google",
      body: { scanId, productId, purchaseToken }
    };
  }

  throw new Error("지원하지 않는 스토어 구매 정보예요.");
}

function resolveReportUrl(reportUrl) {
  return new URL(String(reportUrl), `${apiBaseUrl}/`).toString();
}

function updateReportControls() {
  const bridge = getNativeBillingBridge();
  const purchaseReady = Boolean(state.scanId && config.paymentsEnabled && typeof bridge?.purchaseDetailedReport === "function");
  const restoreReady = Boolean(state.scanId && config.paymentsEnabled && typeof bridge?.restoreDetailedReport === "function");
  const disabledByConfig = !config.paymentsEnabled;
  const missingBridge = config.paymentsEnabled && (!bridge || typeof bridge.purchaseDetailedReport !== "function" || typeof bridge.restoreDetailedReport !== "function");

  document.querySelector("#payment-copy").textContent = disabledByConfig
    ? "App Store와 Google Play 결제 상품 설정 후 앱 내 정밀 리포트 구매가 활성화됩니다."
    : missingBridge
      ? "스토어 결제 브리지를 연결하면 전체 URL과 PDF 리포트를 앱 안에서 열 수 있어요."
      : "스토어 구매 확인 후 전체 URL과 PDF 리포트를 앱 안에서 확인할 수 있어요.";

  purchaseReport.disabled = !purchaseReady || state.redeeming;
  restoreReport.disabled = !restoreReady || state.redeeming;
  purchaseReport.textContent = state.redeeming ? "확인 중" : purchaseReady ? "정밀 리포트 구매" : config.paymentsEnabled ? "스토어 상품 연결 필요" : "정밀 리포트 준비 중";
  restoreReport.textContent = state.redeeming ? "확인 중" : "구매 복원";
}

function getNativeBillingBridge() {
  return window.IDD_NATIVE_BILLING;
}

function renderResult(result) {
  const row = document.createElement("article");
  row.className = "result-row";
  row.innerHTML = `
    <div>
      <span class="result-badge">공개 흔적</span>
      <h3></h3>
      <p class="locked-url"></p>
    </div>
    <span class="risk"></span>
  `;
  row.querySelector("h3").textContent = result.platform;
  row.querySelector("p").textContent = `${hostnameFromUrl(result.url)} · ${maskUrlPreview(result.url)}`;
  row.querySelector(".risk").textContent = riskLabel(result.riskLevel);
  return row;
}

function renderEmptyResult() {
  const row = document.createElement("article");
  row.className = "result-row";
  row.innerHTML = `
    <div>
      <span class="result-badge">공개 흔적 없음</span>
      <h3>이번 빠른 점검에서는 바로 보이는 흔적이 없어요.</h3>
      <p class="locked-url">정밀 리포트에서는 전체 검사 기록을 확인할 수 있어요.</p>
    </div>
  `;
  return row;
}

function renderLockedTeaser(count) {
  const row = document.createElement("article");
  row.className = "locked-teaser";
  row.innerHTML = `
    <div>
      <h3></h3>
      <p>URL, 위험도, 정리 가이드는 정밀 리포트에서 열려요.</p>
    </div>
    <span>잠김</span>
  `;
  row.querySelector("h3").textContent = `${count}개 상세 후보가 더 있어요`;
  return row;
}

function riskLabel(level) {
  if (level === "HIGH") return "높은 위험";
  if (level === "MEDIUM") return "중간 위험";
  return "낮은 위험";
}

function hostnameFromUrl(value) {
  try {
    return new URL(String(value)).hostname.replace(/^www\./, "");
  } catch {
    return "상세 URL";
  }
}

function maskUrlPreview(value) {
  try {
    const parsed = new URL(String(value));
    const host = parsed.hostname.replace(/^www\./, "");
    const pathPart = parsed.pathname.split("/").filter(Boolean)[0] || "profile";
    return `${host}/${pathPart.slice(0, Math.min(4, pathPart.length))}••••`;
  } catch {
    return "상세 URL 잠김";
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.add("hidden"), 3200);
}

function updateSubmitState() {
  const username = usernameInput.value.trim();
  submit.disabled = username.length < 3 || Boolean(validateUsername(username)) || !acknowledge.checked;
}

function validateUsername(username) {
  if (!username) return null;
  if (username.length < 3) return "아이디는 3자 이상 입력해 주세요.";
  if (username.length > 30) return "아이디는 30자 이하로 입력해 주세요.";
  if (/https?:\/\//i.test(username) || username.includes("/")) return "URL 검색은 지원하지 않아요.";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return "이메일 검색은 지원하지 않아요.";
  if (/^01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}$/.test(username)) return "전화번호 검색은 지원하지 않아요.";
  if (/^\d{6}[-\s]?[1-4]\d{6}$/.test(username)) return "주민번호처럼 보이는 값은 검색할 수 없어요.";
  if (!/^[a-zA-Z0-9._@-]+$/.test(username)) return "영문, 숫자, 점, 밑줄, 하이픈만 입력할 수 있어요.";
  return null;
}
