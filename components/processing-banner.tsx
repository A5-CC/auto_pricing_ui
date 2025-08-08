"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
          Processing Your File
        </CardTitle>
        <CardDescription>
          Analyzing {fileName} and generating insights...
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            </div>
            <span>This may take a few moments</span>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>• Extracting data from your file</p>
            <p>• Analyzing patterns and trends</p>
            <p>• Generating KPIs and insights</p>
            <p>• Creating visualizations</p>
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