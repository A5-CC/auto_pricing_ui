"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { GitBranch } from "lucide-react";

interface DeletePipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  pipelineName: string;
}

export function DeletePipelineDialog({
  open,
  onOpenChange,
  onConfirm,
  pipelineName,
}: DeletePipelineDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [phraseText, setPhraseText] = useState("");
  const requiredPhrase = "delete my pipeline";
  const ready =
    confirmText.trim() === pipelineName.trim() &&
    phraseText.trim().toLowerCase() === requiredPhrase;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete pipeline:", error);
    } finally {
      setDeleting(false);
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && ready && !deleting) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-full bg-destructive/10 text-destructive p-1">
              <AlertTriangle className="h-4 w-4" />
            </span>
            Delete Pipeline
          </DialogTitle>
          <DialogDescription>
            Deleting this pipeline removes its saved filters and settings. Any
            teammates who use it will no longer see it in the selector.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-2 pb-3 border-b">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted border">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="text-sm font-medium leading-none">{pipelineName}</span>
          </div>

          <div className="pt-2 grid gap-2">
            <Label htmlFor="confirm-name" className="text-sm">
              <span>
                To confirm, type "
                <span className="font-semibold">{pipelineName}</span>
                "
              </span>
            </Label>
            <Input
              id="confirm-name"
              placeholder={pipelineName}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-phrase" className="text-sm">
              <span>
                To confirm, type "
                <span className="font-semibold">delete my pipeline</span>
                "
              </span>
            </Label>
            <Input
              id="confirm-phrase"
              placeholder={requiredPhrase}
              value={phraseText}
              onChange={(e) => setPhraseText(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>

          <Alert variant="destructive" className="border-destructive/25 mt-1">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action is not reversible. Please be certain.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!ready || deleting}
          >
            {deleting ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
