'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface TopProductPoint {
  name: string;
  quantity: number;
}

export function TopProductsChart({ data }: { data: TopProductPoint[] }) {
  const height = Math.max(160, data.length * 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#334155' }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          formatter={(value) => [`${value} unid.`, 'Vendidos']}
          contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }}
        />
        <Bar dataKey="quantity" fill="#0f172a" radius={[0, 4, 4, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
