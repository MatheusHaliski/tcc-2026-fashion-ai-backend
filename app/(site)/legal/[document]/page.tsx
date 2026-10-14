import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalMarkdown } from "@/lib/legal/markdown";

const documents = {
  terms: "TERMOS_DE_USO_v1.md",
  privacy: "POLITICA_DE_PRIVACIDADE_v1.md",
} as const;

type DocumentSlug = keyof typeof documents;

export function generateStaticParams() {
  return Object.keys(documents).map((document) => ({ document }));
}

export const dynamicParams = false;

export default async function LegalDocumentPage({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  if (!Object.hasOwn(documents, document)) notFound();
  const filename = documents[document as DocumentSlug];
  const markdown = await readFile(path.join(process.cwd(), "docs", "legal", filename), "utf8");

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-4">
        <Link className="font-semibold text-ink underline" href="/register">Voltar ao cadastro</Link>
      </div>
      <div className="rounded-xl border border-line-soft bg-surface p-5 sm:p-8">
        <LegalMarkdown markdown={markdown} />
      </div>
    </main>
  );
}
