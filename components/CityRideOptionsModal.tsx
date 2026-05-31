import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const green = '#4ADE80';
const gold = '#D4A017';

type Props = {
  visible: boolean;
  onClose: () => void;
  passengers: number;
  setPassengers: (value: number) => void;
  bags: number;
  setBags: (value: number) => void;
  waitingTime: number;
  setWaitingTime: (value: number) => void;
};

function CounterRow({
  icon,
  label,
  value,
  onDecrement,
  onIncrement,
  suffix = '',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  suffix?: string;
}) {
  return (
    <View style={styles.counterRow}>
      <Ionicons name={icon} size={18} color={gold} />
      <Text style={styles.counterLabel}>{label}</Text>
      <TouchableOpacity style={styles.counterBtn} onPress={onDecrement}>
        <Ionicons name="remove" size={16} color="#FFF" />
      </TouchableOpacity>
      <Text style={styles.counterValue}>
        {value}
        {suffix}
      </Text>
      <TouchableOpacity style={styles.counterBtn} onPress={onIncrement}>
        <Ionicons name="add" size={16} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

export default function CityRideOptionsModal({
  visible,
  onClose,
  passengers,
  setPassengers,
  bags,
  setBags,
  waitingTime,
  setWaitingTime,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Passagers & options</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <CounterRow
              icon="people-outline"
              label="Passagers"
              value={passengers}
              onDecrement={() => setPassengers(Math.max(1, passengers - 1))}
              onIncrement={() => setPassengers(passengers + 1)}
            />
            <CounterRow
              icon="briefcase-outline"
              label="Bagages"
              value={bags}
              onDecrement={() => setBags(Math.max(0, bags - 1))}
              onIncrement={() => setBags(bags + 1)}
            />
            <CounterRow
              icon="time-outline"
              label="Attente"
              value={waitingTime}
              onDecrement={() => setWaitingTime(Math.max(0, waitingTime - 15))}
              onIncrement={() => setWaitingTime(waitingTime + 15)}
              suffix=" min"
            />

            <Text style={styles.hint}>
              Nom et téléphone se renseignent à l&apos;étape précédente, avant le choix du
              véhicule.
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.9}>
            <Text style={styles.doneText}>Valider</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '78%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  content: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 12,
  },
  counterRow: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  counterLabel: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  counterBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    minWidth: 52,
    textAlign: 'center',
    color: green,
    fontSize: 14,
    fontWeight: '900',
  },
  hint: {
    color: '#888',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 4,
  },
  doneBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
});
