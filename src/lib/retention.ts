export function expiresAtForNonMember(createdAt: Date): string {
  const expiresAt = new Date(createdAt);
  expiresAt.setHours(expiresAt.getHours() + 24);
  return expiresAt.toISOString();
}

export function expiresAtForPaidReport(createdAt: Date): string {
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + 90);
  return expiresAt.toISOString();
}

export function expiresAtForMonitoring(createdAt: Date): string {
  const expiresAt = new Date(createdAt);
  expiresAt.setDate(expiresAt.getDate() + 40);
  return expiresAt.toISOString();
}

export function isExpired(expiresAt: string, now = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}
