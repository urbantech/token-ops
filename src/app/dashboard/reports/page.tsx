'use client'

import { FileBarChart, Download, Calendar, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Report {
  id: string
  title: string
  description: string
  period: string
  format: 'PDF' | 'CSV' | 'JSON'
  status: 'ready' | 'generating' | 'scheduled'
  size?: string
}

const REPORTS: Report[] = [
  {
    id: '1',
    title: 'Monthly AI Cost Summary',
    description: 'Full breakdown by provider, model, team, and classification',
    period: 'May 2026',
    format: 'PDF',
    status: 'ready',
    size: '2.4 MB',
  },
  {
    id: '2',
    title: 'Token Usage Export',
    description: 'Raw token events for the past 30 days — all providers',
    period: 'Jun 1–14, 2026',
    format: 'CSV',
    status: 'ready',
    size: '8.1 MB',
  },
  {
    id: '3',
    title: 'Savings Opportunities Report',
    description: 'AI-identified optimization recommendations with ROI estimates',
    period: 'Jun 2026',
    format: 'PDF',
    status: 'generating',
  },
  {
    id: '4',
    title: 'Executive Summary',
    description: 'C-suite-ready 1-page AI spend overview with YoY trends',
    period: 'Q2 2026',
    format: 'PDF',
    status: 'scheduled',
  },
]

const STATUS_BADGE: Record<Report['status'], { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  ready: { label: 'Ready', variant: 'success' },
  generating: { label: 'Generating', variant: 'warning' },
  scheduled: { label: 'Scheduled', variant: 'secondary' },
}

export default function ReportsPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Executive Reporting</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Download spend summaries, token exports, and savings analyses for stakeholders.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0">
          <Calendar className="mr-2 h-4 w-4" />
          Schedule Report
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Reports Generated', value: '24', icon: FileBarChart, sub: 'All time' },
          { label: 'Cost Identified', value: '$2,140', icon: TrendingDown, sub: 'In savings reports' },
          { label: 'Downloads', value: '87', icon: Download, sub: 'Last 90 days' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
                <stat.icon className="h-5 w-5 text-zinc-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-zinc-50">{stat.value}</p>
                <p className="text-xs text-zinc-400">{stat.label}</p>
                <p className="text-xs text-zinc-600">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report list */}
      <Card>
        <CardHeader>
          <CardTitle>Available Reports</CardTitle>
          <CardDescription>Click download to export. Reports are generated on-demand.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-zinc-800">
            {REPORTS.map((report) => {
              const badge = STATUS_BADGE[report.status]
              return (
                <div
                  key={report.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <FileBarChart className="h-5 w-5 shrink-0 text-violet-400 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-100">{report.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{report.description}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-zinc-600">{report.period}</span>
                        <span className="text-zinc-700">·</span>
                        <Badge variant="outline" className="text-xs py-0 h-4">{report.format}</Badge>
                        {report.size && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className="text-xs text-zinc-600">{report.size}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={report.status !== 'ready'}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
