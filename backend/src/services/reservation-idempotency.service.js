import { redisClient } from "../config/redis.js";

const TTL_SECONDS = 24 * 60 * 60;

export function reservationActionIdempotencyKey(
  userId,
  reservationId,
  action,
  idempotencyKey
) {
  return `fairdrop:idempotency:${action}:${userId}:${reservationId}:${idempotencyKey}`;
}

export function reservationIdempotencyKey(
  userId,
  reservationId,
  idempotencyKey
) {
  return reservationActionIdempotencyKey(
    userId,
    reservationId,
    "confirm",
    idempotencyKey
  );
}

export async function getIdempotentResponse(key) {
  return redisClient.get(key);
}

export async function saveIdempotentResponse(key, response) {
  await redisClient.set(
    key,
    JSON.stringify(response),
    {
      EX: TTL_SECONDS
    }
  );
}