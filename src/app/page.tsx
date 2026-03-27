"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAccount, useWriteContract } from "wagmi";
import { polygon } from "wagmi/chains";
import BalloonComposer from "@/components/BalloonComposer";
import BalloonSidebar from "@/components/BalloonSidebar";
import { useWalletStore } from "@/stores/walletStore";
import {
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
  const [now, setNow] = useState(0);
  const [creating, setCreating] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [simulationWalletId, setSimulationWalletId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    let sid = localStorage.getItem("balloon_sim_wallet_id");
    if (!sid) {
      sid = `0x_sim_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("balloon_sim_wallet_id", sid);
    }
    setSimulationWalletId(sid);
  }, []);
  const [windPoints, setWindPoints] = useState(0);
  const [myTotalStake, setMyTotalStake] = useState(0);
  const [ecoStats, setEcoStats] = useState({ platformTreasury: 0, totalEcosystemStake: 0, activeBalloons: 0, dailyDecayRate: 0.02 });
  const recipientConfigured = /^0x[a-fA-F0-9]{40}$/.test(STAKE_RECIPIENT);
  const simulationMode = !recipientConfigured;
  const effectiveAddress = walletAddress || simulationWalletId;

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
    if (!effectiveAddress) {
      setWindPoints(0);
      setMyTotalStake(0);
      return;
    }

    if (simulationMode) {
      const syncLocalStats = () => {
        try {
          const points = Number(localStorage.getItem(`balloon_points:${effectiveAddress.toLowerCase()}`) ?? "0");
          const stake = Number(localStorage.getItem(`balloon_sim_total_stake:${effectiveAddress.toLowerCase()}`) ?? "0");
          setWindPoints(points);
          setMyTotalStake(stake);
        } catch {
          setWindPoints(0);
          setMyTotalStake(0);
        }
      };
      syncLocalStats();
      window.addEventListener("balloon-encounters:points-updated", syncLocalStats);
      return () => window.removeEventListener("balloon-encounters:points-updated", syncLocalStats);
    }

    const fetchPoints = () => {
      fetch(`/api/user/points?address=${effectiveAddress}`)
        .then(res => res.json())
        .then(data => {
          setWindPoints(data.windPoints || 0);
          setMyTotalStake(data.totalStake || 0);
        })
        .catch(err => console.error("Failed to fetch points", err));
    };
    fetchPoints();
    window.addEventListener("balloon-encounters:points-updated", fetchPoints);
    return () => window.removeEventListener("balloon-encounters:points-updated", fetchPoints);
  }, [effectiveAddress, simulationMode]);

  useEffect(() => {
    if (simulationMode) {
      const syncEco = () => {
        try {
          const saved = localStorage.getItem("polyworld_demo_balloons");
          const demoBalloons = saved ? JSON.parse(saved) as BalloonPost[] : [];
          const total = demoBalloons.reduce((sum, balloon) => sum + balloon.stake, 0);
          setEcoStats({
            platformTreasury: 0,
            totalEcosystemStake: total,
            activeBalloons: demoBalloons.length,
            dailyDecayRate: 0.02,
          });
        } catch {
          setEcoStats({ platformTreasury: 0, totalEcosystemStake: 0, activeBalloons: 0, dailyDecayRate: 0.02 });
        }
      };
      syncEco();
      window.addEventListener("balloon-encounters:points-updated", syncEco);
      return () => window.removeEventListener("balloon-encounters:points-updated", syncEco);
    }

    const fetchEco = () => {
      fetch("/api/economy/stats")
        .then(res => res.json())
        .then(data => setEcoStats(data))
        .catch(() => {});
    };
    fetchEco();
    const timer = window.setInterval(fetchEco, 30000); // 30s refresh
    window.addEventListener("balloon-encounters:points-updated", fetchEco);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("balloon-encounters:points-updated", fetchEco);
    };
  }, [simulationMode]);

  useEffect(() => {
    if (!hydrated) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 110);
    return () => window.clearInterval(timer);
  }, [hydrated]);

  const totalStake = useMemo(() => balloons.reduce((sum, balloon) => sum + balloon.stake, 0), [balloons]);

  async function handleCreate(draft: BalloonDraft) {
    setCreating(true);
    setPublishError(null);
    try {
      if (simulationMode) {
        const actor = effectiveAddress || "0x_anonymous_sim";
        const match = matchDraftToBalloons({ ...draft, wallet: actor }, balloons);
        const post: BalloonPost = {
          ...createBalloonPost({ ...draft, wallet: actor }, match),
          originalStake: draft.stake,
          source: "seed",
          txHash: null,
        };
        setBalloons((prev) => [post, ...prev]);
        setSelectedBalloonId(post.id);
        setAiSummary(match.summary);
        try {
          const saved = localStorage.getItem("polyworld_demo_balloons");
          const demoBalloons = saved ? JSON.parse(saved) as BalloonPost[] : [];
          localStorage.setItem("polyworld_demo_balloons", JSON.stringify([post, ...demoBalloons].slice(0, 50)));
          const pointsKey = `balloon_points:${actor.toLowerCase()}`;
          const stakeKey = `balloon_sim_total_stake:${actor.toLowerCase()}`;
          const points = Number(localStorage.getItem(pointsKey) ?? "0");
          const stake = Number(localStorage.getItem(stakeKey) ?? "0");
          localStorage.setItem(pointsKey, String(points + 3));
          localStorage.setItem(stakeKey, String(stake + post.stake));
        } catch (err) {
          console.error("Simulation persistence failed", err);
        }
        window.dispatchEvent(new CustomEvent("balloon-encounters:points-updated"));
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
      window.dispatchEvent(new CustomEvent("balloon-encounters:points-updated"));
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
              {isConnected && walletAddress ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 transition hover:bg-emerald-500/20">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-300/80">My Stake</span>
                    <span className="text-sm font-bold text-white">${myTotalStake.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-1.5 transition hover:bg-fuchsia-500/20">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-fuchsia-300/80">Wind Points</span>
                    <span className="text-sm font-bold text-white">{windPoints}</span>
                  </div>
                  <div className="ml-2 h-4 w-px bg-white/10" />
                  <div className="text-[12px] tabular-nums text-white/40">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </div>
                </div>
              ) : (
                <div className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm text-white/40">
                  连接钱包后即可发布漂流气球
                </div>
              )}
              <WalletButton />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="活跃气球" value={`${balloons.length}`} detail="包含种子数据与链上气球" />
            <MetricCard label="平台国库" value={`$${ecoStats.platformTreasury.toFixed(4)}`} detail="衰减资金累计及维护费" />
            <MetricCard label="生态总质押" value={`$${totalStake.toFixed(2)}`} detail="全网气球当前价值总合" />
            <MetricCard label="平均衰减率" value={`${(ecoStats.dailyDecayRate * 100).toFixed(0)}%/天`} detail="模型预设的社交热度消退速度" />
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
                <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">The Economic Model</div>
                <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-white">让社交在漂流中聚合，在博弈中沉淀</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <FeatureCard title="社交引力 (Gravity)" body="1-5 USDT 质押定义了气球的“质量”。高质量气球聚合半径更大，能更快锚定相似语义的社区。" />
                  <FeatureCard title="衰减与爆破 (Lifecycle)" body="气球每日扣除 2% 质押给聚合国库。质押低于 0.5 USDT 时强制爆破，确保地图永远新鲜高价值。" />
                  <FeatureCard title="聚合国库 (Treasury)" body="气团内累积的衰减金形成共同价值池。核心成员可获得奖励，或用其将气团锚定在特定地理坐标。" />
                  <FeatureCard title="社交挖矿 (Mining)" body="AI 根据原创度和聚类贡献度发放“风力积分”。共鸣（点击、关注）可赚取积分，用于变现或功能兑换。" />
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                <div className="text-[11px] uppercase tracking-[0.28em] text-fuchsia-200/70">Platform Monetization</div>
                <div className="mt-3 space-y-4 text-sm leading-6 text-white/72">
                  <div>
                    <strong className="text-white/90">● 发布费 & AI 维护：</strong>
                    <p>每只气球 10% 的初始质押会进入平台库，用于覆盖 AI 标签处理、新闻匹配和地图算力的持续支出。</p>
                  </div>
                  <div>
                    <strong className="text-white/90">● 增值漂流服务：</strong>
                    <p>用户可以购买“顺风车”服务（0.5 USDT）手动调整漂移轨迹，或购买“锚定器”（1 USDT）让气球在特定经纬度保持静止。</p>
                  </div>
                  <div>
                    <strong className="text-white/90">● 社交信号溢价：</strong>
                    <p>对于 Signal 类型气球，如果关联的 DeFi 市场预测准确，该气球将被赋予“高亮光晕”，提升社交曝光度和信用分。</p>
                  </div>
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
              effectiveAddress={effectiveAddress}
              simulationMode={simulationMode}
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
