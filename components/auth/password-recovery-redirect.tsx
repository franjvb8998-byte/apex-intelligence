"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getPasswordRecoveryRedirectPath } from "@/lib/auth/password-recovery";

export function PasswordRecoveryRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    function redirectIfRecovery() {
      const redirectPath = getPasswordRecoveryRedirectPath({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });

      if (redirectPath) {
        window.location.replace(redirectPath);
      }
    }

    redirectIfRecovery();
    window.addEventListener("hashchange", redirectIfRecovery);
    return () => window.removeEventListener("hashchange", redirectIfRecovery);
  }, [pathname]);

  return null;
}
