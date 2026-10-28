"use client";

import { useEffect } from "react";

export default function SessionRedirect() {
  useEffect(() => {
    const redirect = () => {
      // A full navigation clears the cached protected route tree.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    };
    window.addEventListener("crm:session-expired", redirect);
    return () => window.removeEventListener("crm:session-expired", redirect);
  }, []);
  return null;
}
