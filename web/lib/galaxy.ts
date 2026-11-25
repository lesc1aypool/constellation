// Shape of web/public/galaxy.json, written by pipeline/build_galaxy.py.

export type Artist = {
  mbid: string;
  name: string;
  x: number;
  y: number;
  size: number;
  listeners: number;
  tags: string[];
  url: string; // Last.fm page (attribution)
  clusterIds: string[]; // [region, subregion?]
};

export type Edge = { source: string; target: string; weight: number };

export type Cluster = {
  id: string;
  parentId: string | null;
  level: number;
  label: string;
  size: number;
  centroid: [number, number];
};

export type Galaxy = {
  meta: { generatedAt: string; attribution: string; artistCount: number; edgeCount: number };
  artists: Artist[];
  edges: Edge[];
  clusters: Cluster[];
};

// One colour per top-level region; chosen to glow nicely on a near-black sky.
export const REGION_COLORS = [
  "#ff7a6b", "#ffb057", "#ffe066", "#7ee08a", "#4fd8c4",
  "#5cb8ff", "#9d8cff", "#f78fc0", "#d9a3ff", "#c6f07a",
];

export function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(3)})`;
}

// Sigma blends with premultiplied alpha, and its built-in edge shader does not
// premultiply, so translucent edge colours must be premultiplied up front or
// they render at full brightness.
export function edgeColor(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const a = Math.max(0, Math.min(1, alpha));
  const c = (v: number) => Math.round(v * a);
  return `rgba(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)},${a.toFixed(3)})`;
}

export function formatListeners(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}
