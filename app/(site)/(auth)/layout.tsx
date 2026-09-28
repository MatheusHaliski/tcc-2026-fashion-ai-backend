import Link from "next/link";
import type { ReactNode } from "react";

/** Telas de conta (RF1/RF2): coluna central, logotipo e link de volta ao feed público. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-8">
        <Link href="/feed" className="flex items-center gap-2" aria-label="Fashion AI">
          <img src="/brand/fai-logo.png" alt="" width={34} height={34} />
          <span className="type-h2">Fashion AI</span>
        </Link>
      </header>
      <main id="conteudo" className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:pt-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
