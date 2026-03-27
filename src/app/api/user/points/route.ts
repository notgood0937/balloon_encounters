import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GET /api/user/points?address=...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address")?.toLowerCase();

    if (!address) {
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    const db = getDb();
    const row = db.prepare("SELECT wind_points FROM user_points WHERE wallet_address = ?").get(address) as { wind_points: number } | undefined;

    return NextResponse.json({ windPoints: row?.wind_points ?? 0 });
  } catch (error) {
    console.error("[user points GET]", error);
    return NextResponse.json({ error: "failed to load points" }, { status: 500 });
  }
}
