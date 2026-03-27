"use client";

import { buildBalloonClusters, type BalloonPost } from "@/lib/balloons";
import { useWalletStore } from "@/stores/walletStore";
import { useState, useEffect } from "react";

interface BalloonSidebarProps {
  balloons: BalloonPost[];
  now: number;
  selectedBalloonId: string | null;
  aiSummary: string | null;
  onSelectBalloon: (balloonId: string) => void;
}

export default function BalloonSidebar({
  balloons,
  now,
  selectedBalloonId,
  aiSummary,
  onSelectBalloon,
}: BalloonSidebarProps) {
  const walletAddress = useWalletStore((state) => state.address);
  const [localPoints, setLocalPoints] = useState<number | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setLocalPoints(null);
      return;
    }
    const fetchPoints = () => {
      fetch(`/api/user/points?address=${walletAddress}`)
        .then(res => res.json())
        .then(data => setLocalPoints(data.windPoints || 0))
        .catch(() => {});
    };
    fetchPoints();
    window.addEventListener("balloon-encounters:points-updated", fetchPoints);
    return () => window.removeEventListener("balloon-encounters:points-updated", fetchPoints);
  }, [walletAddress]);

  const clusters = buildBalloonClusters(balloons, now).slice(0, 6);
  const selected = balloons.find((balloon) => balloon.id === selectedBalloonId) ?? balloons[0] ?? null;

  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (!walletAddress || !selected?.id) {
      setHasInteracted(false);
      return;
    }
    fetch(`/api/balloons/interact/status?balloonId=${selected.id}&address=${walletAddress}`)
      .then(res => res.json())
      .then(data => setHasInteracted(!!data.interacted))
      .catch(() => {});
  }, [walletAddress, selected?.id]);
  const formattedCreatedAt = selected
    ? new Date(selected.createdAt).toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
        <div className="text-[11px] uppercase tracking-[0.28em] text-fuchsia-200/70">Selected Balloon</div>
        {selected ? (
          <>
            <div className="mt-3 flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">{selected.title}</h3>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/12 px-2.5 py-1 text-[11px] text-emerald-100">
                ${selected.stake}
              </span>
            </div>
            <div className="mt-2 text-[12px] uppercase tracking-[0.22em] text-white/38">{selected.kind}</div>
            <p className="mt-3 text-sm leading-6 text-white/76">{selected.content}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {selected.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] text-white/72">
                  #{tag}
                </span>
              ))}
            </div>
            <div className="mt-4 text-[12px] text-white/45">
              by {selected.author} · {selected.wallet.slice(0, 6)}...{selected.wallet.slice(-4)}
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-2xl bg-white/5 p-3">
                <div className="text-[11px] uppercase tracking-wider text-white/50">你的风力积分</div>
                <div className="text-sm font-semibold text-emerald-300">{localPoints !== null ? localPoints : "--"}</div>
              </div>
              
              <button
                type="button"
                disabled={hasInteracted}
                onClick={async () => {
                  if (!walletAddress) {
                    alert("请先连接钱包");
                    return;
                  }
                  if (hasInteracted) return;

                  try {
                    const res = await fetch("/api/balloons/interact", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        balloonId: selected.id,
                        walletAddress: walletAddress,
                        action: "click"
                      })
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setLocalPoints((prev) => (prev ?? 0) + (data.pointsAdded || 0));
                      setHasInteracted(true);
                      window.dispatchEvent(new CustomEvent("balloon-encounters:points-updated"));
                    } else if (res.status === 403) {
                      setHasInteracted(true);
                      alert("你已经为此气球点过赞了");
                    }
                  } catch (err) {
                    console.error("Interaction failed", err);
                  }
                }}
                className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 font-semibold transition active:scale-[0.98] ${
                  hasInteracted 
                    ? "bg-white/10 text-white/40 cursor-not-allowed" 
                    : "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                }`}
              >
                {!hasInteracted && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/20 to-emerald-500/0 translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]" />}
                <span className="text-xl">{hasInteracted ? "✨" : "🎈"}</span>
                <span>{hasInteracted ? "已点亮共鸣" : "Glow +1 点亮共鸣"}</span>
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/42 border-t border-white/5 pt-4">
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
                {selected.source === "onchain" ? "onchain" : "demo seed"}
              </span>
              {formattedCreatedAt ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
                  {formattedCreatedAt}
                </span>
              ) : null}
              {selected.txHash ? (
                <a
                  href={`https://polygonscan.com/tx/${selected.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-cyan-300/16 bg-cyan-300/10 px-2.5 py-1 text-cyan-100 transition hover:bg-cyan-300/16"
                >
                  tx {selected.txHash.slice(0, 8)}...{selected.txHash.slice(-6)}
                </a>
              ) : null}
            </div>
          </>
        ) : (
          <div className="mt-3 text-sm text-white/55">地图上还没有气球。</div>
        )}
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">AI Cluster Feed</div>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">相似的人正在空中靠近</h3>
          </div>
          <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-white/58">
            {clusters.length} clusters
          </div>
        </div>

        {aiSummary ? (
          <div className="mt-4 rounded-2xl border border-cyan-300/18 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">
            {aiSummary}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {clusters.map((cluster) => (
            <button
              key={cluster.id}
              type="button"
              onClick={() => onSelectBalloon(cluster.members[0].id)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:border-white/20 hover:bg-black/30"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-white">
                  {cluster.dominantTags.slice(0, 2).join(" · ") || "open drift"}
                </div>
                <div className="text-[12px] text-emerald-100">${cluster.totalStake}</div>
              </div>
              <div className="mt-1 text-[12px] text-white/55">
                {cluster.members.length} 个气球正在共振，标签相似度 {(cluster.similarityScore * 100).toFixed(0)}%
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
