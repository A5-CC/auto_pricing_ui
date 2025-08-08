import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TrendingUp, TrendingDown, Info, AlertTriangle, Target, CheckCircle2, ArrowRight } from "lucide-react"

export default function TestComponentsPage() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">shadcn/ui Components Test</h1>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Test Card
          </CardTitle>
          <CardDescription>
            This card tests the shadcn/ui components installation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>

            <div className="flex gap-2">
              <Button variant="default" size="sm">
                <TrendingUp className="h-4 w-4 mr-2" />
                Default
              </Button>
              <Button variant="outline" size="sm">
                <TrendingDown className="h-4 w-4 mr-2" />
                Outline
              </Button>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Info className="h-4 w-4 mr-2" />
                    Hover me
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This is a tooltip!</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="h-5 w-5" />
        <span>Basic shadcn/ui components working!</span>
        <ArrowRight className="h-4 w-4" />
        <Target className="h-5 w-5 text-blue-500" />
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
      </div>
    </div>
  )
}