import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import CityBookingMap from '@/components/CityBookingMap';
import CityFlowProgressBar from '@/components/city/CityFlowProgressBar';
import CityDriverNotesModal from '@/components/CityDriverNotesModal';
import CityRideOptionsModal from '@/components/CityRideOptionsModal';
import CityVehicleBottomSheet, {
  CITY_VEHICLES,
  CityVehicleId,
  cityVehicleExtraPrice,
  SHEET_SNAP,
} from '@/components/CityVehicleBottomSheet';
import MapSelectionMode from '@/components/MapSelectionMode';
import DestinationSearchModal, {
  DestinationPick,
} from '@/components/DestinationSearchModal';
import ScheduleRideModal, {
  formatScheduleSummary,
  getDefaultScheduleDate,
  getSchedulePriceExtra,
} from '@/components/ScheduleRideModal';
import { getFirebaseAuth } from '@/firebase/authInstance';
import { useAuth } from '@/hooks/useAuth';
import { useCityLiveDrivers } from '@/hooks/useCityLiveDrivers';
import { submitCityRide } from '@/services/cityRideService';
import { reverseGeocodeCoordinate } from '@/utils/cityMapGeocode';
import { isValidMapCoordinate } from '@/utils/rideTracking';

const gold = '#D4A017';
const green = '#4ADE80';

const destinations = [
  { name: 'Gare routière', sub: 'Départ / arrivée', icon: 'bus', price: 500 },
  { name: 'Hôpital / Clinique', sub: 'Santé & urgence', icon: 'hospital-building', price: 600 },
  { name: 'Université / École', sub: 'Études & formation', icon: 'school', price: 500 },
  { name: 'Courses / Shopping', sub: 'Marché, supermarché', icon: 'cart', price: 700 },
  { name: 'Administratif', sub: 'Banque, poste, mairie', icon: 'bank', price: 600 },
  { name: 'Autre destination', sub: 'Écrire manuellement', icon: 'map-marker', price: 0 },
];

const BASE_CITY_FARE = 500;
const OPTIONAL_DESTINATION_LABEL = 'À définir avec le chauffeur';
const DEFAULT_ROUTE_ETA_MIN = 10;

export default function CityScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rideOptionsVisible, setRideOptionsVisible] = useState(false);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const sheetHeightShared = useSharedValue(SHEET_SNAP.collapsed);
  const sheetProgressShared = useSharedValue(0);
  const mapParallaxEnabled = useSharedValue(0);
  const [destinationModalVisible, setDestinationModalVisible] = useState(false);
  const [mapSelectionMode, setMapSelectionMode] = useState(false);
  const [pickupCoordinate, setPickupCoordinate] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectionCenter, setSelectionCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [liveAddress, setLiveAddress] = useState('Détection en cours…');
  const [isMapDragging, setIsMapDragging] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [routePreview, setRoutePreview] = useState<{
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
  } | null>(null);
  const [routeMetrics, setRouteMetrics] = useState<{
    distanceKm: number;
    etaMin: number;
  } | null>(null);
  const cityMapRef = useRef<{ fitRoute: () => void } | null>(null);
  const geocodeRequestRef = useRef(0);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bookingReady, setBookingReady] = useState(false);
  const [destinationPrice, setDestinationPrice] = useState<number | null>(null);
  const [vehicleType, setVehicleType] = useState<CityVehicleId>('Berline');
  const [destinationType, setDestinationType] = useState('Gare routière');
  const [customDestination, setCustomDestination] = useState('');
  const [pickup, setPickup] = useState('Ma position actuelle, Guelma');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [timingMode, setTimingMode] = useState<'now' | 'later'>('now');
  const [timingConfirmed, setTimingConfirmed] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [date, setDate] = useState(getDefaultScheduleDate());
  const [waitingTime, setWaitingTime] = useState(0);
  const [passengers, setPassengers] = useState(1);
  const [bags, setBags] = useState(0);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [region, setRegion] = useState({
    latitude: 36.462,
    longitude: 7.426,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
      setPickupCoordinate({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();
  }, []);

  useEffect(() => {
    if (profile?.fullName && !fullName.trim()) {
      setFullName(profile.fullName);
    }
    if (profile?.phone && !phone.trim()) {
      setPhone(profile.phone);
    }
  }, [profile, fullName, phone]);

  const selectedDestination = destinations.find((item) => item.name === destinationType);

  const hasDestination = Boolean(destinationAddress.trim());

  const finalDestination = hasDestination
    ? destinationType === 'Autre destination'
      ? customDestination || destinationAddress || 'Destination à préciser'
      : destinationAddress || destinationType
    : OPTIONAL_DESTINATION_LABEL;

  const rideMode = timingMode === 'now' ? 'Maintenant' : 'Réserver plus tard';
  const activeSchedule = timingMode === 'later' ? scheduledAt : null;

  const baseEtaMin = routeMetrics?.etaMin ?? DEFAULT_ROUTE_ETA_MIN;

  const fareBase = useMemo(() => {
    return hasDestination
      ? destinationPrice ?? selectedDestination?.price ?? 0
      : BASE_CITY_FARE;
  }, [hasDestination, destinationPrice, selectedDestination]);

  const estimatedPrice = useMemo(() => {
    const waitPrice = waitingTime * 30;
    const scheduleExtra = getSchedulePriceExtra(activeSchedule, timingMode === 'later');
    return fareBase + waitPrice + scheduleExtra + cityVehicleExtraPrice(vehicleType);
  }, [fareBase, waitingTime, vehicleType, activeSchedule, timingMode]);

  const vehiclePrices = useMemo(() => {
    const waitPrice = waitingTime * 30;
    const scheduleExtra = getSchedulePriceExtra(activeSchedule, timingMode === 'later');
    const shared = fareBase + waitPrice + scheduleExtra;
    return Object.fromEntries(
      CITY_VEHICLES.map((option) => [option.id, shared + option.extraPrice]),
    ) as Record<CityVehicleId, number>;
  }, [fareBase, waitingTime, activeSchedule, timingMode]);

  const formattedPrice =
    estimatedPrice > 0
      ? `${estimatedPrice.toLocaleString('fr-FR')} DA`
      : 'Sur confirmation';

  const panelBottomInset = Math.max(insets.bottom, 6) + 4;
  const selectionBottomInset = Math.max(insets.bottom, 12);
  const showVehicleStep =
    timingConfirmed && (timingMode === 'now' || Boolean(scheduledAt));
  const flowStep: 1 | 2 = showVehicleStep ? 2 : 1;
  const contactComplete = Boolean(fullName.trim() && phone.trim());
  const timingSummaryLabel =
    timingMode === 'later' && scheduledAt
      ? formatScheduleSummary(scheduledAt)
      : timingMode === 'now' && timingConfirmed
        ? 'Maintenant'
        : 'Choisir un horaire';
  const liveDriversEnabled = showVehicleStep && !mapSelectionMode;

  const {
    liveCards,
    liveMapDrivers,
    fallbackVehicleIds,
    loading: liveDriversLoading,
    hasLiveDrivers,
  } = useCityLiveDrivers({
    visible: liveDriversEnabled,
    baseEtaMin,
  });

  useEffect(() => {
    mapParallaxEnabled.value = showVehicleStep && !mapSelectionMode ? 1 : 0;
  }, [showVehicleStep, mapSelectionMode, mapParallaxEnabled]);

  const closeVehicleSheet = useCallback(() => {
    setTimingConfirmed(false);
    setTermsAccepted(false);
    mapParallaxEnabled.value = 0;
    sheetHeightShared.value = SHEET_SNAP.collapsed;
    sheetProgressShared.value = 0;
  }, [mapParallaxEnabled, sheetHeightShared, sheetProgressShared]);

  const mapWrapAnimatedStyle = useAnimatedStyle(() => {
    const active = mapParallaxEnabled.value;
    const progress = sheetProgressShared.value;
    return {
      bottom: active * sheetHeightShared.value,
      transform: [
        {
          translateY: active * interpolate(progress, [0, 1], [0, -26], Extrapolation.CLAMP),
        },
        {
          scale: interpolate(
            active * progress,
            [0, 1],
            [1, 0.93],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Veuillez autoriser la localisation.');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    setRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
    setPickup('Ma position actuelle');
    setPickupCoordinate({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
  };

  const applyRoutePreview = useCallback(
    (destination: { latitude: number; longitude: number }) => {
      const origin = pickupCoordinate ?? {
        latitude: region.latitude,
        longitude: region.longitude,
      };
      setRoutePreview({
        origin,
        destination,
      });
      setRouteMetrics(null);
    },
    [pickupCoordinate, region.latitude, region.longitude],
  );

  const resolveLiveAddress = useCallback(async (coordinate: { latitude: number; longitude: number }) => {
    const requestId = ++geocodeRequestRef.current;
    setIsResolvingAddress(true);
    try {
      const label = await reverseGeocodeCoordinate(coordinate);
      if (requestId !== geocodeRequestRef.current) return;
      setLiveAddress(label);
    } catch {
      if (requestId !== geocodeRequestRef.current) return;
      setLiveAddress(`${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`);
    } finally {
      if (requestId === geocodeRequestRef.current) {
        setIsResolvingAddress(false);
      }
    }
  }, []);

  const scheduleLiveAddressLookup = useCallback(
    (coordinate: { latitude: number; longitude: number }) => {
      if (geocodeTimerRef.current) {
        clearTimeout(geocodeTimerRef.current);
      }
      geocodeTimerRef.current = setTimeout(() => {
        resolveLiveAddress(coordinate);
      }, 260);
    },
    [resolveLiveAddress],
  );

  useEffect(() => {
    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    };
  }, []);

  const handleDestinationSelect = useCallback((pick: DestinationPick) => {
    const label = String(pick?.label ?? '').trim();
    if (!label) return;

    setDestinationAddress(label);
    setDestinationPrice(pick.price);
    setBookingReady(true);
    setMapSelectionMode(false);
    setTimingConfirmed(false);
    setTimingMode('now');
    setScheduledAt(null);
    setTermsAccepted(false);

    applyRoutePreview({ latitude: pick.latitude, longitude: pick.longitude });

    if (pick.destinationType) {
      setDestinationType(pick.destinationType);
      setCustomDestination('');
    } else if (pick.price >= 4000) {
      setDestinationType('Autre destination');
      setCustomDestination(label);
    } else {
      setDestinationType('Autre destination');
      setCustomDestination('');
    }

    const isLongTrip = pick.price >= 4000;
    setRegion({
      latitude: pick.latitude,
      longitude: pick.longitude,
      latitudeDelta: isLongTrip ? 0.85 : 0.025,
      longitudeDelta: isLongTrip ? 0.85 : 0.025,
    });

    setDestinationModalVisible(false);
  }, [applyRoutePreview]);

  const confirmCity = async () => {
    if (!termsAccepted) {
      Alert.alert('Conditions requises', 'Veuillez accepter les conditions générales d’utilisation.');
      return;
    }
    if (!fullName.trim() || !phone.trim()) {
      Alert.alert(
        'Informations manquantes',
        'Renseignez votre nom et votre téléphone à l’étape Trajet & horaire.',
      );
      closeVehicleSheet();
      return;
    }
    if (!pickup.trim()) {
      Alert.alert('Départ manquant', 'Veuillez saisir un lieu de départ.');
      return;
    }
    if (timingMode === 'later' && !scheduledAt) {
      Alert.alert('Horaire manquant', 'Choisissez une date et une heure pour votre course.');
      setScheduleModalVisible(true);
      return;
    }
    if (isSubmitting) return;

    const bookingDate = timingMode === 'later' && scheduledAt ? scheduledAt : new Date();

    setIsSubmitting(true);
    try {
      const rideData = {
        departure: pickup,
        destination: finalDestination,
        selectedVehicle: vehicleType,
        estimatedPrice,
        estimatedDuration: baseEtaMin,
        createdAt: new Date().toISOString(),
        status: 'En attente' as const,
      };

      if (rideMode === 'Maintenant') {
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
      }

      const result = await submitCityRide(
        {
          service: 'Ville 24H',
          destinationType,
          departure: rideData.departure,
          destination: rideData.destination,
          rideMode,
          date:
            rideMode === 'Réserver plus tard'
              ? bookingDate.toLocaleDateString('fr-FR')
              : 'Maintenant',
          time:
            rideMode === 'Réserver plus tard'
              ? bookingDate.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Maintenant',
          waitingTime: `${waitingTime} min`,
          passengers: `${passengers} passager${passengers > 1 ? 's' : ''}`,
          bags: `${bags} bagage${bags > 1 ? 's' : ''}`,
          fullName: fullName || 'Client PROTAXI',
          phone: phone || 'Non renseigné',
          notes: notes || 'Aucune note',
          price: formattedPrice,
          vehicleType: rideData.selectedVehicle,
          estimatedDuration: rideData.estimatedDuration,
          estimatedPrice: rideData.estimatedPrice,
          ...(isValidMapCoordinate(pickupCoordinate)
            ? {
                pickupLatitude: pickupCoordinate.latitude,
                pickupLongitude: pickupCoordinate.longitude,
              }
            : {}),
        },
        {
          clientUid: getFirebaseAuth().currentUser?.uid,
          profileFullName: profile?.fullName,
          profilePhone: profile?.phone,
        },
      );

      if (result.status === 'auth_required') {
        Alert.alert(
          'Connexion requise',
          'Connectez-vous pour réserver une course taxi PROTAXI.',
        );
        return;
      }
      if (result.status === 'missing_ride_id') {
        Alert.alert(
          'Erreur',
          'Impossible d’obtenir l’identifiant de la course. Veuillez réessayer.',
        );
        return;
      }
      if (result.status === 'error') {
        Alert.alert('Erreur', 'Impossible d’enregistrer la course. Veuillez réessayer.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleConfirm = (picked: Date) => {
    setScheduledAt(picked);
    setDate(picked);
    setScheduleModalVisible(false);
    setTermsAccepted(false);
    setTimingConfirmed(true);
  };

  const handleSelectNow = () => {
    setTimingMode('now');
    setScheduledAt(null);
    setScheduleModalVisible(false);
    setTermsAccepted(false);
    setTimingConfirmed(true);
  };

  const handleSelectLater = () => {
    setTimingMode('later');
    setTimingConfirmed(false);
    setScheduleModalVisible(true);
  };

  const handleCommanderPress = () => {
    confirmCity();
  };

  const handleSelectOnMap = () => {
    setDestinationModalVisible(false);
    setRoutePreview(null);
    setRouteMetrics(null);
    const center = {
      latitude: region.latitude,
      longitude: region.longitude,
    };
    setSelectionCenter(center);
    setLiveAddress('Détection en cours…');
    setMapSelectionMode(true);
    resolveLiveAddress(center);
  };

  const handleSelectionRegionChange = useCallback(
    (nextRegion: typeof region, dragging: boolean) => {
      const center = {
        latitude: nextRegion.latitude,
        longitude: nextRegion.longitude,
      };
      setSelectionCenter(center);
      setIsMapDragging(dragging);
      scheduleLiveAddressLookup(center);
    },
    [scheduleLiveAddressLookup],
  );

  const handleValidateMapPoint = () => {
    if (!selectionCenter) return;

    const label = liveAddress.trim() || 'Adresse sélectionnée sur la carte';
    handleDestinationSelect({
      id: `map-${selectionCenter.latitude}-${selectionCenter.longitude}`,
      label,
      subtitle: 'Sélection sur la carte',
      latitude: selectionCenter.latitude,
      longitude: selectionCenter.longitude,
      price: 700,
      icon: 'location-outline',
    });
  };

  const cancelMapSelection = () => {
    setMapSelectionMode(false);
    setIsMapDragging(false);
    geocodeRequestRef.current += 1;
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      <View style={styles.screenBody}>
        <Animated.View style={[styles.mapWrap, mapWrapAnimatedStyle]}>
          <CityBookingMap
            mapRef={cityMapRef}
            mapStyle={styles.map}
            region={region}
            pickupCoordinate={pickupCoordinate}
            markerTitle="Vous"
            selectionMode={mapSelectionMode}
            onSelectionRegionChange={handleSelectionRegionChange}
            routePreview={mapSelectionMode ? null : routePreview}
            onRouteMetrics={setRouteMetrics}
            liveMapDrivers={liveDriversEnabled ? liveMapDrivers : []}
          />
        </Animated.View>

        <MapSelectionMode
          visible={mapSelectionMode}
          liveAddress={liveAddress}
          isDragging={isMapDragging}
          isResolvingAddress={isResolvingAddress}
          bottomInset={selectionBottomInset}
          onCancel={cancelMapSelection}
          onValidate={handleValidateMapPoint}
        />

        {!mapSelectionMode && routeMetrics ? (
          <View style={[styles.routeMetricsChip, { top: insets.top + 56 }]}>
            <Ionicons name="navigate" size={16} color={green} />
            <Text style={styles.routeMetricsText}>
              {routeMetrics.etaMin} min · {routeMetrics.distanceKm} km
            </Text>
          </View>
        ) : null}

        {!mapSelectionMode && !showVehicleStep ? (
          <LinearGradient
            colors={['transparent', 'rgba(5,5,5,0.35)', 'rgba(5,5,5,0.88)']}
            style={styles.mapBottomFade}
            pointerEvents="none"
          />
        ) : null}

        {!mapSelectionMode ? (
          <View
            style={[styles.floatingHeader, { top: insets.top + 8 }]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={styles.compactBtn}
              onPress={() => {
                if (showVehicleStep) {
                  closeVehicleSheet();
                  return;
                }
                router.back();
              }}
            >
              <Ionicons name="chevron-back" size={20} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.headerPill}>
              <Text style={styles.headerLogo} numberOfLines={1}>
                <Text style={{ color: gold }}>VILLE</Text> 24H
              </Text>
              <Text style={styles.headerStatus} numberOfLines={1}>
                Taxi ville · Guelma
              </Text>
            </View>

            <TouchableOpacity style={styles.compactBtn} onPress={useMyLocation}>
              <Ionicons name="locate" size={18} color={gold} />
            </TouchableOpacity>
          </View>
        ) : null}

        {!mapSelectionMode && showVehicleStep ? (
          <View style={[styles.flowBannerFloating, { top: insets.top + 58 }]}>
            <CityFlowProgressBar step={flowStep} />
          </View>
        ) : null}

        {!mapSelectionMode && !showVehicleStep ? (
          <View style={[styles.bottomPanel, { paddingBottom: panelBottomInset }]}>
            <View style={styles.handle} />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.bottomPanelScroll}
            >
              <CityFlowProgressBar step={flowStep} />

              <Text style={styles.panelSectionTitle}>Votre trajet</Text>
              <View style={styles.routeBlock}>
                <RouteField
                  dotColor="#4ADE80"
                  icon="radio-button-on"
                  placeholder="Adresse de prise en charge"
                  value={pickup}
                  onChangeText={setPickup}
                />
                <View style={styles.routeDivider} />
                <DestinationField
                  value={destinationAddress}
                  onPress={() => setDestinationModalVisible(true)}
                />
              </View>

              {!hasDestination ? (
                <Text style={styles.panelHint}>
                  Destination facultative — vous pouvez la préciser avec le chauffeur.
                </Text>
              ) : null}

              <Text style={styles.panelSectionTitle}>Quand partez-vous ?</Text>
              <View style={styles.timingSection}>
                <TimingSegmentedControl
                  mode={timingMode}
                  confirmed={timingConfirmed}
                  onSelectNow={handleSelectNow}
                  onSelectLater={handleSelectLater}
                />

                {timingMode === 'later' && scheduledAt ? (
                  <TouchableOpacity
                    style={styles.scheduleSummary}
                    onPress={() => setScheduleModalVisible(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.scheduleSummaryText}>
                      📅 {formatScheduleSummary(scheduledAt)}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={green} />
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={styles.panelSectionTitle}>Vos coordonnées</Text>
              <View style={styles.contactBlock}>
                <RouteField
                  dotColor={contactComplete ? green : gold}
                  icon="person-outline"
                  placeholder="Nom complet"
                  value={fullName}
                  onChangeText={setFullName}
                />
                <View style={styles.routeDivider} />
                <RouteField
                  dotColor={contactComplete ? green : gold}
                  icon="call-outline"
                  placeholder="Téléphone"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {!contactComplete ? (
                <Text style={styles.panelHint}>
                  Requis avant de commander — le chauffeur pourra vous joindre.
                </Text>
              ) : null}

              {timingConfirmed ? (
                <Text style={styles.panelNextHint}>
                  Choix du véhicule affiché — vérifiez le récapitulatif avant de commander.
                </Text>
              ) : (
                <Text style={styles.panelNextHint}>
                  Sélectionnez Maintenant ou Plus tard pour continuer.
                </Text>
              )}
            </ScrollView>
          </View>
        ) : null}

        {!mapSelectionMode && showVehicleStep ? (
          <CityVehicleBottomSheet
            visible={showVehicleStep}
            selectedVehicle={vehicleType}
            onSelectVehicle={setVehicleType}
            baseEtaMin={baseEtaMin}
            liveCards={liveCards}
            fallbackVehicleIds={fallbackVehicleIds}
            liveDriversLoading={liveDriversLoading}
            hasLiveDrivers={hasLiveDrivers}
            vehiclePrices={vehiclePrices}
            passengersLabel={`${passengers} passager${passengers > 1 ? 's' : ''}`}
            paymentLabel="A bord (Espèces/CB)"
            notesPreview={notes.trim() ? 'Consignes ajoutées' : 'Consignes chauffeur'}
            termsAccepted={termsAccepted}
            onToggleTerms={() => setTermsAccepted((prev) => !prev)}
            onOpenPassengers={() => setRideOptionsVisible(true)}
            onOpenPayment={() =>
              Alert.alert('Paiement', 'Règlement à bord en espèces ou par carte bancaire.')
            }
            onOpenNotes={() => setNotesModalVisible(true)}
            departureLabel={pickup.trim() || 'Prise en charge à confirmer'}
            destinationLabel={finalDestination}
            timingLabel={timingSummaryLabel}
            contactName={fullName}
            contactPhone={phone}
            contactComplete={contactComplete}
            isSubmitting={isSubmitting}
            onCommander={handleCommanderPress}
            bottomInset={panelBottomInset}
            sheetHeightShared={sheetHeightShared}
            sheetProgressShared={sheetProgressShared}
          />
        ) : null}
      </View>

      <DestinationSearchModal
        visible={destinationModalVisible}
        onClose={() => setDestinationModalVisible(false)}
        onSelectDestination={handleDestinationSelect}
        onSelectOnMap={handleSelectOnMap}
        initialQuery={destinationAddress}
      />

      <ScheduleRideModal
        visible={scheduleModalVisible}
        initialDate={scheduledAt ?? date}
        onClose={() => setScheduleModalVisible(false)}
        onConfirm={handleScheduleConfirm}
      />

      <CityRideOptionsModal
        visible={rideOptionsVisible}
        onClose={() => setRideOptionsVisible(false)}
        passengers={passengers}
        setPassengers={setPassengers}
        bags={bags}
        setBags={setBags}
        waitingTime={waitingTime}
        setWaitingTime={setWaitingTime}
      />

      <CityDriverNotesModal
        visible={notesModalVisible}
        notes={notes}
        onChangeNotes={setNotes}
        onClose={() => setNotesModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

function TimingSegmentedControl({
  mode,
  confirmed,
  onSelectNow,
  onSelectLater,
}: {
  mode: 'now' | 'later';
  confirmed: boolean;
  onSelectNow: () => void;
  onSelectLater: () => void;
}) {
  const nowActive = confirmed && mode === 'now';
  const laterActive = confirmed && mode === 'later';

  return (
    <View style={styles.timingRow}>
      <TouchableOpacity
        style={[
          styles.timingButton,
          nowActive ? styles.timingButtonActive : styles.timingButtonInactive,
        ]}
        onPress={onSelectNow}
        activeOpacity={0.72}
      >
        <Ionicons name="flash-outline" size={17} color={nowActive ? '#111' : green} />
        <Text style={[styles.timingButtonText, nowActive && styles.timingButtonTextActive]}>
          Maintenant
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.timingButton,
          laterActive ? styles.timingButtonActive : styles.timingButtonInactive,
        ]}
        onPress={onSelectLater}
        activeOpacity={0.72}
      >
        <Ionicons name="calendar-outline" size={17} color={laterActive ? '#111' : green} />
        <Text style={[styles.timingButtonText, laterActive && styles.timingButtonTextActive]}>
          Plus tard
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function DestinationField({ value, onPress }: { value: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.routeField, styles.destinationFieldCompact]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.routeDot, { backgroundColor: gold }]} />
      <Ionicons name="flag" size={16} color={gold} />
      <Text
        style={[styles.destinationText, !value && styles.routePlaceholder]}
        numberOfLines={1}
      >
        {value || 'Choisir une destination (facultatif)'}
      </Text>
      <Ionicons name="search" size={18} color={green} />
    </TouchableOpacity>
  );
}

function RouteField({
  dotColor,
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
}: {
  dotColor: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'phone-pad';
}) {
  return (
    <View style={styles.routeField}>
      <View style={[styles.routeDot, { backgroundColor: dotColor }]} />
      <Ionicons name={icon} size={16} color={gold} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#666"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={styles.routeInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    overflow: 'hidden',
  },
  screenBody: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  mapWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 160,
  },
  routeMetricsChip: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(8,8,8,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
  },
  routeMetricsText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  floatingHeader: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  compactBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(8,8,8,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  headerPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(8,8,8,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.22)',
  },
  headerLogo: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  headerStatus: {
    color: 'rgba(212,160,23,0.95)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    flexDirection: 'column',
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 6,
    maxHeight: '52%',
    borderTopWidth: 1,
    borderColor: 'rgba(212,160,23,0.18)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: { elevation: 22 },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#333',
    alignSelf: 'center',
    marginBottom: 8,
  },
  bottomPanelScroll: {
    paddingBottom: 8,
    gap: 4,
  },
  flowBannerFloating: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 12,
  },
  panelSectionTitle: {
    color: '#AAA',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 6,
  },
  panelHint: {
    color: '#777',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  panelNextHint: {
    color: 'rgba(74,222,128,0.85)',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  contactBlock: {
    width: '100%',
    gap: 0,
  },
  routeBlock: {
    width: '100%',
    flexShrink: 0,
    gap: 0,
    marginBottom: 4,
  },
  routeDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginLeft: 14,
  },
  destinationFieldCompact: {
    minHeight: 44,
    maxHeight: 44,
  },
  destinationText: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  timingSection: {
    width: '100%',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  vehicleExpandWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 10,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  vehicleSection: {
    width: '100%',
    gap: 8,
  },
  vehicleListCard: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.18)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  vehicleListCardActive: {
    backgroundColor: 'rgba(74,222,128,0.14)',
    borderColor: green,
  },
  vehicleListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  vehicleListText: {
    flex: 1,
    gap: 2,
  },
  vehicleListTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
  vehicleListTitleActive: {
    color: green,
  },
  vehicleListSub: {
    color: '#777',
    fontSize: 11,
    fontWeight: '600',
  },
  vehicleListSubActive: {
    color: 'rgba(74,222,128,0.85)',
  },
  vehicleListPrice: {
    color: gold,
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 8,
  },
  vehicleListPriceActive: {
    color: '#FFF',
  },
  footerCTA: {
    width: '100%',
    gap: 10,
    paddingTop: 4,
    paddingBottom: 2,
  },
  routeField: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 8,
  },
  routePlaceholder: {
    color: '#666',
  },
  vehicleCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(74,222,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleCardIconActive: {
    backgroundColor: 'rgba(74,222,128,0.22)',
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    flexShrink: 0,
  },
  timingButton: {
    flex: 1,
    height: 48,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  timingButtonInactive: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1.5,
    borderColor: 'rgba(74,222,128,0.42)',
  },
  timingButtonActive: {
    backgroundColor: green,
    borderWidth: 1.5,
    borderColor: green,
  },
  timingButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  timingButtonTextActive: {
    color: '#111',
  },
  scheduleSummary: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.28)',
    backgroundColor: 'rgba(74,222,128,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  scheduleSummaryText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    borderColor: 'rgba(212,160,23,0.45)',
    backgroundColor: 'rgba(212,160,23,0.12)',
  },
  chipText: {
    color: '#CCC',
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: gold,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modeBtnActive: {
    backgroundColor: gold,
    borderColor: gold,
  },
  modeBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modeBtnTextActive: {
    color: '#111',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateBox: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  dateBoxText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pickerBox: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.25)',
  },
  pickerDoneBtn: {
    height: 40,
    backgroundColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerDoneText: {
    color: '#111',
    fontSize: 14,
    fontWeight: '900',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.22)',
    backgroundColor: 'rgba(212,160,23,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  priceLabel: {
    color: '#AAA',
    fontSize: 11,
    fontWeight: '700',
  },
  priceValue: {
    color: gold,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  expandBtnText: {
    color: '#BBB',
    fontSize: 12,
    fontWeight: '800',
  },
  expandedBlock: {
    gap: 8,
    paddingBottom: 4,
  },
  destChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 180,
  },
  destChipActive: {
    backgroundColor: gold,
    borderColor: gold,
  },
  destChipText: {
    color: '#DDD',
    fontSize: 11,
    fontWeight: '800',
  },
  destChipTextActive: {
    color: '#111',
  },
  counterRow: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  counterLabel: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    minWidth: 36,
    textAlign: 'center',
  },
  noteBox: {
    minHeight: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  noteInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  commanderBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 8,
  },
  commanderBtnPending: {
    backgroundColor: '#C49214',
  },
  commanderBtnContent: {
    flex: 1,
    gap: 2,
  },
  commanderBtnText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
  commanderBtnPrice: {
    color: 'rgba(17,17,17,0.72)',
    fontSize: 12,
    fontWeight: '800',
  },
});
