import { NextRequest, NextResponse } from "next/server";
import { client, isAiConfigured } from "@/lib/ai";
import {
  type BalloonDraft,
  type BalloonPost,
  matchDraftToBalloons,
} from "@/lib/balloons";

function safeJsonParse(text: string): { canonicalTags?: string[]; relatedBalloonIds?: string[]; summary?: string } | null {
  try {
    return JSON.parse(text) as { canonicalTags?: string[]; relatedBalloonIds?: string[]; summary?: string };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const draft = body?.draft as BalloonDraft | undefined;
  const existing = Array.isArray(body?.existing) ? (body.existing as BalloonPost[]) : [];

  if (!draft) {
    return NextResponse.json({ error: "Missing draft" }, { status: 400 });
  }

  const fallback = matchDraftToBalloons(draft, existing);

  if (!isAiConfigured()) {
    return NextResponse.json(fallback);
  }

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 320,
      messages: [
        {
          role: "user",
          content:
            `You are clustering user-generated drifting balloons for an onchain social map.\n` +
            `Return JSON only with keys canonicalTags, relatedBalloonIds, summary.\n` +
            `canonicalTags: 3-6 short lowercase tags.\n` +
            `relatedBalloonIds: ids from the existing list that feel semantically close.\n` +
            `summary: one short sentence.\n\n` +
            `Draft balloon:\n${JSON.stringify(draft)}\n\n` +
            `Existing balloons:\n${JSON.stringify(existing.slice(0, 12).map((item) => ({
              id: item.id,
              kind: item.kind,
              title: item.title,
              content: item.content,
              tags: item.tags,
              stake: item.stake,
            })))}`
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const parsed = safeJsonParse(text);
    if (!parsed) {
      return NextResponse.json(fallback);
    }

    return NextResponse.json({
      canonicalTags: Array.isArray(parsed.canonicalTags) && parsed.canonicalTags.length > 0
        ? parsed.canonicalTags.slice(0, 6)
        : fallback.canonicalTags,
      relatedBalloonIds: Array.isArray(parsed.relatedBalloonIds)
        ? parsed.relatedBalloonIds.filter((id) => typeof id === "string").slice(0, 5)
        : fallback.relatedBalloonIds,
      summary: typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : fallback.summary,
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
