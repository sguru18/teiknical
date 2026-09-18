import type { NextConfig } from "next";

// Proxy /api to the FastAPI server so the browser only ever sees one origin.
// Without this, a client-side fetch to localhost:8000 breaks under Codespaces
// port forwarding, where each port gets its own hostname.
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
