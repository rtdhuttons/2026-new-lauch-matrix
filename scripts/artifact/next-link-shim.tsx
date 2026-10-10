// next/link for the single-page build: a plain link (there is no Next.js
// router in a standalone page).
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname?: string }; children?: ReactNode; prefetch?: boolean };

export default function Link({ href, children, prefetch, ...rest }: Props) {
  void prefetch;
  return (
    <a href={typeof href === "string" ? href : (href.pathname ?? "#")} {...rest}>
      {children}
    </a>
  );
}
