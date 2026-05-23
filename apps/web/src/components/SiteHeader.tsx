import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { getStoredToken, setStoredToken } from "@/lib/api";
import { QUERY_CACHE_STORAGE_KEY } from "@/lib/query-client";

const NAV_LINKS: { label: string; cat: "movie" | "series" | "anime" }[] = [
  { label: "Movies", cat: "movie" },
  { label: "TV Shows", cat: "series" },
  { label: "Anime", cat: "anime" },
];

export function SiteHeader({ onSignOut }: { onSignOut?: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getStoredToken());
  }, []);

  // Header fades from transparent (over the cinematic hero) to a blurred
  // black bar once the user scrolls past the hero apex. 32px is enough to
  // feel responsive without flickering on micro-scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
    queryClient.clear();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
    }
    onSignOut?.();
    window.location.assign("/");
  };

  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-300 ${
        scrolled
          ? "border-b border-white/5 bg-black/70 backdrop-blur-xl"
          : "border-b border-transparent bg-gradient-to-b from-black/70 to-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-8 px-6 lg:px-10">
        <Link
          to="/"
          className="text-[17px] font-semibold tracking-tight"
        >
          Potato<span className="text-white/60">+</span>
        </Link>
        <nav className="hidden items-center gap-6 text-[13px] sm:flex">
          {NAV_LINKS.map((n) => (
            <Link
              key={n.cat}
              to="/category/$cat"
              params={{ cat: n.cat }}
              search={{}}
              className="text-white/70 transition-colors hover:text-white [&.active]:text-white"
              activeOptions={{ exact: false }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-4">
          <form
            onSubmit={handleSubmit}
            className="relative hidden w-full max-w-[280px] items-center md:flex"
            role="search"
          >
            <Search className="pointer-events-none absolute left-3 size-4 text-white/40" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full rounded-full border border-white/10 bg-white/5 py-1.5 pl-9 pr-3 text-[13px] text-white placeholder:text-white/40 focus:border-white/30 focus:bg-white/10 focus:outline-none"
              aria-label="Search"
            />
          </form>

          {isLoggedIn && (
            <button
              onClick={handleSignOut}
              className="text-[13px] text-white/60 transition-colors hover:text-white"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
