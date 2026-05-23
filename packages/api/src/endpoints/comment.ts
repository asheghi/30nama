import type { ApiClient } from "../client.ts";

export type CommentType = "comment" | "review";
export type CommentOrderBy = "date" | "popular";

export interface CommentParams {
  id: string | number;
  page?: number;
  type?: CommentType;
  orderBy?: CommentOrderBy;
}

// Permissive — captured HAR for a title with zero comments returned ~100B.
// Tighten once a real response with populated comments is in hand.
export interface CommentItem {
  id?: number;
  user?: { id: number; username: string; avatar?: string | null };
  text?: string;
  date?: string;
  likes?: number;
  dislikes?: number;
  replies?: CommentItem[];
  [key: string]: unknown;
}

export interface CommentResult {
  page?: number;
  pages?: number;
  posts?: CommentItem[];
  [key: string]: unknown;
}

export function getComments(
  client: ApiClient,
  params: CommentParams,
): Promise<CommentResult> {
  const { id, page = 1, type = "comment", orderBy = "date" } = params;
  const path =
    `/action/comment` +
    `/id/${id}` +
    `/page/${page}` +
    `/type/${type}` +
    `/orderby/${orderBy}`;
  return client.post<CommentResult>(path, { jsonBody: {} });
}
