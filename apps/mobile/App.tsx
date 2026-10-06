import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { AroundScreen } from './src/AroundScreen';

export default function App() {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <AroundScreen />
      <StatusBar style="dark" />
    </QueryClientProvider>
  );
}
