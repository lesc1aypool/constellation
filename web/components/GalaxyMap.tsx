"use client";

// The WebGL galaxy, organised as snap-point levels (see docs/SPEC.md):
//   Genres         (universe)     genre names over soft nebulas
//   Subgenres      (galaxy)       a genre's subgenres as star clusters
//   Popular bands  (bright stars) the best-known bands of each subgenre
//   Neighbourhood                 a band and its related bands
//   Band           (solar system) not built yet
// Internally the levels are numbered 1-4 in that order (`Layer`).
// The view always rests on one level. Scroll / pinch / +− / keys move one level
// at a time and an animation carries the camera there while stars fade.
//
// Zooming in enters whatever is nearest the mouse (desktop) or the middle of
// the pinch (touch). On desktop that target glows as you move the mouse; on
// touch it glows while you pinch. There is no glow at the Genres level.
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type Sigma from "sigma";
import { type Galaxy, REGION_COLORS, edgeColor, hexToRgba } from "@/lib/galaxy";

export type Layer = 1 | 2 | 3 | 4;
export type Nav = {
  layer: Layer;
  regionId: string | null;
  regionLabel: string | null;
  subId: string | null;
  subLabel: string | null;
  color: string | null;
};

export type GalaxyMapHandle = {
  stepIn: () => void;
  stepOut: () => void;
  goTo: (layer: 1 | 2 | 3, id?: string) => void;
};

type Props = {
  galaxy: Galaxy;
  selected: string | null;
  onSelect: (mbid: string | null) => void;
  onNavChange: (nav: Nav) => void;
  onNotice: (message: string) => void;
  ref?: Ref<GalaxyMapHandle>;
};

type ClusterInfo = {
  id: string;
  label: string;
  level: 0 | 1;
  parentId: string | null;
  color: string;
  members: string[];
  cx: number;
  cy: number;
  radius: number;
};

type Focus = { kind: "cluster"; id: string } | { kind: "band"; id: string } | null;

// --- Per-layer look -----------------------------------------------------------------
const POPULAR_SHARE = 0.4; // layer 3 lights up this share of each subgenre (most listeners first)
const DUST: Record<Layer, number> = { 1: 0.34, 2: 0.3, 3: 0.2, 4: 0.1 }; // brightness of unlit stars
const REGION_LABEL: Record<Layer, number> = { 1: 1, 2: 0.3, 3: 0.12, 4: 0 };
const SUB_LABEL: Record<Layer, number> = { 1: 0, 2: 1, 3: 0.45, 4: 0.06 };
const REGION_NEBULA: Record<Layer, number> = { 1: 1, 2: 0.35, 3: 0.14, 4: 0.06 };
const SUB_NEBULA: Record<Layer, number> = { 1: 0, 2: 0.9, 3: 0.35, 4: 0.05 };
const TRANSITION_MS = 850;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function GalaxyMap({ galaxy, selected, onSelect, onNavChange, onNotice, ref }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const nebulaRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const api = useRef<{
    enterBand: (mbid: string) => void;
    leaveBand: () => void;
    setSelection: (mbid: string | null) => void;
    stepIn: () => void;
    stepOut: () => void;
    goTo: (layer: 1 | 2 | 3, id?: string) => void;
  } | null>(null);
  const callbacks = useRef({ onSelect, onNavChange, onNotice });
  useEffect(() => {
    callbacks.current = { onSelect, onNavChange, onNotice };
  });
  const selectedRef = useRef(selected);

  useEffect(() => {
    let disposed = false;
    let sigma: Sigma | null = null;
    const cleanups: (() => void)[] = [];

    (async () => {
      const [{ default: SigmaCtor }, { default: GraphCtor }, { default: StarProgram }] = await Promise.all([
        import("sigma"),
        import("graphology"),
        import("./StarProgram"),
      ]);
      if (disposed || !containerRef.current) return;

      // --- Clusters ---------------------------------------------------------------
      const regions = galaxy.clusters.filter((c) => c.parentId === null);
      const regionColor = new Map(regions.map((c, i) => [c.id, REGION_COLORS[i % REGION_COLORS.length]]));
      const clusters = new Map<string, ClusterInfo>();
      for (const c of galaxy.clusters) {
        clusters.set(c.id, {
          id: c.id,
          label: c.label,
          level: c.parentId ? 1 : 0,
          parentId: c.parentId,
          color: regionColor.get(c.parentId ?? c.id) ?? "#ffffff",
          members: [],
          cx: c.centroid[0],
          cy: c.centroid[1],
          radius: 0,
        });
      }
      const subOf = new Map<string, string>();
      for (const a of galaxy.artists) {
        const [regionId, subIdRaw] = a.clusterIds;
        let subId = subIdRaw;
        if (!subId) {
          // A region that wasn't split: treat the whole region as one subgenre.
          subId = `${regionId}~`;
          if (!clusters.has(subId)) {
            const r = clusters.get(regionId)!;
            clusters.set(subId, { ...r, id: subId, level: 1, parentId: regionId, members: [] });
          }
        }
        clusters.get(regionId)?.members.push(a.mbid);
        clusters.get(subId)?.members.push(a.mbid);
        subOf.set(a.mbid, subId);
      }
      const pos = new Map(galaxy.artists.map((a) => [a.mbid, [a.x, a.y] as const]));
      for (const c of clusters.values()) {
        const d2 = c.members.map((m) => {
          const [x, y] = pos.get(m)!;
          return (x - c.cx) ** 2 + (y - c.cy) ** 2;
        });
        c.radius = Math.sqrt(d2.reduce((s, v) => s + v, 0) / Math.max(1, d2.length)) || 50;
      }
      const regionList = [...clusters.values()].filter((c) => c.level === 0);
      const subList = [...clusters.values()].filter((c) => c.level === 1 && c.members.length > 0);

      // --- Graph --------------------------------------------------------------------
      const graph = new GraphCtor({ type: "undirected" });
      const subRankCounter = new Map<string, number>();
      for (const a of galaxy.artists) {
        // Artists arrive sorted by listeners, so this is popularity rank in the subgenre.
        const sub = subOf.get(a.mbid)!;
        const rank = subRankCounter.get(sub) ?? 0;
        subRankCounter.set(sub, rank + 1);
        graph.addNode(a.mbid, {
          x: a.x,
          y: a.y,
          size: 1.2 + a.size * 0.38,
          label: a.name,
          baseColor: regionColor.get(a.clusterIds[0]) ?? "#ffffff",
          regionId: a.clusterIds[0],
          subId: sub,
          subRank: rank,
        });
      }
      for (const n of graph.nodes()) {
        const sub = clusters.get(graph.getNodeAttribute(n, "subId"))!;
        const cut = Math.max(2, Math.ceil(sub.members.length * POPULAR_SHARE));
        graph.setNodeAttribute(n, "popular", (graph.getNodeAttribute(n, "subRank") as number) < cut);
      }
      const xs = galaxy.artists.map((a) => a.x);
      const ys = galaxy.artists.map((a) => a.y);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      for (const e of galaxy.edges) {
        if (!graph.hasNode(e.source) || !graph.hasNode(e.target) || graph.hasEdge(e.source, e.target)) continue;
        const [x1, y1] = pos.get(e.source)!;
        const [x2, y2] = pos.get(e.target)!;
        const length = Math.hypot(x2 - x1, y2 - y1) / span;
        const same = graph.getNodeAttribute(e.source, "regionId") === graph.getNodeAttribute(e.target, "regionId");
        const calm = (same ? 1 : 0.3) * Math.max(0.08, 1 - length / 0.25);
        graph.addEdge(e.source, e.target, { weight: e.weight, size: 0.3 + e.weight * 1.6, calm });
      }

      // --- State ----------------------------------------------------------------------
      const nodes = graph.nodes();
      const index = new Map(nodes.map((n, i) => [n, i]));
      const lit = new Float32Array(nodes.length); // animated 0..1 per star
      let litFrom = new Float32Array(nodes.length);
      let litTo = new Float32Array(nodes.length);
      let dust = DUST[1];
      let dustFrom = dust;
      let dustTo = dust;
      let tweenStart = 0;
      let tweenRaf = 0;

      let nav: { layer: Layer; regionId: string | null; subId: string | null; band: string | null } = {
        layer: 1,
        regionId: null,
        subId: null,
        band: null,
      };
      let neighbours = new Set<string>();
      let labelled = new Set<string>();
      let maxWeight = 1;
      let focus: Focus = null;
      let pointer: { x: number; y: number } | null = null;
      let lockedUntil = 0;
      let animToken = 0;
      const hoverDevice = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

      const litTarget = (n: string): number => {
        if (nav.layer === 3) {
          if (!graph.getNodeAttribute(n, "popular")) return 0;
          // The subgenre you're in is bright and named; the ones around it recede.
          return graph.getNodeAttribute(n, "subId") === nav.subId ? 1 : 0.4;
        }
        if (nav.layer === 4) return n === nav.band || neighbours.has(n) ? 1 : 0;
        return 0;
      };

      sigma = new SigmaCtor(graph, containerRef.current, {
        defaultNodeType: "star",
        nodeProgramClasses: { star: StarProgram },
        zIndex: true,
        labelColor: { color: "#e9e7f5" },
        labelFont: "ui-sans-serif, system-ui, sans-serif",
        labelSize: 12,
        labelWeight: "500",
        labelRenderedSizeThreshold: 4,
        labelDensity: 0.7,
        labelGridCellSize: 80,
        zoomToSizeRatioFunction: (r: number) => r ** 0.3,
        minCameraRatio: 0.02,
        maxCameraRatio: 1.15,
        stagePadding: 40,
        enableCameraZooming: false, // layers snap; only our own animations zoom
        defaultDrawNodeHover: drawHover,

        nodeReducer: (node, data) => {
          const i = index.get(node)!;
          const l = lit[i];
          const alpha = dust + (1 - dust) * l;
          const res: Record<string, unknown> = { ...data };
          if (alpha < 0.02) return { ...res, hidden: true };
          const isSel = nav.layer === 4 && node === nav.band;
          const isFocus = focus?.kind === "band" && focus.id === node;
          res.color = hexToRgba(data.baseColor as string, alpha);
          res.size = (data.size as number) * (0.55 + 0.45 * l) * (isSel ? 1.35 : 1);
          res.zIndex = isSel ? 3 : l > 0.5 ? 2 : 0;
          if (l < 0.85 && !isFocus) {
            res.label = "";
          } else {
            res.forceLabel =
              isSel ||
              isFocus ||
              (nav.layer === 3 && (data.subRank as number) < 2) ||
              (nav.layer === 4 && labelled.has(node));
          }
          if (isFocus || isSel) res.highlighted = true;
          return res;
        },

        edgeReducer: (edge, data) => {
          const [s, t] = graph.extremities(edge);
          const ls = lit[index.get(s)!];
          const lt = lit[index.get(t)!];
          const res: Record<string, unknown> = { ...data };
          if (nav.layer === 4 && nav.band && (s === nav.band || t === nav.band)) {
            const other = s === nav.band ? t : s;
            const fade = Math.min(ls, lt);
            const col = graph.getNodeAttribute(other, "baseColor") as string;
            // Width shows listener overlap relative to this band's closest match.
            const rel = Math.pow((data.weight as number) / maxWeight, 2);
            const starWidth = 2 * (graph.getNodeAttribute(other, "size") as number);
            return { ...res, color: edgeColor(col, (0.25 + 0.65 * rel) * fade), size: 0.4 + rel * starWidth * 0.85, zIndex: 1 };
          }
          if (nav.layer === 3 || (nav.layer === 4 && Math.min(ls, lt) > 0.01)) {
            const a = Math.min(ls, lt) * (nav.layer === 3 ? 1 : 0.3);
            if (a < 0.01) return { ...res, hidden: true };
            const col = graph.getNodeAttribute(s, "baseColor") as string;
            return { ...res, color: edgeColor(col, a * (data.calm as number) * (0.05 + 0.2 * (data.weight as number))) };
          }
          return { ...res, hidden: true };
        },
      });
      const camera = sigma.getCamera();

      // --- Overlays: nebulas (behind), labels (above), focus glow ----------------------
      const nebulaHost = nebulaRef.current!;
      const labelHost = labelsRef.current!;
      nebulaHost.innerHTML = "";
      labelHost.innerHTML = "";
      const overlay = [...regionList, ...subList].map((c) => {
        const neb = document.createElement("div");
        neb.className = "nebula";
        neb.style.setProperty("--c", c.color);
        neb.style.opacity = "0";
        nebulaHost.appendChild(neb);
        const label = document.createElement("button");
        label.type = "button";
        label.className = c.level === 0 ? "cluster-label cluster-label--region" : "cluster-label cluster-label--sub";
        label.style.color = c.color;
        label.style.opacity = "0";
        label.textContent = c.label;
        label.tabIndex = -1;
        label.addEventListener("click", (e) => {
          e.stopPropagation();
          if (c.level === 0) enterRegion(c.id);
          else enterSub(c.id);
        });
        labelHost.appendChild(label);
        return { c, neb, label };
      });
      // Hide labels of tiny subgenres; they clutter more than they help.
      const showLabel = (c: ClusterInfo) => c.level === 0 || c.members.length >= 3;

      const applyLayerChrome = () => {
        for (const { c, neb, label } of overlay) {
          const current = nav.layer === 3 && c.id === nav.subId;
          let la = showLabel(c) ? (c.level === 0 ? REGION_LABEL : SUB_LABEL)[nav.layer] : 0;
          let na = (c.level === 0 ? REGION_NEBULA : SUB_NEBULA)[nav.layer];
          if (nav.layer === 3 && c.level === 1) {
            la = current ? 1 : showLabel(c) ? 0.28 : 0;
            na = current ? 0.65 : 0.2;
          }
          label.classList.toggle("is-current", current);
          label.style.opacity = String(la);
          label.classList.toggle("is-clickable", la >= 0.3);
          neb.style.opacity = String(na);
        }
      };

      // Two glow elements that crossfade, so moving focus feels seamless.
      const glowHost = glowRef.current!;
      glowHost.innerHTML = "";
      const glows = [0, 1].map(() => {
        const el = document.createElement("div");
        el.className = "focus-glow";
        el.innerHTML = '<span class="focus-glow__bloom"></span><span class="focus-glow__ring"></span>';
        glowHost.appendChild(el);
        return { el, target: null as Focus };
      });
      let activeGlow = 0;

      const viewportOf = (n: string) =>
        sigma!.graphToViewport({ x: graph.getNodeAttribute(n, "x"), y: graph.getNodeAttribute(n, "y") });
      const clusterViewport = (c: ClusterInfo) => sigma!.graphToViewport({ x: c.cx, y: c.cy });
      const pxPerGraphUnit = () => {
        const a = sigma!.graphToViewport({ x: 0, y: 0 });
        const b = sigma!.graphToViewport({ x: 100, y: 0 });
        return Math.hypot(b.x - a.x, b.y - a.y) / 100;
      };

      const placeOverlays = () => {
        if (!sigma) return;
        const k = pxPerGraphUnit();
        for (const { c, neb, label } of overlay) {
          const p = clusterViewport(c);
          if (label.style.opacity !== "0") {
            label.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
          }
          if (neb.style.opacity !== "0") {
            const d = Math.min(2400, Math.max(80, c.radius * k * (c.level === 0 ? 3.2 : 3)));
            neb.style.width = neb.style.height = `${d.toFixed(0)}px`;
            neb.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
          }
        }
        const ratio = camera.ratio;
        for (const g of glows) {
          const t = g.target;
          if (!t) continue;
          let p: { x: number; y: number };
          let d: number;
          if (t.kind === "band") {
            p = viewportOf(t.id);
            const l = lit[index.get(t.id)!];
            const r = ((graph.getNodeAttribute(t.id, "size") as number) * (0.55 + 0.45 * l)) / ratio ** 0.3;
            d = Math.max(44, r * 9);
          } else {
            const c = clusters.get(t.id)!;
            p = clusterViewport(c);
            d = c.level === 0 ? 220 : 170;
          }
          g.el.style.width = g.el.style.height = `${d.toFixed(0)}px`;
          g.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
        }
      };

      const setFocus = (next: Focus) => {
        const same = (a: Focus, b: Focus) => a?.kind === b?.kind && a?.id === b?.id;
        if (same(next, focus)) return;
        const prevBand = focus?.kind === "band";
        focus = next;
        // Crossfade: retire the current glow, light the other one at the new target.
        glows[activeGlow].el.classList.remove("on");
        activeGlow = 1 - activeGlow;
        const g = glows[activeGlow];
        g.target = next;
        if (next && nav.layer !== 1) {
          const color =
            next.kind === "band" ? (graph.getNodeAttribute(next.id, "baseColor") as string) : clusters.get(next.id)!.color;
          g.el.style.setProperty("--c", color);
          g.el.classList.toggle("is-cluster", next.kind === "cluster");
          // Restart the pulse so each new focus begins with a fresh bloom.
          g.el.classList.remove("on");
          void g.el.offsetWidth;
          g.el.classList.add("on");
        }
        for (const { c, label } of overlay) {
          label.classList.toggle("is-focused", next?.kind === "cluster" && next.id === c.id);
        }
        placeOverlays();
        if (prevBand || next?.kind === "band") sigma?.refresh({ skipIndexation: true });
        if (wrapRef.current) wrapRef.current.style.cursor = next && hoverDevice ? "pointer" : "";
      };

      // --- Focus: what are you aiming at? -------------------------------------------
      const aimPoint = () => {
        const { width: w, height: h } = sigma!.getDimensions();
        if (nav.layer === 4) return w < 640 ? { x: w / 2, y: h * 0.3 } : { x: (w - 340) / 2, y: h / 2 };
        return { x: w / 2, y: h / 2 };
      };

      // What's nearest a point. With no point: the mouse on desktop, nothing on touch.
      // `limit` keeps hover focus from reaching across the screen.
      const computeFocus = (at?: { x: number; y: number } | null, limit = true): Focus => {
        if (!sigma) return null;
        const from = at !== undefined ? at : hoverDevice ? pointer : null;
        if (!from) return nav.layer === 4 && nav.band ? { kind: "band", id: nav.band } : null;
        let best: Focus = null;
        let bestD = Infinity;
        const consider = (f: Focus, p: { x: number; y: number }, penalty = 1) => {
          const d = Math.hypot(p.x - from.x, p.y - from.y) * penalty;
          if (d < bestD) {
            bestD = d;
            best = f;
          }
        };
        if (nav.layer === 1) for (const c of regionList) consider({ kind: "cluster", id: c.id }, clusterViewport(c));
        else if (nav.layer === 2) for (const c of subList) consider({ kind: "cluster", id: c.id }, clusterViewport(c));
        else
          for (const n of nodes) {
            const l = lit[index.get(n)!];
            if (nav.layer === 4 && litTo[index.get(n)!] < 0.5) continue;
            consider({ kind: "band", id: n }, viewportOf(n), l > 0.5 ? 1 : 1.8);
          }
        const reach = nav.layer <= 2 ? 220 : 70;
        if (limit && bestD > reach) return nav.layer === 4 && nav.band ? { kind: "band", id: nav.band } : null;
        return best;
      };

      let focusRaf = 0;
      const refreshFocus = () => {
        if (focusRaf) return;
        focusRaf = requestAnimationFrame(() => {
          focusRaf = 0;
          setFocus(computeFocus());
        });
      };

      // --- Layer transitions ----------------------------------------------------------
      const runTween = () => {
        cancelAnimationFrame(tweenRaf);
        tweenStart = performance.now();
        const step = () => {
          const t = Math.min(1, (performance.now() - tweenStart) / TRANSITION_MS);
          const e = easeInOut(t);
          for (let i = 0; i < lit.length; i++) lit[i] = litFrom[i] + (litTo[i] - litFrom[i]) * e;
          dust = dustFrom + (dustTo - dustFrom) * e;
          sigma?.refresh({ skipIndexation: true });
          if (t < 1) tweenRaf = requestAnimationFrame(step);
          else refreshFocus();
        };
        tweenRaf = requestAnimationFrame(step);
      };

      const emitNav = () => {
        const region = nav.regionId ? clusters.get(nav.regionId) : null;
        const sub = nav.subId ? clusters.get(nav.subId) : null;
        callbacks.current.onNavChange({
          layer: nav.layer,
          regionId: nav.regionId,
          regionLabel: region?.label ?? null,
          subId: nav.subId,
          subLabel: sub && !sub.id.endsWith("~") ? sub.label : null,
          color: region?.color ?? null,
        });
      };

      const setNav = (next: typeof nav) => {
        nav = next;
        litFrom = Float32Array.from(lit);
        litTo = Float32Array.from(nodes, litTarget);
        dustFrom = dust;
        dustTo = DUST[nav.layer];
        applyLayerChrome();
        runTween();
        emitNav();
        setFocus(null);
      };

      const animateCamera = (state: { x?: number; y?: number; ratio?: number }, duration = TRANSITION_MS) => {
        const token = ++animToken;
        camera.enabledZooming = true;
        lockedUntil = performance.now() + duration + 150;
        camera.animate(state, { duration, easing: "cubicInOut" });
        setTimeout(() => {
          if (token === animToken) camera.enabledZooming = false;
        }, duration + 40);
      };

      // Fit a set of stars on screen (optionally aiming them at a point other than the centre).
      const frameMembers = (members: string[], pad: number, aim?: { x: number; y: number }) => {
        const { width: w, height: h } = sigma!.getDimensions();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const m of members) {
          const d = sigma!.getNodeDisplayData(m);
          if (!d) continue;
          minX = Math.min(minX, d.x); maxX = Math.max(maxX, d.x);
          minY = Math.min(minY, d.y); maxY = Math.max(maxY, d.y);
        }
        // Framed-graph units per pixel at the current ratio.
        const a = sigma!.viewportToFramedGraph({ x: 0, y: 0 });
        const b = sigma!.viewportToFramedGraph({ x: 100, y: 0 });
        const unitsPerPx = Math.hypot(b.x - a.x, b.y - a.y) / 100 / camera.ratio;
        const availW = (w < 640 ? w : aim ? w - 380 : w) * 0.88;
        const availH = (h - 140) * 0.88;
        const ratio = Math.min(1, Math.max(0.025, Math.max(
          ((maxX - minX) * pad) / (availW * unitsPerPx),
          ((maxY - minY) * pad) / (availH * unitsPerPx),
        )));
        let x = (minX + maxX) / 2;
        let y = (minY + maxY) / 2;
        if (aim) {
          const centre = sigma!.viewportToFramedGraph({ x: w / 2, y: h / 2 });
          const aimed = sigma!.viewportToFramedGraph(aim);
          const k = ratio / camera.ratio;
          x += (centre.x - aimed.x) * k;
          y += (centre.y - aimed.y) * k;
        } else {
          // Nudge down a touch so the top bar doesn't cover the cluster.
          y += 30 * unitsPerPx * ratio;
        }
        return { x, y, ratio };
      };

      const enterUniverse = () => {
        setNav({ layer: 1, regionId: null, subId: null, band: null });
        animateCamera({ x: 0.5, y: 0.5, ratio: 1 });
      };
      const enterRegion = (id: string) => {
        const c = clusters.get(id);
        if (!c) return;
        setNav({ layer: 2, regionId: id, subId: null, band: null });
        animateCamera(frameMembers(c.members, 1.25));
      };
      const enterSub = (id: string) => {
        const c = clusters.get(id);
        if (!c) return;
        setNav({ layer: 3, regionId: c.parentId, subId: id, band: null });
        animateCamera(frameMembers(c.members, 1.6));
      };
      const enterBand = (mbid: string) => {
        if (!graph.hasNode(mbid)) return;
        const sub = graph.getNodeAttribute(mbid, "subId") as string;
        neighbours = new Set(graph.neighbors(mbid));
        const ranked = graph
          .mapEdges(mbid, (_e, attrs, s, t) => ({ other: s === mbid ? t : s, w: attrs.weight as number }))
          .sort((a, b) => b.w - a.w);
        maxWeight = Math.max(ranked[0]?.w ?? 0.01, 0.01);
        labelled = new Set(ranked.slice(0, 6).map((x) => x.other));
        const wasFar = nav.layer === 4 && nav.band !== null;
        setNav({ layer: 4, regionId: clusters.get(sub)!.parentId, subId: sub, band: mbid });
        // Frame the band with its closest few neighbours, clear of the artist panel.
        const target = frameMembers([mbid, ...ranked.slice(0, 6).map((x) => x.other)], 1.35, aimPoint());
        target.ratio = Math.min(0.3, Math.max(0.05, target.ratio));
        const dist = Math.hypot(target.x - camera.x, target.y - camera.y);
        if (wasFar && dist > 0.25) {
          // Long hop between neighbourhoods: rise up, then glide down.
          animateCamera({ x: (camera.x + target.x) / 2, y: (camera.y + target.y) / 2, ratio: Math.min(0.6, 0.25 + dist) }, 550);
          setTimeout(() => animateCamera(target, 800), 560);
        } else {
          animateCamera(target);
        }
      };
      const leaveBand = () => {
        if (nav.layer !== 4) return;
        enterSub(nav.subId!);
      };

      const nearest = (list: ClusterInfo[]) => {
        const { width: w, height: h } = sigma!.getDimensions();
        let best = list[0];
        let bestD = Infinity;
        for (const c of list) {
          const p = clusterViewport(c);
          const d = Math.hypot(p.x - w / 2, p.y - h / 2);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        return best;
      };

      const bounce = (factor: number) => {
        const r = camera.ratio;
        animateCamera({ ratio: r * factor }, 160);
        setTimeout(() => animateCamera({ ratio: r }, 260), 170);
      };

      const stepIn = (at?: { x: number; y: number }) => {
        if (performance.now() < lockedUntil) return;
        const { width: w, height: h } = sigma!.getDimensions();
        const f = computeFocus(at ?? (hoverDevice && pointer ? pointer : { x: w / 2, y: h / 2 }), false);
        if (nav.layer === 1) enterRegion(f?.kind === "cluster" ? f.id : nearest(regionList).id);
        else if (nav.layer === 2) enterSub(f?.kind === "cluster" ? f.id : nearest(subList).id);
        else if (nav.layer === 3) {
          const band = f?.kind === "band" ? f.id : null;
          if (band) callbacks.current.onSelect(band);
        } else {
          bounce(0.93);
          callbacks.current.onNotice("Solar systems (a band's albums as planets) are the next layer to build.");
        }
      };
      const stepOut = () => {
        if (performance.now() < lockedUntil) return;
        if (nav.layer === 4) callbacks.current.onSelect(null);
        else if (nav.layer === 3) enterRegion(nav.regionId ?? nearest(regionList).id);
        else if (nav.layer === 2) enterUniverse();
        else bounce(1.05);
      };
      const goTo = (layer: 1 | 2 | 3, id?: string) => {
        if (layer === 1) enterUniverse();
        else if (layer === 2 && id) enterRegion(id);
        else if (layer === 3 && id) enterSub(id);
        if (nav.band && selectedRef.current) callbacks.current.onSelect(null);
      };

      // --- Input --------------------------------------------------------------------
      const wrap = wrapRef.current!;
      let wheelAcc = 0;
      let wheelTimer = 0;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        wheelAcc += dy;
        clearTimeout(wheelTimer);
        wheelTimer = window.setTimeout(() => (wheelAcc = 0), 220);
        if (performance.now() < lockedUntil) {
          wheelAcc = 0;
          return;
        }
        if (wheelAcc < -45) {
          wheelAcc = 0;
          const r = wrap.getBoundingClientRect();
          stepIn({ x: e.clientX - r.left, y: e.clientY - r.top });
        } else if (wheelAcc > 45) {
          wheelAcc = 0;
          stepOut();
        }
      };
      let pinchStart = 0;
      let pinchDone = false;
      const touchDist = (e: TouchEvent) =>
        Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const touchMid = (e: TouchEvent) => {
        const r = wrap.getBoundingClientRect();
        return {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top,
        };
      };
      // Two-finger gestures are ours (layer steps); keep them away from Sigma,
      // which would otherwise also pan/zoom the camera with the same fingers.
      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length >= 2) {
          e.stopPropagation();
          pinchStart = touchDist(e);
          pinchDone = false;
          // Show what the pinch will open.
          setFocus(computeFocus(touchMid(e), false));
        }
      };
      const onTouchMove = (e: TouchEvent) => {
        if (e.touches.length >= 2) e.stopPropagation();
        if (e.touches.length !== 2 || !pinchStart || pinchDone) return;
        const scale = touchDist(e) / pinchStart;
        if (scale > 1.3) {
          pinchDone = true;
          stepIn(touchMid(e));
        } else if (scale < 0.75) {
          pinchDone = true;
          stepOut();
        }
      };
      const onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length < 2 && pinchStart) {
          pinchStart = 0;
          if (!pinchDone) setFocus(computeFocus());
        }
      };
      const onMouseMove = (e: MouseEvent) => {
        const r = wrap.getBoundingClientRect();
        pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
        refreshFocus();
      };
      const onMouseLeave = () => {
        pointer = null;
        refreshFocus();
      };
      const onKey = (e: KeyboardEvent) => {
        if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
        if (e.key === "+" || e.key === "=") stepIn();
        else if (e.key === "-" || e.key === "_" || e.key === "Escape") stepOut();
      };
      wrap.addEventListener("wheel", onWheel, { passive: false });
      wrap.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
      wrap.addEventListener("touchmove", onTouchMove, { passive: true, capture: true });
      wrap.addEventListener("touchend", onTouchEnd, { passive: true });
      wrap.addEventListener("mousemove", onMouseMove);
      wrap.addEventListener("mouseleave", onMouseLeave);
      window.addEventListener("keydown", onKey);
      cleanups.push(() => {
        wrap.removeEventListener("wheel", onWheel);
        wrap.removeEventListener("touchstart", onTouchStart, { capture: true });
        wrap.removeEventListener("touchmove", onTouchMove, { capture: true });
        wrap.removeEventListener("touchend", onTouchEnd);
        wrap.removeEventListener("mousemove", onMouseMove);
        wrap.removeEventListener("mouseleave", onMouseLeave);
        window.removeEventListener("keydown", onKey);
        cancelAnimationFrame(tweenRaf);
      });

      // Clicking / tapping always means "go there".
      sigma.on("clickNode", ({ node }) => {
        if (nav.layer === 1) enterRegion(graph.getNodeAttribute(node, "regionId"));
        else if (nav.layer === 2) enterSub(graph.getNodeAttribute(node, "subId"));
        else callbacks.current.onSelect(node);
      });
      sigma.on("clickStage", () => {
        if (nav.layer === 4) callbacks.current.onSelect(null);
      });

      // While you drag at layers 2–3, "where am I" follows the view.
      camera.on("updated", () => {
        if (performance.now() >= lockedUntil && (nav.layer === 2 || nav.layer === 3)) {
          if (nav.layer === 2) {
            const r = nearest(regionList);
            if (r.id !== nav.regionId) {
              nav = { ...nav, regionId: r.id };
              emitNav();
            }
          } else {
            const s = nearest(subList);
            if (s.id !== nav.subId) {
              nav = { ...nav, subId: s.id, regionId: s.parentId };
              emitNav();
              // Move the "you are here" emphasis to the new subgenre.
              litFrom = Float32Array.from(lit);
              litTo = Float32Array.from(nodes, litTarget);
              dustFrom = dust;
              applyLayerChrome();
              runTween();
            }
          }
        }
        refreshFocus();
      });
      sigma.on("afterRender", placeOverlays);

      api.current = {
        enterBand,
        leaveBand,
        setSelection: (mbid) => (mbid ? enterBand(mbid) : leaveBand()),
        stepIn,
        stepOut,
        goTo,
      };
      applyLayerChrome();
      emitNav();
      if (selectedRef.current) enterBand(selectedRef.current);
      placeOverlays();
    })();

    return () => {
      disposed = true;
      cleanups.forEach((f) => f());
      sigma?.kill();
      api.current = null;
    };
  }, [galaxy]);

  // The app owns which band is selected; entering/leaving layer 4 follows it.
  useEffect(() => {
    selectedRef.current = selected;
    api.current?.setSelection(selected);
  }, [selected]);

  useImperativeHandle(ref, () => ({
    stepIn: () => api.current?.stepIn(),
    stepOut: () => api.current?.stepOut(),
    goTo: (layer, id) => api.current?.goTo(layer, id),
  }));

  return (
    <div ref={wrapRef} className="absolute inset-0 touch-none">
      <div ref={nebulaRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <div ref={containerRef} className="absolute inset-0" />
      <div ref={glowRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  );
}

// Hover/focus label: light text on a dark pill instead of Sigma's default white box.
function drawHover(
  ctx: CanvasRenderingContext2D,
  data: { x: number; y: number; size: number; label: string | null },
  settings: { labelSize: number; labelFont: string; labelWeight: string },
) {
  if (!data.label) return;
  const size = settings.labelSize + 1;
  ctx.font = `600 ${size}px ${settings.labelFont}`;
  const w = ctx.measureText(data.label).width;
  const x = data.x + data.size + 8;
  const y = data.y;
  ctx.fillStyle = "rgba(12,13,24,0.88)";
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - 6, y - size / 2 - 5, w + 12, size + 10, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(data.label, x, y + 0.5);
}
