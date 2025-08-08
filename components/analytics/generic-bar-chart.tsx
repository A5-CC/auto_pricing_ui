import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import type { KeyChart } from "./types"

interface GenericBarChartProps {
  data?: KeyChart
}

export function GenericBarChart({ data }: GenericBarChartProps) {
  if (!data) {
    return null
  }

  // Determine the data key dynamically from the first data item
  const dataKey = data.data && data.data.length > 0 ?
    (Object.keys(data.data[0]).find(key => key !== 'facility' && key !== 'label') || 'value') :
    'value'
  const categoryKey = data.data && data.data.length > 0 ? (data.data[0].facility ? 'facility' : 'label') : 'label'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{data.title}</CardTitle>
        <CardDescription>Data visualization</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            [dataKey || 'value']: {
              label: data.title,
              color: "hsl(var(--chart-1))",
            },
          }}
          className="h-[400px]"
        >
          <BarChart
            data={data.data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis type="number" />
            <YAxis type="category" dataKey={categoryKey} width={110} tick={{ fontSize: 12 }} tickLine={false} />
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const categoryValue = payload[0].payload[categoryKey]
                  const dataValue = payload[0]?.value

                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">Category</span>
                          <span className="font-bold text-foreground">{categoryValue}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            Value
                          </span>
                          <span className="font-bold text-foreground">
                            {typeof dataValue === 'number' ? dataValue.toFixed(2) : dataValue}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar
              dataKey={dataKey}
              fill={`var(--color-${dataKey})`}
              radius={[0, 4, 4, 0]}
              barSize={24}
              label={{
                position: "right",
                formatter: (value: number) => typeof value === 'number' ? value.toFixed(2) : value,
                fill: "var(--foreground)",
                fontSize: 12,
              }}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}