import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  DISCOVER_GLOW,
  DISCOVER_GREEN,
  DISCOVER_RADIUS_LG,
  discoverCardShadow,
  discoverPremiumGlow,
  discoverTextShadow,
} from '@/components/discover/discoverTheme';

type DiscoverHeroProps = {
  onPressCta: () => void;
};

export default function DiscoverHero({ onPressCta }: DiscoverHeroProps) {
  return (
    <View style={styles.wrap}>
      <ImageBackground
        source={require('../../assets/images/theatre-romain.jpg')}
        style={styles.image}
        imageStyle={styles.imageStyle}
      >
        <LinearGradient
          colors={['rgba(5,5,5,0.15)', 'rgba(5,5,5,0.45)', 'rgba(5,5,5,0.92)']}
          style={styles.gradient}
        >
          <View style={styles.glowOrb} />

          <View style={styles.pill}>
            <Text style={styles.pillText}>VITRINE OFFICIELLE PROTAXI</Text>
          </View>

          <Text style={styles.title}>Découvrez Guelma autrement</Text>
          <Text style={styles.subtitle}>
            Six expériences privées officielles — patrimoine, nature et bien-être avec votre
            chauffeur PROTAXI.
          </Text>

          <TouchableOpacity style={styles.cta} activeOpacity={0.9} onPress={onPressCta}>
            <Text style={styles.ctaText}>Voir les expériences privées</Text>
            <Ionicons name="arrow-forward" size={18} color="#111" />
          </TouchableOpacity>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: DISCOVER_RADIUS_LG,
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.14)',
    ...discoverCardShadow,
    ...discoverPremiumGlow,
  },
  image: {
    minHeight: 340,
    justifyContent: 'flex-end',
  },
  imageStyle: {
    borderRadius: DISCOVER_RADIUS_LG,
  },
  gradient: {
    minHeight: 340,
    paddingHorizontal: 28,
    paddingVertical: 28,
    justifyContent: 'flex-end',
  },
  glowOrb: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: DISCOVER_GLOW,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: DISCOVER_GLOW,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  pillText: {
    color: DISCOVER_GREEN,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: -0.5,
    maxWidth: '92%',
    ...discoverTextShadow,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    fontWeight: '500',
    maxWidth: '92%',
  },
  cta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: DISCOVER_GREEN,
    ...discoverPremiumGlow,
  },
  ctaText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
});
