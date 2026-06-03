import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthToken, fetchMe, getAuthToken } from "./auth";

type Requirement = {
  check: () => Promise<boolean> | boolean;
  redirect: string;
};

export function withRequirements<P extends object>(
  Component: React.ComponentType<P>,
  requirements: Requirement[],
) {
  return function WithRequirements(props: P) {
    const [isLoading, setIsLoading] = useState(true);
    const [canRender, setCanRender] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
      let isMounted = true;

      const runChecks = async () => {
        for (const { check, redirect } of requirements) {
          const passed = await check();
          if (!passed) {
            if (isMounted) {
              navigate(redirect, { replace: true });
            }
            return;
          }
        }

        if (isMounted) {
          setCanRender(true);
          setIsLoading(false);
        }
      };

      runChecks();

      return () => {
        isMounted = false;
      };
    }, [navigate]);

    if (isLoading) {
      return (
        <div className="requirements-loader">
          <div className="requirements-spinner" />
        </div>
      );
    }

    return canRender ? <Component {...props} /> : null;
  };
}

export const userSignedInRequirement: Requirement = {
  check: async () => {
    if (!getAuthToken()) {
      return false;
    }
    try {
      await fetchMe();
      return true;
    } catch {
      clearAuthToken();
      return false;
    }
  },
  redirect: "/login",
};
