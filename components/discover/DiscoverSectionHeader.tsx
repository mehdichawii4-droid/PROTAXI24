import { StyleSheet, Text, View } from 'react-native';

import { DISCOVER_GREEN, DISCOVER_MUTED } from '@/components/discover/discoverTheme';

type DiscoverSectionHeaderProps = {
  title: string;
  subtitle?: string;
  style?: object;
};

export default function DiscoverSectionHeader({
  title,
  subtitle,
  style,
}: DiscoverSectionHeaderProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  title: {
    color: '#F5F5F5',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: DISCOVER_MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    fontWeight: '500',
  },
  accent: {
    width: 36,
    height: 2,
    borderRadius: 1,
    backgroundColor: DISCOVER_GREEN,
    marginTop: 10,
    opacity: 0.75,
  },
});
