"use client";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";

export function AuthCard({ title, lead, children, footer }: { title: string; lead?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="type-display text-ink">{title}</h1>
      {lead && <p className="type-body text-muted mt-2 mb-6">{lead}</p>}
      {children}
      {footer && <div className="mt-6 border-t border-line-soft pt-4 type-body text-muted">{footer}</div>}
    </Card>
  );
}
