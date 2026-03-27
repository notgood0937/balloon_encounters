"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildBalloonClusters, type BalloonCluster, type BalloonPost } from "@/lib/balloons";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface BalloonMapProps {
  balloons: BalloonPost[];
  now: number;
  selectedBalloonId: string | null;
  onSelectBalloon: (balloonId: string) => void;
}

function clusterTone(cluster: BalloonCluster): string {
  if (cluster.dominantTags.includes("defi") || cluster.dominantTags.includes("onchain")) return "#00ffa3"; // Emerald Neon
  if (cluster.dominantTags.includes("healing") || cluster.dominantTags.includes("love")) return "#ffaa00"; // Amber Neon
  if (cluster.dominantTags.includes("dreamer") || cluster.dominantTags.includes("builder")) return "#00b4ff"; // Sky Neon
  return "#ff3366"; // Rose Neon (Balloon Red)
}

function markerSize(cluster: BalloonCluster): number {
  return Math.min(96, 26 + cluster.totalStake * 7 + Math.max(0, cluster.members.length - 1) * 8);
}

export default function BalloonMap({
  balloons,
  now,
  selectedBalloonId,
  onSelectBalloon,
}: BalloonMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  const clusters = useMemo(() => buildBalloonClusters(balloons, now), [balloons, now]);
  const selectedClusterId = useMemo(
    () => clusters.find((cluster) => cluster.memberIds.includes(selectedBalloonId ?? ""))?.id ?? null,
    [clusters, selectedBalloonId],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [110, 22],
      zoom: 1.55,
      minZoom: 1.2,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setMapReady(true));
    mapRef.current = map;

    return () => {
      for (const marker of markersRef.current.values()) marker.remove();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const nextMarkerIds = new Set(clusters.map((cluster) => cluster.id));

    for (const [markerId, marker] of markersRef.current.entries()) {
      if (!nextMarkerIds.has(markerId)) {
        marker.remove();
        markersRef.current.delete(markerId);
      }
    }

    for (const cluster of clusters) {
      const primary = cluster.members[0];
      const color = clusterTone(cluster);
      const selected = cluster.id === selectedClusterId;
      const size = markerSize(cluster);
      const existing = markersRef.current.get(cluster.id);

      if (existing) {
        existing.setLngLat([cluster.coords[1], cluster.coords[0]]);
        const element = existing.getElement() as HTMLButtonElement;
        element.style.zIndex = selected ? "1000" : "100";
        element.style.setProperty("--balloon-size", `${size}px`);
        element.style.setProperty("--balloon-color", color);
        element.dataset.selected = selected ? "true" : "false";
        element.querySelector("[data-role='stake']")!.textContent = `$${cluster.totalStake}`;
        element.querySelector("[data-role='count']")!.textContent = cluster.members.length > 1 ? `${cluster.members.length}` : "";
        element.querySelector("[data-role='label']")!.textContent = cluster.dominantTags.slice(0, 2).join(" · ") || primary.kind;
        
        // Update bubble visibility and content
        const bubble = element.querySelector(".balloon-marker__bubble");
        if (selected) {
          if (bubble) {
            bubble.querySelector("h4")!.textContent = primary.title;
            bubble.querySelector("p")!.textContent = primary.content.length > 80 ? `${primary.content.slice(0, 78)}...` : primary.content;
          } else {
            const newBubble = document.createElement("div");
            newBubble.className = "balloon-marker__bubble";
            newBubble.innerHTML = `<h4>${primary.title}</h4><p>${primary.content.length > 80 ? `${primary.content.slice(0, 78)}...` : primary.content}</p>`;
            element.appendChild(newBubble);
          }
        } else if (bubble) {
          bubble.remove();
        }
        continue;
      }

      const el = document.createElement("button");
      el.type = "button";
      el.className = "balloon-marker";
      el.dataset.selected = selected ? "true" : "false";
      el.style.zIndex = selected ? "1000" : "100";
      el.style.setProperty("--balloon-size", `${size}px`);
      el.style.setProperty("--balloon-color", color);
      el.innerHTML = `
        <span class="balloon-marker__float">
          <span class="balloon-marker__core">
            <span class="balloon-marker__count" data-role="count">${cluster.members.length > 1 ? cluster.members.length : ""}</span>
            <span class="balloon-marker__stake" data-role="stake">$${cluster.totalStake}</span>
          </span>
          <span class="balloon-marker__string"></span>
        </span>
        <span class="balloon-marker__label" data-role="label">${cluster.dominantTags.slice(0, 2).join(" · ") || primary.kind}</span>
        ${selected ? `<div class="balloon-marker__bubble"><h4>${primary.title}</h4><p>${primary.content.length > 80 ? `${primary.content.slice(0, 78)}...` : primary.content}</p></div>` : ""}
      `;
      el.addEventListener("click", () => onSelectBalloon(primary.id));

      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([cluster.coords[1], cluster.coords[0]])
        .addTo(mapRef.current);

      markersRef.current.set(cluster.id, marker);
    }
  }, [clusters, mapReady, onSelectBalloon, selectedClusterId]);

  const lastSelectedClusterId = useRef<string | null>(null);
  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedClusterId) return;
    if (lastSelectedClusterId.current === selectedClusterId) return;

    const cluster = clusters.find((c) => c.id === selectedClusterId);
    if (!cluster) return;

    lastSelectedClusterId.current = selectedClusterId;
    mapRef.current.easeTo({
      center: [cluster.coords[1], cluster.coords[0]],
      zoom: Math.max(mapRef.current.getZoom(), 4.5),
      duration: 1000,
    });
  }, [selectedClusterId, mapReady, clusters]);

  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-[28px] border border-white/10 bg-[#060816]">
      <div ref={mapContainerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#060816] via-[#060816]/55 to-transparent" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-[#060816] via-[#060816]/70 to-transparent" />

      <div className="absolute left-5 top-5 max-w-[340px] rounded-[24px] border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl">
        <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Drifting Graph</div>
        <div className="mt-2 text-sm text-white/90">
          相似标签的气球会在漂流中逐渐聚合，形成更大的链上社交气团。
        </div>
      </div>

      <div className="absolute bottom-5 left-5 flex flex-wrap gap-2">
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/12 px-3 py-1 text-[11px] text-emerald-100">
          DeFi affinity
        </span>
        <span className="rounded-full border border-amber-300/25 bg-amber-300/12 px-3 py-1 text-[11px] text-amber-50">
          Healing / mood
        </span>
        <span className="rounded-full border border-sky-300/25 bg-sky-300/12 px-3 py-1 text-[11px] text-sky-50">
          Builder / dream
        </span>
      </div>
    </div>
  );
}
