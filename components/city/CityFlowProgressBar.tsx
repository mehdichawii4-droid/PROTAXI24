import { StyleSheet, Text, View } from 'react-native';

const green = '#4ADE80';
const muted = '#8A8A8A';

type CityFlowProgressBarProps = {
  step: 1 | 2;
  totalSteps?: 2;
};

const STEP_LABELS: Record<1 | 2, string> = {
  1: 'Trajet & horaire',
  2: 'Véhicule & confirmation',
};

export default function CityFlowProgressBar({ step, totalSteps = 2 }: CityFlowProgressBarProps) {
  const progress = step / totalSteps;

  return (
    <View style={styles.wrap}>
      <View style={styles.metaRow}>
        <Text style={styles.stepLabel}>
          Étape {step}/{totalSteps} — {STEP_LABELS[step]}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 6,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  track: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: green,
  },
});
