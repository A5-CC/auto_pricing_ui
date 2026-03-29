'use client';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  Activity,
  FileCode,
  FileText,
  Link as LinkIcon,
  MapPin,
  Menu,
  PlayCircle,
  Settings,
  TrendingUp,
  Wrench,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface MenuDrawerProps {
  children?: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Pipelines', href: '/pipelines', icon: <Zap className="h-4 w-4" /> },
      { label: 'Competitor Pricing', href: '/pricing', icon: <TrendingUp className="h-4 w-4" /> },
    ],
  },
  {
    title: 'Data',
    items: [
      { label: 'Raw Scrapes', href: '/raw-scrapes', icon: <FileText className="h-4 w-4" /> },
      { label: 'Scraping Runs', href: '/runs', icon: <PlayCircle className="h-4 w-4" /> },
      { label: 'URL Discovery', href: '/url-dumps', icon: <LinkIcon className="h-4 w-4" /> },
      { label: 'Schema', href: '/pricing-schemas', icon: <FileCode className="h-4 w-4" /> },
      { label: 'Locations', href: '/locations', icon: <MapPin className="h-4 w-4" /> },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Appearance', href: '/settings/appearance', icon: <Settings className="h-4 w-4" /> },
      { label: 'System Status', href: '/settings/system-status', icon: <Activity className="h-4 w-4" /> },
    ],
  },
];

if (process.env.NODE_ENV === 'development') {
  NAV_SECTIONS.push({
    title: 'Developer',
    items: [
      { label: 'Test Components', href: '/test-components', icon: <Wrench className="h-4 w-4" /> },
    ],
  });
}

export function MenuDrawer({ children }: MenuDrawerProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className="hover:bg-accent">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Navigate to different sections of the application</SheetDescription>
        </SheetHeader>

        <nav className="mt-8 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive(item.href)
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
