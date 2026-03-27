"use client";

import { useMemo, useState } from "react";
import { type BalloonDraft, type BalloonKind } from "@/lib/balloons";

interface BalloonComposerProps {
  walletAddress: string | null;
  onCreate: (draft: BalloonDraft) => Promise<void>;
  creating: boolean;
  error?: string | null;
  recipientConfigured?: boolean;
  recipientAddress?: string | null;
}

const KIND_OPTIONS: Array<{ value: BalloonKind; label: string; description: string }> = [
  { value: "mood", label: "心情", description: "即时情绪与陪伴需求" },
  { value: "story", label: "故事", description: "经历、片段、记忆" },
  { value: "dream", label: "理想", description: "愿景、目标、使命" },
  { value: "signal", label: "信号", description: "DeFi 洞察、合作召集" },
];

export default function BalloonComposer({
  walletAddress,
  onCreate,
  creating,
  error,
  recipientConfigured = true,
  recipientAddress,
}: BalloonComposerProps) {
  const [kind, setKind] = useState<BalloonKind>("dream");
  const [author, setAuthor] = useState("匿名漂流者");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("defi, social");
  const [stake, setStake] = useState(3);
  const [coords, setCoords] = useState(() => {
    const lat = 31.2304 + (Math.random() - 0.5) * 0.1;
    const lng = 121.4737 + (Math.random() - 0.5) * 0.1;
    return `[${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
  });

  const isSimulation = !recipientConfigured;
  const disabled = creating || (!walletAddress && !isSimulation) || !title.trim() || !content.trim();
  const parsedCoords = useMemo(() => {
    const matched = coords.match(/-?\d+(\.\d+)?/g);
    if (!matched || matched.length < 2) return null;
    return [Number(matched[0]), Number(matched[1])] as [number, number];
  }, [coords]);

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/70">Launch A Balloon</div>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-white">把一句话、一段故事或一个理想送上地图</h2>
        </div>
        <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100">
          1-5 USDT
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {KIND_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setKind(option.value)}
            className={`rounded-2xl border px-3 py-3 text-left transition ${
              kind === option.value
                ? "border-cyan-300/40 bg-cyan-300/12 text-white"
                : "border-white/10 bg-white/[0.02] text-white/72 hover:border-white/20 hover:bg-white/[0.05]"
            }`}
          >
            <div className="text-sm font-medium">{option.label}</div>
            <div className="mt-1 text-[11px] text-white/55">{option.description}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <label className="block">
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.24em] text-white/45">署名</div>
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/35"
            placeholder="你的昵称"
          />
        </label>

        <label className="block">
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.24em] text-white/45">标题</div>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/35"
            placeholder="比如：想找一起做 DeFi 社交实验的人"
          />
        </label>

        <label className="block">
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.24em] text-white/45">内容</div>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/35"
            placeholder="写下你的心情、故事、理想，或想吸引什么样的人靠近。"
          />
        </label>

        <div className="grid grid-cols-[1.4fr,0.9fr] gap-3">
          <label className="block">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.24em] text-white/45">标签</div>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/35"
              placeholder="defi, healing, builders"
            />
          </label>

          <label className="block">
            <div className="mb-1.5 text-[11px] uppercase tracking-[0.24em] text-white/45">投放坐标</div>
            <input
              value={coords}
              onChange={(event) => setCoords(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/35"
              placeholder="[31.23, 121.47]"
            />
          </label>
        </div>

        <label className="block">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-white/45">
            <span>Stake</span>
            <span className="text-emerald-100">{stake} USDT</span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={stake}
            onChange={(event) => setStake(Number(event.target.value))}
            className="w-full accent-emerald-400"
          />
        </label>
      </div>

      <div className={`mt-5 rounded-2xl border px-4 py-3 text-[12px] ${
        isSimulation 
          ? "border-amber-400/20 bg-amber-400/10 text-amber-200/80" 
          : "border-white/10 bg-black/25 text-white/62"
      }`}>
        {isSimulation
          ? "模拟模式：当前未配置 stake 接收地址。你可以直接发布气球，它将漂浮在你的本地地图上。"
          : walletAddress
          ? `当前钱包 ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} 已连接。发布后会把 1-5 USDT 作为这个气球的社交权重。`
          : "请先连接钱包。发布动作会绑定钱包身份，并把 1-5 USDT 写成这个气球的链上 stake。"}
      </div>

      {recipientConfigured && recipientAddress ? (
        <div className="mt-3 rounded-2xl border border-cyan-300/16 bg-cyan-300/10 px-4 py-3 text-[12px] text-cyan-50">
          Stake recipient: {recipientAddress.slice(0, 8)}...{recipientAddress.slice(-6)}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-[12px] text-rose-100">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={disabled || !parsedCoords}
        onClick={async () => {
          if (!isSimulation && !walletAddress) return;
          if (!parsedCoords) return;
          await onCreate({
            author: author.trim() || "匿名漂流者",
            wallet: walletAddress || "0x_anonymous_drifter",
            kind,
            title: title.trim(),
            content: content.trim(),
            tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
            stake,
            coords: parsedCoords,
          });
          setTitle("");
          setContent("");
          setTags("defi, social");
        }}
        className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 ${
          isSimulation
            ? "bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950"
            : "bg-gradient-to-r from-emerald-400 via-cyan-300 to-sky-400 text-slate-950"
        }`}
      >
        {creating ? "AI 正在匹配标签与社群..." : isSimulation ? "本地模拟发布" : "发布漂流气球"}
      </button>
    </section>
  );
}
