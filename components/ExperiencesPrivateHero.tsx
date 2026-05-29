import { StyleSheet, Text, View } from 'react-native';

const green = '#8BC53F';
const gold = '#C9A227';
const muted = '#8A8A8A';

type ExperiencesPrivateHeroProps = {
  subtitle: string;
};

export default function ExperiencesPrivateHero({ subtitle }: ExperiencesPrivateHeroProps) {
  return (
    <View style={styles.heroWrap}>
      <View style={styles.titleRow}>
        <Text style={styles.titleMain}>Expériences privées </Text>
        <Text style={styles.titleAccent}>premium</Text>
      </View>
      <View style={styles.accentLine} />
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    alignItems: 'center',
    marginTop: -26,
    paddingTop: 0,
    paddingBottom: 4,
    paddingHorizontal: 20,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleMain: {
    color: '#F2F2F2',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  titleAccent: {
    color: green,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  accentLine: {
    width: 28,
    height: 1,
    borderRadius: 1,
    backgroundColor: gold,
    opacity: 0.55,
  },
  subtitle: {
    color: muted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 8,
  },
});
