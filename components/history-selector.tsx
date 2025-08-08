"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { History, ChevronDown, FileText } from "lucide-react"
import { DocMeta } from "@/lib/api/types"

interface HistorySelectorProps {
  history: DocMeta[]
  onSelect: (docId: string) => void
  isLoading: boolean
  mode?: 'default' | 'timeout'
}

export function HistorySelector({ history, onSelect, isLoading, mode = 'default' }: HistorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (history.length === 0) {
    return null
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          {mode === 'timeout' ? 'Check Results Later' : 'Previous Analytics'}
        </CardTitle>
        <CardDescription>
          {mode === 'timeout'
            ? 'Your analysis will appear here once completed'
            : 'View insights from previously uploaded files'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setIsOpen(!isOpen)}
            disabled={isLoading}
            className="w-full justify-between"
          >
            <span>Select a previous analysis</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>

          {isOpen && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
              {history.map((doc, index) => (
                <button
                  key={`${doc.id}-${index}`}
                  onClick={() => {
                    onSelect(doc.id)
                    setIsOpen(false)
                  }}
                  disabled={isLoading}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border-b last:border-b-0 flex items-center gap-3"
                >
                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {doc.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}