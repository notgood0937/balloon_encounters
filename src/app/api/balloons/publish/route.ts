import { NextRequest, NextResponse } from "next/server";
import { listBalloons } from "@/lib/balloonRepo";
import { matchDraftToBalloons, type BalloonDraft, type BalloonMatchResult } from "@/lib/balloons";
import { client, isAiConfigured } from "@/lib/ai";

const USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174".toLowerCase();
const POLYGON_CHAIN_ID = 137;
const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function getRpcUrls(): string[] {
  const configured = process.env.POLYGON_RPC_URLS
    ?.split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  return configured?.length ? configured : ["https://rpc.ankr.com/polygon"];
}

function getStakeRecipient(): string | null {
  const value = process.env.BALLOON_STAKE_RECIPIENT?.trim();
  return value && /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : null;
}

function topicToAddress(topic?: string): string | null {
  if (!topic || topic.length < 66) return null;
  return `0x${topic.slice(-40)}`.toLowerCase();
}

async function fetchReceipt(txHash: string): Promise<{ status?: string; logs?: Array<{ address?: string; topics?: string[]; data?: string }> } | null> {
  for (const rpc of getRpcUrls()) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionReceipt",
          params: [txHash],
        }),
        signal: AbortSignal.timeout(8_000),
      });
      const json = await res.json() as { result?: { status?: string; logs?: Array<{ address?: string; topics?: string[]; data?: string }> } };
      if (json.result) return json.result;
    } catch {
      // try next RPC
    }
  }
  return null;
}

function parseTransferAmount(data?: string): number {
  if (!data || data === "0x") return 0;
  return Number(BigInt(data)) / 1e6;
}

async function enrichMatchWithAi(draft: BalloonDraft, existing = listBalloons()): Promise<BalloonMatchResult> {
  const fallback = matchDraftToBalloons(draft, existing);
  if (!isAiConfigured()) return fallback;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 320,
      messages: [{
        role: "user",
        content:
          `Return JSON only with keys canonicalTags, relatedBalloonIds, summary.\n` +
          `Draft: ${JSON.stringify(draft)}\n` +
          `Existing: ${JSON.stringify(existing.slice(0, 10).map((item) => ({
            id: item.id,
            title: item.title,
            content: item.content,
            tags: item.tags,
          })))}`
      }],
    });
    const text = response.content.filter((item) => item.type === "text").map((item) => item.text).join("").trim();
    const parsed = JSON.parse(text) as Partial<BalloonMatchResult>;
    return {
      canonicalTags: Array.isArray(parsed.canonicalTags) && parsed.canonicalTags.length > 0 ? parsed.canonicalTags.slice(0, 6) : fallback.canonicalTags,
      relatedBalloonIds: Array.isArray(parsed.relatedBalloonIds) ? parsed.relatedBalloonIds.filter((value): value is string => typeof value === "string").slice(0, 5) : fallback.relatedBalloonIds,
      summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : fallback.summary,
    };
  } catch {
    return fallback;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const draft = body?.draft as BalloonDraft | undefined;
    const isSimulation = !!body?.simulation;
    let txHash = typeof body?.txHash === "string" ? body.txHash.trim() : "";
    const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken : null;
    const chainId = Number(body?.chainId ?? POLYGON_CHAIN_ID);

    if (isSimulation) {
      if (!draft || !draft.title?.trim() || !draft.content?.trim() || !draft.author?.trim()) {
        return NextResponse.json({ error: "missing draft data" }, { status: 400 });
      }
      if (!txHash) txHash = `simulated_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      
      const { getTradeSession } = await import("@/lib/tradeSession");
      const session = sessionToken ? getTradeSession(sessionToken) : null;
      const fromAddress = (session?.address || draft.wallet || "0x_anonymous").toLowerCase();

      const match = await enrichMatchWithAi(draft);
      const platformFee = (draft.stake || 0) * 0.1;
      const initialCurrentStake = (draft.stake || 0) - platformFee;

      const { getDb } = await import("@/lib/db");
      const db = getDb();
      db.prepare("UPDATE platform_treasury SET total_usdt = total_usdt + ? WHERE id = 1").run(platformFee);

      const { createPersistedBalloon } = await import("@/lib/balloonRepo");
      const post = createPersistedBalloon({
        draft: { ...draft, stake: initialCurrentStake, wallet: fromAddress },
        match,
        txHash,
        proxyAddress: session?.proxyAddress ?? null,
        chainId: chainId,
        stakeToken: "SIMULATED",
      });

      return NextResponse.json({ balloon: post, summary: match.summary });
    }

    const recipient = getStakeRecipient();
    if (!recipient) {
      return NextResponse.json({ error: "BALLOON_STAKE_RECIPIENT is not configured" }, { status: 500 });
    }

    if (!draft || !txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "draft and txHash are required" }, { status: 400 });
    }
    if (!Array.isArray(draft.coords) || draft.coords.length !== 2 || draft.coords.some((value) => !Number.isFinite(value))) {
      return NextResponse.json({ error: "valid coords are required" }, { status: 400 });
    }
    if (!draft.title?.trim() || !draft.content?.trim() || !draft.author?.trim()) {
      return NextResponse.json({ error: "author, title, and content are required" }, { status: 400 });
    }
    if (draft.stake < 1 || draft.stake > 5) {
      return NextResponse.json({ error: "stake must be between 1 and 5 USDT" }, { status: 400 });
    }
    if (chainId !== POLYGON_CHAIN_ID) {
      return NextResponse.json({ error: "only Polygon chain is supported" }, { status: 400 });
    }

    const receipt = await fetchReceipt(txHash);
    if (!receipt || receipt.status !== "0x1") {
      return NextResponse.json({ error: "transaction not confirmed on Polygon" }, { status: 400 });
    }

    const matchingTransfer = receipt.logs?.find((log) =>
      log.address?.toLowerCase() === USDC_E &&
      log.topics?.[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC &&
      topicToAddress(log.topics?.[2]) === recipient
    );

    if (!matchingTransfer) {
      return NextResponse.json({ error: "stake transfer to configured recipient was not found" }, { status: 400 });
    }

    const onchainAmount = parseTransferAmount(matchingTransfer.data);
    if (Math.abs(onchainAmount - draft.stake) > 0.000001) {
      return NextResponse.json({ error: `stake mismatch: expected ${draft.stake}, got ${onchainAmount}` }, { status: 400 });
    }

    const rawFromAddress = topicToAddress(matchingTransfer.topics?.[1]);
    if (!rawFromAddress) {
      return NextResponse.json({ error: "could not resolve sender address from transfer log" }, { status: 400 });
    }
    const fromAddress = rawFromAddress.toLowerCase();

    const { getTradeSession: getTradeSessionAuth } = await import("@/lib/tradeSession");
    const session = sessionToken ? getTradeSessionAuth(sessionToken) : null;
    if (session && session.proxyAddress.toLowerCase() !== fromAddress && session.address.toLowerCase() !== fromAddress) {
      return NextResponse.json({ error: "transaction sender does not match the active wallet session" }, { status: 403 });
    }

    const normalizedDraft: BalloonDraft = {
      ...draft,
      wallet: (session?.address ?? fromAddress).toLowerCase(),
      stake: onchainAmount,
    };

    const match = await enrichMatchWithAi(normalizedDraft);
    
    // 10% Initial Platform Fee
    const platformFee = normalizedDraft.stake * 0.1;
    const initialCurrentStake = normalizedDraft.stake - platformFee;

    const { getDb } = await import("@/lib/db");
    const db = getDb();
    db.prepare("UPDATE platform_treasury SET total_usdt = total_usdt + ? WHERE id = 1").run(platformFee);

    const { createPersistedBalloon } = await import("@/lib/balloonRepo");
    const post = createPersistedBalloon({
      draft: { ...normalizedDraft, stake: initialCurrentStake },
      match,
      txHash,
      proxyAddress: session?.proxyAddress ?? (session?.address.toLowerCase() === fromAddress ? null : fromAddress),
      chainId,
      stakeToken: "USDC.e",
    });

    return NextResponse.json({ balloon: post, summary: match.summary });
  } catch (error) {
    console.error("[balloons publish]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed to publish balloon" }, { status: 500 });
  }
}
