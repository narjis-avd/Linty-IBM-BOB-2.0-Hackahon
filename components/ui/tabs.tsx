import { ReactNode } from "react";

export function Tabs({ children }: { children: ReactNode }) {
  return (
    <div role="tablist" className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0a0c0a] p-1">
      {children}
    </div>
  );
}

export function Tab({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-2 text-xs font-medium transition ${active ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
      role="tab"
      aria-selected={active}
    >
      {children}
    </button>
  );
}
