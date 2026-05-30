import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DISCOVER_GREEN, discoverTextShadow } from '@/components/discover/discoverTheme';
import DiscoverSectionHeader from '@/components/discover/DiscoverSectionHeader';
import type { DiscoverGuideTeaser } from '@/types/discover';

type DiscoverGuideTeaserCardProps = {
  teaser: DiscoverGuideTeaser;
  onPress: () => void;
};

export default function DiscoverGuideTeaserCard({
  teaser,
  onPress,
}: DiscoverGuideTeaserCardProps) {
  return (
    <>
      <DiscoverSectionHeader
        title="Guides certifiés"
        subtitle="Option guide local sur les expériences privées"
        style={styles.header}
      />
      <View style={styles.card}>
        <Image
          source={require('../../assets/images/services/chauffeur-prive.jpg')}
          style={styles.image}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(5,5,5,0.12)', 'rgba(5,5,5,0.55)', 'rgba(5,5,5,0.97)']}
          locations={[0, 0.45, 1]}
          style={styles.gradient}
        />
        <View style={styles.content}>
          <Text style={styles.eyebrow}>GUIDE CERTIFIÉ PROTAXI</Text>
          <Text style={styles.title}>{teaser.title}</Text>
          <Text style={styles.description}>{teaser.description}</Text>
          <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={onPress}>
            <Ionicons name="person-outline" size={18} color="#111" />
            <Text style={styles.ctaText}>{teaser.ctaLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    minHeight: 260,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    minHeight: 260,
  },
  eyebrow: {
    color: DISCOVER_GREEN,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    ...discoverTextShadow,
  },
  description: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: DISCOVER_GREEN,
  },
  ctaText: {
    color: '#111',
    fontSize: 13,
    fontWeight: '900',
  },
});
