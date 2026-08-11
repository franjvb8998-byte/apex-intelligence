import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#00D4AA] text-[#0B1220] shadow-lg shadow-[#00D4AA]/25 hover:bg-[#00eabb] hover:shadow-[#00D4AA]/40 disabled:opacity-50 disabled:shadow-none",
  secondary:
    "border border-slate-700 bg-slate-800/50 text-white backdrop-blur-sm hover:border-[#00D4AA]/50 hover:bg-slate-800 disabled:opacity-50",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  children,
  fullWidth = false,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex h-12 items-center justify-center rounded-xl px-8 text-base font-semibold transition-all ${variantStyles[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = {
  href: string;
  variant?: ButtonVariant;
  children: ReactNode;
  fullWidth?: boolean;
  className?: string;
};

export function ButtonLink({
  href,
  variant = "primary",
  children,
  fullWidth = false,
  className = "",
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex h-12 items-center justify-center rounded-xl px-8 text-base font-semibold transition-all ${variantStyles[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}
