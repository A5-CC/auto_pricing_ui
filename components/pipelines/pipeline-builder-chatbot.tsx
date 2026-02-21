"use client";

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
    getE1DataSummary,
    listPipelines,
    loadPipelineIntoSession,
    saveAgentPipeline,
    sendAgentMessage,
    type AgentChatResponse,
    type ConversationPhase,
    type E1DataSummary,
    type PipelineAction,
    type PipelineState,
} from "@/lib/api/client/pipelines";
import type { Pipeline } from "@/lib/api/types";
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
  className?: string;
}

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

// =============================================================================
// Main Component
// =============================================================================

export function PipelineBuilderChatbot({
  availableColumns,
  onPipelineUpdate,
  onActionExecute,
  className,
}: PipelineBuilderChatbotProps) {
  // Hydration safety - only render dynamic content after mount
  const [mounted, setMounted] = useState(false);
  const componentId = useId();

  // State
  const [isOpen, setIsOpen] = useState(false);
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
  
  // Saved pipelines state
  const [savedPipelines, setSavedPipelines] = useState<Pipeline[]>([]);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  
  // E1 Data Summary state for interactive suggestions
  const [e1DataSummary, setE1DataSummary] = useState<E1DataSummary | null>(null);
  const [isLoadingE1Data, setIsLoadingE1Data] = useState(false);

  // Set mounted after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
  
  // Load E1 data summary when chatbot opens
  const loadE1DataSummary = useCallback(async () => {
    if (e1DataSummary) return; // Already loaded
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
  }, [e1DataSummary]);

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

  const handleAgentResponse = useCallback((response: AgentChatResponse) => {
    // Update session
    setSessionId(response.session_id);
    setCurrentPhase(response.phase);
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
      });
    }
  }, [onActionExecute]);

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

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: generateMessageId("user"),
      role: "user",
      content: messageText.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    try {
      // Include E1 data summary in context for interactive suggestions
      const context: Record<string, unknown> = { availableColumns };
      if (e1DataSummary) {
        context.e1DataSummary = e1DataSummary;
      }
      
      const response = await sendAgentMessage(
        messageText,
        sessionId || undefined,
        context
      );
      handleAgentResponse(response);
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

  const handleSavePipeline = async () => {
    if (!sessionId || !pipelineName.trim()) {
      toast.error("Name required", {
        description: "Please enter a name for the pipeline"
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveAgentPipeline(sessionId, pipelineName.trim());
      
      if (result.success) {
        toast.success("✅ Pipeline saved", {
          description: result.message
        });
        // Update phase to complete
        setCurrentPhase("complete");
        // Refresh saved pipelines list
        await refreshSavedPipelines();
      } else {
        toast.error("Error saving", {
          description: result.message
        });
      }
    } catch (error) {
      console.error("Error saving pipeline:", error);
      toast.error("Error saving", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsSaving(false);
    }
  };

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

  // Initialize conversation when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadE1DataSummary(); // Load E1 data for interactive suggestions
      initializeConversation();
      refreshSavedPipelines();
    }
  }, [isOpen, loadE1DataSummary, initializeConversation, refreshSavedPipelines, messages.length]);

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
    
    try {
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

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

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
    setShowPipelinePreview(false);
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
          "flex gap-3",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
        )}
        
        <div
          className={cn(
            "max-w-[80%] rounded-2xl px-4 py-2",
            isUser
              ? "bg-blue-600 text-white rounded-br-sm"
              : "bg-white border border-slate-200 rounded-bl-sm"
          )}
        >
          <div className={cn(
            "text-sm whitespace-pre-wrap",
            !isUser && "text-slate-700"
          )}>
            {message.content}
          </div>
        </div>
        
        {isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
            <span className="text-sm font-medium text-slate-600">You</span>
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

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110",
          "bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
          "z-50"
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
        )}
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <Card
          className={cn(
            "fixed bottom-24 right-6 w-[460px] shadow-2xl border-2 border-blue-100 z-50",
            "animate-in slide-in-from-bottom-5 fade-in duration-300",
            isMinimized ? "h-auto" : "h-[650px]",
            className
          )}
        >
          {/* Header */}
          <CardHeader className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-white text-base">
                    Pricing Pipeline Builder Chatbot
                  </CardTitle>
                  <p className="text-blue-100 text-xs">
                    {e1DataSummary 
                      ? `${e1DataSummary.competitors.length} competitors • ${e1DataSummary.locations.length} locations`
                      : isLoadingE1Data 
                        ? "Loading data..."
                        : "Configuration assistant"
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Data Status Indicator */}
                {e1DataSummary && (
                  <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-1 mr-2" title="Real data loaded from E1 endpoint">
                    <Database className="h-3 w-3 text-green-300" />
                    <span className="text-xs text-white/90">{e1DataSummary.total_rows.toLocaleString()} rows</span>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white hover:bg-white/20"
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
                <div className="bg-white/20 rounded-full px-3 py-1">
                  {renderPhaseIndicator()}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/80 hover:text-white hover:bg-white/20 text-xs"
                    onClick={() => setShowLoadDialog(!showLoadDialog)}
                    title="Load saved pipeline"
                  >
                    <FolderOpen className="h-3 w-3 mr-1" />
                    Load
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/80 hover:text-white hover:bg-white/20 text-xs"
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
            <div className="px-4 py-3 border-b bg-blue-50">
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
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Load
                </Button>
              </div>
            </div>
          )}

          {!isMinimized && (
            <>
              {/* Messages Area */}
              <CardContent className="p-0 flex-1 overflow-hidden">
                <div className="h-[350px] p-4 overflow-y-auto">
                  <div className="space-y-4">
                    {messages.map(renderMessage)}
                    
                    {/* Typing indicator */}
                    {isTyping && (
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Pipeline Preview */}
                {showPipelinePreview && (
                  <div className="px-4 pb-2">
                    {renderPipelinePreview()}
                  </div>
                )}
              </CardContent>

              {/* Save Pipeline Section (shown in review/complete phase) */}
              {(currentPhase === "review" || currentPhase === "complete") && pipelineState && (
                <div className="px-4 py-3 border-t bg-green-50">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Pipeline name..."
                      value={pipelineName}
                      onChange={(e) => setPipelineName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSavePipeline}
                      disabled={isSaving || !pipelineName.trim()}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className="p-4 border-t bg-white rounded-b-lg">
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
                    disabled={isTyping || !inputValue.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isTyping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
                
                {/* Quick Actions */}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-slate-500 hover:text-blue-600"
                    onClick={() => sendMessage("Show current state")}
                  >
                    Current state
                  </Button>
                  <span className="text-slate-300">|</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-slate-500 hover:text-blue-600"
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
