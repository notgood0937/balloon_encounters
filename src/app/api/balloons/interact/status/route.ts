import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/balloons/interact/status?balloonId=...&address=...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const balloonId = searchParams.get("balloonId");
    const address = searchParams.get("address")?.toLowerCase();

    if (!balloonId || !address) {
      return NextResponse.json({ error: "missing parameters" }, { status: 400 });
    }

    const db = getDb();
    const row = db.prepare(`
      SELECT 1 FROM balloon_interactions 
      WHERE balloon_id = ? AND wallet_address = ? AND action = 'click'
    `).get(balloonId, address);

    return NextResponse.json({ interacted: !!row });
  } catch (error) {
    console.error("[interact status GET]", error);
    return NextResponse.json({ error: "failed to check status" }, { status: 500 });
  }
}
