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
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e2d9" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b6760' }} axisLine={{ stroke: '#e7e2d9' }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: '#6b6760' }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(v: number) => formatPrice(v)}
        />
        <Tooltip
          cursor={{ fill: '#f6f4f0' }}
          formatter={(value) => [formatPrice(Number(value)), 'Faturamento']}
          contentStyle={{ borderRadius: 12, borderColor: '#e7e2d9', fontSize: 13 }}
        />
        <Bar dataKey="total" fill="#b4854a" radius={[8, 8, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
