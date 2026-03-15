'use client';

import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function NavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }

    // Show loading indicator briefly
    setLoading(true);

    // Hide after a short delay to ensure smooth transitions
    const id = setTimeout(() => {
      setLoading(false);
    }, 300);

    setTimeoutId(id);

    return () => {
      if (id) clearTimeout(id);
    };
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      {/* Progress bar */}
      <div className="h-1 bg-primary animate-pulse">
        <div className="h-full bg-primary/50 animate-[shimmer_1s_infinite]" />
      </div>
      
      {/* Spinner overlay */}
      <div className="fixed inset-0 bg-background/30 backdrop-blur-[2px] flex items-center justify-center">
        <div className="bg-background/90 rounded-lg shadow-lg p-4 flex items-center gap-3 border">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium">Loading...</span>
        </div>
      </div>
    </div>
  );
}
