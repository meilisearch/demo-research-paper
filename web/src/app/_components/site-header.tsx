"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useReadingList } from "./reading-list-store";

const NAV = [
  { href: "/", label: "Search" },
  { href: "/chat", label: "Ask the papers" },
];

const navLink =
  "relative flex h-full items-center text-sm text-muted-foreground transition-colors hover:text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent";

export function SiteHeader() {
  const pathname = usePathname();
  const count = useReadingList((s) => s.items.length);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-4">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="font-serif text-[22px] leading-none font-bold tracking-tight">
            Paperscope
          </span>
          <span className="hidden font-serif text-sm text-muted-foreground italic md:inline">
            AI research from arXiv, indexed by Meilisearch
          </span>
        </Link>
        <nav className="ml-auto flex h-full items-center gap-6">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(navLink, pathname === href && "text-foreground after:bg-arxiv")}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/chat?scope=list"
            className={cn(navLink, "gap-1.5")}
          >
            Reading list
            <span
              className={cn(
                "min-w-5 rounded-sm px-1 text-center text-xs font-medium tabular-nums",
                count > 0 ? "bg-arxiv text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
