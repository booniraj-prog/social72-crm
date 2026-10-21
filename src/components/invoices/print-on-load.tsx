"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function PrintOnLoad() {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("autoprint") !== "1") return;
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [params]);
  return null;
}
