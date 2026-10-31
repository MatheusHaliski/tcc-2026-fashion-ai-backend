import { catalogApi, type CatalogProduct } from "@/lib/api/catalog";
import { api, API_BASE, ApiError, tokenStore } from "@/lib/api/client";
import type {
  Asset,
  GenderEvidence,
  SceneResponse,
  SceneVersion,
  SaveCommand,
  GuestInvite,
} from "./contracts";
export interface SceneAccess {
  projectId?: string;
  guestId?: string;
  token?: string;
}
export function sceneApi(access: SceneAccess) {
  const guest = !!access.guestId,
    root = guest
      ? `/api/atelier/guest/${access.guestId}`
      : `/api/atelier/projects/${access.projectId}/scene`;
  const request = async <T>(
    path: string,
    method = "GET",
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> => {
    if (!guest) {
      if (method === "POST") return api.post<T>(root + path, body);
      if (method === "DELETE") return api.delete<T>(root + path);
      return api.get<T>(root + path);
    }
    const response = await fetch(API_BASE + root + path, {
      method,
      headers: {
        "X-Atelier-Guest": access.token ?? "",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        error.code ?? "ATELIER_GUEST",
        error.message ?? "ATELIER_GUEST",
      );
    }
    return response.json();
  };
  return {
    get: () => request<SceneResponse>(guest ? "/scene" : ""),
    version: (id: string) => request<SceneVersion>("/versions/" + id),
    metadata: (id: string) => request<Asset>("/assets/" + id + "/metadata"),
    save: (cmd: SaveCommand) => request<SceneVersion>("/versions", "POST", cmd),
    evidence: (ids: string[]) =>
      request<GenderEvidence>("/gender-evidence", "POST", ids),
    async upload(file: File): Promise<Asset> {
      const body = new FormData();
      body.append("file", file);
      if (!guest) return api.upload<Asset>(root + "/assets", body);
      const response = await fetch(API_BASE + root + "/assets", {
        method: "POST",
        headers: { "X-Atelier-Guest": access.token ?? "" },
        body,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(response.status, error.code, error.message);
      }
      return response.json();
    },
    async bytes(asset: string): Promise<ArrayBuffer> {
      const response = await fetch(API_BASE + root + "/assets/" + asset, {
        headers: guest
          ? { "X-Atelier-Guest": access.token ?? "" }
          : tokenStore.access
            ? { Authorization: `Bearer ${tokenStore.access}` }
            : {},
        cache: "no-store",
      });
      if (!response.ok)
        throw new ApiError(response.status, "ATELIER_ASSET", "ATELIER_ASSET");
      return response.arrayBuffer();
    },
    search: (q: string, signal: AbortSignal) =>
      guest
        ? request<{ items: CatalogProduct[] }>(
            "/catalog?q=" + encodeURIComponent(q),
            "GET",
            undefined,
            signal,
          )
        : catalogApi.browse({ q, size: 8 }, signal),
    invites: () => request<GuestInvite[]>("/guests"),
    invite: (body: {
      label: string;
      role: string;
      hours: number;
      allowExport: boolean;
    }) =>
      request<{ invite: GuestInvite; token: string }>("/guests", "POST", body),
    revoke: (id: string) => request<void>("/guests/" + id, "DELETE"),
  };
}
