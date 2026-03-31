"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useProject } from "@/lib/project-context";
import {
  LayoutDashboard,
  Radio,
  MessageSquare,
  Send,
  Settings,
  BarChart3,
  ChevronDown,
  LogOut,
  Shield,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/monitor", label: "Monitor", icon: Radio },
  { href: "/queue", label: "Queue", icon: MessageSquare },
  { href: "/replies", label: "Replies", icon: Send },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { projects, activeProject, setActiveProject } = useProject();
  const [showSwitcher, setShowSwitcher] = useState(false);

  // Don't show nav on login page
  if (pathname === "/login") return null;

  // Don't show nav if not logged in
  if (!session?.user) return null;

  return (
    <nav className="flex flex-col w-64 border-r border-gray-200 bg-white min-h-screen">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900">
          <span className="text-orange-500">Reddit</span>Reach
        </h1>
        <p className="text-xs text-gray-500 mt-1">Outreach Platform</p>
      </div>

      {/* Project switcher */}
      {projects.length > 0 && (
        <div className="px-3 mb-4">
          <div className="relative">
            <button
              onClick={() => setShowSwitcher(!showSwitcher)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: activeProject?.color || "#f97316" }}
                />
                <span className="text-sm font-medium text-gray-900 truncate">
                  {activeProject?.name || "Select project"}
                </span>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-gray-400 shrink-0 transition-transform", showSwitcher && "rotate-180")} />
            </button>

            {showSwitcher && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setActiveProject(project);
                      setShowSwitcher(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg",
                      activeProject?.id === project.id && "bg-gray-50 font-medium"
                    )}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <div className="text-left min-w-0">
                      <p className="truncate">{project.name}</p>
                      {project.siteUrl && (
                        <p className="text-[10px] text-gray-400 truncate">{project.siteUrl}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
        {session.user.isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mt-2 border-t border-gray-100 pt-3",
              pathname === "/admin"
                ? "bg-orange-50 text-orange-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        )}
      </div>

      {/* User info at bottom */}
      <div className="mt-auto p-3 border-t border-gray-100">
        <div className="flex items-center gap-2 px-3 py-2">
          {session.user.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={session.user.image}
              alt=""
              className="w-7 h-7 rounded-full"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">
              {session.user.name?.[0] || session.user.email?.[0] || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {session.user.name || session.user.email}
            </p>
            <p className="text-[10px] text-gray-400 uppercase">
              {session.user.plan || "free"}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-gray-400 hover:text-gray-600"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
