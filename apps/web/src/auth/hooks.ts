import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post, setCsrf, type Employee, type Entry, type Me, type User } from "../api";

export function useEntries(employeeId?: string | null) {
  return useQuery({
    queryKey: ["entries", employeeId],
    queryFn: () => api<Entry[]>(`/time-entries?employee_id=${employeeId}`),
    enabled: !!employeeId,
  });
}

export function useCreateOwnEmployee(user: User) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const local = user.email.split("@")[0] || "pracownik";
      const parts = local.split(/[._-]+/).filter(Boolean);
      const first = (parts[0] || "Pracownik").replace(/^\w/, (c) =>
        c.toUpperCase(),
      );
      const last = (parts[1] || "TimeLogic").replace(/^\w/, (c) =>
        c.toUpperCase(),
      );
      return post<Employee>("/employees", {
        first_name: first,
        last_name: last,
        user_id: user.id,
        position: "Pracownik",
      });
    },
    onSuccess: async () => {
      const me = await api<Me>("/auth/me");
      setCsrf(me.csrf_token);
      client.setQueryData(["me"], me);
      client.invalidateQueries({ queryKey: ["employees"] });
      client.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
