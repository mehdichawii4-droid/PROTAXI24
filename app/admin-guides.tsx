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
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native';
import { GUIDE_YEARS_EXPERIENCE_OPTIONS } from '@/constants/guideCatalog';
import type { GuideStatus } from '@/firebase/types';
import { subscribeGuides } from '@/services/adminGuideService';
import type { AdminGuideListItem } from '@/types/guide';
import { devError, devLog } from '@/utils/devLog';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const green = '#8BC53F';
const gold = '#D4A017';
const muted = '#8A8A8A';
const red = '#FF5A5A';

const GUIDE_ROW_HEIGHT = 172;

type StatusFilter = 'all' | GuideStatus;

const FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'pending_review', label: 'En attente' },
  { id: 'active', label: 'Actifs' },
  { id: 'suspended', label: 'Suspendus' },
  { id: 'draft', label: 'Brouillons' },
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

function getYearsExperienceLabel(id: string) {
  return GUIDE_YEARS_EXPERIENCE_OPTIONS.find((item) => item.id === id)?.label ?? id;
}

function getStatusPillStyle(status: GuideStatus) {
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

type GuideListItemProps = {
  item: AdminGuideListItem;
  onPress: (guideId: string) => void;
};

const GuideListItem = memo(function GuideListItem({ item, onPress }: GuideListItemProps) {
  const statusStyle = getStatusPillStyle(item.status);
  const validatedLabel =
    item.status === 'active' ? formatValidatedAtLabel(item.validatedAt) : null;

  return (
    <TouchableOpacity
      style={styles.guideCard}
      activeOpacity={0.85}
      onPress={() => onPress(item.uid)}
    >
      <View style={styles.guideTop}>
        <View style={styles.guideTitleWrap}>
          <Text style={styles.guideName} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={styles.guideYears}>{getYearsExperienceLabel(item.yearsExperience)}</Text>
        </View>
        <View style={[styles.statusPill, statusStyle.pill]}>
          <Text style={[styles.statusText, statusStyle.text]}>{item.statusLabel}</Text>
        </View>
      </View>

      <Text style={styles.guideMeta} numberOfLines={1}>
        {item.phone || 'Téléphone non renseigné'} · {item.email || 'Email non renseigné'}
      </Text>

      <Text style={styles.guideSpecialties} numberOfLines={2}>
        Spécialités : {item.specialtiesSummary}
      </Text>

      <View style={styles.guideFooterRow}>
        <Text style={styles.guideExperiences}>
          {item.allowedExperienceCount} expérience
          {item.allowedExperienceCount > 1 ? 's autorisées' : ' autorisée'}
        </Text>
        {validatedLabel ? (
          <Text style={styles.guideValidated}>Validé le {validatedLabel}</Text>
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
  onFilterChange,
  onCreate,
}: {
  total: number;
  pendingCount: number;
  activeCount: number;
  suspendedCount: number;
  draftCount: number;
  activeFilter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
  onCreate: () => void;
}) {
  return (
    <View style={styles.headerBlock}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#FFF" />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="account-tie-outline" size={14} color={green} />
          <Text style={styles.badgeText}>Admin · Guides V1</Text>
        </View>
        <Text style={styles.title}>Gestion des guides</Text>
        <Text style={styles.subtitle}>{PROTAXI_ROUTES.adminGuides}</Text>
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
        <Text style={styles.draftHint}>{draftCount} brouillon{draftCount > 1 ? 's' : ''}</Text>
      ) : null}

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

      <TouchableOpacity style={styles.createBtn} activeOpacity={0.9} onPress={onCreate}>
        <Ionicons name="add-circle-outline" size={20} color="#050505" />
        <Text style={styles.createBtnText}>Nouveau guide</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AdminGuidesScreen() {
  const [guides, setGuides] = useState<AdminGuideListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    devLog('[ADMIN GUIDES] list mount');

    const unsubscribe = subscribeGuides(
      (items) => {
        setGuides(items);
        setLoading(false);
        setPermissionError(false);
      },
      (error) => {
        devError('[ADMIN GUIDES] list subscription failed', error);
        setLoading(false);
        setPermissionError(true);
      },
    );

    return unsubscribe;
  }, []);

  const summary = useMemo(() => {
    return {
      total: guides.length,
      pendingCount: guides.filter((g) => g.status === 'pending_review').length,
      activeCount: guides.filter((g) => g.status === 'active').length,
      suspendedCount: guides.filter((g) => g.status === 'suspended').length,
      draftCount: guides.filter((g) => g.status === 'draft').length,
    };
  }, [guides]);

  const filteredGuides = useMemo(() => {
    if (activeFilter === 'all') return guides;
    return guides.filter((guide) => guide.status === activeFilter);
  }, [activeFilter, guides]);

  const openGuideDetails = useCallback((guideId: string) => {
    devLog('[ADMIN GUIDES] open details', { guideId });
    router.push({
      pathname: '/admin-guide-details',
      params: { id: guideId },
    });
  }, []);

  const openCreateGuide = useCallback(() => {
    router.push({
      pathname: '/admin-guide-details',
      params: { mode: 'create' },
    });
  }, []);

  const renderItem: ListRenderItem<AdminGuideListItem> = useCallback(
    ({ item }) => <GuideListItem item={item} onPress={openGuideDetails} />,
    [openGuideDetails],
  );

  const keyExtractor = useCallback((item: AdminGuideListItem) => item.uid, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<AdminGuideListItem> | null | undefined, index: number) => ({
      length: GUIDE_ROW_HEIGHT,
      offset: GUIDE_ROW_HEIGHT * index,
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
        onFilterChange={setActiveFilter}
        onCreate={openCreateGuide}
      />
    ),
    [
      activeFilter,
      openCreateGuide,
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
          <ActivityIndicator size="large" color={green} />
          <Text style={styles.emptyText}>Chargement des guides...</Text>
        </View>
      );
    }

    if (permissionError) {
      return (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="shield-alert-outline" size={34} color={red} />
          <Text style={styles.emptyTitle}>Accès refusé</Text>
          <Text style={styles.emptyText}>
            Connectez-vous avec un compte administrateur pour gérer les guides.
          </Text>
        </View>
      );
    }

    if (guides.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="account-tie-outline" size={34} color={muted} />
          <Text style={styles.emptyTitle}>Aucun guide</Text>
          <Text style={styles.emptyText}>
            Créez un profil guide après avoir créé le compte Firebase Auth du guide.
          </Text>
          <TouchableOpacity style={styles.emptyCreateBtn} onPress={openCreateGuide}>
            <Text style={styles.emptyCreateBtnText}>Nouveau guide</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="filter-outline" size={34} color={muted} />
        <Text style={styles.emptyTitle}>Aucun guide dans ce filtre</Text>
        <Text style={styles.emptyText}>Changez de filtre ou créez un nouveau profil guide.</Text>
      </View>
    );
  }, [guides.length, loading, openCreateGuide, permissionError]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <FlatList
        data={filteredGuides}
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
    backgroundColor: 'rgba(139,197,63,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.25)',
    marginBottom: 12,
  },
  badgeText: { color: green, fontSize: 12, fontWeight: '700' },
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
  draftHint: { color: muted, fontSize: 11, marginBottom: 12, fontWeight: '600' },
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
    backgroundColor: 'rgba(139,197,63,0.14)',
    borderColor: 'rgba(139,197,63,0.4)',
  },
  filterChipText: { color: muted, fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: green },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: green,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  createBtnText: { color: '#050505', fontSize: 15, fontWeight: '800' },
  guideCard: {
    minHeight: GUIDE_ROW_HEIGHT - 12,
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    marginBottom: 12,
  },
  guideTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  guideTitleWrap: { flex: 1 },
  guideName: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  guideYears: { color: green, fontSize: 11, fontWeight: '700', marginTop: 4 },
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
  guideMeta: { color: muted, fontSize: 12, marginBottom: 8 },
  guideSpecialties: { color: '#D6D6D6', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  guideFooterRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  guideExperiences: { color: green, fontSize: 11, fontWeight: '700' },
  guideValidated: { color: muted, fontSize: 11, fontWeight: '600' },
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
  emptyCreateBtn: {
    marginTop: 8,
    backgroundColor: green,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyCreateBtnText: { color: '#050505', fontWeight: '800' },
});
