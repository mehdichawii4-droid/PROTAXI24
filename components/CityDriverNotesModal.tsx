import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const green = '#4ADE80';
const gold = '#D4A017';

type Props = {
  visible: boolean;
  notes: string;
  onChangeNotes: (value: string) => void;
  onClose: () => void;
};

export default function CityDriverNotesModal({
  visible,
  notes,
  onChangeNotes,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Consignes chauffeur</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.noteBox}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={gold} />
            <TextInput
              placeholder="Ex. Appelez à l'arrivée, porte B…"
              placeholderTextColor="#666"
              value={notes}
              onChangeText={onChangeNotes}
              style={styles.input}
              multiline
              maxLength={200}
              autoFocus
            />
          </View>

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
  noteBox: {
    marginHorizontal: 16,
    minHeight: 120,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    minHeight: 96,
    textAlignVertical: 'top',
  },
  doneBtn: {
    marginHorizontal: 16,
    marginTop: 12,
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
