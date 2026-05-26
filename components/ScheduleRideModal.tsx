import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const green = '#4ADE80';
const gold = '#D4A017';

type SectionId = 'today' | 'tomorrow' | 'date' | 'time';

export function formatScheduleDayLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Aujourd’hui';
  if (diffDays === 1) return 'Demain';
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatScheduleSummary(date: Date): string {
  const day = formatScheduleDayLabel(date);
  const time = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day} • ${time}`;
}

export function getDefaultScheduleDate(): Date {
  const next = new Date(Date.now() + 30 * 60 * 1000);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const rounded = Math.ceil(minutes / 5) * 5;
  next.setMinutes(rounded === 60 ? 0 : rounded);
  if (rounded === 60) next.setHours(next.getHours() + 1);
  return next;
}

export function normalizeScheduleDate(draft: Date): Date {
  const min = new Date(Date.now() + 15 * 60 * 1000);
  if (draft.getTime() < min.getTime()) return min;
  return draft;
}

export function getSchedulePriceExtra(scheduledAt: Date | null, isLater: boolean): number {
  if (!isLater || !scheduledAt) return 0;

  let extra = 0;
  const hour = scheduledAt.getHours();
  const day = scheduledAt.getDay();

  if (hour >= 22 || hour < 5) extra += 150;
  if (hour >= 7 && hour < 9) extra += 100;
  if (day === 0 || day === 6) extra += 80;

  return extra;
}

type Props = {
  visible: boolean;
  initialDate: Date;
  onClose: () => void;
  onConfirm: (date: Date) => void;
};

const SECTIONS: { id: SectionId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'today', label: 'Aujourd’hui', icon: 'today-outline' },
  { id: 'tomorrow', label: 'Demain', icon: 'sunny-outline' },
  { id: 'date', label: 'Choisir date', icon: 'calendar-outline' },
  { id: 'time', label: 'Choisir heure', icon: 'time-outline' },
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function mergeDatePart(base: Date, daySource: Date): Date {
  const merged = new Date(base);
  merged.setFullYear(daySource.getFullYear(), daySource.getMonth(), daySource.getDate());
  return merged;
}

function mergeTimePart(base: Date, timeSource: Date): Date {
  const merged = new Date(base);
  merged.setHours(timeSource.getHours(), timeSource.getMinutes(), 0, 0);
  return merged;
}

export default function ScheduleRideModal({
  visible,
  initialDate,
  onClose,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(initialDate);
  const [activeSection, setActiveSection] = useState<SectionId>('time');
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setDraft(initialDate);
    setActiveSection('time');
    dragY.setValue(0);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 220,
    }).start();
  }, [visible, initialDate, slideAnim, dragY]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) dragY.setValue(gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 90 || gesture.vy > 0.9) {
          onClose();
          return;
        }
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 260,
        }).start();
      },
    }),
  ).current;

  const translateY = Animated.add(
    slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [520, 0],
    }),
    dragY,
  );

  const preview = useMemo(() => formatScheduleSummary(draft), [draft]);

  const handleSectionPress = (section: SectionId) => {
    setActiveSection(section);
    const now = new Date();

    if (section === 'today') {
      setDraft((prev) => mergeDatePart(prev, now));
      return;
    }
    if (section === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDraft((prev) => mergeDatePart(prev, tomorrow));
      return;
    }
  };

  const handleConfirm = () => {
    onConfirm(normalizeScheduleDate(draft));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              transform: [{ translateY }],
            },
          ]}
        >
          <View {...panResponder.panHandlers}>
            <View style={styles.handleRow}>
              <View style={styles.handle} />
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.title}>Planifier votre course</Text>
          <Text style={styles.preview}>📅 {preview}</Text>

          <View style={styles.sectionsGrid}>
            {SECTIONS.map((section) => {
              const active = activeSection === section.id;
              return (
                <TouchableOpacity
                  key={section.id}
                  style={[styles.sectionChip, active && styles.sectionChipActive]}
                  onPress={() => handleSectionPress(section.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={section.icon}
                    size={15}
                    color={active ? '#111' : green}
                  />
                  <Text
                    style={[styles.sectionChipText, active && styles.sectionChipTextActive]}
                    numberOfLines={1}
                  >
                    {section.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.pickerBox}>
            {activeSection === 'date' || activeSection === 'today' || activeSection === 'tomorrow' ? (
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                minimumDate={startOfDay(new Date())}
                locale="fr-FR"
                themeVariant="dark"
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    setDraft((prev) => mergeDatePart(prev, selectedDate));
                    if (activeSection !== 'date') setActiveSection('date');
                  }
                }}
              />
            ) : (
              <DateTimePicker
                value={draft}
                mode="time"
                display="spinner"
                is24Hour
                locale="fr-FR"
                themeVariant="dark"
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    setDraft((prev) => mergeTimePart(prev, selectedDate));
                  }
                }}
              />
            )}
          </View>

          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.9}>
            <Text style={styles.confirmBtnText}>Valider</Text>
            <Ionicons name="checkmark" size={20} color="#111" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(74,222,128,0.22)',
    paddingHorizontal: 16,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -12 },
        shadowOpacity: 0.55,
        shadowRadius: 24,
      },
      android: { elevation: 24 },
    }),
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 28,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 4,
  },
  preview: {
    color: green,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 14,
  },
  sectionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  sectionChip: {
    width: '48%',
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.22)',
    backgroundColor: 'rgba(74,222,128,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  sectionChipActive: {
    backgroundColor: green,
    borderColor: green,
  },
  sectionChipText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionChipTextActive: {
    color: '#111',
  },
  pickerBox: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.22)',
    marginBottom: 12,
  },
  confirmBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
});
