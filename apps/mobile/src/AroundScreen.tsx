import type {
  AboutPlace,
  AroundSectionName,
  AroundSectionResponse,
  PlaceCard,
  PlaceSearchHit,
} from '@around/shared-types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useQuery,
  useQueries,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchSection, searchPlaces, type SectionPayload } from './api';
import { RADIUS_PRESETS } from './config';
import { PlaceRow } from './components/PlaceRow';
import { SkeletonLines } from './components/SkeletonLines';
import { loadDeviceId } from './device';
import {
  distanceMeters,
  formatDistance,
  hierarchyLine,
  type DistanceUnit,
} from './format';
import { locate } from './locate';
import { SettingsScreen, useDistanceUnit } from './SettingsScreen';

const EXPLAINER_KEY = 'around.explainerSeen';
const SNAPSHOT_KEY = 'around.snapshot';

interface OfflineSnapshot {
  savedAt: string;
  lat: number;
  lng: number;
  radiusKm: number;
  sections: Partial<
    Record<AroundSectionName, AroundSectionResponse<SectionPayload>>
  >;
}

const SECTION_TITLES: Record<AroundSectionName, string> = {
  about: 'About this place',
  famous: 'Famous things nearby',
  essentials: 'Essentials',
  eat: 'Eat',
  stay: 'Stay',
  coffee: 'Coffee',
};

const SECTION_ORDER: AroundSectionName[] = [
  'about',
  'famous',
  'essentials',
  'eat',
  'stay',
  'coffee',
];

type Center =
  | { kind: 'pending' }
  | { kind: 'denied' | 'blocked' | 'services-off' | 'search' }
  | {
      kind: 'ready';
      lat: number;
      lng: number;
      label?: string;
      source: 'gps' | 'search';
    };

export function AroundScreen() {
  const [unit, setUnit] = useDistanceUnit();
  const [settings, setSettings] = useState(false);
  const [seen, setSeen] = useState<boolean | null>(null);
  const [center, setCenter] = useState<Center>({ kind: 'pending' });
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(EXPLAINER_KEY).then((value) => {
      if (!cancelled) setSeen(value === '1');
    });
    void loadDeviceId().then((id) => {
      if (!cancelled) setDeviceId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (seen !== true) return;
    let cancelled = false;
    void locate()
      .then((fix) => {
        if (cancelled) return;
        setCenter(fix.kind === 'ready' ? { ...fix, source: 'gps' } : fix);
      })
      .catch(() => {
        if (!cancelled) setCenter({ kind: 'denied' });
      });
    return () => {
      cancelled = true;
    };
  }, [seen]);

  if (settings) {
    return (
      <SettingsScreen
        unit={unit}
        onUnit={setUnit}
        onClose={() => setSettings(false)}
      />
    );
  }
  if (seen === false) {
    return (
      <Explainer
        onContinue={() => {
          void AsyncStorage.setItem(EXPLAINER_KEY, '1');
          setSeen(true);
        }}
      />
    );
  }
  if (center.kind !== 'ready' || !deviceId) {
    return (
      <PlacePrompt
        center={center}
        deviceId={deviceId}
        onSearch={() => setCenter({ kind: 'search' })}
        onPick={(hit) =>
          setCenter({
            kind: 'ready',
            lat: hit.lat,
            lng: hit.lng,
            label: hit.name,
            source: 'search',
          })
        }
        onRetry={() => {
          setCenter({ kind: 'pending' });
          void locate()
            .then((fix) => {
              setCenter(fix.kind === 'ready' ? { ...fix, source: 'gps' } : fix);
            })
            .catch(() => setCenter({ kind: 'denied' }));
        }}
      />
    );
  }

  return (
    <Summary
      lat={center.lat}
      lng={center.lng}
      label={center.label}
      source={center.source}
      deviceId={deviceId}
      unit={unit}
      onSettings={() => setSettings(true)}
      onSearch={() => setCenter({ kind: 'search' })}
      onMoved={(lat, lng) =>
        setCenter({ kind: 'ready', lat, lng, source: 'gps' })
      }
    />
  );
}

function Summary({
  lat,
  lng,
  label,
  source,
  deviceId,
  unit,
  onSettings,
  onSearch,
  onMoved,
}: {
  lat: number;
  lng: number;
  label?: string;
  source: 'gps' | 'search';
  deviceId: string;
  unit: DistanceUnit;
  onSettings: () => void;
  onSearch: () => void;
  onMoved: (lat: number, lng: number) => void;
}) {
  const [radiusKm, setRadiusKm] = useState(10);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [movedM, setMovedM] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(SNAPSHOT_KEY).then((raw) => {
      if (cancelled || !raw) return;
      try {
        setSnapshot(JSON.parse(raw) as OfflineSnapshot);
      } catch {
        // A corrupt snapshot is ignored; the next successful load replaces it.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useQueries({
    queries: SECTION_ORDER.map((section) => ({
      queryKey: ['around', section, lat, lng, radiusKm],
      queryFn: () => fetchSection(section, lat, lng, radiusKm, deviceId),
    })),
  });

  const updatedAt = results.reduce((latest, result) => {
    return Math.max(latest, result.dataUpdatedAt);
  }, 0);
  const liveFailed =
    results.length > 0 &&
    results.every((result) => result.isError || result.isFetched) &&
    results.every((result) => !result.data) &&
    results.some((result) => result.isError);
  const savedSections: OfflineSnapshot['sections'] = {};
  SECTION_ORDER.forEach((section, index) => {
    const data = results[index]?.data;
    const status = data?.section.status;
    if (data && (status === 'ok' || status === 'empty')) {
      savedSections[section] = data;
    }
  });
  const savedKey = JSON.stringify(savedSections);

  useEffect(() => {
    if (savedKey === '{}') return;
    let cancelled = false;
    const next: OfflineSnapshot = {
      savedAt: new Date().toISOString(),
      lat,
      lng,
      radiusKm,
      sections: JSON.parse(savedKey) as OfflineSnapshot['sections'],
    };
    void AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next)).then(() => {
      if (!cancelled) setSnapshot(next);
    });
    return () => {
      cancelled = true;
    };
  }, [savedKey, lat, lng, radiusKm]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      if (source === 'gps') {
        const fix = await locate();
        if (fix.kind === 'ready') {
          setMovedM(distanceMeters(lat, lng, fix.lat, fix.lng));
          if (fix.lat !== lat || fix.lng !== lng) {
            onMoved(fix.lat, fix.lng);
            return;
          }
        }
      }
      await Promise.all(results.map((result) => result.refetch()));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
        />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Around</Text>
        <Pressable accessibilityRole="button" onPress={onSettings}>
          <Text style={styles.link}>Settings</Text>
        </Pressable>
      </View>
      <Text style={styles.placeLabel}>{label ?? 'Near you'}</Text>
      <View style={styles.radiusRow}>
        {RADIUS_PRESETS.map((preset) => (
          <Pressable
            key={preset}
            accessibilityRole="button"
            onPress={() => {
              setCustomOpen(false);
              setRadiusKm(preset);
            }}
            style={[
              styles.chip,
              radiusKm === preset && !customOpen ? styles.chipOn : null,
            ]}
          >
            <Text
              style={[
                styles.chipLabel,
                radiusKm === preset && !customOpen ? styles.chipLabelOn : null,
              ]}
            >
              {preset} km
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => setCustomOpen(true)}
          style={[styles.chip, customOpen ? styles.chipOn : null]}
        >
          <Text
            style={[styles.chipLabel, customOpen ? styles.chipLabelOn : null]}
          >
            Custom
          </Text>
        </Pressable>
      </View>
      {customOpen ? (
        <View style={styles.customRow}>
          <TextInput
            value={customText}
            onChangeText={setCustomText}
            keyboardType="decimal-pad"
            placeholder="1–50"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            style={styles.apply}
            onPress={() => {
              const value = Number(customText);
              if (!Number.isFinite(value) || value < 1 || value > 50) {
                setCustomError('Enter a radius from 1 to 50 km');
                return;
              }
              setCustomError(null);
              setRadiusKm(value);
            }}
          >
            <Text style={styles.applyLabel}>Apply</Text>
          </Pressable>
        </View>
      ) : null}
      {customError ? <Text style={styles.error}>{customError}</Text> : null}
      {liveFailed ? (
        <Text style={styles.error}>
          {snapshot
            ? `Offline, last updated at ${new Date(snapshot.savedAt).toLocaleString()}`
            : 'Offline. No saved summary yet.'}
        </Text>
      ) : null}
      <Text style={styles.metaLine}>
        {updatedAt > 0
          ? `Updated ${new Date(updatedAt).toLocaleTimeString()}`
          : 'Loading nearby'}
        {movedM != null ? ` · moved ${formatDistance(movedM, unit)}` : ''}
      </Text>
      <Pressable accessibilityRole="button" onPress={onSearch}>
        <Text style={styles.link}>Search a place</Text>
      </Pressable>
      {SECTION_ORDER.map((section, index) => (
        <SectionCard
          key={section}
          section={section}
          unit={unit}
          query={results[index]}
          saved={snapshot?.sections[section]}
        />
      ))}
      <Text style={styles.metaLine}>
        Place data © OpenStreetMap contributors
      </Text>
    </ScrollView>
  );
}

function SectionCard({
  section,
  unit,
  query,
  saved,
}: {
  section: AroundSectionName;
  unit: DistanceUnit;
  query: UseQueryResult<AroundSectionResponse<SectionPayload>> | undefined;
  saved?: AroundSectionResponse<SectionPayload>;
}) {
  const [open, setOpen] = useState(true);
  const payload =
    query?.data?.section ?? (query?.isError ? saved?.section : undefined);

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
        style={styles.sectionHeader}
      >
        <Text style={styles.sectionTitle}>{SECTION_TITLES[section]}</Text>
        <Text style={styles.link}>{open ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.sectionBody}>
          {section === 'essentials' ? <EmergencyButton /> : null}
          {query == null || (query.isLoading && !query.data) ? (
            <SkeletonLines />
          ) : null}
          {query?.isError && !payload ? (
            <Text style={styles.error}>Couldn&apos;t load this section.</Text>
          ) : null}
          {payload ? (
            <SectionPayloadView
              section={section}
              payload={payload}
              unit={unit}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SectionPayloadView({
  section,
  payload,
  unit,
}: {
  section: AroundSectionName;
  payload: AroundSectionResponse<SectionPayload>['section'];
  unit: DistanceUnit;
}) {
  if (section === 'about' && payload.data && isAboutPlace(payload.data)) {
    return <AboutBody place={payload.data} />;
  }
  if (
    payload.status === 'empty' ||
    payload.status === 'error' ||
    payload.status === 'not_found'
  ) {
    return (
      <Text style={styles.body}>
        {payload.status === 'not_found'
          ? 'No reliable information found'
          : payload.message}
      </Text>
    );
  }
  return (
    <View style={styles.list}>
      {payload.message ? (
        <Text style={styles.metaLine}>{payload.message}</Text>
      ) : null}
      {payload.items?.map((place) =>
        isListedPlace(place) ? (
          <PlaceRow key={place.id} place={place} unit={unit} />
        ) : null,
      )}
    </View>
  );
}

function AboutBody({ place }: { place: AboutPlace }) {
  const source = place.etymology.source_url;
  return (
    <View style={styles.list}>
      <Text style={styles.placeName}>{place.name}</Text>
      <Text style={styles.body}>{hierarchyLine(place.hierarchy)}</Text>
      {place.significance ? (
        <Text style={styles.body}>{place.significance}</Text>
      ) : null}
      {place.etymology.status === 'not_found' ? (
        <Text style={styles.body}>No reliable information found</Text>
      ) : (
        <Text style={styles.body}>{place.etymology.summary}</Text>
      )}
      {source ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(source)}
        >
          <Text style={styles.link}>Source</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function isAboutPlace(place: SectionPayload): place is AboutPlace {
  return 'etymology' in place;
}

function isListedPlace(place: SectionPayload): place is PlaceCard {
  return 'maps_url' in place;
}

function EmergencyButton() {
  return (
    <Pressable
      accessibilityRole="button"
      style={styles.emergency}
      onPress={() => void Linking.openURL('tel:112')}
    >
      <Text style={styles.emergencyLabel}>Call 112</Text>
    </Pressable>
  );
}

function Explainer({ onContinue }: { onContinue: () => void }) {
  return (
    <View style={styles.prompt}>
      <Text style={styles.kicker}>Somewhere new</Text>
      <Text style={styles.title}>Around</Text>
      <Text style={styles.body}>
        One screen for this place: what it is, what is famous nearby, and the
        nearest hospital, police station, and pharmacy. Next, Around asks for
        your location.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={styles.primary}
        onPress={onContinue}
      >
        <Text style={styles.primaryLabel}>Continue</Text>
      </Pressable>
    </View>
  );
}

function PlacePrompt({
  center,
  deviceId,
  onSearch,
  onPick,
  onRetry,
}: {
  center: Center;
  deviceId: string | null;
  onSearch: () => void;
  onPick: (hit: PlaceSearchHit) => void;
  onRetry: () => void;
}) {
  const message =
    center.kind === 'services-off'
      ? 'Location services are turned off.'
      : center.kind === 'blocked'
        ? 'Location is blocked for Around. Enable it in system settings, or search a place.'
        : center.kind === 'denied'
          ? 'Location was not allowed. Search a place instead.'
          : center.kind === 'pending'
            ? 'Finding where you are…'
            : 'Search a place to see what is around it.';

  return (
    <View style={styles.prompt}>
      <Text style={styles.title}>Around</Text>
      <Text style={styles.body}>{message}</Text>
      {center.kind === 'denied' ||
      center.kind === 'blocked' ||
      center.kind === 'services-off' ? (
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text style={styles.link}>Try location again</Text>
        </Pressable>
      ) : null}
      {center.kind !== 'pending' && center.kind !== 'search' ? (
        <Pressable
          accessibilityRole="button"
          style={styles.primary}
          onPress={onSearch}
        >
          <Text style={styles.primaryLabel}>Search a place</Text>
        </Pressable>
      ) : null}
      {center.kind === 'search' && deviceId ? (
        <PlaceSearch deviceId={deviceId} onPick={onPick} />
      ) : null}
    </View>
  );
}

function PlaceSearch({
  deviceId,
  onPick,
}: {
  deviceId: string;
  onPick: (hit: PlaceSearchHit) => void;
}) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState('');
  const search = useQuery({
    queryKey: ['place-search', submitted],
    queryFn: () => searchPlaces(submitted, deviceId),
    enabled: submitted.length >= 2,
  });

  return (
    <View style={styles.search}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="City or neighbourhood"
        style={styles.input}
        onSubmitEditing={() => setSubmitted(text.trim())}
      />
      <Pressable
        accessibilityRole="button"
        style={styles.apply}
        onPress={() => setSubmitted(text.trim())}
      >
        <Text style={styles.applyLabel}>Search</Text>
      </Pressable>
      {search.isLoading ? <SkeletonLines /> : null}
      {search.isError ? <Text style={styles.error}>Search failed.</Text> : null}
      {search.data?.map((hit) => (
        <Pressable
          key={`${hit.lat},${hit.lng},${hit.name}`}
          accessibilityRole="button"
          onPress={() => onPick(hit)}
          style={styles.hit}
        >
          <Text style={styles.placeName}>{hit.name}</Text>
          <Text style={styles.metaLine}>{hierarchyLine(hit.hierarchy)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f1ea' },
  content: { padding: 20, paddingTop: 64, gap: 12, paddingBottom: 48 },
  prompt: {
    flex: 1,
    backgroundColor: '#f4f1ea',
    padding: 24,
    paddingTop: 80,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: {
    color: '#8a5a2b',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 13,
  },
  title: { fontSize: 40, fontWeight: '700', color: '#1c1915' },
  placeLabel: { fontSize: 18, color: '#3d3832' },
  body: { fontSize: 16, lineHeight: 23, color: '#3d3832' },
  metaLine: { fontSize: 13, color: '#6b645c' },
  link: { color: '#8a5a2b', fontWeight: '600', fontSize: 14 },
  error: { color: '#8d3b32', fontSize: 14 },
  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#efeae2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: '#1c1915' },
  chipLabel: { color: '#1c1915', fontWeight: '600' },
  chipLabelOn: { color: '#f4f1ea' },
  customRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  apply: {
    backgroundColor: '#1c1915',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  applyLabel: { color: '#f4f1ea', fontWeight: '600' },
  section: {
    backgroundColor: '#fffdf9',
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1c1915' },
  sectionBody: { gap: 8 },
  list: { gap: 8 },
  placeName: { fontSize: 20, fontWeight: '700', color: '#1c1915' },
  emergency: {
    backgroundColor: '#8d3b32',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  emergencyLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  primary: {
    marginTop: 8,
    backgroundColor: '#1c1915',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryLabel: { color: '#f4f1ea', fontWeight: '700' },
  search: { gap: 8, marginTop: 8 },
  hit: { backgroundColor: '#fff', borderRadius: 14, padding: 12 },
});
