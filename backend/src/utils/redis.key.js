// ============================================================
// REDIS KEY HELPERS
// ============================================================

export function joinRateLimitKey(userId, dropId) {
  return `fairdrop:rate:join:${userId}:${dropId}`;
}

export function joinIdempotencyKey(userId, dropId, idempotencyKey) {
  return `fairdrop:idempotency:join:${userId}:${dropId}:${idempotencyKey}`;
}

export function joinAbuseCounterKey(userId, dropId) {
  return `fairdrop:abuse:join:${userId}:${dropId}`;
}