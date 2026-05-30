import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { onSnapshot } from 'firebase/firestore';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AssignedGuideClientCard from '@/components/AssignedGuideClientCard';
import { getBookingModeLabel } from '@/constants/experiencesPrivateCatalog';
import { getTourBookingDocRef } from '@/firebase/firestore';
import {
  parseClientAssignedGuide,
  shouldShowClientAssignedGuide,
  type ClientAssignedGuideDisplay,
} from '@/services/clientAssignedGuide';
import { devError } from '@/utils/devLog';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const green = '#8BC53F';
const gold = '#D4A017';
const bg = '#050505';
const muted = '#8A8A8A';

const getParamString = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? '' : value ?? '';

type LiveBookingStatus = 'pending' | 'confirmed' | 'cancelled';

function normalizeLiveStatus(value: unknown): LiveBookingStatus {
  if (value === 'confirmed' || value === 'cancelled') return value;
  return 'pending';
}

const STATUS_TITLE: Record<LiveBookingStatus, string> = {
  pending: 'En attente de confirmation',
  confirmed: 'Demande confirmée',
  cancelled: 'Demande annulée',
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function ExperienceConfirmedScreen() {
  const params = useLocalSearchParams<{
    tourBookingId?: string | string[];
    experience?: string | string[];
    formulaLabel?: string | string[];
    familyLabel?: string | string[];
    date?: string | string[];
    participants?: string | string[];
    notes?: string | string[];
    options?: string | string[];
    bookingMode?: string | string[];
    price?: string | string[];
  }>();

  const tourBookingId = getParamString(params.tourBookingId);
  const experience = getParamString(params.experience) || 'Expérience PROTAXI';
  const formulaLabel =
    getParamString(params.formulaLabel) ||
    getParamString(params.familyLabel) ||
    getBookingModeLabel('private');
  const date = getParamString(params.date) || 'À confirmer';
  const participants = getParamString(params.participants) || '—';
  const notes = getParamString(params.notes);
  const options = getParamString(params.options);
  const price = getParamString(params.price) || 'Sur confirmation';

  const [liveStatus, setLiveStatus] = useState<LiveBookingStatus>('pending');
  const [assignedGuide, setAssignedGuide] = useState<ClientAssignedGuideDisplay | null>(null);

  useEffect(() => {
    if (!tourBookingId) return;

    const bookingRef = getTourBookingDocRef(tourBookingId);
    const unsubscribe = onSnapshot(
      bookingRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as Record<string, unknown>;
        setLiveStatus(normalizeLiveStatus(data.status));
        const bookingRow = {
          source: String(data.source || 'experiences-private'),
          status: normalizeLiveStatus(data.status),
          ...data,
        };
        setAssignedGuide(
          shouldShowClientAssignedGuide(bookingRow)
            ? parseClientAssignedGuide(bookingRow)
            : null,
        );
      },
      (error) => {
        devError('[SNAPSHOT DENIED - experience-confirmed - tourBooking]', error);
      },
    );

    return () => unsubscribe();
  }, [tourBookingId]);

  const statusTitle = STATUS_TITLE[liveStatus];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['rgba(139,197,63,0.08)', 'rgba(5,5,5,0)']}
          style={styles.topGlow}
        />

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={72} color={green} />
          </View>

          <Text style={styles.title}>Demande enregistrée</Text>
          <Text style={styles.subtitle}>
            PROTAXI confirmera votre expérience et le tarif avant le jour J.
          </Text>

          <View style={styles.statusCard}>
            <View style={styles.statusDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{statusTitle}</Text>
              <Text style={styles.statusText}>
                Notre équipe traite votre demande sous réserve de disponibilité.
              </Text>
            </View>
          </View>

          {assignedGuide ? <AssignedGuideClientCard guide={assignedGuide} variant="full" /> : null}

          <LinearGradient
            colors={['rgba(28,28,28,0.95)', 'rgba(12,12,12,0.98)']}
            style={styles.recapCard}
          >
            <SummaryRow label="Formule" value={formulaLabel} />
            <SummaryRow label="Expérience" value={experience} />
            <SummaryRow label="Date & heure" value={date} />
            <SummaryRow label="Participants" value={participants} />
            {options && options !== 'Aucune option supplémentaire' ? (
              <SummaryRow label="Options" value={options} />
            ) : null}
            <SummaryRow label="Tarif" value={price} />
            {notes && notes !== 'Aucune note' ? (
              <SummaryRow label="Message" value={notes} />
            ) : null}
            {tourBookingId ? (
              <SummaryRow label="Référence" value={tourBookingId.slice(0, 8).toUpperCase()} />
            ) : null}
          </LinearGradient>

          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.9}
            onPress={() => router.replace(PROTAXI_ROUTES.home)}
          >
            <Text style={styles.primaryBtnText}>Retour à l&apos;accueil</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.9}
            onPress={() => router.push(PROTAXI_ROUTES.history)}
          >
            <Ionicons name="calendar-outline" size={18} color={gold} />
            <Text style={styles.secondaryBtnText}>Mes réservations</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: bg },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: { marginBottom: 4 },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  statusCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(139,197,63,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.25)',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: green,
    marginTop: 5,
  },
  statusTitle: { color: green, fontSize: 14, fontWeight: '800' },
  statusText: { color: muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  recapCard: {
    width: '100%',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  row: { gap: 4 },
  rowLabel: {
    color: muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  rowValue: { color: '#F0F0F0', fontSize: 15, fontWeight: '600', lineHeight: 21 },
  primaryBtn: {
    width: '100%',
    backgroundColor: green,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#050505', fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    backgroundColor: 'rgba(212,160,23,0.06)',
  },
  secondaryBtnText: { color: gold, fontSize: 15, fontWeight: '700' },
});
