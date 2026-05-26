import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ListRenderItem,
} from 'react-native';
import {
  formatPartnerRevenue,
  subscribePartnersWithStats,
} from '@/services/adminPartnerService';
import type { AdminPartnerListItem } from '@/types/partner';
import { devError, devLog } from '@/utils/devLog';
import { PROTAXI_ROUTES } from '@/utils/navigation';

const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const green = '#8BC53F';
const muted = '#8A8A8A';
const red = '#FF5A5A';

const PARTNER_ROW_HEIGHT = 168;

type PartnerListItemProps = {
  item: AdminPartnerListItem;
  onPress: (partnerId: string) => void;
};

const PartnerListItem = memo(function PartnerListItem({ item, onPress }: PartnerListItemProps) {
  const isActive = item.isActive;

  return (
    <TouchableOpacity
      style={styles.partnerCard}
      activeOpacity={0.85}
      onPress={() => onPress(item.uid)}
    >
      <View style={styles.partnerTop}>
        <View style={styles.partnerTitleWrap}>
          <Text style={styles.partnerName} numberOfLines={1}>
            {item.companyName}
          </Text>
          <Text style={styles.partnerType}>{item.partnerTypeLabel}</Text>
        </View>
        <View style={[styles.statusPill, isActive ? styles.statusActive : styles.statusSuspended]}>
          <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextSuspended]}>
            {item.statusLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.partnerMeta} numberOfLines={1}>
        {item.phone || 'Téléphone non renseigné'} · {item.email || 'Email non renseigné'}
      </Text>

      <View style={styles.partnerStatsRow}>
        <View style={styles.partnerStatBox}>
          <Text style={styles.partnerStatValue}>{item.totalBookings}</Text>
          <Text style={styles.partnerStatLabel}>Réservations</Text>
        </View>
        <View style={styles.partnerStatBox}>
          <Text style={styles.partnerStatValue}>{formatPartnerRevenue(item.totalRevenue)}</Text>
          <Text style={styles.partnerStatLabel}>Revenu estimé</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

function ListHeader({
  total,
  activeCount,
  suspendedCount,
}: {
  total: number;
  activeCount: number;
  suspendedCount: number;
}) {
  return (
    <View style={styles.headerBlock}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="#FFF" />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="shield-account-outline" size={14} color={green} />
          <Text style={styles.badgeText}>Admin · Partenaires V1</Text>
        </View>
        <Text style={styles.title}>Gestion partenaires</Text>
        <Text style={styles.subtitle}>{PROTAXI_ROUTES.adminPartners}</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{total}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
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
    </View>
  );
}

export default function AdminPartnersScreen() {
  const [partners, setPartners] = useState<AdminPartnerListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    devLog('[ADMIN PARTNERS] list mount');

    const unsubscribe = subscribePartnersWithStats(
      (items) => {
        setPartners(items);
        setLoading(false);
      },
      (error) => {
        devError('[ADMIN PARTNERS] list subscription failed', error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const summary = useMemo(() => {
    const activeCount = partners.filter((partner) => partner.isActive).length;
    return {
      total: partners.length,
      activeCount,
      suspendedCount: partners.length - activeCount,
    };
  }, [partners]);

  const openPartnerDetails = useCallback((partnerId: string) => {
    devLog('[ADMIN PARTNERS] open details', { partnerId });
    router.push({
      pathname: '/admin-partner-details',
      params: { id: partnerId },
    });
  }, []);

  const renderItem: ListRenderItem<AdminPartnerListItem> = useCallback(
    ({ item }) => <PartnerListItem item={item} onPress={openPartnerDetails} />,
    [openPartnerDetails],
  );

  const keyExtractor = useCallback((item: AdminPartnerListItem) => item.uid, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<AdminPartnerListItem> | null | undefined, index: number) => ({
      length: PARTNER_ROW_HEIGHT,
      offset: PARTNER_ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  const listHeader = useMemo(
    () => (
      <ListHeader
        total={summary.total}
        activeCount={summary.activeCount}
        suspendedCount={summary.suspendedCount}
      />
    ),
    [summary.activeCount, summary.suspendedCount, summary.total],
  );

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="large" color={green} />
          <Text style={styles.emptyText}>Chargement des partenaires...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyCard}>
        <MaterialCommunityIcons name="handshake-outline" size={34} color={muted} />
        <Text style={styles.emptyTitle}>Aucun partenaire</Text>
        <Text style={styles.emptyText}>
          Les documents de la collection partners apparaîtront ici avec leurs statistiques.
        </Text>
      </View>
    );
  }, [loading]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <FlatList
        data={partners}
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
  container: {
    flex: 1,
    backgroundColor: bg,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    flexGrow: 1,
  },
  headerBlock: {
    paddingTop: 8,
    paddingBottom: 8,
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
    marginBottom: 18,
  },
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
  badgeText: {
    color: green,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: muted,
    fontSize: 12,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 14,
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
  },
  summaryLabel: {
    color: muted,
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  partnerCard: {
    height: PARTNER_ROW_HEIGHT - 12,
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    marginBottom: 12,
  },
  partnerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  partnerTitleWrap: {
    flex: 1,
  },
  partnerName: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
  partnerType: {
    color: green,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  statusActive: {
    backgroundColor: 'rgba(139,197,63,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.35)',
  },
  statusSuspended: {
    backgroundColor: 'rgba(255,90,90,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.35)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextActive: {
    color: green,
  },
  statusTextSuspended: {
    color: red,
  },
  partnerMeta: {
    color: muted,
    fontSize: 12,
    marginBottom: 12,
  },
  partnerStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  partnerStatBox: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 10,
  },
  partnerStatValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  partnerStatLabel: {
    color: muted,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
