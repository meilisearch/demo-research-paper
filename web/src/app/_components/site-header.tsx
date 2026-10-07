"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useReadingList } from "./reading-list-store";

// `short` replaces the label on phones so the header stays on one line.
const NAV = [
  { href: "/", label: "Search", short: "Search" },
  { href: "/chat", label: "Ask the papers", short: "Ask" },
];

const navLink =
  "relative flex h-full items-center whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent";

export function SiteHeader() {
  const pathname = usePathname();
  const count = useReadingList((s) => s.items.length);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:gap-8">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="font-serif text-[22px] leading-none font-bold tracking-tight">
            Paperscope
          </span>
          <span className="hidden font-serif text-sm text-muted-foreground italic md:inline">
            AI research from arXiv, indexed by Meilisearch
          </span>
        </Link>
        <nav className="ml-auto flex h-full items-center gap-4 sm:gap-6">
          {NAV.map(({ href, label, short }) => (
            <Link
              key={href}
              href={href}
              className={cn(navLink, pathname === href && "text-foreground after:bg-arxiv")}
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </Link>
          ))}
          <Link
            href="/chat?scope=list"
            className={cn(navLink, "gap-1.5")}
          >
            <span className="hidden sm:inline">Reading list</span>
            <span className="sm:hidden">List</span>
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
