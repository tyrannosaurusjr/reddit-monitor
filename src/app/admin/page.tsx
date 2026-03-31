"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Crown, User, ChevronUp, ChevronDown } from "lucide-react";

interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  plan: string;
  isAdmin: boolean;
  createdAt: string;
  _count: { projects: number };
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = () => {
    fetch("/api/admin/users")
      .then((r) => {
        if (r.status === 403) throw new Error("Not authorized — admin only");
        if (!r.ok) throw new Error("Failed to load users");
        return r.json();
      })
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateUser = async (userId: string, data: Record<string, unknown>) => {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...data }),
    });
    fetchUsers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Shield className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <p className="text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="h-6 w-6 text-orange-500" />
          Admin
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Manage users and plans — {users.length} registered user{users.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Users</CardTitle>
          <CardDescription>
            Anyone can sign up via GitHub. Upgrade users to Pro or grant admin access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {user.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={user.image} alt="" className="w-9 h-9 rounded-full" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {user.name || "No name"}
                    </p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                    <div className="flex gap-1.5 mt-1">
                      <Badge
                        variant={user.plan === "pro" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {user.plan === "pro" ? (
                          <><Crown className="h-2.5 w-2.5 mr-0.5" /> Pro</>
                        ) : (
                          "Free"
                        )}
                      </Badge>
                      {user.isAdmin && (
                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700">
                          Admin
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {user._count.projects} project{user._count.projects !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {user.plan === "free" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateUser(user.id, { plan: "pro" })}
                    >
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Upgrade to Pro
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateUser(user.id, { plan: "free" })}
                    >
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Downgrade
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
