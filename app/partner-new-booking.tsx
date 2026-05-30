import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  createPartnerBooking,
  getPartnerBookingErrorMessage,
} from '@/services/partnerBookingService';
import {
  fetchMyPartnerProfile,
  getPartnerSelfErrorMessage,
} from '@/services/partnerSelfService';
import { getPartnerTypeLabel } from '@/services/partnerService';
import type { PartnerBookingType } from '@/types/partner';
import type { PartnerSelfProfile } from '@/types/partner';
import type { PartnerStatus } from '@/firebase/types';
import { devError, devLog } from '@/utils/devLog';
import { isPartnerOperational } from '@/utils/partnerSelfProfileDisplay';

const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const green = '#8BC53F';
const gold = '#D4A017';
const muted = '#8A8A8A';

const BOOKING_TYPES: Array<{ id: PartnerBookingType; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'transfer', label: 'Transfert', icon: 'car-outline' },
  { id: 'tour', label: 'Excursion', icon: 'compass-outline' },
];

function getLockedMessage(status: PartnerStatus): string {
  switch (status) {
    case 'pending_review':
      return 'Votre profil est en attente de validation. Les réservations seront disponibles après activation par PROTAXI.';
    case 'draft':
      return 'Complétez et envoyez votre profil en validation depuis « Modifier mon profil » avant de créer une réservation.';
    case 'suspended':
      return 'Votre compte est suspendu. Contactez le support PROTAXI pour plus d’informations.';
    default:
      return 'La création de réservations partenaire est réservée aux établissements au statut actif.';
  }
}

export default function PartnerNewBookingScreen() {
  const { user } = useAuth();
  const [loadingPartner, setLoadingPartner] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [partner, setPartner] = useState<PartnerSelfProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingType, setBookingType] = useState<PartnerBookingType>('transfer');

  const canOperate = partner ? isPartnerOperational(partner.status) : false;
  const partnerName = partner?.companyName || 'Partenaire PROTAXI';
  const partnerTypeLabel = partner ? getPartnerTypeLabel(partner.partnerType) : 'Hôtel';

  useEffect(() => {
    const uid = user?.uid;

    if (!uid) {
      devError('[PARTNER BOOKING] missing auth uid');
      setPartner(null);
      setLoadError('Session partenaire introuvable. Reconnectez-vous.');
      setLoadingPartner(false);
      return;
    }

    void (async () => {
      setLoadingPartner(true);
      setLoadError(null);

      try {
        devLog('[PARTNER BOOKING] load partner profile', { uid });
        const profile = await fetchMyPartnerProfile(uid);

        if (!profile) {
          setPartner(null);
          setLoadError('Impossible de charger votre profil partenaire.');
          Alert.alert(
            'Profil introuvable',
            'Impossible de charger votre profil partenaire.',
            [{ text: 'Retour', onPress: () => router.back() }],
          );
          return;
        }

        setPartner(profile);
        devLog('[PARTNER BOOKING] partner profile loaded', {
          uid,
          status: profile.status,
          partnerName: profile.companyName,
        });
      } catch (error) {
        setPartner(null);
        const message = getPartnerSelfErrorMessage(error);
        setLoadError(message);
        devError('[PARTNER BOOKING] partner profile load failed', error);
        Alert.alert('Erreur', message);
      } finally {
        setLoadingPartner(false);
      }
    })();
  }, [user?.uid]);

  const validateForm = () => {
    if (!clientName.trim()) return 'Nom du client requis.';
    if (!clientPhone.trim()) return 'Téléphone client requis.';
    if (!pickup.trim()) return 'Point de prise en charge requis.';
    if (!destination.trim()) {
      return bookingType === 'tour'
        ? 'Titre ou destination de l’excursion requis.'
        : 'Destination requise.';
    }
    if (!date.trim()) return 'Date requise.';
    if (!time.trim()) return 'Heure requise.';
    return null;
  };

  const handleSubmit = async () => {
    if (!canOperate) {
      Alert.alert(
        'Réservation indisponible',
        partner ? getLockedMessage(partner.status) : 'Partenaire non actif.',
      );
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Formulaire incomplet', validationError);
      return;
    }

    const partnerUid = user?.uid;
    if (!partnerUid) {
      Alert.alert('Session expirée', 'Reconnectez-vous pour créer une réservation.');
      return;
    }

    setSubmitting(true);

    try {
      const result = await createPartnerBooking({
        partnerUid,
        partnerName,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        pickup: pickup.trim(),
        destination: destination.trim(),
        date: date.trim(),
        time: time.trim(),
        bookingType,
        notes: notes.trim(),
      });

      Alert.alert(
        'Réservation créée',
        bookingType === 'transfer'
          ? 'Le transfert a été enregistré et apparaîtra dans votre dashboard.'
          : 'L’excursion a été enregistrée et apparaîtra dans votre dashboard.',
        [
          {
            text: 'Retour dashboard',
            onPress: () => router.replace('/partner-dashboard'),
          },
        ],
      );

      devLog('[PARTNER BOOKING] success', result);
    } catch (error) {
      Alert.alert('Erreur', getPartnerBookingErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPartner) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={green} />
          <Text style={styles.loadingText}>Chargement du profil partenaire...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Nouvelle réservation</Text>
          <Text style={styles.subtitle}>{partnerName}</Text>
          <Text style={styles.meta}>{partnerTypeLabel} · source partenaire</Text>
        </View>

        {loadError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={22} color="#FF5A5A" />
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : null}

        {!canOperate && partner ? (
          <View style={styles.lockedCard}>
            <Ionicons name="lock-closed-outline" size={22} color={gold} />
            <Text style={styles.lockedTitle}>Réservation indisponible</Text>
            <Text style={styles.lockedText}>{getLockedMessage(partner.status)}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
              <Text style={styles.secondaryBtnText}>Retour au dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {canOperate ? (
          <>
            <Text style={styles.label}>Type de réservation</Text>
            <View style={styles.typeRow}>
              {BOOKING_TYPES.map((type) => {
                const active = bookingType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.typeChip, active && styles.typeChipActive]}
                    onPress={() => setBookingType(type.id)}
                  >
                    <Ionicons name={type.icon} size={16} color={active ? '#050505' : green} />
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Nom du client</Text>
              <TextInput
                style={styles.input}
                value={clientName}
                onChangeText={setClientName}
                placeholder="Nom complet du client"
                placeholderTextColor={muted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Téléphone client</Text>
              <TextInput
                style={styles.input}
                value={clientPhone}
                onChangeText={setClientPhone}
                placeholder="+213..."
                placeholderTextColor={muted}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Prise en charge</Text>
              <TextInput
                style={styles.input}
                value={pickup}
                onChangeText={setPickup}
                placeholder="Hôtel, adresse, aéroport..."
                placeholderTextColor={muted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                {bookingType === 'tour' ? 'Excursion / destination' : 'Destination'}
              </Text>
              <TextInput
                style={styles.input}
                value={destination}
                onChangeText={setDestination}
                placeholder={
                  bookingType === 'tour'
                    ? 'Ex. Guelma Antique, Hammam Debagh...'
                    : 'Ex. Aéroport Constantine, Centre-ville...'
                }
                placeholderTextColor={muted}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.halfField]}>
                <Text style={styles.label}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="JJ/MM/AAAA"
                  placeholderTextColor={muted}
                />
              </View>
              <View style={[styles.field, styles.halfField]}>
                <Text style={styles.label}>Heure</Text>
                <TextInput
                  style={styles.input}
                  value={time}
                  onChangeText={setTime}
                  placeholder="HH:MM"
                  placeholderTextColor={muted}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Informations complémentaires (optionnel)"
                placeholderTextColor={muted}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#050505" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#050505" />
                  <Text style={styles.submitBtnText}>Créer la réservation</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bg,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: muted,
    fontSize: 14,
    fontWeight: '600',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: card,
    marginBottom: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: green,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  meta: {
    color: muted,
    fontSize: 13,
    marginTop: 4,
  },
  errorCard: {
    backgroundColor: 'rgba(255,90,90,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.25)',
    padding: 16,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: '#FFB4B4',
    fontSize: 14,
    lineHeight: 20,
  },
  lockedCard: {
    backgroundColor: 'rgba(212,160,23,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.3)',
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  lockedTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  lockedText: {
    color: muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  secondaryBtn: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
  label: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: card,
    paddingVertical: 12,
  },
  typeChipActive: {
    backgroundColor: green,
    borderColor: green,
  },
  typeChipText: {
    color: green,
    fontSize: 14,
    fontWeight: '800',
  },
  typeChipTextActive: {
    color: '#050505',
  },
  field: {
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  input: {
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 15,
  },
  notesInput: {
    minHeight: 96,
  },
  submitBtn: {
    marginTop: 10,
    backgroundColor: green,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#050505',
    fontSize: 16,
    fontWeight: '800',
  },
});
