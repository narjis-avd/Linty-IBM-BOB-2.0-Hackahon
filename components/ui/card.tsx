import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#101310]/90 shadow-[0_24px_80px_rgba(0,0,0,0.24)] ${className}`}
      {...props}
    />
  );
}
