import crypto from "crypto";

/**
 * Creates a deterministic numeric value from:
 *
 * allocationSeed + entryId
 *
 * The same seed + same entry ID
 * will always produce the same value.
 */
function getEntryScore(seed, entryId) {
  const hash = crypto
    .createHash("sha256")
    .update(`${seed}:${entryId}`)
    .digest("hex");

  // Convert the first 16 hex characters into a BigInt.
  return BigInt(`0x${hash.slice(0, 16)}`);
}

/**
 * Creates a deterministic random ordering of entries.
 *
 * Important:
 * - Does NOT depend on request arrival time.
 * - Does NOT depend on MongoDB insertion order.
 * - Same seed produces the same ordering.
 */
export function selectFairEntries(entries, winnerCount, seed) {
  if (!Array.isArray(entries)) {
    throw new Error("entries must be an array");
  }

  if (!Number.isInteger(winnerCount) || winnerCount < 0) {
    throw new Error("winnerCount must be a non-negative integer");
  }

  if (!seed) {
    throw new Error("Allocation seed is required");
  }

  if (winnerCount > entries.length) {
    throw new Error(
      "winnerCount cannot be greater than number of entries"
    );
  }

  const scoredEntries = entries.map((entry) => {
    const entryId = entry._id.toString();

    return {
      entry,
      score: getEntryScore(seed, entryId)
    };
  });

  // Deterministic ordering.
  scoredEntries.sort((a, b) => {
    if (a.score < b.score) return -1;
    if (a.score > b.score) return 1;
    return 0;
  });

  const selectedEntries = scoredEntries
    .slice(0, winnerCount)
    .map((item) => item.entry);

  const selectedIds = new Set(
    selectedEntries.map((entry) =>
      entry._id.toString()
    )
  );

  const notSelectedEntries = entries.filter(
    (entry) => !selectedIds.has(entry._id.toString())
  );

  return {
    selectedEntries,
    notSelectedEntries
  };
}