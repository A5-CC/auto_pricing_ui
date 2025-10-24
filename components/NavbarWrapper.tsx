"use client";

import { SiteNavbar } from "./site-navbar";
import { usePathname } from "next/navigation";

export default function NavbarWrapper() {
  const pathname = usePathname();

  // Hide navbar on login page
  if (pathname === "/login") return null;

  return <SiteNavbar />;
}
