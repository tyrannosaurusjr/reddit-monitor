"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Radio,
  MessageSquare,
  Send,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/monitor", label: "Monitor", icon: Radio },
  { href: "/queue", label: "Queue", icon: MessageSquare },
  { href: "/replies", label: "Replies", icon: Send },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col w-64 border-r border-gray-200 bg-white min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900">
          <span className="text-orange-500">Reddit</span>Reach
        </h1>
        <p className="text-xs text-gray-500 mt-1">Outreach Platform</p>
      </div>
      <div className="flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-orange-50 text-orange-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
