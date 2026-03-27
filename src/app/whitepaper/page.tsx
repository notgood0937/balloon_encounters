"use client";

import React from "react";
import Link from "next/link";

export default function WhitepaperPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-serif p-6 sm:p-12 md:p-20 selection:bg-rose-500/30">
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .paper-content { box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
          h1, h2, h3 { color: black !important; }
          a { color: black !important; text-decoration: underline !important; }
        }
      `}</style>

      {/* Navigation & Actions */}
      <nav className="no-print fixed top-6 right-6 flex items-center gap-4 z-50">
        <Link 
          href="/"
          className="px-4 py-2 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-rose-400 text-[13px] font-sans transition-all text-[var(--text-muted)] no-underline flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          返回地图
        </Link>
        <button 
          onClick={handlePrint}
          className="px-4 py-2 rounded-full bg-rose-500 text-white text-[13px] font-sans font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          保存 PDF / 打印
        </button>
      </nav>

      {/* Main Content Area */}
      <article className="paper-content max-w-3xl mx-auto bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl p-10 sm:p-16 relative overflow-hidden">
        {/* Decorative corner */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rotate-45 translate-x-16 -translate-y-16 pointer-events-none" />
        
        <header className="mb-12 border-b border-[var(--border-subtle)] pb-8">
          <div className="text-rose-500 font-sans font-bold tracking-widest text-[12px] uppercase mb-4">Official Whitepaper / 官方白皮书</div>
          <h1 className="text-4xl sm:text-5xl font-bold font-sans tracking-tight mb-4">气球遭遇战 (Balloon Encounters)</h1>
          <p className="text-[var(--text-secondary)] text-lg leading-relaxed font-sans italic">
            经济模型提案："社交漂流与合并" (Social Drift & Merge)
          </p>
          <div className="mt-8 flex items-center gap-4 text-[13px] font-sans text-[var(--text-faint)] uppercase tracking-tighter">
            <span>Version 1.0.1</span>
            <span>•</span>
            <span>Last Updated: {new Date().toLocaleDateString('zh-CN')}</span>
          </div>
        </header>

        <section className="space-y-12 leading-loose text-lg text-[var(--text-secondary)]">
          <div>
            <p>
              本模型旨在通过结合当前的 USDT 质押和自动化的价值再分配，激励高质量的社交表达、有意义的聚类，并确保平台的长期可持续性。
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-[var(--text)] mb-6 font-sans">1. 核心：气球质押（“社交引力”）</h2>
            <p>
              每个气球发布时需质押 <strong className="text-rose-400">1-5 USDT</strong>。这就是气球的“引力 (Gravity)”。
            </p>
            <ul className="list-disc ml-6 mt-4 space-y-4">
              <li><strong>创建费</strong>：质押金的高达 10% 进入平台国库 (Platform Treasury)，用于覆盖 AI 新闻匹配、内容分析等基础设施。</li>
              <li><strong>引力缩放</strong>：高质押气球具备更大的语义捕获半径，能够在动态地图中充当区域协调中心。</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-[var(--text)] mb-6 font-sans">2. 生命周期：“褪色与爆破”</h2>
            <p>
              气球代表了社交注意力的瞬时性。
            </p>
            <ul className="list-disc ml-6 mt-4 space-y-4">
              <li><strong>资金衰减 (Drift Decay)</strong>：每 24 小时，气球会失去当前剩余质押金的 2%。这部分资金将重新分配到气团金库和风力奖金池。</li>
              <li><strong>爆破阈值</strong>：当气球的质押金低于 0.5 USDT 时，它会发生“爆破”（从地图上消失），实现内容的自动代谢。</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-[var(--text)] mb-6 font-sans">3. 协同效应：气团金库</h2>
            <p>
              当相似的气球聚集在一起时，它们会创建一个共享价值池。大型气团可以解锁气团聊天室等公共功能。AI 会识别“核心”气球，赋予其所有者治理气团金库的权利。
            </p>
          </div>

          <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-8 my-10 font-sans">
            <h2 className="text-xl font-bold text-rose-400 mb-4">4. 数学公式 (Mathematical Logic)</h2>
            <div className="space-y-6 text-[15px] leading-relaxed">
              <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--border-subtle)]">
                <div className="text-[var(--text-muted)] mb-1">资金衰减公式 (S_decay):</div>
                <code className="text-rose-300 font-mono">S_decay = S_current * (0.02 / 24)</code>
              </div>
              <div className="bg-[var(--bg)] p-4 rounded-lg border border-[var(--border-subtle)]">
                <div className="text-[var(--text-muted)] mb-1">风力积分奖励 (P_wind):</div>
                <code className="text-rose-300 font-mono">P_wind = Σ(Interaction) + B_originality</code>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-[var(--text)] mb-6 font-sans">5. 公平性与设计理念</h2>
            <p>
              “衰减”模型并非单纯的资金流失，而是一种<strong>“注意力证明税 (Proof-of-Attention Tax)”</strong>。它有效对抗了零价值僵尸内容，确保只有持续获得社区共鸣的信息才能留存。
            </p>
            <p className="mt-4">
              用户质押不仅仅是为了展示，更是为了参与一场<strong>社交行为挖矿</strong>，获取象征未来治理权的 $BALLOON 代币奖励。
            </p>
          </div>
        </section>

        <footer className="mt-20 pt-10 border-t border-[var(--border-subtle)] text-center">
          <p className="text-[var(--text-faint)] text-[12px] font-sans tracking-widest uppercase">
            © {new Date().getFullYear()} Balloon Encounters Protocol. All Rights Reserved.
          </p>
        </footer>
      </article>
      
      <div className="no-print h-20" />
    </div>
  );
}
