"use client";

// The WebGL galaxy. Owns the Sigma instance; everything else (search, panel,
// breadcrumbs, audio) lives in GalaxyApp and talks to this via props + ref.
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type Sigma from "sigma";
import type Graph from "graphology";
import { type Galaxy, REGION_COLORS, edgeColor, hexToRgba } from "@/lib/galaxy";

export type GalaxyMapHandle = {
  flyTo: (mbid: string) => void;
  zoomBy: (factor: number) => void;
  reset: () => void;
};

type Props = {
  galaxy: Galaxy;
  selected: string | null;
  onSelect: (mbid: string | null) => void;
  ref?: Ref<GalaxyMapHandle>;
};

// --- Semantic zoom ---------------------------------------------------------------
// Camera ratio: 1 = whole galaxy in view, smaller = zoomed in.
// Each artist has a rank within its region (0 = most listeners, 1 = fewest).
// An artist is visible once the zoom "reveal" fraction passes its rank, so every
// region shows its biggest names when zoomed out and fills in as you zoom.
const revealFraction = (ratio: number) => Math.min(1, 0.22 / ratio ** 1.1);
const FADE = 0.12; // width of the fade-in band, in rank units

function artistAlpha(regionRank: number, regionIndex: number, ratio: number) {
  if (regionIndex < 2) return 1; // the top 2 of each region are always lit
  return Math.max(0, Math.min(1, (revealFraction(ratio) - regionRank) / FADE));
}

// Cluster label opacity: region names when zoomed out, subregions mid-zoom.
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const regionLabelAlpha = (ratio: number) => smooth(0.22, 0.45, ratio);
const subLabelAlpha = (ratio: number) => smooth(0.05, 0.1, ratio) * (1 - smooth(0.3, 0.5, ratio));

const DIM = "rgba(120,125,150,0.07)";

export default function GalaxyMap({ galaxy, selected, onSelect, ref }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const selectedRef = useRef<string | null>(selected);
  const neighboursRef = useRef<Set<string>>(new Set());
  const labelledRef = useRef<Set<string>>(new Set()); // neighbours that always get a label
  const maxWeightRef = useRef(1); // strongest link of the selected artist
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Build the graph and the Sigma renderer once.
  useEffect(() => {
    let disposed = false;
    let sigma: Sigma | null = null;

    (async () => {
      const [{ default: SigmaCtor }, { default: GraphCtor }, { default: StarProgram }] = await Promise.all([
        import("sigma"),
        import("graphology"),
        import("./StarProgram"),
      ]);
      if (disposed || !containerRef.current) return;

      const regions = galaxy.clusters.filter((c) => c.parentId === null);
      const regionColor = new Map(regions.map((c, i) => [c.id, REGION_COLORS[i % REGION_COLORS.length]]));

      // Rank artists within their region by listeners (artists arrive sorted).
      const seen = new Map<string, number>();
      const regionSize = new Map(regions.map((c) => [c.id, c.size]));

      const graph = new GraphCtor({ type: "undirected" });
      for (const a of galaxy.artists) {
        const region = a.clusterIds[0];
        const idx = seen.get(region) ?? 0;
        seen.set(region, idx + 1);
        graph.addNode(a.mbid, {
          x: a.x,
          y: a.y,
          size: 1.2 + a.size * 0.38,
          label: a.name,
          baseColor: regionColor.get(region) ?? "#ffffff",
          regionIndex: idx,
          regionRank: idx / Math.max(1, (regionSize.get(region) ?? 1) - 1),
        });
      }
      // Long links and links between regions are drawn much fainter unless
      // their artist is selected; otherwise they cross the map as a tangle.
      const xs = galaxy.artists.map((a) => a.x);
      const ys = galaxy.artists.map((a) => a.y);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      const regionOf = new Map(galaxy.artists.map((a) => [a.mbid, a.clusterIds[0]]));
      const posOf = new Map(galaxy.artists.map((a) => [a.mbid, [a.x, a.y]]));
      for (const e of galaxy.edges) {
        if (graph.hasNode(e.source) && graph.hasNode(e.target) && !graph.hasEdge(e.source, e.target)) {
          const [x1, y1] = posOf.get(e.source)!;
          const [x2, y2] = posOf.get(e.target)!;
          const length = Math.hypot(x2 - x1, y2 - y1) / span;
          const sameRegion = regionOf.get(e.source) === regionOf.get(e.target);
          const calm = (sameRegion ? 1 : 0.3) * Math.max(0.08, 1 - length / 0.25);
          graph.addEdge(e.source, e.target, { weight: e.weight, size: 0.3 + e.weight * 1.6, calm });
        }
      }
      graphRef.current = graph;

      let ratio = 1;
      const alphaOf = (node: string) => {
        const attrs = graph.getNodeAttributes(node);
        return artistAlpha(attrs.regionRank, attrs.regionIndex, ratio);
      };

      sigma = new SigmaCtor(graph, containerRef.current, {
        defaultNodeType: "star",
        nodeProgramClasses: { star: StarProgram },
        zIndex: true,
        labelColor: { color: "#e9e7f5" },
        labelFont: "ui-sans-serif, system-ui, sans-serif",
        labelSize: 12,
        labelWeight: "500",
        labelRenderedSizeThreshold: 5,
        labelDensity: 0.6,
        labelGridCellSize: 90,
        // Stars grow only gently as you zoom in (default would be sqrt).
        zoomToSizeRatioFunction: (r: number) => r ** 0.3,
        minCameraRatio: 0.015,
        maxCameraRatio: 1.3,
        stagePadding: 40,
        defaultDrawNodeHover: drawHover,

        nodeReducer: (node, data) => {
          const sel = selectedRef.current;
          const res: Record<string, unknown> = { ...data };
          const isSel = node === sel;
          const isNeighbour = sel !== null && neighboursRef.current.has(node);
          const alpha = alphaOf(node);

          if (sel && !isSel && !isNeighbour) {
            res.color = DIM;
            res.size = (data.size as number) * 0.6;
            res.label = "";
            res.zIndex = 0;
            if (alpha === 0) res.hidden = true;
            return res;
          }
          if (isSel || isNeighbour) {
            res.color = data.baseColor;
            // Selected star + its strongest links always get names; the rest
            // are labelled only where there's room, to avoid pile-ups.
            res.forceLabel = isSel || labelledRef.current.has(node);
            res.zIndex = isSel ? 3 : 2;
            if (isSel) {
              res.size = (data.size as number) * 1.35;
              res.highlighted = true;
            }
            return res;
          }
          if (alpha === 0) {
            res.hidden = true;
            return res;
          }
          res.color = hexToRgba(data.baseColor as string, alpha);
          res.zIndex = 1;
          if (alpha < 0.7) res.label = "";
          return res;
        },

        edgeReducer: (edge, data) => {
          const sel = selectedRef.current;
          const [s, t] = graph.extremities(edge);
          const res: Record<string, unknown> = { ...data };
          if (sel) {
            if (s !== sel && t !== sel) return { ...res, hidden: true };
            const other = s === sel ? t : s;
            const col = graph.getNodeAttribute(other, "baseColor") as string;
            // Line width shows listener overlap relative to this artist's
            // closest match. Squaring exaggerates the gap, so the strongest
            // link is nearly as wide as its star and weak ones are hairlines.
            const rel = Math.pow((data.weight as number) / maxWeightRef.current, 2);
            const starWidth = 2 * (graph.getNodeAttribute(other, "size") as number);
            return {
              ...res,
              color: edgeColor(col, 0.25 + 0.65 * rel),
              size: 0.4 + rel * starWidth * 0.85,
              zIndex: 1,
            };
          }
          const a = Math.min(alphaOf(s), alphaOf(t));
          if (a === 0) return { ...res, hidden: true };
          const col = graph.getNodeAttribute(s, "baseColor") as string;
          // Lines are faint when zoomed out and come forward as you zoom in.
          const zoomBoost = 1 - smooth(0.15, 0.8, ratio) * 0.6;
          const strength = a * zoomBoost * (data.calm as number) * (0.06 + 0.22 * (data.weight as number));
          return { ...res, color: edgeColor(col, strength) };
        },
      });
      sigmaRef.current = sigma;

      // --- Cluster labels (HTML overlay, repositioned every frame) -------------
      const labelHost = labelsRef.current!;
      labelHost.innerHTML = "";
      const labelEls = galaxy.clusters.map((c) => {
        const el = document.createElement("div");
        const color = regionColor.get(c.parentId ?? c.id) ?? "#fff";
        el.className = c.level === 0 ? "cluster-label cluster-label--region" : "cluster-label cluster-label--sub";
        el.style.color = color;
        el.textContent = c.label;
        labelHost.appendChild(el);
        return { el, c };
      });

      const placeLabels = () => {
        if (!sigma) return;
        const r = sigma.getCamera().ratio;
        const dimmed = selectedRef.current ? 0.25 : 1;
        const regionA = regionLabelAlpha(r) * dimmed;
        const subA = subLabelAlpha(r) * dimmed;
        for (const { el, c } of labelEls) {
          const a = c.level === 0 ? regionA : c.size >= 4 ? subA : 0;
          el.style.opacity = a.toFixed(3);
          if (a < 0.01) continue;
          const p = sigma.graphToViewport({ x: c.centroid[0], y: c.centroid[1] });
          el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -50%)`;
        }
      };

      // Re-run reducers when the zoom level changes enough to reveal/fade stars.
      let pending = false;
      sigma.getCamera().on("updated", (state) => {
        if (Math.abs(state.ratio - ratio) / ratio > 0.02 && !pending) {
          pending = true;
          requestAnimationFrame(() => {
            pending = false;
            ratio = sigma!.getCamera().ratio;
            sigma!.refresh({ skipIndexation: true });
          });
        }
      });
      sigma.on("afterRender", placeLabels);

      sigma.on("clickNode", ({ node }) => onSelectRef.current(node));
      sigma.on("clickStage", () => onSelectRef.current(null));
      sigma.on("enterNode", () => containerRef.current?.classList.add("cursor-pointer"));
      sigma.on("leaveNode", () => containerRef.current?.classList.remove("cursor-pointer"));
      placeLabels();
    })();

    return () => {
      disposed = true;
      sigma?.kill();
      sigmaRef.current = null;
    };
  }, [galaxy]);

  // Selection changed: recompute neighbours and redraw.
  useEffect(() => {
    selectedRef.current = selected;
    const graph = graphRef.current;
    const valid = selected && graph?.hasNode(selected);
    neighboursRef.current = new Set(valid ? graph!.neighbors(selected) : []);
    maxWeightRef.current = valid
      ? Math.max(...graph!.mapEdges(selected, (_e, attrs) => attrs.weight as number), 0.01)
      : 1;
    labelledRef.current = new Set(
      valid
        ? graph!
            .mapEdges(selected, (_e, attrs, s, t) => ({ other: s === selected ? t : s, w: attrs.weight as number }))
            .sort((a, b) => b.w - a.w)
            .slice(0, 6)
            .map((x) => x.other)
        : [],
    );
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [selected]);

  useImperativeHandle(ref, () => ({
    flyTo: async (mbid: string) => {
      const sigma = sigmaRef.current;
      if (!sigma || !sigma.getGraph().hasNode(mbid)) return;
      const camera = sigma.getCamera();
      const node = sigma.getNodeDisplayData(mbid)!;
      const targetRatio = Math.min(camera.ratio, 0.16);
      // Keep the star clear of the artist panel: on phones the panel is a
      // bottom sheet, so aim for the upper third; on desktop it sits on the
      // right, so aim left of centre.
      const { width: w, height: h } = sigma.getDimensions();
      const aim = w < 640 ? { x: w / 2, y: h * 0.3 } : { x: (w - 340) / 2, y: h / 2 };
      const centre = sigma.viewportToFramedGraph({ x: w / 2, y: h / 2 });
      const aimed = sigma.viewportToFramedGraph(aim);
      const k = targetRatio / camera.ratio;
      const target = { x: node.x + (centre.x - aimed.x) * k, y: node.y + (centre.y - aimed.y) * k };
      const dist = Math.hypot(target.x - camera.x, target.y - camera.y);
      // Long jumps while zoomed in: pull back first, then dive in, so you
      // can see where you're travelling.
      if (dist > 0.25 && camera.ratio < 0.35) {
        await camera.animate(
          { x: (camera.x + target.x) / 2, y: (camera.y + target.y) / 2, ratio: Math.min(0.6, 0.25 + dist) },
          { duration: 550, easing: "quadraticInOut" },
        );
      }
      await camera.animate({ x: target.x, y: target.y, ratio: targetRatio }, { duration: 800, easing: "cubicInOut" });
    },
    zoomBy: (factor: number) => {
      const camera = sigmaRef.current?.getCamera();
      camera?.animate({ ratio: camera.ratio / factor }, { duration: 300 });
    },
    reset: () => {
      sigmaRef.current?.getCamera().animate({ x: 0.5, y: 0.5, ratio: 1, angle: 0 }, { duration: 700, easing: "cubicInOut" });
    },
  }));

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0" />
      <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </div>
  );
}

// Hover label: light text on a dark pill instead of Sigma's default white box.
function drawHover(
  ctx: CanvasRenderingContext2D,
  data: { x: number; y: number; size: number; label: string | null },
  settings: { labelSize: number; labelFont: string; labelWeight: string },
) {
  if (!data.label) return;
  const size = settings.labelSize + 1;
  ctx.font = `600 ${size}px ${settings.labelFont}`;
  const w = ctx.measureText(data.label).width;
  const x = data.x + data.size + 6;
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
