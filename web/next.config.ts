import type { NextConfig } from "next";

// Proxy /api to the FastAPI server so the browser only ever sees one origin.
// Without this, a client-side fetch to localhost:8000 breaks under Codespaces
// port forwarding, where each port gets its own hostname.

// this basically means that the browser just asks the NextJS server for stuff instead of asking the fastAPI directly
// and the NextJS server asks on behalf of the server. this way there is never a cross origin, all requests come from one place

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      // FastAPI's generated docs, exposed on the same origin so they are
      // reachable from the deployed dashboard and not just port 8000.
      { source: "/docs", destination: `${API_URL}/docs` },
      { source: "/redoc", destination: `${API_URL}/redoc` },
      { source: "/openapi.json", destination: `${API_URL}/openapi.json` },
    ];
  },
};

export default nextConfig;
