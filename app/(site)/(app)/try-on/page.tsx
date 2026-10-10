"use client";

import { Suspense } from "react";
import { RequireAuth } from "@/components/app-shell";
import { FittingRoom } from "@/components/try-on/fitting-room";

/** RF18 route: authentication and the boundary required by useSearchParams. */
export default function TryOnPage() {
  return (
    <RequireAuth>
      <Suspense>
        <FittingRoom />
      </Suspense>
    </RequireAuth>
  );
}
