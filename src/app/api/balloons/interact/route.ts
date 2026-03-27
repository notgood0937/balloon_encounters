import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/balloons/interact
 * Body: { balloonId, walletAddress, action: 'click' | 'follow' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const balloonId = body.balloonId;
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.toLowerCase() : "";
    const action = body.action;

    if (!balloonId || !walletAddress || !action) {
      return NextResponse.json({ error: "missing parameters" }, { status: 400 });
    }

    const db = getDb();
    const nowIso = new Date().toISOString();

    // 1. Check for existing interaction
    const existing = db.prepare(`
      SELECT 1 FROM balloon_interactions 
      WHERE balloon_id = ? AND wallet_address = ? AND action = ?
    `).get(balloonId, walletAddress, action);

    if (existing) {
      return NextResponse.json({ error: "already interacted with this balloon" }, { status: 403 });
    }

    // 2. Assign points based on action
    const pointsToAdd = action === "follow" ? 5 : 1;

    // 3. Update user_points
    db.prepare(`
      INSERT INTO user_points (wallet_address, wind_points, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(wallet_address) DO UPDATE SET
        wind_points = wind_points + EXCLUDED.wind_points,
        updated_at = EXCLUDED.updated_at
    `).run(walletAddress, pointsToAdd, nowIso);

    // 4. Record the interaction
    db.prepare(`
      INSERT INTO balloon_interactions (balloon_id, wallet_address, action, created_at)
      VALUES (?, ?, ?, ?)
    `).run(balloonId, walletAddress, action, nowIso);

    return NextResponse.json({ success: true, pointsAdded: pointsToAdd });
  } catch (error) {
    console.error("[interact POST]", error);
    return NextResponse.json({ error: "failed to process interaction" }, { status: 500 });
  }
}
