import type { DistanceUnit } from './format';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const UNIT_KEY = 'around.units';

export function SettingsScreen({
  unit,
  onUnit,
  onClose,
}: {
  unit: DistanceUnit;
  onUnit: (unit: DistanceUnit) => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.screen}>
      <Pressable accessibilityRole="button" onPress={onClose}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.label}>Units</Text>
      <View style={styles.row}>
        <Choice
          label="Kilometres"
          selected={unit === 'km'}
          onPress={() => onUnit('km')}
        />
        <Choice
          label="Miles"
          selected={unit === 'mi'}
          onPress={() => onUnit('mi')}
        />
      </View>
      <Text style={styles.label}>Default sections on open</Text>
      <Text style={styles.note}>
        All sections open for now. Choosing a subset comes later.
      </Text>
    </View>
  );
}

export function useDistanceUnit(): [
  DistanceUnit,
  (unit: DistanceUnit) => void,
] {
  const [unit, setUnit] = useState<DistanceUnit>('km');

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(UNIT_KEY).then((value) => {
      if (!cancelled && (value === 'km' || value === 'mi')) setUnit(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (next: DistanceUnit) => {
    setUnit(next);
    void AsyncStorage.setItem(UNIT_KEY, next);
  };

  return [unit, update];
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.choice, selected ? styles.choiceOn : null]}
    >
      <Text
        style={[styles.choiceLabel, selected ? styles.choiceLabelOn : null]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f1ea', padding: 24, paddingTop: 64 },
  back: { color: '#8a5a2b', fontSize: 16, fontWeight: '600' },
  title: { marginTop: 16, fontSize: 36, fontWeight: '700', color: '#1c1915' },
  label: { marginTop: 28, fontSize: 15, fontWeight: '600', color: '#1c1915' },
  note: { marginTop: 8, fontSize: 15, lineHeight: 22, color: '#6b645c' },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  choice: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#efeae2',
  },
  choiceOn: { backgroundColor: '#1c1915' },
  choiceLabel: { color: '#1c1915', fontWeight: '600' },
  choiceLabelOn: { color: '#f4f1ea' },
});
