"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, X } from "lucide-react"

interface ProcessingBannerProps {
  fileName: string
  onCancel: () => void
}

export function ProcessingBanner({ fileName, onCancel }: ProcessingBannerProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          Processing
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-sm">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={onCancel}
            className="mt-4"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}