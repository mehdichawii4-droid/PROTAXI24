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
import { getFirebaseAuth } from '@/firebase/authInstance';
import {
  createPartnerBooking,
  getPartnerBookingErrorMessage,
} from '@/services/partnerBookingService';
import {
  fetchPartnerProfile,
  getPartnerDisplayName,
  getPartnerTypeLabel,
} from '@/services/partnerService';
import type { PartnerBookingType } from '@/types/partner';
import { devError, devLog } from '@/utils/devLog';

const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const green = '#8BC53F';
const muted = '#8A8A8A';

const BOOKING_TYPES: Array<{ id: PartnerBookingType; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'transfer', label: 'Transfert', icon: 'car-outline' },
  { id: 'tour', label: 'Excursion', icon: 'compass-outline' },
];

export default function PartnerNewBookingScreen() {
  const [loadingPartner, setLoadingPartner] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [partnerName, setPartnerName] = useState('Partenaire PROTAXI');
  const [partnerTypeLabel, setPartnerTypeLabel] = useState('Hôtel');

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingType, setBookingType] = useState<PartnerBookingType>('transfer');

  useEffect(() => {
    const uid = getFirebaseAuth().currentUser?.uid;

    if (!uid) {
      devError('[PARTNER BOOKING] missing auth uid');
      setLoadingPartner(false);
      return;
    }

    void (async () => {
      try {
        devLog('[PARTNER BOOKING] load partner profile', { uid });
        const profile = await fetchPartnerProfile(uid);

        if (!profile) {
          Alert.alert(
            'Profil introuvable',
            'Impossible de charger votre profil partenaire.',
            [{ text: 'Retour', onPress: () => router.back() }],
          );
          return;
        }

        setPartnerName(getPartnerDisplayName(profile));
        setPartnerTypeLabel(getPartnerTypeLabel(profile.partnerType));
        devLog('[PARTNER BOOKING] partner profile loaded', {
          uid,
          partnerName: getPartnerDisplayName(profile),
        });
      } catch (error) {
        devError('[PARTNER BOOKING] partner profile load failed', error);
        Alert.alert('Erreur', 'Impossible de charger le profil partenaire.');
      } finally {
        setLoadingPartner(false);
      }
    })();
  }, []);

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
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Formulaire incomplet', validationError);
      return;
    }

    const partnerUid = getFirebaseAuth().currentUser?.uid;
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
