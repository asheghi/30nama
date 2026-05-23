import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getStoredToken, setStoredToken } from "@/lib/api";
import { QUERY_CACHE_STORAGE_KEY } from "@/lib/query-client";

const NAV_LINKS: { label: string; cat: "movie" | "series" | "anime" }[] = [
  { label: "Movies", cat: "movie" },
  { label: "Series", cat: "series" },
  { label: "Anime", cat: "anime" },
];

export function SiteHeader({ onSignOut }: { onSignOut?: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    setIsLoggedIn(!!getStoredToken());
  }, []);
  const currentSearchQ = useRouterState({
    select: (s) => {
      const match = s.matches.find((m) => m.routeId === "/search");
      const sp = match?.search as { q?: string } | undefined;
      return sp?.q ?? "";
    },
  });
  const [query, setQuery] = useState(currentSearchQ);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate({ to: "/search", search: { q } });
  };

  const handleSignOut = () => {
    setStoredToken(null);
    // Nuke both the in-memory query cache and the persisted snapshot so a
    // subsequent sign-in doesn't see the previous user's home/single data.
    queryClient.clear();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
    }
    onSignOut?.();
    window.location.assign("/");
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-6 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-xl font-bold tracking-tight">
          Potato+
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV_LINKS.map((n) => (
            <Link
              key={n.cat}
              to="/category/$cat"
              params={{ cat: n.cat }}
              search={{}}
              className="rounded px-2.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground [&.active]:text-foreground"
              activeOptions={{ exact: false }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-1 max-w-sm items-center gap-2"
        role="search"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles…"
          className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          aria-label="Search"
        />
      </form>
      {isLoggedIn && (
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      )}
    </header>
  );
}
