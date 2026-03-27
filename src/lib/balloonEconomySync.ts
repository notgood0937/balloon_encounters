import { getDb } from "./db";
import { buildBalloonClusters, type BalloonPost } from "./balloons";

/**
 * Balloon Economy Sync
 * Handles:
 * 1. Hourly/Daily decay of balloon stakes (2% per 24h)
 * 2. Stake redistribution to Platform Treasury and Cluster Treasuries
 * 3. Balloon "bursting" (deletion) when stake < 0.5 USDT
 */

export async function processBalloonEconomy() {
  const db = getDb();
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Fetch all active balloons
  // Note: we need to parse tags/canonical_tags from JSON
  const rawBalloons = db.prepare("SELECT * FROM balloons").all() as any[];
  const balloons: BalloonPost[] = rawBalloons.map(b => ({
    id: b.id,
    author: b.author,
    wallet: b.wallet_address,
    proxyAddress: b.proxy_address,
    kind: b.kind,
    title: b.title,
    content: b.content,
    tags: JSON.parse(b.tags_json),
    stake: b.current_stake || b.stake_usdt,
    coords: [b.lat, b.lng],
    createdAt: b.created_at,
    txHash: b.tx_hash,
    source: "onchain"
  }));

  if (balloons.length === 0) return;

  // 2. Process decay for each balloon
  const decayRateDaily = 0.02; // 2%
  const decayRateHourly = decayRateDaily / 24;

  let totalPlatformFee = 0;

  for (const b of rawBalloons) {
    const lastDecay = new Array(b.last_decay_at ? new Date(b.last_decay_at).getTime() : new Date(b.created_at).getTime());
    const elapsedMs = now.getTime() - lastDecay[0];
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    if (elapsedHours < 1) continue;

    const currentStake = b.current_stake || b.stake_usdt;
    // Simple hourly compounding or just linear for the elapsed time
    const decayAmount = currentStake * decayRateHourly * elapsedHours;
    const nextStake = Math.max(0, currentStake - decayAmount);

    // 10% of decay goes to Platform Treasury (or as configured in model - the model says 50% of DECAY goes to platform)
    // The model says: 50% of decay to Cluster Treasury, 50% to Wind Rewards/Platform
    const platformShare = decayAmount * 0.5;
    totalPlatformFee += platformShare;

    if (nextStake < 0.5) {
      console.log(`[economy] Balloon ${b.id} burst (stake: ${nextStake})`);
      db.prepare("DELETE FROM balloons WHERE id = ?").run(b.id);
    } else {
      db.prepare("UPDATE balloons SET current_stake = ?, last_decay_at = ? WHERE id = ?")
        .run(nextStake, nowIso, b.id);
    }
  }

  // 3. Update Platform Treasury
  if (totalPlatformFee > 0) {
    db.prepare("UPDATE platform_treasury SET total_usdt = total_usdt + ?, updated_at = ? WHERE id = 1")
      .run(totalPlatformFee, nowIso);
  }

  // TODO: Cluster Treasury distribution logic
  // This would require backend clustering and a table for cluster_treasuries
  // For now, the "Community Fund" is the Platform Treasury.
}

let economyTick: NodeJS.Timeout | null = null;
export function startEconomySync(intervalMs = 60 * 60 * 1000) {
  if (economyTick) return;
  console.log("[economy] Starting economy sync loop (1h)");
  economyTick = setInterval(() => {
    processBalloonEconomy().catch(err => console.error("[economy] Sync error:", err));
  }, intervalMs);
  
  // Also run once immediately
  processBalloonEconomy().catch(err => console.error("[economy] Initial sync error:", err));
}
