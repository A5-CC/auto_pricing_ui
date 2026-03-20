'use client';

import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function NavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Show loading indicator
    setLoading(true);

    // Hide after transition completes
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 flex flex-col items-center gap-4 min-w-[200px] border border-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-900">Loading page...</p>
          <p className="text-xs text-slate-500 mt-1">Please wait</p>
        </div>
      </div>
    </div>
  );
}
