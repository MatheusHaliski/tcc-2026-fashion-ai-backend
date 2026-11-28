import type { ComponentPropsWithRef, ReactNode } from "react";

type PieceCardFrameProps = ComponentPropsWithRef<"article"> & {
  layers?: ReactNode;
};

export function PieceCardFrame({ layers, className, children, ...article }: PieceCardFrameProps) {
  return (
    <article {...article} className={`fai-card piece-card ${className ?? ""}`}>
      {layers}
      <div className="pc-frame"><div className="pc-content">{children}</div></div>
    </article>
  );
}
