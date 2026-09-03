import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Unwrap API response that may be wrapped in multiple layers:
 * - { success, data: { data: [...], pagination } } (NexOn raw)
 * - { data: [...], pagination } (after interceptor unwrap)
 * - [...] (already unwrapped array)
 *
 * Returns { data: any[], pagination: any }
 */
export function unwrapApiResponse(responseData: any): { data: any[]; pagination: any } {
  if (!responseData) return { data: [], pagination: {} };

  // Already an array
  if (Array.isArray(responseData)) return { data: responseData, pagination: {} };

  // { success, data: { data: [...], pagination } }
  if (responseData.success !== undefined && responseData.data) {
    return unwrapApiResponse(responseData.data);
  }

  // { data: [...], pagination: {...} }
  if (Array.isArray(responseData.data)) {
    return { data: responseData.data, pagination: responseData.pagination || {} };
  }

  // { data: { data: [...], pagination } } (double wrapped)
  if (responseData.data?.data && Array.isArray(responseData.data.data)) {
    return { data: responseData.data.data, pagination: responseData.data.pagination || responseData.pagination || {} };
  }

  // Fallback
  return { data: [], pagination: {} };
}
