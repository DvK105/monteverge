import React from 'react';
import { getFallbackStocksData } from '@/lib/data/tata-fallback-data';
import { UniverseOverview } from '@/components/universe/UniverseOverview';

export default function HomePage() {
  const initialData = getFallbackStocksData();

  return (
    <main className="min-h-dvh w-full bg-background text-foreground">
      <UniverseOverview initialData={initialData} />
    </main>
  );
}
