import Link from "next/link";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <span className="text-xl font-bold tracking-tight sm:text-2xl">
        <span className="text-[#00D4AA]">APEX</span>{" "}
        <span className="text-white">Intelligence</span>
      </span>
    </Link>
  );
}
