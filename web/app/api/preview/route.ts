// GET /api/preview?artist=Khemmis
// Finds the artist on Deezer and returns their top tracks with 30-second
// preview URLs. Runs on the server so the browser never talks to Deezer's API
// directly (no CORS issues, and room for a key later if we ever need one).
import type { NextRequest } from "next/server";

type DeezerArtist = { id: number; name: string; link: string; nb_fan: number };
type DeezerTrack = {
  title: string;
  preview: string;
  link: string;
  album: { title: string; cover_medium: string };
};

const norm = (s: string) => s.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

async function deezer<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.deezer.com${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Deezer ${res.status}`);
  return res.json() as Promise<T>;
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("artist")?.trim();
  if (!name) return Response.json({ error: "missing ?artist=" }, { status: 400 });

  try {
    const search = await deezer<{ data?: DeezerArtist[] }>(
      `/search/artist?q=${encodeURIComponent(name)}&limit=50`,
    );
    // Only accept an exact name match (several bands share names; among
    // exact matches, the one with the most fans is the best guess).
    const matches = (search.data ?? []).filter((a) => norm(a.name) === norm(name));
    matches.sort((a, b) => b.nb_fan - a.nb_fan);

    // Take the first of the top 3 matches that actually has previews.
    for (const artist of matches.slice(0, 3)) {
      const top = await deezer<{ data?: DeezerTrack[] }>(`/artist/${artist.id}/top?limit=10`);
      const tracks = (top.data ?? [])
        .filter((t) => t.preview)
        .map((t) => ({
          title: t.title,
          preview: t.preview,
          link: t.link,
          album: t.album.title,
          cover: t.album.cover_medium,
        }));
      if (tracks.length) {
        return Response.json(
          { artist: { name: artist.name, link: artist.link }, tracks },
          // Preview URLs are signed and expire after ~15 min; cache for 5.
          { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
        );
      }
    }
    return Response.json({ artist: null, tracks: [] }, { status: 404 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
