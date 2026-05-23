import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  SkipForward,
  Subtitles,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { StreamEpisode } from "@30nama/api";
import { cn } from "@/lib/utils";
import {
  fetchSubtitleAsVttBlob,
  normaliseSubtitleUrl,
} from "@/lib/srt";
import { pingObserver } from "@/server/observer";
import { Button } from "@/components/ui/button";

type Channel = "auto" | "6ch" | "2ch";
type SubtitleLang = "fa" | "en" | "off";

interface PlayerPrefs {
  quality: string; // label, e.g. "خودکار" / "1080p"
  channel: Channel;
  subtitle: SubtitleLang;
}

const PREFS_KEY = "30nama:playerPrefs";
const DEFAULT_PREFS: PlayerPrefs = {
  quality: "خودکار",
  channel: "auto",
  subtitle: "fa",
};

function loadPrefs(): PlayerPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.sessionStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<PlayerPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: PlayerPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // sessionStorage may be unavailable (private mode, quota)
  }
}

/**
 * Parses `HH:MM:SS` (or `MM:SS`) from the API options into seconds. Returns
 * `null` if the input is unusable so callers can skip the corresponding
 * UI affordance (Skip Intro etc) instead of showing it at t=0.
 */
function parseTimecode(tc: string | null | undefined): number | null {
  if (!tc) return null;
  const parts = tc.split(":").map((p) => Number.parseInt(p, 10));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

function formatTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Extracts the user id from the CDN URL: `/stream/1/6/{user_id}/{fid}/...`. */
function parseUserId(url: string): string {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean);
    // ["stream", "1", "6", "{user_id}", "{fid}", ...]
    const i = segs.indexOf("stream");
    if (i >= 0 && segs.length > i + 3) return segs[i + 3];
  } catch {
    // fall through
  }
  return "";
}

/**
 * Picks the right `.m3u8` URL from an episode given the current quality
 * label + audio channel preference. Falls back gracefully:
 *  1. exact (quality + channel)
 *  2. quality + auto channel
 *  3. خودکار (auto quality) + auto channel
 *  4. file.url (the master playlist)
 */
function pickStreamUrl(
  ep: StreamEpisode,
  quality: string,
  channel: Channel,
): string {
  const sources = ep.file.source ?? [];
  const byLabel = (label: string) => sources.find((s) => s.label === label);

  const tryGet = (label: string, ch: Channel): string => {
    const src = byLabel(label);
    if (!src) return "";
    return src[ch] ?? "";
  };

  return (
    tryGet(quality, channel) ||
    tryGet(quality, "auto") ||
    tryGet("خودکار", "auto") ||
    sources[0]?.auto ||
    ep.file.url
  );
}

export interface HlsPlayerProps {
  episode: StreamEpisode;
  postId: number;
  /** Episodes in playback order — used to find the next one for "Next Episode". */
  playlist: StreamEpisode[];
  /** Seconds to resume from on mount (0 to start fresh). */
  resumeFrom?: number;
  /** Called when the user picks the next episode. */
  onNextEpisode?: (next: StreamEpisode) => void;
  /** Bearer token for observer pings. */
  token: string;
}

/**
 * Apple TV+-style HLS player. Wraps a `<video>` with hls.js, renders the
 * dark overlay control bar, manages quality/audio/subtitle pickers, fires
 * the Skip Intro / Next Episode shortcuts, and pings the observer endpoint
 * every 30 s + on pause/unload.
 */
export function HlsPlayer({
  episode,
  postId,
  playlist,
  resumeFrom = 0,
  onNextEpisode,
  token,
}: HlsPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [prefs, setPrefs] = useState<PlayerPrefs>(() => loadPrefs());
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState<"none" | "quality" | "subtitle">(
    "none",
  );
  const [subtitleBlobUrl, setSubtitleBlobUrl] = useState<string | null>(null);

  // Persist prefs whenever they change.
  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const introStart = useMemo(
    () => parseTimecode(episode.options.intro_start),
    [episode],
  );
  const introEnd = useMemo(
    () => parseTimecode(episode.options.intro_end),
    [episode],
  );
  const endTime = useMemo(
    () => parseTimecode(episode.options.end),
    [episode],
  );

  const nextEpisode = useMemo(() => {
    const idx = playlist.findIndex((e) => e.data.id === episode.data.id);
    if (idx < 0 || idx + 1 >= playlist.length) return null;
    return playlist[idx + 1];
  }, [playlist, episode]);

  const streamUrl = useMemo(
    () => pickStreamUrl(episode, prefs.quality, prefs.channel),
    [episode, prefs.quality, prefs.channel],
  );

  const userId = useMemo(() => parseUserId(streamUrl), [streamUrl]);

  // ----- hls.js lifecycle -----
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    // Tear down any previous instance first.
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let cancelled = false;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) return;
        if (resumeFrom > 0) {
          try {
            video.currentTime = resumeFrom;
          } catch {
            // ignore — some browsers throw before duration is known
          }
        }
        void video.play().catch(() => {
          // autoplay blocked — user will press play
        });
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari has native HLS.
      video.src = streamUrl;
      video.addEventListener(
        "loadedmetadata",
        () => {
          if (cancelled) return;
          if (resumeFrom > 0) {
            try {
              video.currentTime = resumeFrom;
            } catch {
              // ignore
            }
          }
          void video.play().catch(() => {});
        },
        { once: true },
      );
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // Resume only applies once on the *initial* mount of a given source,
    // and we explicitly want to keep it pinned to the value passed in at
    // mount time rather than re-seeking on every prop change. Exclude
    // resumeFrom from the deps deliberately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  // ----- subtitle blob lifecycle -----
  useEffect(() => {
    let cancelled = false;
    let createdBlob: string | null = null;

    if (prefs.subtitle === "off") {
      setSubtitleBlobUrl(null);
      return;
    }

    const rawUrl =
      prefs.subtitle === "fa"
        ? episode.subtitle?.fa
        : episode.subtitle?.en;
    const url = normaliseSubtitleUrl(rawUrl);
    if (!url) {
      setSubtitleBlobUrl(null);
      return;
    }

    void fetchSubtitleAsVttBlob(url).then((blob) => {
      if (cancelled) {
        if (blob) URL.revokeObjectURL(blob);
        return;
      }
      createdBlob = blob;
      setSubtitleBlobUrl(blob);
    });

    return () => {
      cancelled = true;
      if (createdBlob) URL.revokeObjectURL(createdBlob);
    };
  }, [prefs.subtitle, episode]);

  // ----- video event wiring -----
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolume = () => {
      setMuted(video.muted);
      setVolume(video.volume);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolume);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolume);
    };
  }, []);

  // ----- fullscreen state -----
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ----- observer pings -----
  const sendPing = useCallback(
    (t: number, d: number) => {
      if (!token || !userId) return;
      void pingObserver({
        data: {
          fid: episode.data.id,
          pid: postId,
          t,
          d,
          k: episode.options.key,
          uid: userId,
          token,
        },
      }).catch(() => {
        // best-effort; observer failures shouldn't disrupt playback
      });
    },
    [token, userId, episode, postId],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Fire once on mount with t=0 so the server knows the session started.
    sendPing(0, 0);

    const interval = window.setInterval(() => {
      if (!video.paused) sendPing(video.currentTime, video.duration || 0);
    }, 30_000);

    const onPause = () => sendPing(video.currentTime, video.duration || 0);
    const onUnload = () => sendPing(video.currentTime, video.duration || 0);

    video.addEventListener("pause", onPause);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      window.clearInterval(interval);
      video.removeEventListener("pause", onPause);
      window.removeEventListener("beforeunload", onUnload);
      // Final ping on unmount — keeps watched.time fresh between episode swaps.
      sendPing(video.currentTime, video.duration || 0);
    };
  }, [sendPing]);

  // ----- hide controls after inactivity -----
  useEffect(() => {
    if (!controlsVisible || !playing) return;
    const t = window.setTimeout(() => setControlsVisible(false), 3000);
    return () => window.clearTimeout(t);
  }, [controlsVisible, playing, currentTime]);

  const showControls = useCallback(() => setControlsVisible(true), []);

  // ----- handlers -----
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const setVol = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    if (val > 0 && v.muted) v.muted = false;
  };

  const seekTo = (sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(sec, v.duration || sec));
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen().catch(() => {});
    }
  };

  const skipIntro = () => {
    if (introEnd != null) seekTo(introEnd + 0.1);
  };

  const goNext = () => {
    if (nextEpisode && onNextEpisode) onNextEpisode(nextEpisode);
  };

  // Pre-compute UI flags
  const inIntro =
    introStart != null &&
    introEnd != null &&
    currentTime >= introStart &&
    currentTime <= introEnd;
  const atEnd =
    endTime != null && currentTime >= endTime && nextEpisode != null;

  // Available quality labels (deduplicated, preserve order)
  const qualityLabels = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of episode.file.source ?? []) {
      if (s.label && !seen.has(s.label)) {
        seen.add(s.label);
        out.push(s.label);
      }
    }
    return out;
  }, [episode]);

  // Available channels for the currently-picked quality
  const availableChannels = useMemo<Channel[]>(() => {
    const src = episode.file.source?.find((s) => s.label === prefs.quality);
    const channels: Channel[] = [];
    if (src?.auto) channels.push("auto");
    if (src?.["6ch"]) channels.push("6ch");
    if (src?.["2ch"]) channels.push("2ch");
    return channels.length > 0 ? channels : ["auto"];
  }, [episode, prefs.quality]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full overflow-hidden bg-black"
      onMouseMove={showControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      onClick={showControls}
    >
      <video
        ref={videoRef}
        className="h-full w-full bg-black"
        playsInline
        crossOrigin="anonymous"
      >
        {subtitleBlobUrl && (
          <track
            key={`${prefs.subtitle}-${episode.data.id}`}
            kind="subtitles"
            srcLang={prefs.subtitle === "off" ? undefined : prefs.subtitle}
            label={prefs.subtitle.toUpperCase()}
            src={subtitleBlobUrl}
            default
          />
        )}
      </video>

      {/* Apple TV+-style top vignette + bottom gradient */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0",
          "bg-gradient-to-t from-black/80 via-transparent to-black/30",
        )}
      />

      {/* Center play/pause */}
      <button
        type="button"
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
          !playing || controlsVisible ? "opacity-100" : "opacity-0",
        )}
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        aria-label={playing ? "Pause" : "Play"}
      >
        <span className="rounded-full bg-black/50 p-5 backdrop-blur-md">
          {playing ? (
            <Pause className="size-10 text-white" />
          ) : (
            <Play className="size-10 text-white" />
          )}
        </span>
      </button>

      {/* Skip Intro */}
      {inIntro && (
        <button
          type="button"
          className="absolute bottom-24 right-6 z-20 rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-black shadow-lg backdrop-blur-md hover:bg-white"
          onClick={(e) => {
            e.stopPropagation();
            skipIntro();
          }}
        >
          Skip Intro
        </button>
      )}

      {/* Next Episode */}
      {atEnd && (
        <button
          type="button"
          className="absolute bottom-24 right-6 z-20 flex items-center gap-2 rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-black shadow-lg backdrop-blur-md hover:bg-white"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
        >
          <SkipForward className="size-4" />
          Next Episode
        </button>
      )}

      {/* Settings popovers */}
      {settingsOpen !== "none" && (
        <div
          className="absolute right-6 top-16 z-30 w-56 rounded-lg border border-white/10 bg-black/85 p-3 text-sm text-white backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {settingsOpen === "quality" && (
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-white/60">
                  Quality
                </div>
                <div className="flex flex-wrap gap-1">
                  {qualityLabels.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setPrefs({ ...prefs, quality: label })}
                      className={cn(
                        "rounded px-2 py-1 text-xs",
                        prefs.quality === label
                          ? "bg-white text-black"
                          : "bg-white/10 hover:bg-white/20",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-white/60">
                  Audio
                </div>
                <div className="flex flex-wrap gap-1">
                  {(["auto", "6ch", "2ch"] as Channel[]).map((ch) => {
                    const enabled = availableChannels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        disabled={!enabled}
                        onClick={() =>
                          enabled && setPrefs({ ...prefs, channel: ch })
                        }
                        className={cn(
                          "rounded px-2 py-1 text-xs",
                          prefs.channel === ch
                            ? "bg-white text-black"
                            : "bg-white/10 hover:bg-white/20",
                          !enabled && "cursor-not-allowed opacity-30",
                        )}
                      >
                        {ch === "auto" ? "Auto" : ch === "6ch" ? "5.1" : "Stereo"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {settingsOpen === "subtitle" && (
            <div>
              <div className="mb-1 text-xs uppercase tracking-wide text-white/60">
                Subtitles
              </div>
              <div className="flex flex-wrap gap-1">
                {(["fa", "en", "off"] as SubtitleLang[]).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setPrefs({ ...prefs, subtitle: lang })}
                    className={cn(
                      "rounded px-2 py-1 text-xs",
                      prefs.subtitle === lang
                        ? "bg-white text-black"
                        : "bg-white/10 hover:bg-white/20",
                    )}
                  >
                    {lang === "fa" ? "فارسی" : lang === "en" ? "English" : "Off"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top-right settings buttons */}
      <div
        className={cn(
          "absolute right-4 top-4 z-20 flex items-center gap-1 transition-opacity duration-200",
          controlsVisible ? "opacity-100" : "opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={() =>
            setSettingsOpen((s) => (s === "subtitle" ? "none" : "subtitle"))
          }
          aria-label="Subtitles"
        >
          <Subtitles />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={() =>
            setSettingsOpen((s) => (s === "quality" ? "none" : "quality"))
          }
          aria-label="Quality and audio"
        >
          <Settings />
        </Button>
      </div>

      {/* Bottom control bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 px-6 pb-4 pt-12 transition-opacity duration-200",
          controlsVisible ? "opacity-100" : "opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber */}
        <input
          type="range"
          min={0}
          max={Math.max(1, duration || 1)}
          step={0.1}
          value={Math.min(currentTime, duration || currentTime)}
          onChange={(e) => seekTo(Number.parseFloat(e.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
          aria-label="Seek"
        />

        <div className="mt-3 flex items-center gap-3 text-white">
          <button
            type="button"
            onClick={togglePlay}
            className="rounded p-1 hover:bg-white/10"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="rounded p-1 hover:bg-white/10"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? (
                <VolumeX className="size-5" />
              ) : (
                <Volume2 className="size-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVol(Number.parseFloat(e.target.value))}
              className="hidden h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/20 accent-white sm:block"
              aria-label="Volume"
            />
          </div>

          <div className="text-xs tabular-nums text-white/80">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

          <div className="ml-auto flex items-center gap-1">
            {nextEpisode && (
              <button
                type="button"
                onClick={goNext}
                className="rounded p-1 hover:bg-white/10"
                aria-label="Next episode"
                title="Next episode"
              >
                <SkipForward className="size-5" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded p-1 hover:bg-white/10"
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? (
                <Minimize className="size-5" />
              ) : (
                <Maximize className="size-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
