import { redisClient } from "../config/redis.js";


// ============================================================
// CONFIGURATION
// ============================================================

const WINDOW_SECONDS = 10;

// Maximum requests during the window
const MAX_REQUESTS = 20;

// Maximum join attempts during the window
const MAX_JOIN_ATTEMPTS = 5;

// Maximum duplicate attempts during the window
const MAX_DUPLICATE_ATTEMPTS = 3;

// Maximum simultaneous requests we allow tracking
const MAX_CONCURRENCY = 5;


// ============================================================
// REDIS KEYS
// ============================================================

function requestKey(userId, dropId) {
  return `fairdrop:risk:requests:${userId}:${dropId}`;
}

function joinKey(userId, dropId) {
  return `fairdrop:risk:joins:${userId}:${dropId}`;
}

function duplicateKey(userId, dropId) {
  return `fairdrop:risk:duplicates:${userId}:${dropId}`;
}

function concurrencyKey(userId, dropId) {
  return `fairdrop:risk:concurrency:${userId}:${dropId}`;
}


// ============================================================
// INCREMENT COUNTER WITH TTL
// ============================================================

async function incrementWithExpiry(key, ttl = WINDOW_SECONDS) {
  const count = await redisClient.incr(key);

  // Set expiry only on the first request
  if (count === 1) {
    await redisClient.expire(key, ttl);
  }

  return count;
}


// ============================================================
// REQUEST TRACKING
// ============================================================

export async function trackRequest(userId, dropId) {
  return incrementWithExpiry(
    requestKey(userId, dropId)
  );
}


// ============================================================
// JOIN TRACKING
// ============================================================

export async function trackJoinAttempt(userId, dropId) {
  return incrementWithExpiry(
    joinKey(userId, dropId)
  );
}


// ============================================================
// DUPLICATE TRACKING
// ============================================================

export async function trackDuplicateAttempt(userId, dropId) {
  return incrementWithExpiry(
    duplicateKey(userId, dropId)
  );
}


// ============================================================
// CONCURRENCY
// ============================================================

export async function acquireConcurrency(userId, dropId) {
  const key = concurrencyKey(userId, dropId);

  const current = await redisClient.incr(key);

  if (current === 1) {
    await redisClient.expire(key, WINDOW_SECONDS);
  }

  if (current > MAX_CONCURRENCY) {
    await redisClient.decr(key);

    return false;
  }

  return true;
}


export async function releaseConcurrency(userId, dropId) {
  const key = concurrencyKey(userId, dropId);

  const current = await redisClient.decr(key);

  if (current <= 0) {
    await redisClient.del(key);
  }
}


// ============================================================
// GET CURRENT COUNTERS
// ============================================================

export async function getRiskCounters(userId, dropId) {
  const [
    requests,
    joins,
    duplicates,
    concurrency
  ] = await Promise.all([
    redisClient.get(requestKey(userId, dropId)),
    redisClient.get(joinKey(userId, dropId)),
    redisClient.get(duplicateKey(userId, dropId)),
    redisClient.get(concurrencyKey(userId, dropId))
  ]);

  return {
    requests: Number(requests || 0),
    joins: Number(joins || 0),
    duplicates: Number(duplicates || 0),
    concurrency: Number(concurrency || 0)
  };
}


// ============================================================
// RISK SCORE
// ============================================================

export function calculateRiskScore({
  requests,
  joins,
  duplicates,
  concurrency
}) {
  let score = 0;


  // ------------------------------------------
  // Request frequency
  // ------------------------------------------

  if (requests > MAX_REQUESTS) {
    score += 30;
  } else if (requests > MAX_REQUESTS * 0.75) {
    score += 15;
  }


  // ------------------------------------------
  // Join frequency
  // ------------------------------------------

  if (joins > MAX_JOIN_ATTEMPTS) {
    score += 30;
  } else if (joins > MAX_JOIN_ATTEMPTS * 0.6) {
    score += 15;
  }


  // ------------------------------------------
  // Duplicate attempts
  // ------------------------------------------

  if (duplicates > MAX_DUPLICATE_ATTEMPTS) {
    score += 25;
  } else if (duplicates > 0) {
    score += 10;
  }


  // ------------------------------------------
  // Concurrent requests
  // ------------------------------------------

  if (concurrency >= MAX_CONCURRENCY) {
    score += 20;
  }


  return Math.min(score, 100);
}


// ============================================================
// DECISION
// ============================================================

export function getRiskDecision(score) {
  if (score >= 81) {
    return "BLOCK";
  }

  if (score >= 61) {
    return "CHALLENGE";
  }

  if (score >= 31) {
    return "THROTTLE";
  }

  return "ALLOW";
}


// ============================================================
// COMPLETE RISK EVALUATION
// ============================================================

export async function evaluateRisk(userId, dropId) {
  const counters = await getRiskCounters(
    userId,
    dropId
  );

  const riskScore = calculateRiskScore(
    counters
  );

  const decision = getRiskDecision(
    riskScore
  );

  return {
    decision,
    riskScore,
    counters
  };
}


// ============================================================
// EXPORT LIMITS
// ============================================================

export const RISK_LIMITS = {
  WINDOW_SECONDS,
  MAX_REQUESTS,
  MAX_JOIN_ATTEMPTS,
  MAX_DUPLICATE_ATTEMPTS,
  MAX_CONCURRENCY
};