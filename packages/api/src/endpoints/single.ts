import type { ApiClient } from "../client.ts";
import type { Title } from "../types.ts";

export interface Person {
  name: string;
  as?: string;
  id?: string;
  imdb?: string;
  image?: {
    poster: {
      preview: string;
      webp: { small: string; medium: string; large: string; big: string };
      jpg: { small: string; medium: string; large: string; big: string };
    };
  };
}

export interface Single extends Title {
  cast: Person[];
  crew: {
    director?: Person[];
    writer?: Person[];
    creator?: Person[];
  };
  country: { name: string; code: string }[];
  language: {
    primary: { name: string; code: string };
    others?: { name: string; code: string }[];
  };
  list: { watchlist: number; favorite: number };
  note: {
    main?: string;
    update: {
      title: string;
      content: string;
      date: { g: string; j: string };
    }[];
  };
  subtitle: {
    language: string;
    quality: string;
    link: string;
    single: boolean;
    type?: string;
    season?: string;
  }[];
  network: string[];
}

/** Returns the full title detail for a single post id. */
export function getSingle(
  client: ApiClient,
  postId: number | string,
): Promise<Single> {
  return client.call<Single>("single", { post_id: postId });
}
