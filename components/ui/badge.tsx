import { HTMLAttributes } from "react";

export function Badge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`rounded-full border border-lime-300/20 bg-lime-300/8 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-lime-200/80 ${className}`}
      {...props}
    />
  );
}
