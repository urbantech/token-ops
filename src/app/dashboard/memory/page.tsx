/**
 * Memory Optimization Dashboard
 *
 * Composes the memory-related components into a single page:
 *  - Top row:    MemoryStats cards
 *  - Middle:     DuplicateDetector + SavingsProjection chart
 *  - Bottom:     MemoryReuseTable
 *
 * Issues #17 and #18
 */

import { MemoryStats } from '@/components/memory/MemoryStats';
import { DuplicateDetector } from '@/components/memory/DuplicateDetector';
import { SavingsProjection } from '@/components/memory/SavingsProjection';
import { MemoryReuseTable } from '@/components/memory/MemoryReuseTable';

export const metadata = {
  title: 'Memory Optimization | TokenOps',
  description: 'Duplicate detection, reuse recommendations, and token savings.',
};

export default function MemoryDashboardPage() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6 lg:p-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">
          Memory Optimization
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Detect duplicate requests and surface reuse opportunities to reduce token spend.
        </p>
      </div>

      {/* Top row — Stats */}
      <section className="mb-6">
        <MemoryStats />
      </section>

      {/* Middle row — Detector + Projection */}
      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <DuplicateDetector />
        <SavingsProjection />
      </section>

      {/* Bottom — Reuse Table */}
      <section>
        <MemoryReuseTable />
      </section>
    </div>
  );
}
