"use client";

import Link from "next/link";

import { CohortBreakdown } from "@/components/CohortBreakdown";

export default function CohortPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-8 pb-16">
      <div className="mt-6 text-sm">
        <Link
          href="/"
          className="text-[#e5341a] transition-colors hover:opacity-75"
        >
          ← Back to dashboard
        </Link>
      </div>
      <div className="mt-4 bg-white rounded-xl border border-[#e5e0d9] px-8 py-8">
        <CohortBreakdown />
      </div>
    </main>
  );
}
