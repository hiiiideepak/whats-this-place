import type { EssentialPlace, PlaceCard } from '@around/shared-types';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDistance, type DistanceUnit } from '../format';

export function PlaceRow({
  place,
  unit,
}: {
  place: PlaceCard | EssentialPlace;
  unit: DistanceUnit;
}) {
  const rating =
    place.rating != null
      ? `${place.rating.toFixed(1)}${place.review_count != null ? ` (${place.review_count})` : ''}`
      : null;

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{place.name}</Text>
      <Text style={styles.meta}>
        {[place.category, rating, formatDistance(place.distance_m, unit)]
          .filter((part): part is string => Boolean(part))
          .join(' · ')}
      </Text>
      {place.open_now != null ? (
        <Text style={styles.meta}>
          {place.open_now ? 'Open now' : 'Closed'}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openURL(place.maps_url)}
          style={styles.action}
        >
          <Text style={styles.actionLabel}>Open in Maps</Text>
        </Pressable>
        {place.phone ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openURL(`tel:${place.phone}`)}
            style={styles.action}
          >
            <Text style={styles.actionLabel}>Call</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  name: { fontSize: 16, fontWeight: '600', color: '#1c1915' },
  meta: { fontSize: 13, color: '#6b645c' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: {
    borderRadius: 999,
    backgroundColor: '#efeae2',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#1c1915' },
});
