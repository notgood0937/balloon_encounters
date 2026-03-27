import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSeedBalloons } from "@/lib/balloons";

/**
 * GET /api/economy/stats
 * Returns global economy overview
 */
export async function GET() {
  try {
    const db = getDb();
    
    // 1. Platform Treasury
    const treasury = db.prepare("SELECT total_usdt FROM platform_treasury WHERE id = 1").get() as { total_usdt: number } | undefined;
    
    // 2. Total Ecosystem Stake (Active)
    const ecosystem = db.prepare("SELECT SUM(current_stake) as total_stake, COUNT(*) as active_balloons FROM balloons").get() as { total_stake: number, active_balloons: number } | undefined;
    
    const seeds = getSeedBalloons();
    const totalEcoStake = (ecosystem?.total_stake ?? 0) + (ecosystem?.active_balloons === 0 ? seeds.reduce((s, b) => s + b.stake, 0) : 0);
    const activeBalloons = (ecosystem?.active_balloons ?? 0) + (ecosystem?.active_balloons === 0 ? seeds.length : 0);

    return NextResponse.json({
      platformTreasury: treasury?.total_usdt ?? 0,
      totalEcosystemStake: totalEcoStake,
      activeBalloons: activeBalloons,
      dailyDecayRate: 0.02
    });
  } catch (error) {
    console.error("[economy stats GET]", error);
    return NextResponse.json({ error: "failed to load economy stats" }, { status: 500 });
  }
}
