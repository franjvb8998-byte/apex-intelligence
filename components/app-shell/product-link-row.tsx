import Link from "next/link";

export type ProductLink = {
  href: string;
  label: string;
};

export function ProductLinkRow({ links }: { links: ProductLink[] }) {
  if (links.length === 0) return null;
  return (
    <nav
      aria-label="Related"
      className="flex flex-wrap gap-x-4 gap-y-2 text-sm"
    >
      {links.map((link) => (
        <Link
          key={link.href + link.label}
          href={link.href}
          className="apex-focusable text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
