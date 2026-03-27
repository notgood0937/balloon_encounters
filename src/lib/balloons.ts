export type BalloonKind = "mood" | "story" | "dream" | "signal";

export interface BalloonPost {
  id: string;
  author: string;
  wallet: string;
  proxyAddress?: string | null;
  kind: BalloonKind;
  title: string;
  content: string;
  tags: string[];
  stake: number;
  originalStake?: number;
  coords: [number, number];
  createdAt: string;
  txHash?: string | null;
  source?: "seed" | "onchain";
}

export interface BalloonDraft {
  author: string;
  wallet: string;
  kind: BalloonKind;
  title: string;
  content: string;
  tags: string[];
  stake: number;
  coords: [number, number];
}

export interface BalloonCluster {
  id: string;
  memberIds: string[];
  members: BalloonPost[];
  coords: [number, number];
  totalStake: number;
  dominantTags: string[];
  similarityScore: number;
}

export interface BalloonMatchResult {
  canonicalTags: string[];
  relatedBalloonIds: string[];
  summary: string;
}

const SEMANTIC_GROUPS: Record<string, string[]> = {
  optimism: ["hope", "optimism", "light", "future", "sunrise", "believe", "faith"],
  loneliness: ["lonely", "solitude", "alone", "distance", "quiet", "missing"],
  healing: ["healing", "recover", "repair", "therapy", "growth", "breathe", "calm"],
  love: ["love", "relationship", "crush", "heart", "romance", "care", "family"],
  freedom: ["freedom", "travel", "roam", "escape", "wander", "sea", "sky"],
  builder: ["build", "builder", "maker", "ship", "product", "craft", "create"],
  defi: ["defi", "liquidity", "yield", "amm", "lending", "staking", "protocol"],
  onchain: ["onchain", "wallet", "token", "usdt", "usdc", "chain", "smartcontract"],
  social: ["social", "community", "friend", "people", "together", "tribe", "belonging"],
  dreamer: ["dream", "vision", "ideal", "mission", "purpose", "wish"],
  startup: ["startup", "founder", "team", "launch", "producthunt", "growth"],
  art: ["art", "music", "poem", "story", "film", "paint", "design"],
  citylife: ["city", "urban", "night", "metro", "cafe", "street"],
  nature: ["nature", "forest", "mountain", "river", "island", "ocean"],
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "your", "have", "want",
  "about", "after", "before", "while", "where", "when", "been", "feel", "story", "dream",
  "mood", "life", "some", "just", "like", "will", "would", "could",
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s]+/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !STOP_WORDS.has(part));
}

export function deriveCanonicalTags(tags: string[], text = ""): string[] {
  const seen = new Set<string>();
  const inputs = [...tags.map(normalizeTag), ...tokenize(text)];

  for (const raw of inputs) {
    if (!raw) continue;
    let matched = false;
    for (const [canonical, synonyms] of Object.entries(SEMANTIC_GROUPS)) {
      if (raw === canonical || synonyms.some((item) => normalizeTag(item) === raw)) {
        seen.add(canonical);
        matched = true;
      }
    }
    if (!matched && raw.length >= 3) {
      seen.add(raw);
    }
  }

  return [...seen].slice(0, 6);
}

function overlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const aSet = new Set(a);
  const bSet = new Set(b);
  let hits = 0;
  for (const value of aSet) {
    if (bSet.has(value)) hits += 1;
  }
  return hits / new Set([...aSet, ...bSet]).size;
}

function seededUnit(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 10000) / 10000;
}

export function getBalloonSimilarity(a: BalloonPost | BalloonDraft, b: BalloonPost | BalloonDraft): number {
  const aTags = deriveCanonicalTags(a.tags, `${a.title} ${a.content}`);
  const bTags = deriveCanonicalTags(b.tags, `${b.title} ${b.content}`);
  const tagScore = overlapScore(aTags, bTags);
  const kindBonus = a.kind === b.kind ? 0.1 : 0;
  const stakeBonus = 1 - Math.min(1, Math.abs(a.stake - b.stake) / 5) * 0.08;
  return clamp(tagScore * 0.82 + kindBonus + stakeBonus, 0, 1);
}

export function driftBalloon(post: BalloonPost, timeMs: number): [number, number] {
  const startTime = new Date(post.createdAt || 0).getTime();
  const elapsed = Math.max(0, timeMs - startTime);
  const t = elapsed / 1000;
  
  // Power scales from 0 to 1 over 2 seconds so it starts exactly at coords
  const power = Math.min(1, elapsed / 2000);
  
  // Unique velocities for each balloon
  const vLatSeed = seededUnit(`${post.id}:vLat`);
  const vLngSeed = seededUnit(`${post.id}:vLng`);
  
  // Longitude drift: -0.015 to 0.045 deg/sec (mostly east-drift)
  const vLng = (vLngSeed * 0.06 - 0.015) * power;
  // Latitude drift: -0.01 to 0.01 deg/sec
  const vLat = (vLatSeed * 0.02 - 0.01) * power;

  // Global linear drift
  let lat = post.coords[0] + vLat * t;
  let lng = post.coords[1] + vLng * t;
  
  // Longitude wrap: -180 to 180
  lng = ((lng + 180) % 360 + 360) % 360 - 180;
  
  // Latitude bounce: 0 -> 1 -> 0 over its period for -85 to 85 range
  const phase = (lat + 85) / 170;
  const bounce = Math.abs(((phase % 2) + 2) % 2 - 1);
  lat = -85 + bounce * 170;
  
  // Local high-frequency "string sway" noise
  const waveA = seededUnit(`${post.id}:a`);
  const waveB = seededUnit(`${post.id}:b`);
  const swayLat = Math.sin(t * (0.4 + waveA * 0.2) + waveB * Math.PI * 2) * (0.05 + waveA * 0.03);
  const swayLng = Math.cos(t * (0.3 + waveB * 0.2) + waveA * Math.PI * 2) * (0.08 + waveB * 0.04);
  
  return [lat + swayLat, lng + swayLng];
}

function approxDistance(a: [number, number], b: [number, number]): number {
  const lat = a[0] - b[0];
  const lng = a[1] - b[1];
  return Math.sqrt(lat * lat + lng * lng);
}

export function buildBalloonClusters(posts: BalloonPost[], timeMs: number): BalloonCluster[] {
  const parents = new Map<string, string>();
  const drifted = new Map<string, [number, number]>();

  for (const post of posts) {
    parents.set(post.id, post.id);
    drifted.set(post.id, driftBalloon(post, timeMs));
  }

  const find = (id: string): string => {
    const parent = parents.get(id);
    if (!parent || parent === id) return id;
    const root = find(parent);
    parents.set(id, root);
    return root;
  };

  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parents.set(rootB, rootA);
  };

  for (let i = 0; i < posts.length; i += 1) {
    for (let j = i + 1; j < posts.length; j += 1) {
      const first = posts[i];
      const second = posts[j];
      const similarity = getBalloonSimilarity(first, second);
      const distance = approxDistance(drifted.get(first.id)!, drifted.get(second.id)!);
      
      // Gravity: High stake balloons have a larger capture radius
      const gravityRadius = 8.5 + (first.stake + second.stake) * 0.8;
      
      if (similarity >= 0.58 && distance <= gravityRadius) {
        union(first.id, second.id);
      }
    }
  }

  const grouped = new Map<string, BalloonPost[]>();
  for (const post of posts) {
    const root = find(post.id);
    const bucket = grouped.get(root) ?? [];
    bucket.push(post);
    grouped.set(root, bucket);
  }

  return [...grouped.values()]
    .map((members) => {
      const points = members.map((member) => drifted.get(member.id)!);
      const coords: [number, number] = [
        points.reduce((sum, point) => sum + point[0], 0) / points.length,
        points.reduce((sum, point) => sum + point[1], 0) / points.length,
      ];
      const tags = members.flatMap((member) => deriveCanonicalTags(member.tags, `${member.title} ${member.content}`));
      const frequency = new Map<string, number>();
      for (const tag of tags) frequency.set(tag, (frequency.get(tag) ?? 0) + 1);
      const dominantTags = [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([tag]) => tag);
      const totalStake = members.reduce((sum, member) => sum + member.stake, 0);
      const similarityScore = members.length <= 1
        ? 0.32
        : members
            .flatMap((member, index) =>
              members.slice(index + 1).map((peer) => getBalloonSimilarity(member, peer)),
            )
            .reduce((sum, value, _, array) => sum + value / array.length, 0);

      return {
        id: members.map((member) => member.id).sort().join(":"),
        memberIds: members.map((member) => member.id),
        members,
        coords,
        totalStake,
        dominantTags,
        similarityScore,
      };
    })
    .sort((a, b) => b.totalStake - a.totalStake);
}

export function matchDraftToBalloons(draft: BalloonDraft, existing: BalloonPost[]): BalloonMatchResult {
  const canonicalTags = deriveCanonicalTags(draft.tags, `${draft.title} ${draft.content}`);
  const relatedBalloonIds = existing
    .map((post) => ({ id: post.id, score: getBalloonSimilarity(draft, post) }))
    .filter((item) => item.score >= 0.36)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.id);

  const tagLine = canonicalTags.length > 0 ? canonicalTags.slice(0, 3).join(" / ") : "open social drift";
  const summary = relatedBalloonIds.length > 0
    ? `AI matched this balloon with ${relatedBalloonIds.length} nearby emotional or DeFi communities around ${tagLine}.`
    : `AI did not find a strong cluster yet, so this balloon will keep drifting with a ${tagLine} signature.`;

  return { canonicalTags, relatedBalloonIds, summary };
}

export function createBalloonPost(draft: BalloonDraft, match?: BalloonMatchResult): BalloonPost {
  return {
    id: `balloon-${Math.random().toString(36).slice(2, 10)}`,
    author: draft.author,
    wallet: draft.wallet,
    kind: draft.kind,
    title: draft.title,
    content: draft.content,
    tags: match?.canonicalTags.length ? match.canonicalTags : draft.tags,
    stake: clamp(Math.round(draft.stake), 1, 5),
    coords: draft.coords,
    createdAt: new Date().toISOString(),
    txHash: null,
    source: "seed",
  };
}

export function getSeedBalloons(): BalloonPost[] {
  return [
    {
      id: "seed-hk-builders",
      author: "Aster",
      wallet: "0x1d7c...cb11",
      kind: "dream",
      title: "想做一个属于亚洲 builder 的链上社区",
      content: "我想把远程协作、赏金、资金池和线下见面都放到一个轻社交协议里。",
      tags: ["builder", "defi", "social", "community"],
      stake: 5,
      coords: [22.3193, 114.1694],
      createdAt: "2026-03-24T09:20:00.000Z",
      source: "seed",
    },
    {
      id: "seed-shanghai-calm",
      author: "Mio",
      wallet: "0x8c21...1fd0",
      kind: "mood",
      title: "今天想慢一点，但也不想掉队",
      content: "希望在做产品和生活之间找到更柔和的节奏，也想认识同样在恢复元气的人。",
      tags: ["healing", "calm", "social", "growth"],
      stake: 2,
      coords: [31.2304, 121.4737],
      createdAt: "2026-03-25T12:00:00.000Z",
      source: "seed",
    },
    {
      id: "seed-singapore-liquidity",
      author: "Kai",
      wallet: "0x5a92...0ce1",
      kind: "signal",
      title: "想找长期做 DeFi 社交图谱的人",
      content: "如果钱包关系和内容标签能一起定价，也许新的社交信用层就会出现。",
      tags: ["defi", "onchain", "social", "liquidity"],
      stake: 4,
      coords: [1.3521, 103.8198],
      createdAt: "2026-03-23T04:40:00.000Z",
      source: "seed",
    },
    {
      id: "seed-berlin-story",
      author: "Nova",
      wallet: "0x7233...af44",
      kind: "story",
      title: "从柏林搬到海边后，我终于又开始写故事",
      content: "想把那些关于自由、城市疲惫和重新开始的片段留在空中，等会共振的人看到。",
      tags: ["freedom", "story", "city", "nature", "art"],
      stake: 3,
      coords: [52.52, 13.405],
      createdAt: "2026-03-22T18:10:00.000Z",
      source: "seed",
    },
    {
      id: "seed-nyc-founder",
      author: "Rune",
      wallet: "0xa442...9ab2",
      kind: "dream",
      title: "下一代社交产品不该只卖注意力",
      content: "我希望社交图谱也能拥有收益权，让认真表达的人在链上被看见。",
      tags: ["startup", "social", "builder", "onchain"],
      stake: 5,
      coords: [40.7128, -74.006],
      createdAt: "2026-03-21T08:15:00.000Z",
      source: "seed",
    },
    {
      id: "seed-sf-lonely",
      author: "Lena",
      wallet: "0x9921...4d22",
      kind: "mood",
      title: "在最热闹的城市里也会有一点孤独",
      content: "希望能遇到同样在高速职业节奏里寻找真实连接的人。",
      tags: ["loneliness", "social", "healing", "citylife"],
      stake: 1,
      coords: [37.7749, -122.4194],
      createdAt: "2026-03-20T03:25:00.000Z",
      source: "seed",
    },
  ];
}
