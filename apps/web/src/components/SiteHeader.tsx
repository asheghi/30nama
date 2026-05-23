import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { setStoredToken } from "@/lib/api";
import { QUERY_CACHE_STORAGE_KEY } from "@/lib/query-client";

const NAV_LINKS: { label: string; cat: "movie" | "series" | "anime" }[] = [
  { label: "Movies", cat: "movie" },
  { label: "Series", cat: "series" },
  { label: "Anime", cat: "anime" },
];

export function SiteHeader({ onSignOut }: { onSignOut?: () => void }) {
  const queryClient = useQueryClient();

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
          30nama
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
      <Button variant="ghost" size="sm" onClick={handleSignOut}>
        Sign out
      </Button>
    </header>
  );
}
