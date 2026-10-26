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
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e2d9" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#6b6760' }} axisLine={{ stroke: '#e7e2d9' }} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#374151' }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip
          cursor={{ fill: '#f6f4f0' }}
          formatter={(value) => [`${value} unid.`, 'Vendidos']}
          contentStyle={{ borderRadius: 12, borderColor: '#e7e2d9', fontSize: 13 }}
        />
        <Bar dataKey="quantity" fill="#b4854a" radius={[0, 8, 8, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
