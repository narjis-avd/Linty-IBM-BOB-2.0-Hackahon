import { InputHTMLAttributes, forwardRef } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`h-12 min-w-0 flex-1 rounded-lg border border-white/12 bg-[#0a0c0a] px-4 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-300/70 focus:ring-2 focus:ring-lime-300/15 ${className}`}
        {...props}
      />
    );
  },
);
