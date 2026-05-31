import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

const green = '#4ADE80';
const gold = '#D4A017';
const muted = '#9A9A9A';

type CityRideSummaryStripProps = {
  departure: string;
  destination: string;
  timingLabel: string;
  contactName: string;
  contactPhone: string;
  contactComplete: boolean;
};

function SummaryLine({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={14} color={iconColor} />
      <View style={styles.lineText}>
        <Text style={styles.lineLabel}>{label}</Text>
        <Text style={styles.lineValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function CityRideSummaryStrip({
  departure,
  destination,
  timingLabel,
  contactName,
  contactPhone,
  contactComplete,
}: CityRideSummaryStripProps) {
  const contactValue = contactComplete
    ? `${contactName.trim()} · ${contactPhone.trim()}`
    : 'Nom et téléphone requis';

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Récapitulatif</Text>
      <SummaryLine icon="navigate-outline" iconColor={green} label="Départ" value={departure} />
      <SummaryLine icon="flag-outline" iconColor={gold} label="Destination" value={destination} />
      <SummaryLine icon="time-outline" iconColor={green} label="Quand" value={timingLabel} />
      <SummaryLine
        icon="person-outline"
        iconColor={contactComplete ? green : gold}
        label="Contact"
        value={contactValue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.22)',
    backgroundColor: 'rgba(74,222,128,0.06)',
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  title: {
    color: '#ECECEC',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  lineText: {
    flex: 1,
    gap: 1,
  },
  lineLabel: {
    color: muted,
    fontSize: 10,
    fontWeight: '700',
  },
  lineValue: {
    color: '#F5F5F5',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
});
