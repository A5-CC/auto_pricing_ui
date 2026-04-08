"use client";

import { SavePipelineDialog } from "@/components/pipelines/save-pipeline-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPipeline,
  getAgentSession,
  getE1DataSummary,
  listPipelines,
  loadPipelineIntoSession,
  sendAgentMessage,
  type AgentChatResponse,
  type ConversationPhase,
  type E1DataSummary,
  type PipelineAction,
  type PipelineState,
} from "@/lib/api/client/pipelines";
import type { Pipeline, PipelineSettings } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Filter,
  FolderOpen,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

// Helper to generate stable message IDs
let messageIdCounter = 0;
const generateMessageId = (prefix: string) => `${prefix}-${++messageIdCounter}`;

// =============================================================================
// Types
// =============================================================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  actions?: PipelineAction[];
}

interface PipelineBuilderChatbotProps {
  availableColumns: string[];
  onPipelineUpdate?: (state: PipelineState) => void;
  onActionExecute?: (action: PipelineAction) => void;
  onReady?: () => void;
  className?: string;
  mode?: 'floating' | 'fullpage' | 'embedded';
}

const SAVE_DIALOG_DISABLED = true;

const LEGACY_TO_CANONICAL_FILTER_KEY: Record<string, string> = {
  competitors: "competitor_name",
  locations: "client_location",
  dimensions: "unit_dimensions",
  unit_categories: "unit_category",
};

// =============================================================================
// Phase Labels & Icons
// =============================================================================

const PHASE_CONFIG: Record<ConversationPhase, { label: string; icon: React.ReactNode; color: string }> = {
  welcome: { label: "Welcome", icon: <Sparkles className="h-4 w-4" />, color: "bg-blue-500" },
  scope_dimensions: { label: "Dimensions", icon: <Filter className="h-4 w-4" />, color: "bg-purple-500" },
  scope_values: { label: "Values", icon: <Settings2 className="h-4 w-4" />, color: "bg-indigo-500" },
  adjuster_type: { label: "Adjuster Type", icon: <Zap className="h-4 w-4" />, color: "bg-amber-500" },
  adjuster_config: { label: "Adjuster Config", icon: <Pencil className="h-4 w-4" />, color: "bg-orange-500" },
  review: { label: "Review", icon: <CheckCircle2 className="h-4 w-4" />, color: "bg-green-500" },
  complete: { label: "Complete", icon: <Check className="h-4 w-4" />, color: "bg-emerald-500" },
};

function normalizeConversationPhase(phase: string | ConversationPhase | null | undefined): ConversationPhase {
  const next = String(phase ?? "").toLowerCase();
  const allowed: ConversationPhase[] = [
    "welcome",
    "scope_dimensions",
    "scope_values",
    "adjuster_type",
    "adjuster_config",
    "review",
    "complete",
  ];
  if (allowed.includes(next as ConversationPhase)) {
    return next as ConversationPhase;
  }
  return "welcome";
}

// =============================================================================
// Main Component
// =============================================================================

export function PipelineBuilderChatbot({
  availableColumns,
  onPipelineUpdate,
  onActionExecute,
  onReady,
  className,
  mode = 'floating',
}: PipelineBuilderChatbotProps) {
  // Hydration safety - only render dynamic content after mount
  const [mounted, setMounted] = useState(false);
  const componentId = useId();

  // State
  const [isOpen, setIsOpen] = useState(mode === 'fullpage');
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<ConversationPhase>("welcome");
  const [pipelineState, setPipelineState] = useState<PipelineState | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [showPipelinePreview, setShowPipelinePreview] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePromptedSessionId, setSavePromptedSessionId] = useState<string | null>(null);

  const [loadedPipelineSettings, setLoadedPipelineSettings] = useState<PipelineSettings | null>(null);

  const openSaveDialog = useCallback(() => {
    if (SAVE_DIALOG_DISABLED) return;
    setShowSaveDialog(true);
  }, []);
  
  // Saved pipelines state
  const [savedPipelines, setSavedPipelines] = useState<Pipeline[]>([]);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  
  // E1 Data Summary state for interactive suggestions
  const [e1DataSummary, setE1DataSummary] = useState<E1DataSummary | null>(null);
  const [isLoadingE1Data, setIsLoadingE1Data] = useState(false);
  
  // Track if initialization has happened to prevent duplicate calls
  const hasInitialized = useRef(false);

  // Set mounted after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);
  
  // Notify parent of pipeline changes
  useEffect(() => {
    if (pipelineState && onPipelineUpdate) {
      onPipelineUpdate(pipelineState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineState]); // Intentionally omit onPipelineUpdate to prevent infinite loops

  // =============================================================================
  // API Interactions
  // =============================================================================

  // Save is only enabled when we have a session and at least one adjuster in
  // the current pipeline snapshot.
  const canSavePipeline = Boolean(sessionId && (pipelineState?.adjusters?.length ?? 0) > 0);

  const savePipelineToPipelinesStore = useCallback(async (state: PipelineState, name: string) => {
    const trimmedName = (name ?? "").trim();
    if (!trimmedName) {
      throw new Error("Pipeline name is required");
    }

    // Always fetch the latest session state from the server — the local
    // pipeline_state returned by chat responses may have empty adjusters even
    // when the agent has fully configured them server-side.
    let stateToSave = state;

    if (sessionId) {
      try {
        const latestSession = await getAgentSession(sessionId);
        if (latestSession?.pipeline) {
          stateToSave = latestSession.pipeline;
          console.log("[save] Using session state — adjusters:", stateToSave.adjusters?.length ?? 0);
        }
      } catch (error) {
        console.warn("Could not fetch latest session pipeline before save, using local state:", error);
      }
    }

    if ((stateToSave.adjusters?.length ?? 0) === 0) {
      throw new Error("Pipeline has no adjusters yet. Finish configuring at least one adjuster, then save again.");
    }

    const settingsUniversalFilters = (stateToSave.settings?.universal_filters ?? {}) as Record<string, string[]>;
    const canonicalFiltersFromLegacy = Object.fromEntries(
      Object.entries(stateToSave.filters ?? {}).flatMap(([key, values]) => {
        if (!Array.isArray(values) || values.length === 0) return [];
        const canonicalKey = LEGACY_TO_CANONICAL_FILTER_KEY[key] ?? key;
        return [[canonicalKey, values]];
      })
    ) as Record<string, string[]>;
    const canonicalFilters = {
      ...canonicalFiltersFromLegacy,
      ...settingsUniversalFilters,
    } as Record<string, string[]>;

    const explicitFilterModes = Object.fromEntries(
      (stateToSave.dimensions ?? [])
        .filter((d) => d?.enabled && d?.name)
        .map((d) => [
          LEGACY_TO_CANONICAL_FILTER_KEY[d.name] ?? d.name,
          d.mode === "combinatorial" ? "combinatoric" : "subset",
        ])
    ) as Record<string, "combinatoric" | "subset">;

    const settingsFilterModes = (stateToSave.settings?.filter_modes ?? {}) as Record<string, "combinatoric" | "subset">;
    const settingsCombinatoricFlags = (stateToSave.settings?.combinatoric_flags ?? {}) as Record<string, boolean>;
    const loadedFilterModes = (loadedPipelineSettings?.filter_modes ?? {}) as Record<string, "combinatoric" | "subset">;
    const loadedCombinatoricFlags = (loadedPipelineSettings?.combinatoric_flags ?? {}) as Record<string, boolean>;

    const activeFilterKeys = Object.keys(canonicalFilters);
    const filterModes = Object.fromEntries(
      activeFilterKeys.map((key) => {
        const settingsMode = settingsFilterModes[key];
        if (settingsMode) return [key, settingsMode];

        const explicitMode = explicitFilterModes[key];
        if (explicitMode) return [key, explicitMode];

        const loadedMode = loadedFilterModes[key];
        if (loadedMode) return [key, loadedMode];

        if (key in settingsCombinatoricFlags) {
          return [key, settingsCombinatoricFlags[key] ? "combinatoric" : "subset"];
        }

        if (key in loadedCombinatoricFlags) {
          return [key, loadedCombinatoricFlags[key] ? "combinatoric" : "subset"];
        }

        return [key, "subset"];
      })
    ) as Record<string, "combinatoric" | "subset">;

    const combinatoricFlags = Object.fromEntries(
      Object.entries(filterModes).map(([key, mode]) => [key, mode === "combinatoric"])
    ) as Record<string, boolean>;

    const normalizedAdjusters = (stateToSave.adjusters ?? []).map((adj) => {
      if (adj.type === "competitive") {
        return {
          type: "competitive" as const,
          price_columns: Array.isArray(adj.price_columns) && adj.price_columns.length > 0
            ? adj.price_columns
            : ["monthly_rate_online", "monthly_rate_regular", "monthly_rate_instore"],
          aggregation: adj.aggregation ?? "min",
          multiplier: typeof adj.multiplier === "number" ? adj.multiplier : 1,
        };
      }

      if (adj.type === "function") {
        return {
          type: "function" as const,
          variable: adj.variable ?? "available_units",
          function_string: adj.function_string ?? "1.0",
          domain_min: typeof adj.domain_min === "number" ? adj.domain_min : 0,
          domain_max: typeof adj.domain_max === "number" ? adj.domain_max : 100,
        };
      }

      return {
        type: "temporal" as const,
        granularity: adj.granularity ?? "weekly",
        multipliers: Array.isArray(adj.multipliers) && adj.multipliers.length > 0
          ? adj.multipliers
          : [1, 1, 1, 1, 1, 1, 1],
      };
    });

    const requestPayload = {
      name: trimmedName,
      // Backward compatibility: keep legacy keys for older readers.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filters: stateToSave.filters as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      adjusters: normalizedAdjusters as any,
      settings: {
        ...(Object.keys(canonicalFilters).length > 0 ? { universal_filters: canonicalFilters } : {}),
        ...(Object.keys(combinatoricFlags).length > 0 ? { combinatoric_flags: combinatoricFlags } : {}),
        ...(Object.keys(filterModes).length > 0 ? { filter_modes: filterModes } : {}),
      },
    };

    try {
      await createPipeline(requestPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const duplicateName = message.includes("already exists") || message.includes("duplicate") || message.includes("409");
      if (!duplicateName) throw error;

      const uniqueName = `${trimmedName} (${new Date().toISOString().slice(11, 19)})`;
      await createPipeline({ ...requestPayload, name: uniqueName });
      setPipelineName(uniqueName);
    }
  }, [loadedPipelineSettings, sessionId]);

  // Load saved pipelines list
  const refreshSavedPipelines = useCallback(async () => {
    setIsLoadingPipelines(true);
    try {
      const pipelines = await listPipelines();
      setSavedPipelines(pipelines);
    } catch (error) {
      console.error("Error loading pipelines:", error);
    } finally {
      setIsLoadingPipelines(false);
    }
  }, []);

  const handleAgentResponse = useCallback((response: AgentChatResponse) => {
    // Update session
    setSessionId(response.session_id);
    setCurrentPhase(normalizeConversationPhase(response.phase));
    setPipelineState(response.pipeline_state);

    // Add assistant message
    const assistantMessage: Message = {
      id: generateMessageId("assistant"),
      role: "assistant",
      content: response.message,
      timestamp: new Date(response.timestamp),
      suggestions: response.suggestions,
      actions: response.actions,
    };
    setMessages(prev => [...prev, assistantMessage]);

    // Execute actions
    if (response.actions && response.actions.length > 0) {
      response.actions.forEach(action => {
        if (onActionExecute) {
          onActionExecute(action);
        }
        // Handle special actions internally
        if (action.type === "show_preview") {
          setShowPipelinePreview(true);
        }

        if (action.type === "save_pipeline") {
          const actionName = typeof action.payload?.name === "string" ? action.payload.name.trim() : "";
          const derivedName = actionName || (response.pipeline_state?.name ?? "").trim() || `Pipeline ${new Date().toISOString().replace("T", " ").slice(0, 19)}`;

          setPipelineName(derivedName);

          void (async () => {
            setIsSaving(true);
            try {
              await savePipelineToPipelinesStore(response.pipeline_state, derivedName);
              toast.success("✅ Pipeline saved", {
                description: `"${derivedName}" is now available on the Pipelines page`
              });
              setCurrentPhase("complete");
              await refreshSavedPipelines();
            } catch (error) {
              console.error("Error auto-saving pipeline:", error);
              toast.error("Auto-save failed", {
                description: error instanceof Error ? error.message : "Unknown error"
              });
            } finally {
              setIsSaving(false);
            }
          })();
        }
      });
    }
  }, [onActionExecute, refreshSavedPipelines, savePipelineToPipelinesStore]);

  // Load E1 data summary
  const loadE1DataSummary = useCallback(async () => {
    if (e1DataSummary || isLoadingE1Data) return; // Already loaded or loading
    setIsLoadingE1Data(true);
    try {
      const summary = await getE1DataSummary();
      setE1DataSummary(summary);
      console.log("E1 Data Summary loaded:", summary);
    } catch (error) {
      console.error("Failed to load E1 data summary:", error);
    } finally {
      setIsLoadingE1Data(false);
    }
  }, [e1DataSummary, isLoadingE1Data]);

  const initializeConversation = useCallback(async () => {
    setIsTyping(true);
    try {
      const response = await sendAgentMessage(
        "Hello, I want to create a new pricing pipeline",
        undefined,
        { availableColumns }
      );
      
      handleAgentResponse(response);
    } catch (error) {
      console.error("Error initializing conversation:", error);
      // Add a fallback welcome message
      setMessages([{
        id: `${componentId}-welcome`,
        role: "assistant",
        content: "👋 Hello! I'm your pricing pipeline assistant. I can help you configure your pricing strategy step by step.\n\nWould you like to start creating a new pipeline?",
        timestamp: new Date(),
        suggestions: [
          "Yes, let's create a pipeline",
          "What options do I have?",
          "Explain the process"
        ]
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [availableColumns, componentId, handleAgentResponse]);

  const sendMessage = async (messageText: string | null | undefined) => {
    const cleanedMessage = (messageText ?? "").trim();
    if (!cleanedMessage) return;

    // Add user message
    const userMessage: Message = {
      id: generateMessageId("user"),
      role: "user",
      content: cleanedMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    const saveIntent = /\bsave\b/i.test(cleanedMessage);

    setIsTyping(true);

    try {
      // Include E1 data summary in context for interactive suggestions
      const context: Record<string, unknown> = { availableColumns };
      if (e1DataSummary) {
        context.e1DataSummary = e1DataSummary;
      }
      
      const response = await sendAgentMessage(
        cleanedMessage,
        sessionId || undefined,
        context
      );

      const responseTriggeredSave = response.actions?.some((action) => action.type === "save_pipeline") ?? false;
      handleAgentResponse(response);

      // If user asked to save but the agent didn't emit save action,
      // save the latest pipeline state returned by this response.
      if (saveIntent && !responseTriggeredSave) {
        const inferredName = (pipelineName ?? "").trim() || (response.pipeline_state?.name ?? "").trim() || `Pipeline ${new Date().toISOString().replace("T", " ").slice(0, 19)}`;
        setPipelineName(inferredName);
        setIsSaving(true);
        try {
          await savePipelineToPipelinesStore(response.pipeline_state, inferredName);
          toast.success("✅ Pipeline saved", {
            description: `"${inferredName}" is now available on the Pipelines page`
          });
          setCurrentPhase("complete");
          await refreshSavedPipelines();
        } catch (error) {
          console.error("Error saving pipeline from chat command:", error);
          toast.error("Error saving", {
            description: error instanceof Error ? error.message : "Unknown error"
          });
        } finally {
          setIsSaving(false);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Connection error", {
        description: "Could not send message. Please try again."
      });
      
      // Add error message
      setMessages(prev => [...prev, {
        id: generateMessageId("error"),
        role: "assistant",
        content: "❌ Sorry, there was an error processing your message. Can you try again?",
        timestamp: new Date(),
        suggestions: ["Retry", "Restart conversation"]
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSavePipeline = async (nameOverride?: string) => {
    const nameToUse = (nameOverride ?? pipelineName ?? "").trim();

    if (!pipelineState || !nameToUse) {
      toast.error("Name required", {
        description: "Please enter a name for the pipeline"
      });
      return;
    }

    setIsSaving(true);
    try {
      setPipelineName(nameToUse);
      await savePipelineToPipelinesStore(pipelineState, nameToUse);
      toast.success("✅ Pipeline saved", {
        description: `"${nameToUse}" is now available on the Pipelines page`
      });
      // Update phase to complete
      setCurrentPhase("complete");
      // Refresh saved pipelines list
      await refreshSavedPipelines();
      setShowSaveDialog(false);
    } catch (error) {
      console.error("Error saving pipeline:", error);
      toast.error("Error saving", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Initialize conversation when opened (floating mode) or when component mounts (fullpage mode)
  useEffect(() => {
    // For fullpage mode, initialize only once when mounted
    if (mode === 'fullpage' && mounted && !hasInitialized.current) {
      hasInitialized.current = true;
      
      (async () => {
        try {
          await Promise.all([
            loadE1DataSummary(),
            refreshSavedPipelines(),
          ]);
          await initializeConversation();
        } catch (error) {
          console.error("Failed to initialize chatbot:", error);
        }
      })();
    }
    
    // For floating mode, initialize when opened (only if no messages exist)
    if (mode !== 'fullpage' && isOpen && messages.length === 0 && !isTyping) {
      (async () => {
        try {
          await Promise.all([
            loadE1DataSummary(),
            refreshSavedPipelines(),
          ]);
          await initializeConversation();
        } catch (error) {
          console.error("Failed to initialize chatbot:", error);
        }
      })();
    }
  }, [
    mode,
    mounted,
    isOpen,
    messages.length,
    isTyping,
    loadE1DataSummary,
    refreshSavedPipelines,
    initializeConversation,
  ]);

  // Notify parent when ready (E1 data loaded and conversation initialized)
  useEffect(() => {
    if (mode === 'fullpage' && e1DataSummary && messages.length > 0 && onReady) {
      onReady();
    }
  }, [mode, e1DataSummary, messages.length, onReady]);

  // Auto-open save dialog once per session when pipeline becomes savable.
  // Uses backend-confirmed session state to avoid showing save for empty drafts.
  useEffect(() => {
    if (SAVE_DIALOG_DISABLED) return;
    const triggerPhases: ConversationPhase[] = ["review", "complete"];
    if (!triggerPhases.includes(currentPhase)) return;
    if (!sessionId) return;
    if (savePromptedSessionId === sessionId) return;

    void (async () => {
      try {
        const latest = await getAgentSession(sessionId);
        const latestPipeline = latest?.pipeline ?? null;
        if (!latestPipeline) return;

        // Keep local preview in sync with what will actually be saved.
        setPipelineState(latestPipeline);

        if ((latestPipeline.adjusters?.length ?? 0) === 0) {
          return;
        }

        if (!(pipelineName ?? "").trim()) {
          setPipelineName((latestPipeline.name ?? "").trim() || `Pipeline ${new Date().toISOString().replace("T", " ").slice(0, 19)}`);
        }

        openSaveDialog();
        setSavePromptedSessionId(sessionId);
      } catch (error) {
        console.warn("Could not confirm session pipeline before showing save dialog:", error);
      }
    })();
  }, [currentPhase, openSaveDialog, pipelineName, savePromptedSessionId, sessionId]);

  // Load a specific pipeline into the session
  const handleLoadPipeline = async (pipelineId: string) => {
    if (!pipelineId) {
      toast.error("Select a pipeline", {
        description: "Please select a pipeline to load"
      });
      return;
    }

    setIsTyping(true);
    setShowLoadDialog(false);
    // Allow save prompt to re-open for loaded pipelines, even when backend
    // keeps the same session_id.
    setSavePromptedSessionId(null);
    
    try {
      const loadedPipeline = savedPipelines.find((pipeline: Pipeline) => pipeline.id === pipelineId) ?? null;
      setLoadedPipelineSettings(loadedPipeline?.settings ?? null);
      const response = await loadPipelineIntoSession(pipelineId, sessionId || undefined);
      handleAgentResponse(response);
      setSelectedPipelineId("");
      toast.success("Pipeline loaded", {
        description: `Loaded "${response.pipeline_state.name || 'pipeline'}"`
      });
    } catch (error) {
      console.error("Error loading pipeline:", error);
      toast.error("Error loading pipeline", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsTyping(false);
    }
  };

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // const handleSuggestionClick = (suggestion: string) => {
  //   sendMessage(suggestion);
  // };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setSessionId(null);
    setCurrentPhase("welcome");
    setPipelineState(null);
    setPipelineName("");
    setLoadedPipelineSettings(null);
    setShowPipelinePreview(false);
    setShowSaveDialog(false);
    setSavePromptedSessionId(null);
    initializeConversation();
  };

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const renderPhaseIndicator = () => {
    const phaseConfig = PHASE_CONFIG[currentPhase];
    return (
      <div className="flex items-center gap-2">
        <div className={cn("p-1 rounded-full text-white", phaseConfig.color)}>
          {phaseConfig.icon}
        </div>
        <span className="text-sm font-medium">{phaseConfig.label}</span>
      </div>
    );
  };

  const renderPipelinePreview = () => {
    if (!pipelineState) return null;

    const hasFilters = pipelineState.filters && (
      pipelineState.filters.competitors?.length > 0 ||
      pipelineState.filters.locations?.length > 0 ||
      pipelineState.filters.dimensions?.length > 0 ||
      pipelineState.filters.unit_categories?.length > 0
    );

    return (
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Pipeline Preview</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPipelinePreview(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Name */}
        {pipelineState.name && (
          <div className="text-sm">
            <span className="text-slate-500">Name:</span>{" "}
            <span className="font-medium">{pipelineState.name}</span>
          </div>
        )}
        
        <hr className="my-2 border-slate-200" />
        
        {/* Filters */}
        <div>
          <span className="text-xs text-slate-500 uppercase">Filters</span>
          {hasFilters ? (
            <ul className="mt-1 space-y-1">
              {pipelineState.filters?.competitors?.length > 0 && (
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Competitors</Badge>
                  <span className="text-slate-600 text-xs">
                    {pipelineState.filters.competitors.slice(0, 3).join(", ")}
                    {pipelineState.filters.competitors.length > 3 && ` +${pipelineState.filters.competitors.length - 3} more`}
                  </span>
                </li>
              )}
              {pipelineState.filters?.locations?.length > 0 && (
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Locations</Badge>
                  <span className="text-slate-600 text-xs">
                    {pipelineState.filters.locations.slice(0, 3).join(", ")}
                    {pipelineState.filters.locations.length > 3 && ` +${pipelineState.filters.locations.length - 3} more`}
                  </span>
                </li>
              )}
              {pipelineState.filters?.dimensions?.length > 0 && (
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Dimensions</Badge>
                  <span className="text-slate-600 text-xs">
                    {pipelineState.filters.dimensions.slice(0, 3).join(", ")}
                    {pipelineState.filters.dimensions.length > 3 && ` +${pipelineState.filters.dimensions.length - 3} more`}
                  </span>
                </li>
              )}
              {pipelineState.filters?.unit_categories?.length > 0 && (
                <li className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Categories</Badge>
                  <span className="text-slate-600 text-xs">
                    {pipelineState.filters.unit_categories.slice(0, 3).join(", ")}
                    {pipelineState.filters.unit_categories.length > 3 && ` +${pipelineState.filters.unit_categories.length - 3} more`}
                  </span>
                </li>
              )}
            </ul>
          ) : (
            <p className="text-slate-400 italic text-xs">No filters (all data)</p>
          )}
        </div>

        {/* Adjusters */}
        <div>
          <span className="text-xs text-slate-500 uppercase">Adjusters</span>
          {pipelineState.adjusters.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {pipelineState.adjusters.map((adj, i) => (
                <li key={i} className="flex items-center gap-2 flex-wrap">
                  <Badge className="text-xs capitalize" variant={adj.type === "competitive" ? "default" : "secondary"}>
                    {i + 1}. {adj.type}
                  </Badge>
                  {adj.type === "competitive" && (
                    <span className="text-xs text-slate-500">
                      {adj.aggregation} × {adj.multiplier}
                    </span>
                  )}
                  {adj.type === "temporal" && (
                    <span className="text-xs text-slate-500">
                      {adj.granularity} ({adj.multipliers?.length || 0} values)
                    </span>
                  )}
                  {adj.type === "function" && (
                    <span className="text-xs text-slate-500 font-mono">
                      {adj.variable}: {adj.function_string?.substring(0, 20)}...
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 italic text-xs">No adjusters configured</p>
          )}
        </div>

        {/* Validation */}
        {pipelineState.validation_errors.length > 0 && (
          <div className="p-2 bg-amber-50 rounded border border-amber-200">
            <span className="text-xs text-amber-700 font-medium">⚠️ Warnings:</span>
            <ul className="mt-1 text-xs text-amber-600">
              {pipelineState.validation_errors.map((err, i) => (
                <li key={i}>• {err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === "user";
    
    return (
      <div
        key={message.id}
        className={cn(
          "flex gap-3 animate-fade-in",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {!isUser && (
          <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
        )}
        
        <div
          className={cn(
            "max-w-[80%] rounded-2xl px-5 py-3.5",
            isUser
              ? "bg-gradient-to-br from-primary to-primary/90 text-white shadow-lg shadow-primary/25"
              : "bg-white border border-slate-200/80 shadow-md hover:shadow-lg transition-shadow"
          )}
        >
          <div className={cn(
            "text-[15px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
            isUser ? "text-white" : "text-slate-800"
          )}>
            {message.content}
          </div>
        </div>
        
        {isUser && (
          <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg flex items-center justify-center">
            <span className="text-sm font-semibold text-white">You</span>
          </div>
        )}
      </div>
    );
  };

  // =============================================================================
  // Main Render
  // =============================================================================

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  // Embedded mode - chatbot embedded in homepage
  if (mode === 'embedded') {
    return (
      <div className="w-full h-[700px] flex flex-col bg-white">
        {!SAVE_DIALOG_DISABLED && (
          <SavePipelineDialog
            open={showSaveDialog}
            onOpenChange={setShowSaveDialog}
            onSave={async (name: string) => {
              setPipelineName(name);
              await handleSavePipeline(name);
            }}
            defaultName={pipelineName}
          />
        )}

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200/80 bg-white/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg shadow-primary/20">
                <MessageCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  AI Pricing Assistant
                </h2>
                <p className="text-sm text-slate-600 mt-0.5 font-medium">
                  {e1DataSummary 
                    ? `${e1DataSummary.competitors.length} competitors • ${e1DataSummary.locations.length} locations • ${e1DataSummary.total_rows.toLocaleString()} rows`
                    : isLoadingE1Data 
                      ? "Loading data..."
                      : "Ask questions or request pipeline configurations"
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {e1DataSummary && (
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-lg px-3 py-1.5 text-xs font-semibold border border-green-200/50 shadow-sm">
                  <Database className="h-3.5 w-3.5" />
                  <span>Live</span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLoadDialog(!showLoadDialog)}
                className="text-xs font-medium border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                Load
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetConversation}
                className="text-xs font-medium border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Reset
              </Button>
            </div>
          </div>
          
          {/* Phase Indicator */}
          {currentPhase !== "welcome" && (
            <div className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl px-4 py-2 border border-slate-200/80 shadow-sm">
              {renderPhaseIndicator()}
            </div>
          )}
        </div>

        {/* Load Pipeline Dialog */}
        {showLoadDialog && (
          <div className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-slate-100/50 shadow-inner">
            <div className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Load Saved Pipeline
            </div>
            <div className="flex gap-3">
              <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                <SelectTrigger className="flex-1 h-10 text-sm border-2 border-slate-200 rounded-xl bg-white shadow-sm hover:border-slate-300 transition-all">
                  <SelectValue placeholder={isLoadingPipelines ? "Loading..." : "Select a pipeline"} />
                </SelectTrigger>
                <SelectContent>
                  {savedPipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name || `Pipeline ${pipeline.id.substring(0, 8)}`}
                    </SelectItem>
                  ))}
                  {savedPipelines.length === 0 && !isLoadingPipelines && (
                    <SelectItem value="_none" disabled>No saved pipelines</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => refreshSavedPipelines()}
                variant="outline"
                disabled={isLoadingPipelines}
                className="h-10 px-4 border-2 border-slate-200 hover:border-slate-300 rounded-xl transition-all"
              >
                {isLoadingPipelines ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                onClick={() => handleLoadPipeline(selectedPipelineId)}
                disabled={!selectedPipelineId || isTyping}
                className="h-10 px-5 bg-gradient-to-r from-primary to-primary/90 text-white shadow-md rounded-xl font-medium hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                <FolderOpen className="h-4 w-4 mr-1.5" />
                Load
              </Button>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 min-h-0 overflow-hidden bg-white">
          <div className="flex-1 min-h-0 pt-8 px-6 pb-6 overflow-y-auto scroll-pb-32">
            <div className="max-w-4xl mx-auto space-y-5">
              {messages.map(renderMessage)}
              
              {isTyping && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl px-5 py-3 shadow-md">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} className="h-24 shrink-0" />
            </div>
          </div>

          {/* Pipeline Preview */}
          {showPipelinePreview && (
            <div className="px-6 pb-4 border-t">
              {renderPipelinePreview()}
            </div>
          )}
        </div>

        {/* Save Pipeline Section */}
        {!SAVE_DIALOG_DISABLED && (currentPhase === "review" || currentPhase === "complete") && pipelineState && (
          <div className="px-6 py-4 border-t bg-gradient-to-r from-green-50 to-emerald-50 flex-shrink-0 shadow-inner">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
              <p className="text-sm text-emerald-900/80">Pipeline is ready to save.</p>
              <Button
                onClick={openSaveDialog}
                disabled={isSaving || !canSavePipeline}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-11 px-6 rounded-xl shadow-lg shadow-green-600/25 font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                size="sm"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Name & Save
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-6 py-5 border-t bg-white/90 backdrop-blur-sm flex-shrink-0 shadow-2xl">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message or ask for help..."
                  disabled={isTyping}
                  className="flex-1 h-12 pl-4 pr-4 text-[15px] border-2 border-slate-200 focus:border-primary rounded-xl shadow-sm transition-all hover:border-slate-300 disabled:opacity-50"
                />
              </div>
              <Button
                type="submit"
                disabled={isTyping || !(inputValue ?? "").trim()}
                className="h-12 px-6 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg shadow-primary/25 rounded-xl font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isTyping ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </form>
            
            {/* Quick Actions */}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-medium transition-all"
                onClick={() => sendMessage("Show current state")}
              >
                <Sparkles className="h-3 w-3 mr-1.5" />
                Current State
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-medium transition-all"
                onClick={() => sendMessage("Help")}
              >
                Help
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fullpage mode - chatbot as primary interface
  if (mode === 'fullpage') {
    return (
      <div className="flex flex-col h-[calc(100dvh-4rem)] bg-white">
        {!SAVE_DIALOG_DISABLED && (
          <SavePipelineDialog
            open={showSaveDialog}
            onOpenChange={setShowSaveDialog}
            onSave={async (name: string) => {
              setPipelineName(name);
              await handleSavePipeline(name);
            }}
            defaultName={pipelineName}
          />
        )}

        <div className="flex-1 min-h-0 flex flex-col max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200/80 bg-white/80 backdrop-blur-sm flex-shrink-0 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg shadow-primary/20">
                  <MessageCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    AI Pricing Assistant
                  </h1>
                  <p className="text-sm text-slate-600 font-medium mt-0.5">
                    {e1DataSummary 
                      ? `${e1DataSummary.competitors.length} competitors • ${e1DataSummary.locations.length} locations • ${e1DataSummary.total_rows.toLocaleString()} rows`
                      : isLoadingE1Data 
                        ? "Loading data..."
                        : "Ready to help you configure pricing pipelines"
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {e1DataSummary && (
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-lg px-3 py-1.5 text-xs font-semibold border border-green-200/50 shadow-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    Connected
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLoadDialog(!showLoadDialog)}
                  className="gap-2 text-xs font-medium border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all"
                >
                  <FolderOpen className="h-4 w-4" />
                  Load
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetConversation}
                  className="gap-2 text-xs font-medium border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
            
            {/* Phase Indicator */}
            {currentPhase !== "welcome" && (
              <div className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl px-4 py-2 border border-slate-200/80 shadow-sm">
                {renderPhaseIndicator()}
              </div>
            )}
          </div>

          {/* Load Pipeline Dialog */}
          {showLoadDialog && (
            <div className="px-6 py-3 border-b bg-muted/50 flex-shrink-0">
              <div className="text-sm font-medium text-foreground mb-2">Load Saved Pipeline</div>
              <div className="flex gap-2">
                <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={isLoadingPipelines ? "Loading..." : "Select a pipeline"} />
                  </SelectTrigger>
                  <SelectContent>
                    {savedPipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name || `Pipeline ${pipeline.id.substring(0, 8)}`}
                      </SelectItem>
                    ))}
                    {savedPipelines.length === 0 && !isLoadingPipelines && (
                      <SelectItem value="_none" disabled>No saved pipelines</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => refreshSavedPipelines()}
                  variant="outline"
                  disabled={isLoadingPipelines}
                >
                  {isLoadingPipelines ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleLoadPipeline(selectedPipelineId)}
                  disabled={!selectedPipelineId || isTyping}
                >
                  Load
                </Button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0 pt-12 px-8 pb-8 overflow-y-auto bg-white scroll-pb-32">
              <div className="max-w-4xl mx-auto space-y-5">
                {messages.map(renderMessage)}
                
                {isTyping && (
                  <div className="flex gap-3 animate-fade-in">
                    <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-2xl px-5 py-3 shadow-md">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} className="h-24 shrink-0" />
              </div>
            </div>

            {/* Pipeline Preview */}
            {showPipelinePreview && (
              <div className="px-6 pb-4 border-t bg-card">
                {renderPipelinePreview()}
              </div>
            )}
          </div>

          {/* Save Pipeline Section */}
          {!SAVE_DIALOG_DISABLED && (currentPhase === "review" || currentPhase === "complete") && pipelineState && (
            <div className="px-6 py-4 border-t bg-gradient-to-r from-green-50 to-emerald-50 flex-shrink-0 shadow-inner">
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                <p className="text-sm text-emerald-900/80">Pipeline is ready to save.</p>
                <Button
                  onClick={openSaveDialog}
                  disabled={isSaving || !canSavePipeline}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-11 px-6 rounded-xl shadow-lg shadow-green-600/25 font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  size="sm"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />Name & Save</>}
                </Button>
              </div>
            </div>
          )}

          {/* Input Area - Sticky Bottom */}
          <div className="px-6 py-5 border-t bg-white/90 backdrop-blur-sm flex-shrink-0 shadow-2xl">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message or ask for help..."
                    disabled={isTyping}
                    className="flex-1 h-12 pl-4 pr-4 text-[15px] border-2 border-slate-200 focus:border-primary rounded-xl shadow-sm transition-all hover:border-slate-300 disabled:opacity-50"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isTyping || !(inputValue ?? "").trim()}
                  className="h-12 px-6 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg shadow-primary/25 rounded-xl font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isTyping ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Send</>}
                </Button>
              </form>
              
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-medium transition-all"
                  onClick={() => sendMessage("Show current state")}
                >
                  <Sparkles className="h-3 w-3 mr-1.5" />
                  Current State
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-medium transition-all"
                  onClick={() => sendMessage("Help")}
                >
                  Help
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Floating mode - widget on pipelines page
  return (
    <>
      {!SAVE_DIALOG_DISABLED && (
        <SavePipelineDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          onSave={async (name: string) => {
            setPipelineName(name);
            await handleSavePipeline(name);
          }}
          defaultName={pipelineName}
        />
      )}

      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110",
          "z-50"
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <Card
          className={cn(
            "fixed bottom-24 right-6 w-[460px] shadow-2xl border z-50 flex flex-col",
            "animate-in slide-in-from-bottom-5 fade-in duration-300",
            isMinimized ? "h-auto" : "h-[72vh] min-h-[620px] max-h-[860px]",
            className
          )}
        >
          {/* Header */}
          <CardHeader className="p-4 border-b bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base text-foreground">
                    Pipeline Assistant
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {e1DataSummary 
                      ? `${e1DataSummary.competitors.length} competitors • ${e1DataSummary.locations.length} locations`
                      : isLoadingE1Data 
                        ? "Loading data..."
                        : "Ready to help"
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Data Status Indicator */}
                {e1DataSummary && (
                  <Badge variant="outline" className="gap-1.5 mr-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    Connected
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  {isMinimized ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* Phase Indicator */}
            {!isMinimized && (
              <div className="mt-3 flex items-center justify-between">
                <div className="bg-muted rounded-lg px-3 py-1">
                  {renderPhaseIndicator()}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowLoadDialog(!showLoadDialog)}
                    title="Load saved pipeline"
                  >
                    <FolderOpen className="h-3 w-3 mr-1" />
                    Load
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={resetConversation}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>

          {/* Load Pipeline Dialog */}
          {showLoadDialog && !isMinimized && (
            <div className="px-4 py-3 border-b bg-muted/50">
              <div className="text-sm font-medium text-slate-700 mb-2">Load Saved Pipeline</div>
              <div className="flex gap-2">
                <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={isLoadingPipelines ? "Loading..." : "Select a pipeline"} />
                  </SelectTrigger>
                  <SelectContent>
                    {savedPipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        {pipeline.name || `Pipeline ${pipeline.id.substring(0, 8)}`}
                      </SelectItem>
                    ))}
                    {savedPipelines.length === 0 && !isLoadingPipelines && (
                      <SelectItem value="_none" disabled>No saved pipelines</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => refreshSavedPipelines()}
                  variant="outline"
                  disabled={isLoadingPipelines}
                >
                  {isLoadingPipelines ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleLoadPipeline(selectedPipelineId)}
                  disabled={!selectedPipelineId || isTyping}
                >
                  Load
                </Button>
              </div>
            </div>
          )}

          {!isMinimized && (
            <>
              {/* Messages Area */}
              <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 min-h-0 p-4 overflow-y-auto bg-muted/30 scroll-pb-28">
                  <div className="space-y-4">
                    {messages.map(renderMessage)}
                    
                    {/* Typing indicator */}
                    {isTyping && (
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                        <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-sm">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} className="h-20 shrink-0" />
                  </div>
                </div>

                {/* Pipeline Preview */}
                {showPipelinePreview && (
                  <div className="px-4 pb-2 border-t bg-card">
                    {renderPipelinePreview()}
                  </div>
                )}
              </CardContent>

              {/* Save Pipeline Section (shown in review/complete phase) */}
              {!SAVE_DIALOG_DISABLED && (currentPhase === "review" || currentPhase === "complete") && pipelineState && (
                <div className="px-4 py-3 border-t bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Pipeline is ready to save.</p>
                    <Button
                      onClick={openSaveDialog}
                      disabled={isSaving || !canSavePipeline}
                      className="gap-2"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Name & Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className="p-4 border-t bg-card">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your message..."
                    disabled={isTyping}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={isTyping || !(inputValue ?? "").trim()}
                  >
                    {isTyping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><Send className="h-4 w-4 mr-2" />Send</>
                    )}
                  </Button>
                </form>
                
                {/* Quick Actions */}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs hover:bg-muted"
                    onClick={() => sendMessage("Show current state")}
                  >
                    Current state
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs hover:bg-muted"
                    onClick={() => sendMessage("Help")}
                  >
                    Help
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}

export default PipelineBuilderChatbot;
