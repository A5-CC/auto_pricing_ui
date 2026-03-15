'use client';

import { PipelineBuilderChatbot } from '@/components/pipelines/pipeline-builder-chatbot';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch available columns from API if needed
    // For now, provide empty array - chatbot will work without it
    setAvailableColumns([]);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading chatbot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6 bg-background">
      <div className="w-full max-w-5xl">
        <PipelineBuilderChatbot
          availableColumns={availableColumns}
          mode="embedded"
        />
      </div>
    </div>
  );
}
