
export default function PipelineBundlesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineIds, setSelectedPipelineIds] = useState<string[]>([]);

  useEffect(() => {
    listPipelines().then(setPipelines);
  }, []);

  // Selected pipeline objects
  const selectedPipelines = useMemo(
    () => selectedPipelineIds.map((id) => pipelines.find((p) => p.id === id)).filter(Boolean) as Pipeline[],
    [selectedPipelineIds, pipelines]
  );

  // All pipelines not selected are eligible
  const eligiblePipelines = useMemo(
    () => pipelines.filter((p) => !selectedPipelineIds.includes(p.id)),
    [pipelines, selectedPipelineIds]
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-4 sm:space-y-5">
      <h1 className="text-2xl font-bold mb-6">Pipeline Bundles</h1>
      <div className="mb-8 text-muted-foreground">
        Create and manage bundles of pipelines. Select any pipelines to combine. Pipeline settings are only editable in the Pipelines tab.
      </div>
      <div className="mb-6">
        <label className="block mb-2 font-medium">Selected pipelines:</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedPipelines.length === 0 && <span className="text-muted-foreground">None selected</span>}
          {selectedPipelines.map((p) => (
            <span key={p.id} className="inline-flex items-center bg-primary/10 text-primary px-3 py-1 rounded-full">
              {p.name}
              <button
                className="ml-2 text-red-500 hover:text-red-700"
                onClick={() => setSelectedPipelineIds(ids => ids.filter(id => id !== p.id))}
                title="Remove pipeline"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="mb-6">
        <label className="block mb-2 font-medium">Available pipelines:</label>
        <div className="max-h-64 overflow-y-auto border rounded-lg bg-background/50 p-4">
          {eligiblePipelines.length > 0 ? (
            <ul className="space-y-2">
              {eligiblePipelines.map((p) => (
                <li
                  key={p.id}
                  className="py-1 px-2 rounded hover:bg-accent cursor-pointer"
                  onClick={() => setSelectedPipelineIds(ids => [...ids, p.id])}
                >
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-muted-foreground">No pipelines available.</div>
          )}
        </div>
      </div>
    </main>
  );
}
            <span key={p.id} className="inline-flex items-center bg-primary/10 text-primary px-3 py-1 rounded-full">
              {p.name}
              <button
                className="ml-2 text-red-500 hover:text-red-700"
                onClick={() => setSelectedPipelineIds(ids => ids.filter(id => id !== p.id))}
                title="Remove pipeline"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="mb-6">
        <label className="block mb-2 font-medium">Eligible pipelines to bundle:</label>
        <div className="max-h-64 overflow-y-auto border rounded-lg bg-background/50 p-4">
          {eligiblePipelines.length > 0 ? (
            <ul className="space-y-2">
              {eligiblePipelines.map((p) => (
                <li
                  key={p.id}
                  className="py-1 px-2 rounded hover:bg-accent cursor-pointer"
                  onClick={() => setSelectedPipelineIds(ids => [...ids, p.id])}
                >
                  {p.name}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-muted-foreground">No eligible pipelines available for bundling.</div>
          )}
        </div>
      </div>
    </main>
  );
}
