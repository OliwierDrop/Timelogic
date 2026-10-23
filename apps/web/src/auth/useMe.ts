import { useQuery } from "@tanstack/react-query";
import { api, post, setCsrf, type Me } from "../api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const result = await api<Me>("/auth/me");
      setCsrf(result.csrf_token);
      if (
        result.csrf_token &&
        result.session_expires_at &&
        new Date(result.session_expires_at).getTime() - Date.now() < 86_400_000
      ) {
        const renewed = await post<Me>("/auth/refresh", {});
        setCsrf(renewed.csrf_token);
        return renewed;
      }
      return result;
    },
    retry: false,
  });
}
