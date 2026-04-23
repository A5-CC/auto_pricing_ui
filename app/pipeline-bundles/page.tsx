"use client";

import { useState } from "react";

export default function PipelineBundlesPage() {
  // Placeholder for bundle selection logic
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-4 sm:space-y-5">
      <h1 className="text-2xl font-bold mb-6">Pipeline Bundles</h1>
      <div className="mb-8 text-muted-foreground">
        Create and manage bundles of pipelines. Select pipelines to combine as long as their filters do not conflict. Pipeline settings are only editable in the Pipelines tab.
      </div>
      {/* Bundle selection UI will go here */}
      <div className="rounded-xl border bg-background/50 p-6 text-center text-muted-foreground">
        Pipeline bundle selection and management UI coming soon...
      </div>
    </main>
  );
}
