export type Platform =
  | "DESKTOP"
  | "HYBRID"
  | "ANDROIDTV"
  | "WEBTV"
  | "WEBSITE"
  | "MOBILE"
  | "SYSTEM"
  | "DEVELOPMENT";

// Per-platform API keys, extracted from the official 30nama-sdk's
// dist/api/request.js. Not secrets — they ship to every client unchanged.
// The server uses them to gate per-platform behaviour (rate limits, captcha
// policy, etc.), not for authentication.
export const PLATFORM_KEYS: Record<Platform, string> = {
  DESKTOP: "et7bRHdhmL468C5BcNrEMYTWGfz3a9vJ",
  HYBRID: "et7bRHdhmL468C5BcNrEMYTWGfz3a9vJ",
  ANDROIDTV: "VdapnkLG9EHsSmF8yeKcb4253RAuN6YX",
  WEBTV:
    "83hRzBabjDnuv9SmV2GFaftpxjhZSHXYe7UnBuX5DdANdpzPvXu46jvKZHPb97As",
  WEBSITE:
    "B9gA4Dr8gefwtd999YYw7SNRzPzq2TDPEJvXVJLnPDWFL2H4RcVq83TZy7dHY9Z4",
  MOBILE: "qCKS5D6Ek39eATysYgUhNP4fBjxZ2a8u",
  SYSTEM:
    "QguPhpFdjNQD73cmakvtIYwdMDHry8UDuG6qACvDshWTrXa2UaKtccAL5GAuIHZm",
  DEVELOPMENT:
    "BqnpVqrUNX8ReMWcurMK2Vr8yBPcxpaVzJ4eTgnfpd338X6fW4ChUjnVSLfBmpwb",
};

export const HANA_API_WORLD = "https://world.hana-api.com/api/v2";
export const HANA_API_IR = "https://ir.kazem-api.com/api/v2";

// The website's own backend (interface.30nama.com) exposes a few actions
// that hana-api doesn't — most notably `full_search`, which is the only
// keyword-search action that also accepts type/orderby/order filters.
// Used by the search route via a second server-side proxy.
export const INTERFACE_API = "https://interface.30nama.com/api/v1";
export const INTERFACE_APP_VERSION = "2.0.0";
export const INTERFACE_PLATFORM = "Website";
// The website ships a different `c-api-key` than the SDK's WEBSITE
// platform key — same "not a secret, in the public JS bundle" character,
// but interface.30nama.com only accepts this one.
export const INTERFACE_API_KEY =
  "YygufGCvFgYR3g9sjD92Ct5ZSx7SJs4JXpuCeTS24nWAszaL4u3qCDZRULpejmzF";

// Authoritative endpoint list, fetched at runtime by the official SDK so
// hosts can be rotated without shipping a new client. Hardcoded WORLD/IR
// above are the current (2026-05) values used as a fallback.
export const SDK_ENDPOINT_JSON =
  "https://30update.s3.ir-thr-at1.arvanstorage.ir/sdk-endpoint.json";

export const DEFAULT_PLATFORM: Platform = "DESKTOP";
export const DEFAULT_LANGUAGE: "fa" | "en" = "en";
// The server enforces a minimum c-version-number — older values get
// "QR Disabled 1.0.0" style responses. Match the latest hybrid build.
export const DEFAULT_VERSION_NUMBER = "300.3.16";
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
