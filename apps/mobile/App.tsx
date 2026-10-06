import { APP_NAME, type HealthResponse } from '@around/shared-types';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type HealthState =
  | { kind: 'loading' }
  | { kind: 'unreachable' }
  | { kind: 'ready'; report: HealthResponse };

async function fetchHealth(): Promise<HealthState> {
  try {
    const response = await fetch(`${apiUrl}/health`);
    if (!response.ok) {
      return { kind: 'unreachable' };
    }
    const report = (await response.json()) as HealthResponse;
    return { kind: 'ready', report };
  } catch {
    return { kind: 'unreachable' };
  }
}

export default function App() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  const reload = useCallback(() => {
    setHealth({ kind: 'loading' });
    void fetchHealth().then(setHealth);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchHealth().then((next) => {
      if (!cancelled) {
        setHealth(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Somewhere new</Text>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.body}>
        A single screen for what matters nearby. Location and sections come
        next.
      </Text>
      <HealthLine health={health} />
      <Text style={styles.meta}>{apiUrl}</Text>
      <Pressable onPress={reload} style={styles.button}>
        <Text style={styles.buttonLabel}>Check API</Text>
      </Pressable>
      <StatusBar style="dark" />
    </View>
  );
}

function HealthLine({ health }: { health: HealthState }) {
  if (health.kind === 'loading') {
    return <Text style={styles.meta}>Checking API…</Text>;
  }
  if (health.kind === 'unreachable') {
    return <Text style={styles.meta}>API unreachable</Text>;
  }
  const { report } = health;
  return (
    <Text style={styles.meta}>
      API {report.status} · postgres {report.checks.postgres.status} · redis{' '}
      {report.checks.redis.status}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f1ea',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  kicker: {
    color: '#8a5a2b',
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    fontSize: 48,
    fontWeight: '700',
    color: '#1c1915',
  },
  body: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 24,
    color: '#3d3832',
  },
  meta: {
    marginTop: 20,
    fontSize: 14,
    color: '#6b645c',
  },
  button: {
    marginTop: 16,
    backgroundColor: '#1c1915',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonLabel: {
    color: '#f4f1ea',
    fontSize: 14,
    fontWeight: '600',
  },
});
