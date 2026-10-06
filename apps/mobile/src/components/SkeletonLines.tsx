import { StyleSheet, View } from 'react-native';

export function SkeletonLines() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading">
      <View style={[styles.line, styles.long]} />
      <View style={[styles.line, styles.medium]} />
      <View style={[styles.line, styles.short]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingVertical: 8 },
  line: {
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e4ddd2',
  },
  long: { width: '88%' },
  medium: { width: '64%' },
  short: { width: '40%' },
});
