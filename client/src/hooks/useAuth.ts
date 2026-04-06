import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";

interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  termsAcceptedAt: string | null;
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["auth-user"],
    queryFn: () => apiRequest("/api/auth/user"),
    retry: false,
    staleTime: 30 * 1000,
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.isAdmin ?? false,
    error,
  };
}
