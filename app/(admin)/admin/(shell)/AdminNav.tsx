"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Oversigt" },
  { href: "/admin/homepage", label: "Forside" },
  { href: "/admin/newsletters", label: "Nyhedsbrevskatalog" },
  { href: "/admin/users", label: "Brugere" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-sidebar__nav">
      {LINKS.map((link) => {
        const isActive =
          link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} aria-current={isActive ? "page" : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
