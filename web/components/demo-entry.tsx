// Entry point for the static, no-sound demo page (no /api/preview route).
// Build a single bundle with:
//   npx esbuild components/demo-entry.tsx --bundle --minify --charset=ascii \
//     --format=iife --jsx=automatic --define:process.env.NODE_ENV='"production"' \
//     --outfile=demo/app.js
import { createRoot } from "react-dom/client";
import GalaxyApp from "./GalaxyApp";

createRoot(document.getElementById("app")!).render(<GalaxyApp dataUrl="galaxy.json" previews={false} />);
