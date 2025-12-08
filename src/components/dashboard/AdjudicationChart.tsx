import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const data = [
  { name: "Adjudicated", value: 847, color: "hsl(160, 60%, 40%)" },
  { name: "Pending", value: 156, color: "hsl(38, 92%, 50%)" },
  { name: "Rejected", value: 23, color: "hsl(0, 72%, 51%)" },
  { name: "Under Review", value: 89, color: "hsl(200, 80%, 50%)" },
];

export function AdjudicationChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Adjudication Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "var(--shadow-md)",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-muted-foreground">{item.name}:</span>
              <span className="text-sm font-medium text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
