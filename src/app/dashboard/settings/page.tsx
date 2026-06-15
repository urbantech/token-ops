'use client'

import { Settings, Key, Bell, Database, Palette } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export default function SettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-50">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configure API connections, notifications, and platform preferences.
        </p>
      </div>

      {/* API Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-violet-400" />
            <CardTitle>API Configuration</CardTitle>
          </div>
          <CardDescription>
            Connect TokenOps to your AINative account and model providers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">AINative API Key</label>
            <div className="flex gap-2">
              <Input
                type="password"
                defaultValue="sk_nLI6DrYP9h7qrac9t876Wj4e3iV-zsk5YXUv0S-ttkM"
                className="font-mono"
              />
              <Button variant="outline" size="sm" className="shrink-0">
                Verify
              </Button>
            </div>
            <p className="text-xs text-zinc-600">Used to connect to AINative ZeroDB and Model APIs.</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">AINative API URL</label>
            <Input
              defaultValue="https://api.ainative.studio"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">ZeroDB Project ID</label>
            <Input
              placeholder="zerodb-project-id"
              className="font-mono"
            />
            <p className="text-xs text-zinc-600">Your ZeroDB project for storing token events and agent memory.</p>
          </div>

          <Button className="bg-violet-600 hover:bg-violet-700">
            Save API Settings
          </Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-violet-400" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>
            Configure alerts for cost thresholds and optimization opportunities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Alert Email</label>
            <Input
              type="email"
              defaultValue="admin@ainative.studio"
              placeholder="your@email.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Cost Alert Threshold (USD)</label>
            <Input
              type="number"
              defaultValue="100"
              min={1}
            />
            <p className="text-xs text-zinc-600">
              Send an alert when daily AI spend exceeds this amount.
            </p>
          </div>

          <Button variant="outline">
            Save Notification Settings
          </Button>
        </CardContent>
      </Card>

      {/* Data & Storage */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-violet-400" />
            <CardTitle>Data & Retention</CardTitle>
          </div>
          <CardDescription>
            Manage how long token events and memory are retained.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Event Retention (days)</label>
            <Input type="number" defaultValue="90" min={7} max={365} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Memory Retention (days)</label>
            <Input type="number" defaultValue="180" min={7} max={730} />
          </div>

          <Button variant="outline">
            Save Data Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
