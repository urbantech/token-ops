'use client'

import { Bell, Search, Settings, User, LogOut, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-zinc-800 bg-zinc-950/80 px-6 backdrop-blur-sm">
      {/* Page title */}
      {title && (
        <h1 className="text-sm font-semibold text-zinc-50 hidden sm:block">
          {title}
        </h1>
      )}

      {/* Search */}
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search..."
            className="pl-9 h-8 bg-zinc-900 border-zinc-700 text-sm"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-zinc-400 hover:text-zinc-50"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {/* Notification dot */}
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-500" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 h-8 px-2 text-zinc-400 hover:text-zinc-50"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-700 text-xs font-semibold text-white">
                A
              </div>
              <span className="hidden text-sm md:block">Admin</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-zinc-500">
              admin@ainative.studio
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-400 focus:text-red-400">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
