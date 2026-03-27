import { NextResponse } from "next/server";
import { listBalloons } from "@/lib/balloonRepo";

export async function GET() {
  try {
    const balloons = listBalloons();
    return NextResponse.json({ balloons });
  } catch (error) {
    console.error("[balloons GET]", error);
    return NextResponse.json({ error: "failed to load balloons" }, { status: 500 });
  }
}
