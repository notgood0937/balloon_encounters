import { getDb } from "@/lib/db";
import { createBalloonPost, getSeedBalloons, type BalloonDraft, type BalloonMatchResult, type BalloonPost } from "@/lib/balloons";

interface BalloonRow {
  id: string;
  author: string;
  wallet_address: string;
  proxy_address?: string | null;
  kind: BalloonPost["kind"];
  title: string;
  content: string;
  tags_json: string;
  canonical_tags_json: string;
  stake_usdt: number;
  lat: number;
  lng: number;
  tx_hash: string;
  current_stake: number;
  last_decay_at: string;
  created_at: string;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function rowToBalloon(row: BalloonRow): BalloonPost {
  return {
    id: row.id,
    author: row.author,
    wallet: row.wallet_address,
    proxyAddress: row.proxy_address ?? null,
    kind: row.kind,
    title: row.title,
    content: row.content,
    tags: parseJsonArray(row.canonical_tags_json).length > 0
      ? parseJsonArray(row.canonical_tags_json)
      : parseJsonArray(row.tags_json),
    stake: Number(row.current_stake ?? row.stake_usdt),
    originalStake: Number(row.stake_usdt),
    coords: [Number(row.lat), Number(row.lng)],
    createdAt: row.created_at,
    txHash: row.tx_hash,
    source: "onchain",
  };
}

export function listBalloons(limit = 200): BalloonPost[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, author, wallet_address, proxy_address, kind, title, content, tags_json, canonical_tags_json,
           stake_usdt, current_stake, last_decay_at, lat, lng, tx_hash, created_at
    FROM balloons
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as BalloonRow[];

  if (rows.length === 0) {
    return getSeedBalloons();
  }

  return rows.map(rowToBalloon);
}

export function createPersistedBalloon(input: {
  draft: BalloonDraft;
  match: BalloonMatchResult;
  txHash: string;
  proxyAddress?: string | null;
  chainId?: number;
  stakeToken?: string;
}): BalloonPost {
  const db = getDb();
  const post = createBalloonPost(input.draft, input.match);

  db.prepare(`
    INSERT INTO balloons (
      id, author, wallet_address, proxy_address, kind, title, content,
      tags_json, canonical_tags_json, stake_usdt, current_stake, last_decay_at, lat, lng, tx_hash, chain_id, stake_token,
      ai_summary, related_balloon_ids_json, created_at
    ) VALUES (
      @id, @author, @wallet_address, @proxy_address, @kind, @title, @content,
      @tags_json, @canonical_tags_json, @stake_usdt, @current_stake, @last_decay_at, @lat, @lng, @tx_hash, @chain_id, @stake_token,
      @ai_summary, @related_balloon_ids_json, @created_at
    )
  `).run({
    id: post.id,
    author: post.author,
    wallet_address: input.draft.wallet,
    proxy_address: input.proxyAddress ?? null,
    kind: post.kind,
    title: post.title,
    content: post.content,
    tags_json: JSON.stringify(input.draft.tags),
    canonical_tags_json: JSON.stringify(input.match.canonicalTags),
    stake_usdt: post.stake,
    current_stake: post.stake,
    last_decay_at: post.createdAt,
    lat: post.coords[0],
    lng: post.coords[1],
    tx_hash: input.txHash,
    chain_id: input.chainId ?? 137,
    stake_token: input.stakeToken ?? "USDC.e",
    ai_summary: input.match.summary,
    related_balloon_ids_json: JSON.stringify(input.match.relatedBalloonIds),
    created_at: post.createdAt,
  });

  return {
    ...post,
    originalStake: input.draft.stake,
    proxyAddress: input.proxyAddress ?? null,
    txHash: input.txHash,
    source: "onchain",
  };
}
