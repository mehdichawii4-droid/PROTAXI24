import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import RideRatingSheet from '@/components/RideRatingSheet';
import { useAuth } from '@/hooks/useAuth';
import { getRideDocRef } from '@/firebase/firestore';
import {
  clientHasRatedDriverFromRide,
  readLegacyClientStars,
  resolveClientHasRatedDriver,
} from '@/services/rideRating';
import { devLog } from '@/utils/devLog';

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() || '';
  }
  return String(value || '').trim();
}

export default function RatingScreen() {
  const params = useLocalSearchParams<{
    rideId?: string | string[];
    driverId?: string | string[];
    driverName?: string | string[];
  }>();
  const { user } = useAuth();
  const clientUid = String(user?.uid ?? '').trim();

  const rideId = normalizeParam(params.rideId);
  const [driverId, setDriverId] = useState(normalizeParam(params.driverId));
  const [driverName, setDriverName] = useState(
    normalizeParam(params.driverName) || 'Votre chauffeur',
  );
  const [loadingRide, setLoadingRide] = useState(Boolean(rideId));
  const [sheetVisible, setSheetVisible] = useState(false);
  const [existingStars, setExistingStars] = useState<number | null>(null);
  const [existingComment, setExistingComment] = useState('');

  useEffect(() => {
    if (!rideId) {
      setLoadingRide(false);
      return;
    }

    void (async () => {
      try {
        const snapshot = await getDoc(getRideDocRef(rideId));
        if (!snapshot.exists()) return;

        const data = snapshot.data() as Record<string, unknown>;
        const rideDriverId = String(data.driverId || data.ratedDriverId || '').trim();
        const rideDriverName = String(data.driverName || data.ratedDriverName || '').trim();

        if (rideDriverId) {
          setDriverId((current) => current || rideDriverId);
        }
        if (rideDriverName) {
          setDriverName((current) =>
            current && current !== 'Votre chauffeur' ? current : rideDriverName || current,
          );
        }

        const legacyStars = readLegacyClientStars(data);
        const alreadyRated = await resolveClientHasRatedDriver(
          rideId,
          clientUid,
          data,
        );

        if (alreadyRated) {
          setExistingStars(legacyStars ?? 5);
          setExistingComment(String(data.comment || '').trim());
        }

        setSheetVisible(true);

        devLog('[RATING] ride loaded', {
          rideId,
          driverId: rideDriverId,
          alreadyRated,
          v2: clientHasRatedDriverFromRide(data),
        });
      } finally {
        setLoadingRide(false);
      }
    })();
  }, [rideId, clientUid]);

  if (!rideId || !clientUid) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <Text style={styles.errorTitle}>Session ou course invalide</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Avis course</Text>
        <View style={{ width: 28 }} />
      </View>

      {loadingRide ? (
        <ActivityIndicator color="#D4A017" style={{ marginTop: 40 }} />
      ) : (
        <RideRatingSheet
          visible={sheetVisible}
          onClose={() => {
            setSheetVisible(false);
            router.back();
          }}
          onLater={() => router.push('/reservation')}
          onSubmitted={() => router.push('/reservation')}
          rideId={rideId}
          fromUserId={clientUid}
          fromRole="client"
          toUserId={driverId}
          toRole="driver"
          peerLabel={driverName}
          toUserName={driverName}
          existingStars={existingStars}
          existingComment={existingComment}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: {
    paddingTop: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  errorTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
  },
  backBtn: {
    alignSelf: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#D4A017',
  },
  backBtnText: { color: '#111', fontWeight: '900' },
});
