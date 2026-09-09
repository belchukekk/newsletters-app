"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Oversigt" },
  { href: "/admin/newsletters", label: "Nyhedsbreve" },
  { href: "/admin/users", label: "Brugere" },
  { href: "/admin/gdpr", label: "GDPR" },
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
