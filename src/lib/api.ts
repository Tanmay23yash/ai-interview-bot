import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/*
 * Small fetch wrapper for the adaptive-interview pages. Every request carries
 * a fresh X-Correlation-ID; error messages keep the ID the server logged them
 * under, so a user can quote it and we can find the exact request.
 */

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  readonly status: number;
  readonly correlationId: string | null;

  constructor(message: string, status: number, correlationId: string | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.correlationId = correlationId;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal;
};

function newCorrelationId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 14)}`;
  }
}

function messageFrom(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  // FastAPI validation errors: [{ msg: "Value error, ..." }, ...]
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") return detail[0].msg.replace(/^Value error, /, "");
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return "That request didn't work.";
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export async function apiRequest<T>(path: string, { method = "GET", json, form, signal }: RequestOptions = {}): Promise<T> {
  const correlationId = newCorrelationId();
  const headers: Record<string, string> = { "X-Correlation-ID": correlationId };
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (form) {
    body = form;
  } else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body, signal });
  } catch (err) {
    if (isAbort(err)) throw err;
    throw new ApiError("Can't reach the server. Check that the backend is running.", 0, correlationId);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      messageFrom(data?.detail, res.status),
      res.status,
      data?.correlation_id ?? res.headers.get("X-Correlation-ID") ?? correlationId
    );
  }
  return data as T;
}

/** apiRequest that signs the user out and returns to login when the session has expired. */
export function useApi() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return useCallback(
    async <T>(path: string, options?: RequestOptions): Promise<T> => {
      try {
        return await apiRequest<T>(path, options);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          navigate("/login", { replace: true });
        }
        throw err;
      }
    },
    [logout, navigate]
  );
}
