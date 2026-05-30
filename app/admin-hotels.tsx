import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native';
import type { PartnerStatus } from '@/firebase/types';
import { subscribeHotels } from '@/services/adminHotelService';
import type { AdminHotelListItem } from '@/types/partner';
import { devError, devLog } from '@/utils/devLog';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const green = '#8BC53F';
const gold = '#D4A017';
const muted = '#8A8A8A';
const red = '#FF5A5A';

const HOTEL_ROW_HEIGHT = 168;

type StatusFilter = 'all' | PartnerStatus;

const FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'pending_review', label: 'En attente' },
  { id: 'active', label: 'Actifs' },
  { id: 'suspended', label: 'Suspendus' },
];

function formatValidatedAtLabel(value: unknown): string | null {
  if (!value) return null;

  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object' && value !== null && 'toDate' in value) {
    date = (value as { toDate?: () => Date }).toDate?.() ?? null;
  }

  if (!date || Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getStatusPillStyle(status: PartnerStatus) {
  switch (status) {
    case 'active':
      return { pill: styles.statusActive, text: styles.statusTextActive };
    case 'suspended':
      return { pill: styles.statusSuspended, text: styles.statusTextSuspended };
    case 'pending_review':
      return { pill: styles.statusPending, text: styles.statusTextPending };
    default:
      return { pill: styles.statusDraft, text: styles.statusTextDraft };
  }
}

function matchesSearch(item: AdminHotelListItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    item.companyName,
    item.contactName,
    item.email,
    item.phone,
    item.city ?? '',
    item.descriptionPreview,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(needle);
}

type HotelListItemProps = {
  item: AdminHotelListItem;
  onPress: (hotelId: string) => void;
};

const HotelListItem = memo(function HotelListItem({ item, onPress }: HotelListItemProps) {
  const statusStyle = getStatusPillStyle(item.status);
  const validatedLabel =
    item.status === 'active' ? formatValidatedAtLabel(item.validatedAt) : null;

  return (
    <TouchableOpacity
      style={styles.hotelCard}
      activeOpacity={0.85}
      onPress={() => onPress(item.uid)}
    >
      <View style={styles.hotelTop}>
        <View style={styles.hotelTitleWrap}>
          <Text style={styles.hotelName} numberOfLines={1}>
            {item.companyName}
          </Text>
          {item.city ? (
            <Text style={styles.hotelCity} numberOfLines={1}>
              {item.city}
            </Text>
          ) : null}
        </View>
        <View style={[styles.statusPill, statusStyle.pill]}>
          <Text style={[styles.statusText, statusStyle.text]}>{item.statusLabel}</Text>
        </View>
      </View>

      <Text style={styles.hotelMeta} numberOfLines={1}>
        {item.contactName} · {item.phone || 'Téléphone non renseigné'}
      </Text>

      <Text style={styles.hotelDescription} numberOfLines={2}>
        {item.descriptionPreview}
      </Text>

      <View style={styles.hotelFooterRow}>
        <Text style={styles.hotelEmail} numberOfLines={1}>
          {item.email || 'Email non renseigné'}
        </Text>
        {validatedLabel ? (
          <Text style={styles.hotelValidated}>Validé le {validatedLabel}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

function ListHeader({
  total,
  pendingCount,
  activeCount,
  suspendedCount,
  draftCount,
  activeFilter,
  searchQuery,
  onSearchChange,
  onFilterChange,
}: {
  total: number;
  pendingCount: number;
  activeCount: number;
  suspendedCount: number;
  draftCount: number;
  activeFilter: StatusFilter;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: StatusFilter) => void;
}) {
  return (
    <View style={styles.headerBlock}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#FFF" />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="domain" size={14} color={gold} />
          <Text style={styles.badgeText}>Admin · Hôtels partenaires</Text>
        </View>
        <Text style={styles.title}>Gestion des hôtels</Text>
        <Text style={styles.subtitle}>{PROTAXI_ROUTES.adminHotels}</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>En attente</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{activeCount}</Text>
          <Text style={styles.summaryLabel}>Actifs</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{suspendedCount}</Text>
          <Text style={styles.summaryLabel}>Suspendus</Text>
        </View>
      </View>

      {draftCount > 0 ? (
        <Text style={styles.draftHint}>
          {draftCount} brouillon{draftCount > 1 ? 's' : ''} (filtre « Tous »)
        </Text>
      ) : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={muted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Rechercher établissement, contact, email…"
          placeholderTextColor={muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => onSearchChange('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={muted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map((option) => {
          const isActive = activeFilter === option.id;
          return (
            <Pressable
              key={option.id}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => onFilterChange(option.id)}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function AdminHotelsScreen() {
  const [hotels, setHotels] = useState<AdminHotelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('pending_review');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    devLog('[ADMIN HOTELS] list mount');

    const unsubscribe = subscribeHotels(
      (items) => {
        setHotels(items);
        setLoading(false);
        setPermissionError(false);
      },
      (error) => {
        devError('[ADMIN HOTELS] list subscription failed', error);
        setLoading(false);
        setPermissionError(true);
      },
    );

    return unsubscribe;
  }, []);

  const summary = useMemo(
    () => ({
      total: hotels.length,
      pendingCount: hotels.filter((h) => h.status === 'pending_review').length,
      activeCount: hotels.filter((h) => h.status === 'active').length,
      suspendedCount: hotels.filter((h) => h.status === 'suspended').length,
      draftCount: hotels.filter((h) => h.status === 'draft').length,
    }),
    [hotels],
  );

  const filteredHotels = useMemo(() => {
    let rows = hotels;

    if (activeFilter !== 'all') {
      rows = rows.filter((hotel) => hotel.status === activeFilter);
    }

    if (searchQuery.trim()) {
      rows = rows.filter((hotel) => matchesSearch(hotel, searchQuery));
    }

    return rows;
  }, [activeFilter, hotels, searchQuery]);

  const openHotelDetails = useCallback((hotelId: string) => {
    devLog('[ADMIN HOTELS] open details', { hotelId });
    router.push({
      pathname: '/admin-hotel-details',
      params: { id: hotelId },
    });
  }, []);

  const renderItem: ListRenderItem<AdminHotelListItem> = useCallback(
    ({ item }) => <HotelListItem item={item} onPress={openHotelDetails} />,
    [openHotelDetails],
  );

  const keyExtractor = useCallback((item: AdminHotelListItem) => item.uid, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<AdminHotelListItem> | null | undefined, index: number) => ({
      length: HOTEL_ROW_HEIGHT,
      offset: HOTEL_ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  const listHeader = useMemo(
    () => (
      <ListHeader
        total={summary.total}
        pendingCount={summary.pendingCount}
        activeCount={summary.activeCount}
        suspendedCount={summary.suspendedCount}
        draftCount={summary.draftCount}
        activeFilter={activeFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterChange={setActiveFilter}
      />
    ),
    [
      activeFilter,
      searchQuery,
      summary.activeCount,
      summary.draftCount,
      summary.pendingCount,
      summary.suspendedCount,
      summary.total,
    ],
  );

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="large" color={gold} />
          <Text style={styles.emptyText}>Chargement des hôtels partenaires…</Text>
        </View>
      );
    }

    if (permissionError) {
      return (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="shield-alert-outline" size={34} color={red} />
          <Text style={styles.emptyTitle}>Accès refusé</Text>
          <Text style={styles.emptyText}>
            Connectez-vous avec un compte administrateur pour gérer les hôtels partenaires.
          </Text>
        </View>
      );
    }

    if (hotels.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="domain" size={34} color={muted} />
          <Text style={styles.emptyTitle}>Aucun hôtel partenaire</Text>
          <Text style={styles.emptyText}>
            Les établissements inscrits via l&apos;espace hôtel apparaîtront ici.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="filter-outline" size={34} color={muted} />
        <Text style={styles.emptyTitle}>Aucun résultat</Text>
        <Text style={styles.emptyText}>
          Modifiez la recherche ou changez de filtre de statut.
        </Text>
      </View>
    );
  }, [hotels.length, loading, permissionError]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <FlatList
        data={filteredHotels}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        getItemLayout={getItemLayout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: bg },
  listContent: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  headerBlock: { paddingTop: 8, paddingBottom: 8 },
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
  header: { marginBottom: 18 },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.3)',
    marginBottom: 12,
  },
  badgeText: { color: gold, fontSize: 12, fontWeight: '700' },
  title: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  subtitle: { color: muted, fontSize: 12, marginTop: 4 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  summaryCard: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 12,
  },
  summaryValue: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  summaryLabel: { color: muted, fontSize: 10, marginTop: 4, fontWeight: '600' },
  draftHint: { color: muted, fontSize: 11, marginBottom: 10, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '600', padding: 0 },
  filterRow: { gap: 8, paddingBottom: 14 },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: card,
  },
  filterChipActive: {
    backgroundColor: 'rgba(212,160,23,0.14)',
    borderColor: 'rgba(212,160,23,0.4)',
  },
  filterChipText: { color: muted, fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: gold },
  hotelCard: {
    minHeight: HOTEL_ROW_HEIGHT - 12,
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    marginBottom: 12,
  },
  hotelTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  hotelTitleWrap: { flex: 1 },
  hotelName: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  hotelCity: { color: gold, fontSize: 11, fontWeight: '700', marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '800' },
  statusActive: {
    backgroundColor: 'rgba(139,197,63,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
  },
  statusTextActive: { color: green },
  statusSuspended: {
    backgroundColor: 'rgba(255,90,90,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.35)',
  },
  statusTextSuspended: { color: red },
  statusPending: {
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
  },
  statusTextPending: { color: gold },
  statusDraft: {
    backgroundColor: 'rgba(138,138,138,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(138,138,138,0.35)',
  },
  statusTextDraft: { color: muted },
  hotelMeta: { color: muted, fontSize: 12, marginBottom: 8 },
  hotelDescription: { color: '#D6D6D6', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  hotelFooterRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  hotelEmail: { color: muted, fontSize: 11, fontWeight: '600', flex: 1 },
  hotelValidated: { color: green, fontSize: 11, fontWeight: '700' },
  emptyCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  emptyText: { color: muted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
