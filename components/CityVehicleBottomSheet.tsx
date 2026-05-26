import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import {
  CITY_VEHICLES,
  type CityVehicleDef,
  type CityVehicleId,
} from '@/constants/cityVehicles';
import { useCityLiveDrivers, type CityLiveDriverCard } from '@/hooks/useCityLiveDrivers';

export {
  CITY_VEHICLES,
  cityVehicleExtraPrice,
  type CityVehicleDef,
  type CityVehicleId,
} from '@/constants/cityVehicles';

const green = '#4ADE80';
const SCREEN_HEIGHT = Dimensions.get('window').height;

export const SHEET_SNAP = {
  collapsed: SCREEN_HEIGHT * 0.38,
  mid: SCREEN_HEIGHT * 0.58,
  expanded: SCREEN_HEIGHT * 0.86,
} as const;

const SPRING = { damping: 24, stiffness: 220, mass: 0.85 };
const HANDLE_ZONE_PX = 28;
const HERO_ROW_PX = 80;
const BOTTOM_BLOCK_PX = 236;

const SNAP_INDEX = {
  collapsed: 0,
  mid: 1,
  expanded: 2,
} as const;

function formatPrice(amount: number): string {
  return amount > 0 ? `${amount.toLocaleString('fr-FR')} DA` : '—';
}

function sheetProgress(height: number): number {
  'worklet';
  return interpolate(
    height,
    [SHEET_SNAP.collapsed, SHEET_SNAP.expanded],
    [0, 1],
    Extrapolation.CLAMP,
  );
}

function snapIndexForHeight(target: number): number {
  const points = [
    { index: SNAP_INDEX.collapsed, height: SHEET_SNAP.collapsed },
    { index: SNAP_INDEX.mid, height: SHEET_SNAP.mid },
    { index: SNAP_INDEX.expanded, height: SHEET_SNAP.expanded },
  ];

  let nearest = points[0];
  let minDist = Math.abs(target - points[0].height);

  for (let i = 1; i < points.length; i += 1) {
    const dist = Math.abs(target - points[i].height);
    if (dist < minDist) {
      minDist = dist;
      nearest = points[i];
    }
  }

  return nearest.index;
}

type Props = {
  visible: boolean;
  selectedVehicle: CityVehicleId;
  onSelectVehicle: (id: CityVehicleId) => void;
  baseEtaMin: number;
  vehiclePrices: Record<CityVehicleId, number>;
  passengersLabel: string;
  paymentLabel: string;
  notesPreview: string;
  termsAccepted: boolean;
  onToggleTerms: () => void;
  onOpenPassengers: () => void;
  onOpenOptions: () => void;
  onOpenPayment: () => void;
  onOpenNotes: () => void;
  isSubmitting: boolean;
  onCommander: () => void;
  bottomInset: number;
  sheetHeightShared?: SharedValue<number>;
  sheetProgressShared?: SharedValue<number>;
  onHeightChange?: (height: number) => void;
};

function VehicleCarArt({
  vehicle,
  dimmed = false,
}: {
  vehicle: CityVehicleDef;
  dimmed?: boolean;
}) {
  return (
    <View style={[styles.carArt, dimmed && styles.carArtDimmed]}>
      <LinearGradient
        colors={[vehicle.accent ?? '#1a1a1a', '#0a0a0a']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.carArtGlow} />
      <Ionicons
        name={vehicle.icon}
        size={28}
        color={dimmed ? '#555' : 'rgba(74,222,128,0.55)'}
      />
    </View>
  );
}

function LiveDriverCard({
  card,
  selected,
  price,
  onPress,
}: {
  card: CityLiveDriverCard;
  selected: boolean;
  price: number;
  onPress: () => void;
}) {
  const disabled = !card.available;

  return (
    <TouchableOpacity
      style={[styles.offerCard, selected && !disabled && styles.offerCardActive, disabled && styles.offerCardDisabled]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.88}
      disabled={disabled}
    >
      <VehicleCarArt vehicle={card.vehicleDef} dimmed={disabled} />
      <View style={styles.offerBody}>
        <View style={styles.offerTopRow}>
          <Text style={styles.driverName} numberOfLines={1}>
            {card.driverName}
          </Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>
        <Text style={styles.vehicleTitle}>{card.vehicleDef.title}</Text>
        <Text style={styles.vehicleSub}>{card.vehicleDef.subtitle}</Text>
        <Text style={styles.carMeta} numberOfLines={1}>
          {card.carLabel}
        </Text>
      </View>
      <View style={styles.offerRight}>
        {disabled ? (
          <Text style={styles.unavailableText}>Indisponible</Text>
        ) : (
          <>
            <Text style={styles.etaText}>{card.etaMin} MIN</Text>
            <Text style={styles.availabilityText}>Disponible</Text>
          </>
        )}
        <Text style={styles.priceText}>{formatPrice(price)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function VehicleTierCard({
  vehicle,
  selected,
  etaMin,
  price,
  onPress,
}: {
  vehicle: CityVehicleDef;
  selected: boolean;
  etaMin: number;
  price: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.offerCard, selected && styles.offerCardActive]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <VehicleCarArt vehicle={vehicle} />
      <View style={styles.offerBody}>
        <Text style={styles.vehicleTitle}>{vehicle.title}</Text>
        <Text style={styles.vehicleSub}>{vehicle.subtitle}</Text>
        <Text style={styles.carMeta}>Dispatch automatique</Text>
      </View>
      <View style={styles.offerRight}>
        <Text style={styles.etaText}>{etaMin} MIN</Text>
        <Text style={styles.availabilityText}>Disponible</Text>
        <Text style={styles.priceText}>{formatPrice(price)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function SelectedHeroRow({
  vehicle,
  etaMin,
  price,
  driverName,
}: {
  vehicle: CityVehicleDef;
  etaMin: number;
  price: number;
  driverName?: string;
}) {
  return (
    <View style={styles.heroRow}>
      <VehicleCarArt vehicle={vehicle} />
      <View style={styles.heroBody}>
        <Text style={styles.heroTitle} numberOfLines={1}>
          {driverName ?? vehicle.title}
        </Text>
        <Text style={styles.heroSub} numberOfLines={1}>
          {driverName ? vehicle.title : vehicle.subtitle}
        </Text>
      </View>
      <View style={styles.heroRight}>
        <Text style={styles.heroEta}>{etaMin} MIN</Text>
        <Text style={styles.heroPrice}>{formatPrice(price)}</Text>
      </View>
    </View>
  );
}

export default function CityVehicleBottomSheet({
  visible,
  selectedVehicle,
  onSelectVehicle,
  baseEtaMin,
  vehiclePrices,
  passengersLabel,
  paymentLabel,
  notesPreview,
  termsAccepted,
  onToggleTerms,
  onOpenPassengers,
  onOpenOptions,
  onOpenPayment,
  onOpenNotes,
  isSubmitting,
  onCommander,
  bottomInset,
  sheetHeightShared,
  sheetProgressShared,
  onHeightChange,
}: Props) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const animatedPosition = useSharedValue(SCREEN_HEIGHT - SHEET_SNAP.collapsed);
  const footerPad = Math.max(bottomInset, 8);
  const handleZoneHeight = useSharedValue(HANDLE_ZONE_PX);
  const bottomBlockHeight = useSharedValue(BOTTOM_BLOCK_PX + footerPad);
  const heroRowHeight = useSharedValue(HERO_ROW_PX);

  const { liveCards, fallbackVehicleIds, loading, hasLiveDrivers } = useCityLiveDrivers({
    visible,
    baseEtaMin,
  });

  const snapPoints = useMemo(
    () => [SHEET_SNAP.collapsed, SHEET_SNAP.mid, SHEET_SNAP.expanded],
    [],
  );

  const sheetHeightDerived = useDerivedValue(
    () => SCREEN_HEIGHT - animatedPosition.value,
  );

  const emitMetrics = useCallback(
    (height: number) => {
      onHeightChange?.(height);
    },
    [onHeightChange],
  );

  useAnimatedReaction(
    () => sheetHeightDerived.value,
    (height) => {
      if (!Number.isFinite(height)) return;
      const progress = sheetProgress(height);
      if (sheetHeightShared) sheetHeightShared.value = height;
      if (sheetProgressShared) sheetProgressShared.value = progress;
      runOnJS(emitMetrics)(height);
    },
    [sheetHeightShared, sheetProgressShared, emitMetrics],
  );

  const snapTo = useCallback((target: number) => {
    bottomSheetRef.current?.snapToIndex(snapIndexForHeight(target));
  }, []);

  useEffect(() => {
    if (!visible) {
      animatedPosition.value = SCREEN_HEIGHT - SHEET_SNAP.collapsed;
      return;
    }

    bottomSheetRef.current?.snapToIndex(SNAP_INDEX.collapsed);
  }, [visible, animatedPosition]);

  const getCatalogEta = (vehicle: CityVehicleDef): number =>
    Math.max(5, baseEtaMin + (vehicle.etaOffset ?? 0));

  const selectedDef = useMemo(
    () => CITY_VEHICLES.find((item) => item.id === selectedVehicle) ?? CITY_VEHICLES[0],
    [selectedVehicle],
  );

  const selectedLiveCard = useMemo(
    () => liveCards.find((card) => card.vehicleId === selectedVehicle),
    [liveCards, selectedVehicle],
  );

  const heroEta = selectedLiveCard?.etaMin ?? getCatalogEta(selectedDef);
  const heroDriverName = selectedLiveCard?.available ? selectedLiveCard.driverName : undefined;

  const listLiveCards = useMemo(() => {
    if (!selectedLiveCard) return liveCards;
    return liveCards.filter((card) => card.id !== selectedLiveCard.id);
  }, [liveCards, selectedLiveCard]);

  const listFallbackIds = useMemo(
    () => fallbackVehicleIds.filter((vehicle) => vehicle.id !== selectedVehicle),
    [fallbackVehicleIds, selectedVehicle],
  );

  const renderHandle = useCallback(
    () => (
      <View
        style={styles.dragZone}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height > 0) handleZoneHeight.value = height;
        }}
      >
        <View style={styles.handle} />
      </View>
    ),
    [handleZoneHeight],
  );

  const onHeroLayout = useCallback(
    (height: number) => {
      if (height > 0) heroRowHeight.value = height;
    },
    [heroRowHeight],
  );

  const onBottomBlockLayout = useCallback(
    (height: number) => {
      if (height > 0) bottomBlockHeight.value = height;
    },
    [bottomBlockHeight],
  );

  const listPaneStyle = useAnimatedStyle(() => {
    const bodyH = Math.max(0, sheetHeightDerived.value - handleZoneHeight.value);
    const listH = Math.max(0, bodyH - heroRowHeight.value - bottomBlockHeight.value);
    return {
      height: listH,
      maxHeight: listH,
      minHeight: 0,
      opacity: interpolate(listH, [0, 16], [0, 1], Extrapolation.CLAMP),
      overflow: 'hidden',
    };
  });

  if (!visible) return null;

  return (
    <View style={styles.sheetHost} pointerEvents="box-none">
      <BottomSheet
        ref={bottomSheetRef}
        index={SNAP_INDEX.collapsed}
        snapPoints={snapPoints}
        animatedPosition={animatedPosition}
        enablePanDownToClose={false}
        enableOverDrag={false}
        enableDynamicSizing={false}
        handleComponent={renderHandle}
        animationConfigs={SPRING}
        backgroundStyle={styles.sheetBackground}
        style={styles.sheet}
        containerStyle={styles.sheetHost}
      >
        <BottomSheetView style={styles.sheetBody}>
          <View style={styles.heroWrap} onLayout={(event) => onHeroLayout(event.nativeEvent.layout.height)}>
            <SelectedHeroRow
              vehicle={selectedDef}
              etaMin={heroEta}
              price={vehiclePrices[selectedDef.id]}
              driverName={heroDriverName}
            />
          </View>

          <Animated.View style={listPaneStyle}>
            <BottomSheetScrollView
              style={styles.listScroll}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.listHeader}>
                <View style={styles.listHeaderLeft}>
                  <View style={styles.livePulse}>
                    <View style={styles.livePulseDot} />
                  </View>
                  <View>
                    <Text style={styles.listHeaderTitle}>Chauffeurs disponibles</Text>
                    <Text style={styles.listHeaderSub}>
                      {hasLiveDrivers
                        ? `${liveCards.length} en ligne près de vous`
                        : 'Recherche de chauffeurs en cours…'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.expandHint}
                  onPress={() => snapTo(SHEET_SNAP.expanded)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chevron-up" size={16} color={green} />
                </TouchableOpacity>
              </View>

              {loading && liveCards.length === 0 ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={green} />
                  <Text style={styles.loadingText}>Synchronisation live…</Text>
                </View>
              ) : null}

              {listLiveCards.map((card) => (
                <LiveDriverCard
                  key={card.id}
                  card={card}
                  selected={selectedVehicle === card.vehicleId}
                  price={vehiclePrices[card.vehicleId]}
                  onPress={() => {
                    if (!card.available) return;
                    onSelectVehicle(card.vehicleId);
                  }}
                />
              ))}

              {listFallbackIds.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>
                    {hasLiveDrivers ? 'AUTRES OPTIONS' : 'OPTIONS PROTAXI'}
                  </Text>
                  {listFallbackIds.map((vehicle) => (
                    <VehicleTierCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      selected={selectedVehicle === vehicle.id}
                      etaMin={getCatalogEta(vehicle)}
                      price={vehiclePrices[vehicle.id]}
                      onPress={() => onSelectVehicle(vehicle.id)}
                    />
                  ))}
                </>
              ) : null}

              {!loading && !hasLiveDrivers && listFallbackIds.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="car-outline" size={28} color="#555" />
                  <Text style={styles.emptyTitle}>Aucun chauffeur disponible</Text>
                  <Text style={styles.emptySub}>
                    Réessayez dans quelques instants ou choisissez une autre heure.
                  </Text>
                </View>
              ) : null}
            </BottomSheetScrollView>
          </Animated.View>

          <View
            style={[styles.bottomBlock, styles.bottomFooter, { paddingBottom: footerPad }]}
            onLayout={(event) => onBottomBlockLayout(event.nativeEvent.layout.height)}
          >
            <View style={styles.optionsGrid}>
              <TouchableOpacity style={styles.optionCell} onPress={onOpenPassengers} activeOpacity={0.85}>
                <Ionicons name="person-outline" size={17} color={green} />
                <Text style={styles.optionText} numberOfLines={1}>
                  {passengersLabel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionCell} onPress={onOpenOptions} activeOpacity={0.85}>
                <Ionicons name="options-outline" size={17} color={green} />
                <Text style={styles.optionText}>Options</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionCell} onPress={onOpenPayment} activeOpacity={0.85}>
                <Ionicons name="cash-outline" size={17} color={green} />
                <Text style={styles.optionText} numberOfLines={1}>
                  {paymentLabel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionCell} onPress={onOpenNotes} activeOpacity={0.85}>
                <Ionicons name="chatbubble-ellipses-outline" size={17} color={green} />
                <Text style={styles.optionText} numberOfLines={1}>
                  {notesPreview}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.termsRow} onPress={onToggleTerms} activeOpacity={0.85}>
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted ? <Ionicons name="checkmark" size={14} color="#111" /> : null}
              </View>
              <Text style={styles.termsText}>
                J&apos;accepte les{' '}
                <Text style={styles.termsLink}>Conditions Générales d&apos;Utilisation</Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.commanderBtn, isSubmitting && styles.commanderBtnPending]}
              onPress={onCommander}
              disabled={isSubmitting}
              activeOpacity={0.9}
            >
              <Text style={styles.commanderText}>
                {isSubmitting ? 'Envoi…' : 'Commander'}
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    pointerEvents: 'box-none',
  },
  sheet: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
      },
      android: { elevation: 28 },
    }),
  },
  sheetBackground: {
    backgroundColor: '#101010',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  dragZone: {
    paddingTop: 10,
    paddingBottom: 2,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#3a3a3a',
    alignSelf: 'center',
  },
  sheetBody: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  heroWrap: {
    flexShrink: 0,
  },
  bottomFooter: {
    flexShrink: 0,
  },
  heroRow: {
    minHeight: HERO_ROW_PX,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  heroBody: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  heroSub: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  heroRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  heroEta: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
  heroPrice: {
    color: green,
    fontSize: 11,
    fontWeight: '800',
  },
  listScroll: {
    ...StyleSheet.absoluteFillObject,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  bottomBlock: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
    backgroundColor: '#101010',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  listHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  livePulse: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(74,222,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: green,
  },
  listHeaderTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  listHeaderSub: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  expandHint: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(74,222,128,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  loadingText: {
    color: '#AAA',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    color: '#777',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  offerCard: {
    marginHorizontal: 12,
    marginBottom: 8,
    minHeight: 92,
    borderRadius: 14,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  offerCardActive: {
    borderColor: 'rgba(74,222,128,0.45)',
    backgroundColor: 'rgba(74,222,128,0.08)',
  },
  offerCardDisabled: {
    opacity: 0.5,
  },
  carArt: {
    width: 72,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  carArtDimmed: {
    opacity: 0.45,
  },
  carArtGlow: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(74,222,128,0.35)',
  },
  offerBody: {
    flex: 1,
    gap: 2,
  },
  offerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverName: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(74,222,128,0.12)',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: green,
  },
  liveBadgeText: {
    color: green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  vehicleTitle: {
    color: '#EDEDED',
    fontSize: 13,
    fontWeight: '800',
  },
  vehicleSub: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
  },
  carMeta: {
    color: '#666',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  offerRight: {
    alignItems: 'flex-end',
    minWidth: 84,
    gap: 2,
  },
  etaText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  availabilityText: {
    color: green,
    fontSize: 10,
    fontWeight: '800',
  },
  unavailableText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '800',
  },
  priceText: {
    color: '#BBB',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  emptySub: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 2,
    columnGap: 8,
  },
  optionCell: {
    width: '48%',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  optionText: {
    flex: 1,
    color: '#EDEDED',
    fontSize: 12,
    fontWeight: '700',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: green,
    borderColor: green,
  },
  termsText: {
    flex: 1,
    color: '#CCC',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  termsLink: {
    color: '#FFF',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  commanderBtn: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commanderBtnPending: {
    opacity: 0.72,
  },
  commanderText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
});
