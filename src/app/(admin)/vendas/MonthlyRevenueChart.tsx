'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatPrice } from '@/lib/currency';

export interface MonthlyRevenuePoint {
  label: string;
  total: number;
}

export function MonthlyRevenueChart({ data }: { data: MonthlyRevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v: number) => formatPrice(v)}
        />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          formatter={(value) => [formatPrice(Number(value)), 'Faturamento']}
          contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0', fontSize: 13 }}
        />
        <Bar dataKey="total" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
