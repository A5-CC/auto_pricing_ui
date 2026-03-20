'use client';

import { PipelineBuilderChatbot } from '@/components/pipelines/pipeline-builder-chatbot';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set available columns immediately
    setAvailableColumns([]);
  }, []);

  const handleChatbotReady = () => {
    // Chatbot is fully loaded with data
    setIsLoading(false);
  };

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading chatbot...</p>
          </div>
        </div>
      )}
      <PipelineBuilderChatbot
        availableColumns={availableColumns}
        mode="fullpage"
        onReady={handleChatbotReady}
      />
    </>
  );
}
