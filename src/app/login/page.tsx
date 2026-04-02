"use client";

import { signIn, getProviders } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const errorMessages: Record<string, string> = {
  OAuthSignin: "Could not start sign-in. The provider may be misconfigured.",
  OAuthCallback: "Sign-in failed during the callback step.",
  OAuthCreateAccount: "Could not create your account.",
  Callback: "Something went wrong during sign-in.",
  Default: "An unexpected error occurred. Please try again.",
};

const providerIcons: Record<string, React.ReactNode> = {
  google: (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  ),
  github: (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  ),
};

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [providers, setProviders] = useState<Record<string, { id: string; name: string }>>({});

  useEffect(() => {
    getProviders().then((p) => {
      if (p) setProviders(p);
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            <span className="text-orange-500">Reddit</span>Reach
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Monitor subreddits, find relevant threads, and draft targeted replies across multiple projects.
          </p>
          {error && (
            <p className="text-sm text-red-600 mt-2 bg-red-50 rounded-md px-3 py-2">
              {errorMessages[error] || errorMessages.Default}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.values(providers).map((provider) => (
            <Button
              key={provider.id}
              className="w-full"
              variant="outline"
              onClick={() => signIn(provider.id, { callbackUrl: "/" })}
            >
              {providerIcons[provider.id]}
              Continue with {provider.name}
            </Button>
          ))}
          {Object.keys(providers).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-2">
              Loading sign-in options...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
