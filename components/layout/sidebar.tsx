'use client';

import { useAuth } from '@/components/AuthContext';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCode,
  FileText,
  Link as LinkIcon,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  PlayCircle,
  Settings,
  TrendingUp,
  Wrench,
  Zap
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
  collapsible?: boolean;
}

const MENU_SECTIONS: MenuSection[] = [
  {
    title: 'PRICING',
    collapsible: false,
    items: [
      { label: 'Chat Assistant', href: '/', icon: <MessageCircle className="h-4 w-4" /> },
      { label: 'Pipeline Bundles', href: '/pipeline-bundles', icon: <Zap className="h-4 w-4 rotate-45" /> },
      { label: 'Pipelines', href: '/pipelines', icon: <Zap className="h-4 w-4" /> },
      { label: 'Competitor Pricing', href: '/pricing', icon: <TrendingUp className="h-4 w-4" /> },
    ],
  },
  {
    title: 'DATA',
    collapsible: true,
    items: [
      { label: 'Raw Scrapes', href: '/raw-scrapes', icon: <FileText className="h-4 w-4" /> },
      { label: 'Scraping Runs', href: '/runs', icon: <PlayCircle className="h-4 w-4" /> },
      { label: 'URL Discovery', href: '/url-dumps', icon: <LinkIcon className="h-4 w-4" /> },
      { label: 'Schema', href: '/pricing-schemas', icon: <FileCode className="h-4 w-4" /> },
      { label: 'Locations', href: '/locations', icon: <MapPin className="h-4 w-4" /> },
    ],
  },
];

// Developer section - conditional
if (process.env.NODE_ENV === 'development') {
  MENU_SECTIONS.push({
    title: 'DEVELOPER',
    collapsible: true,
    items: [
      { label: 'Test Components', href: '/test-components', icon: <Wrench className="h-4 w-4" /> },
    ],
  });
}

function MenuSectionComponent({ section, isCollapsed }: { section: MenuSection; isCollapsed: boolean }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <div className="space-y-1">
      {!isCollapsed && (
        <>
          {section.collapsible ? (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-white/60 uppercase tracking-wider hover:text-white/80 transition-colors"
            >
              <span>{section.title}</span>
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <div className="px-3 py-2 text-xs font-semibold text-white/60 uppercase tracking-wider">
              {section.title}
            </div>
          )}
        </>
      )}
      
      {(!section.collapsible || isExpanded) && (
        <div className="space-y-0.5">
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                isActive(item.href)
                  ? 'bg-white/10 text-white font-medium shadow-sm'
                  : 'text-white/90 hover:bg-white/5 hover:text-white',
                isCollapsed && 'justify-center'
              )}
            >
              <span className={cn(
                isActive(item.href) ? 'text-white' : 'text-white/70'
              )}>
                {item.icon}
              </span>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  // const { isNightMode, toggleNightMode } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  const isSettingsActive = pathname.startsWith('/settings');

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className={cn(
      "h-screen bg-[#2D1B4E] text-white flex flex-col border-r border-white/10 transition-all duration-300",
      isCollapsed ? "w-16" : "w-60"
    )}>
      {/* Header with collapse button */}
      <div className={cn(
        "p-3 border-b border-white/10 flex items-center",
        isCollapsed ? "justify-center" : "justify-end"
      )}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <Menu className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Menu Sections */}
      <nav className="flex-1 px-3 py-6 space-y-6 overflow-y-auto">
        {MENU_SECTIONS.map((section) => (
          <MenuSectionComponent key={section.title} section={section} isCollapsed={isCollapsed} />
        ))}
      </nav>

      {/* Settings and Logout at Bottom (Night mode toggle removed) */}
      <div className="p-3 border-t border-white/10 space-y-1">
        <Link
          href="/settings"
          title={isCollapsed ? "Settings" : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
            isSettingsActive
              ? 'bg-white/10 text-white font-medium'
              : 'text-white/90 hover:bg-white/5 hover:text-white',
            isCollapsed && 'justify-center'
          )}
        >
          <Settings className="h-4 w-4" />
          {!isCollapsed && <span>Settings</span>}
        </Link>
        <button
          onClick={handleLogout}
          title={isCollapsed ? "Logout" : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all text-white/90 hover:bg-white/5 hover:text-white',
            isCollapsed && 'justify-center'
          )}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
