export type ScanPurpose = "SELF_CHECK" | "BRAND_CHECK" | "NICKNAME_CHECK";

export type ScanMode = "QUICK" | "DEEP";

export type ScanStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "DELETED";

export type ScanSource = "PUBLIC_SCAN" | "LOCAL_FALLBACK";

export type FreePreviewLockReason = "BETA_FREE_SCAN_LIMITED";

export type PlatformCategory =
  | "SNS"
  | "BLOG"
  | "COMMUNITY"
  | "DEVELOPER"
  | "CREATOR"
  | "COMMERCE"
  | "DOMAIN"
  | "GLOBAL";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface PlatformDefinition {
  id: string;
  name: string;
  aliases?: string[];
  category: PlatformCategory;
  country: "KR" | "US" | "JP" | "GLOBAL";
  urlPattern: string;
  hostAliases?: string[];
  freePreview: boolean;
  cleanupHint: string;
  riskWeight: number;
}

export interface ScanResult {
  id: string;
  platform: string;
  url: string;
  platformUrl?: string;
  platformIconUrl?: string;
  profileImageUrl?: string;
  evidenceTitle?: string;
  evidenceDescription?: string;
  evidenceImageUrl?: string;
  evidenceSnippet?: string;
  evidenceFetchedAt?: string;
  evidenceLocked?: boolean;
  category: PlatformCategory;
  country: PlatformDefinition["country"];
  status: "FOUND" | "UNAVAILABLE" | "UNKNOWN";
  riskLevel: RiskLevel;
  cleanupHint: string;
  tags?: string[];
  rank?: number;
  httpStatus?: number;
}

export interface LockedScanResultPreview {
  id: string;
  platform: string;
  maskedUrl?: string;
  category: PlatformCategory;
  country: PlatformDefinition["country"];
  riskLevel: RiskLevel;
}

export interface LockedPreviewInsight {
  totalCount: number;
  riskDistribution: Record<RiskLevel, number>;
  countryDistribution: Partial<Record<PlatformDefinition["country"], number>>;
  categoryDistribution: Partial<Record<PlatformCategory, number>>;
}

export interface MaigretReportArtifacts {
  html?: string;
  htmlFilename?: string;
  generatedAt?: string;
}

export interface ScoreBundle {
  doppelgangerScore: number;
  rarityScore: number;
  exposureScore: number;
  impersonationScore: number;
  cleanupScore: number;
}

export interface ScanSummary extends ScoreBundle {
  scanId: string;
  username: string;
  purpose: ScanPurpose;
  mode: ScanMode;
  status: ScanStatus;
  progress: number;
  foundCount: number;
  checkedCount: number;
  failedRate: number;
  countryDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
  previewResults: ScanResult[];
  lockedResults?: LockedScanResultPreview[];
  lockedInsight?: LockedPreviewInsight;
  freePreviewLocked?: boolean;
  freePreviewLockReason?: FreePreviewLockReason;
  scanSource?: ScanSource;
  maigretReportAvailable?: boolean;
  maigretReportFilename?: string;
  fullResults?: ScanResult[];
  sourceReportHtml?: string;
  createdAt: string;
  finishedAt: string | null;
  expiresAt: string;
}

export interface ScanJob extends ScanSummary {
  results: ScanResult[];
  maigretReport?: MaigretReportArtifacts;
  ticketAccessOwnerTokenHash?: string | null;
}

export interface CreateScanInput {
  username: string;
  purpose: ScanPurpose;
  mode?: ScanMode;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ProductId = "DETAILED_REPORT" | "MONTHLY_MONITORING";

export type OrderStatus = "READY" | "PAID" | "FAILED" | "CANCELED";

export interface ReportOrder {
  orderId: string;
  scanId: string;
  productId: ProductId;
  amount: number;
  currency: "KRW";
  orderName: string;
  provider: "MOCK" | "TOSS" | "POLAR" | "APP_STORE" | "GOOGLE_PLAY";
  status: OrderStatus;
  checkoutUrl: string | null;
  paymentKey: string | null;
  reportTokenHash: string | null;
  createdAt: string;
  paidAt: string | null;
}

export type MonitoringCadence = "MONTHLY";

export type MonitoringStatus = "ACTIVE" | "PAUSED" | "DELETED";

export interface MonitoringSubscription {
  monitoringId: string;
  ownerTokenHash: string;
  usernames: string[];
  purpose: ScanPurpose;
  cadence: MonitoringCadence;
  status: MonitoringStatus;
  latestScanIds: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  nextRunAt: string;
}

export interface PublicMonitoringSubscription {
  monitoringId: string;
  usernames: string[];
  purpose: ScanPurpose;
  cadence: MonitoringCadence;
  status: MonitoringStatus;
  latestScanIds: Record<string, string>;
  latestScans?: PublicMonitoringScanSnapshot[];
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  nextRunAt: string;
}

export interface PublicMonitoringScanSnapshot {
  username: string;
  scanId: string;
  foundCount: number;
  checkedCount: number;
  exposureScore: number;
  createdAt: string;
}
