import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { setStoredToken } from "@/lib/api";

const NAV_LINKS: { label: string; cat: "movie" | "series" | "anime" }[] = [
  { label: "Movies", cat: "movie" },
  { label: "Series", cat: "series" },
  { label: "Anime", cat: "anime" },
];

export function SiteHeader({ onSignOut }: { onSignOut?: () => void }) {
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setStoredToken(null);
          onSignOut?.();
          window.location.assign("/");
        }}
      >
        Sign out
      </Button>
    </header>
  );
}
