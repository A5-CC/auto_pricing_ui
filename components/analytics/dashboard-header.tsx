import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface DashboardHeaderProps {
  title: string
  onReset?: () => void
}

export function DashboardHeader({ title, onReset }: DashboardHeaderProps) {
  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-sm text-gray-500">
            Analytics Dashboard generated on{" "}
            {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        {onReset && (
          <Button variant="outline" onClick={onReset}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to Main Page
          </Button>
        )}
      </div>
    </div>
  )
}