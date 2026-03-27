"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAccount, useWriteContract } from "wagmi";
import { polygon } from "wagmi/chains";
import BalloonComposer from "@/components/BalloonComposer";
import BalloonSidebar from "@/components/BalloonSidebar";
import { useWalletStore } from "@/stores/walletStore";
import {
  buildBalloonClusters,
  createBalloonPost,
  getSeedBalloons,
  matchDraftToBalloons,
  type BalloonDraft,
  type BalloonPost,
} from "@/lib/balloons";

const WalletButton = dynamic(() => import("@/components/WalletButton"), { ssr: false });
const BalloonMap = dynamic(() => import("@/components/BalloonMap"), { ssr: false });
const USDC_E_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;
const STAKE_RECIPIENT = process.env.NEXT_PUBLIC_BALLOON_STAKE_RECIPIENT ?? "";
const ERC20_TRANSFER_ABI = [{
  name: "transfer",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [{ type: "bool" }],
}] as const;

export default function Home() {
  const { chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const walletAddress = useWalletStore((state) => state.address);
  const isConnected = useWalletStore((state) => state.isConnected);
  const tradeSession = useWalletStore((state) => state.tradeSession);
  const [balloons, setBalloons] = useState<BalloonPost[]>(() => getSeedBalloons());
  const [selectedBalloonId, setSelectedBalloonId] = useState<string | null>(() => getSeedBalloons()[0]?.id ?? null);
  const [now, setNow] = useState(() => Date.now());
  const [creating, setCreating] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Load persisted demo balloons from localStorage
    const saved = localStorage.getItem("polyworld_demo_balloons");
    const demoBalloons = saved ? JSON.parse(saved) as BalloonPost[] : [];

    fetch("/api/balloons")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (cancelled) return;
        const apiBalloons = (data?.balloons as BalloonPost[]) ?? [];
        // Merge API balloons with local demo balloons, filtering duplicates
        const merged = [...demoBalloons, ...apiBalloons.filter(api => !demoBalloons.some(d => d.id === api.id))];
        setBalloons(merged.length > 0 ? merged : getSeedBalloons());
        setSelectedBalloonId((prev) => prev ?? merged[0]?.id ?? getSeedBalloons()[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled && demoBalloons.length > 0) {
          setBalloons([...demoBalloons, ...getSeedBalloons()]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 110);
    return () => window.clearInterval(timer);
  }, []);

  const clusters = useMemo(() => buildBalloonClusters(balloons, now), [balloons, now]);
  const totalStake = useMemo(() => balloons.reduce((sum, balloon) => sum + balloon.stake, 0), [balloons]);
  const defiWeighted = useMemo(
    () => balloons.filter((balloon) => balloon.tags.some((tag) => ["defi", "onchain", "builder", "social"].includes(tag))).length,
    [balloons],
  );
  const onchainCount = useMemo(
    () => balloons.filter((balloon) => balloon.source === "onchain").length,
    [balloons],
  );
  const recipientConfigured = /^0x[a-fA-F0-9]{40}$/.test(STAKE_RECIPIENT);

  async function handleCreate(draft: BalloonDraft) {
    setCreating(true);
    setPublishError(null);
    try {
      if (!recipientConfigured) {
        // Simulation path: skip blockchain and API, just add to local state
        const match = matchDraftToBalloons(draft, balloons);
        const post = createBalloonPost(draft, match);
        const nextBalloons = [post, ...balloons];
        setBalloons(nextBalloons);
        setSelectedBalloonId(post.id);
        setAiSummary(match.summary);

        // Persist to localStorage
        const saved = localStorage.getItem("polyworld_demo_balloons");
        const demoBalloons = saved ? JSON.parse(saved) as BalloonPost[] : [];
        localStorage.setItem("polyworld_demo_balloons", JSON.stringify([post, ...demoBalloons].slice(0, 50)));

        console.log("Simulated balloon published and persisted:", post);
        return;
      }

      if (!walletAddress) {
        throw new Error("请先连接钱包");
      }
      if (chainId !== polygon.id) {
        throw new Error("请先切换到 Polygon 网络");
      }

      const txHash = await writeContractAsync({
        address: USDC_E_ADDRESS,
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [STAKE_RECIPIENT as `0x${string}`, BigInt(Math.round(draft.stake * 1e6))],
        chainId: polygon.id,
      });

      let publishResponse: Response | null = null;
      for (let attempt = 0; attempt < 18; attempt += 1) {
        publishResponse = await fetch("/api/balloons/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draft: {
              ...draft,
              wallet: walletAddress,
            },
            txHash,
            chainId: chainId ?? polygon.id,
            sessionToken: tradeSession?.sessionToken ?? null,
          }),
        });

        if (publishResponse.ok) break;
        const failed = await publishResponse.json().catch(() => null);
        if (!failed?.error || !String(failed.error).includes("not confirmed")) {
          throw new Error(failed?.error ?? "发布失败");
        }
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }

      if (!publishResponse || !publishResponse.ok) {
        throw new Error("链上交易已提交，但服务端还未确认 receipt");
      }

      const payload = await publishResponse.json() as { balloon: BalloonPost; summary?: string };
      const post = payload.balloon ?? createBalloonPost(draft, matchDraftToBalloons(draft, balloons));
      setBalloons((prev) => [post, ...prev.filter((item) => item.id !== post.id)]);
      setSelectedBalloonId(post.id);
      setAiSummary(payload.summary ?? null);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    if (creating) setPublishError(null);
  }, [creating]);

  async function guardedCreate(draft: BalloonDraft) {
    try {
      await handleCreate(draft);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "发布失败");
      setCreating(false);
    }
  }

  return (
    <main className="balloon-home min-h-screen overflow-x-hidden bg-[#050816] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-10%] h-[26rem] w-[26rem] rounded-full bg-cyan-400/16 blur-3xl" />
        <div className="absolute right-[-6%] top-[12%] h-[24rem] w-[24rem] rounded-full bg-fuchsia-500/14 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[28%] h-[22rem] w-[22rem] rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <header className="rounded-[26px] border border-white/10 bg-white/[0.04] px-5 py-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-[0.34em] text-cyan-200/70">Balloon Encounters</div>
              <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
                <h1 className="text-[34px] font-semibold leading-none tracking-[-0.05em] text-white sm:text-[48px]">
                  漂浮气球社交地图
                </h1>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/12 px-3 py-1 text-[11px] text-emerald-100">
                  DeFi x Social
                </span>
              </div>
              <p className="mt-3 max-w-[820px] text-sm leading-6 text-white/68 sm:text-[15px]">
                每个用户都能把心情、故事、理想或 DeFi 合作信号放进一个带 1-5 USDT stake 的气球里，让 AI 根据标签与语义把相似的人慢慢聚到一起。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-[20px] border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
                {isConnected && walletAddress
                  ? `钱包已连接 ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : "连接钱包后即可发布漂流气球"}
              </div>
              <WalletButton />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="漂流气球" value={`${balloons.length}`} detail="用户发布的人类表达" />
            <MetricCard label="社交资金" value={`$${totalStake}`} detail="所有气球的 stake 总和" />
            <MetricCard label="DeFi / 社交权重" value={`${defiWeighted}/${balloons.length}`} detail={`${clusters.length} 个正在形成的相似气团`} />
            <MetricCard label="链上已确认" value={`${onchainCount}`} detail={recipientConfigured ? "已验真并写入 SQLite" : "等待配置接收地址"} />
          </div>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.66fr]">
          <div className="space-y-6">
            <BalloonMap
              balloons={balloons}
              now={now}
              selectedBalloonId={selectedBalloonId}
              onSelectBalloon={setSelectedBalloonId}
            />

            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Why This Works</div>
                <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-white">让标签相似的人，不靠刷 feed，而靠漂流和聚合被看见</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <FeatureCard title="Human posts" body="内容来自用户亲自发布，主题可以是情绪、故事、愿景或链上合作信号。" />
                  <FeatureCard title="AI matching" body="AI 会把原始标签归一化，并把情绪和 DeFi 语义放进同一聚类图里。" />
                  <FeatureCard title="Stake gravity" body="1-5 USDT 不只是打赏，而是气球的引力，让聚合结果更有密度。" />
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.28em] text-fuchsia-200/70">Social Finance Loop</div>
                <div className="mt-3 space-y-3 text-sm leading-6 text-white/72">
                  <p>用户发布气球并绑定钱包身份，stake 形成最轻量的社交承诺。</p>
                  <p>语义相似的气球在地图上漂动时会合成更大的球，形成主题社群。</p>
                  <p>后续可以在大球上继续接入任务、资金池、membership NFT 或合作提案。</p>
                </div>
              </section>
            </div>
          </div>

          <div className="space-y-6">
            <BalloonComposer
              walletAddress={walletAddress}
              onCreate={guardedCreate}
              creating={creating}
              error={publishError}
              recipientConfigured={recipientConfigured}
              recipientAddress={recipientConfigured ? STAKE_RECIPIENT : null}
            />
            <BalloonSidebar
              balloons={balloons}
              now={now}
              selectedBalloonId={selectedBalloonId}
              aiSummary={aiSummary}
              onSelectBalloon={setSelectedBalloonId}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">{label}</div>
      <div className="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-white">{value}</div>
      <div className="mt-1 text-[12px] text-white/52">{detail}</div>
    </div>
  );
}

function FeatureCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-2 text-[13px] leading-6 text-white/58">{body}</div>
    </div>
  );
}
