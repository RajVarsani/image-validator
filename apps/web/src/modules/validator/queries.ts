import useSWR from "swr";
import useSWRMutation from "swr/mutation";
import { genericAPIFetcher, genericMutationFetcher } from "../../lib/fetchers.js";
import type { FilterTab, ImageDto, ImagesResponse } from "./types.js";

/** Poll a session's images. Keeps polling while anything is still processing. */
export function useImages(sessionId: string | null, filter: FilterTab) {
  const status = filter === "ALL" ? "" : `?status=${filter}`;
  const key = sessionId ? [`/api/sessions/${sessionId}/images${status}`, "get"] : null;
  const { data, isLoading, mutate } = useSWR<ImagesResponse>(key, genericAPIFetcher, {
    refreshInterval: (latest) =>
      latest?.images?.some((i) => i.status === "PROCESSING" || i.status === "PENDING") ? 1200 : 0,
    keepPreviousData: true,
  });
  return {
    images: data?.images ?? [],
    counts: data?.counts ?? {},
    isLoading,
    refresh: mutate,
  };
}

/** Upload a batch of files (multipart) to a session. */
export function useUploadImages() {
  const { trigger, isMutating } = useSWRMutation("/api/images", genericMutationFetcher);
  const upload = (sessionId: string, files: File[]) => {
    const form = new FormData();
    form.append("sessionId", sessionId);
    for (const f of files) form.append("files", f);
    return trigger({
      type: "post",
      rest: [form, { headers: { "Content-Type": "multipart/form-data" } }],
    }) as Promise<{ images: ImageDto[] }>;
  };
  return { upload, isUploading: isMutating };
}

/** Create (and persist) a session id for this browser. */
export async function ensureSession(): Promise<string> {
  const cached = localStorage.getItem("iv-session");
  if (cached) return cached;
  const res = await genericMutationFetcher("/api/sessions", { arg: { type: "post" } });
  localStorage.setItem("iv-session", res.id);
  return res.id;
}
