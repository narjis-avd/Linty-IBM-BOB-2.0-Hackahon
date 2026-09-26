import { ButtonHTMLAttributes, forwardRef } from "react";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function Button({ className = "", ...props }, ref) {
    return (
      <button
        ref={ref}
        className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-lime-300 px-5 text-sm font-semibold text-[#10140d] transition hover:bg-lime-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  },
);
