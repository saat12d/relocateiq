import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  clearAuthToken,
  fetchMe,
  getAuthToken,
  type CurrentUser,
} from "../lib/auth";

type SessionState = {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
};

export function useSession(): SessionState {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(getAuthToken()));

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchMe()
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch(() => {
        if (!cancelled) {
          clearAuthToken();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: Boolean(getAuthToken() && user),
    logout,
  };
}
