import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  normalizePhoneForDial,
  type ClientAssignedGuideDisplay,
} from '@/services/clientAssignedGuide';

const green = '#8BC53F';
const gold = '#D4A017';
const muted = '#8A8A8A';

type AssignedGuideClientCardProps = {
  guide: ClientAssignedGuideDisplay;
  variant?: 'compact' | 'full';
};

export default function AssignedGuideClientCard({
  guide,
  variant = 'full',
}: AssignedGuideClientCardProps) {
  const dialPhone = normalizePhoneForDial(guide.assignedGuidePhone);
  const specialties = guide.assignedGuideSpecialtiesSummary?.trim() || '—';
  const phoneLabel = guide.assignedGuidePhone?.trim() || '—';

  const handleCall = () => {
    if (!dialPhone) return;
    void Linking.openURL(`tel:${dialPhone}`);
  };

  if (variant === 'compact') {
    return (
      <View style={styles.compactWrap}>
        <View style={styles.compactLeft}>
          <MaterialCommunityIcons name="account-tie-outline" size={16} color={green} />
          <Text style={styles.compactLabel}>Guide :</Text>
          <Text style={styles.compactName} numberOfLines={1}>
            {guide.assignedGuideName}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Guide PROTAXI</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullCard}>
      <View style={styles.fullHeader}>
        <View style={styles.fullTitleRow}>
          <MaterialCommunityIcons name="account-tie-outline" size={20} color={green} />
          <Text style={styles.fullTitle}>Votre guide certifié</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Guide PROTAXI</Text>
        </View>
      </View>

      <Text style={styles.fullName}>{guide.assignedGuideName}</Text>

      <View style={styles.metaRow}>
        <Ionicons name="call-outline" size={15} color={green} />
        <Text style={styles.metaText}>{phoneLabel}</Text>
        {dialPhone ? (
          <Pressable style={styles.callBtn} onPress={handleCall}>
            <Text style={styles.callBtnText}>Appeler</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="ribbon-outline" size={15} color={green} />
        <Text style={styles.metaText} numberOfLines={2}>
          {specialties}
        </Text>
      </View>

      <Text style={styles.footerHint}>
        Votre guide vous accompagne le jour de l&apos;expérience.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  compactWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(139,197,63,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.22)',
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  compactLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
  },
  compactName: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  badge: {
    backgroundColor: 'rgba(212,160,23,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.45)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  fullCard: {
    width: '100%',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    backgroundColor: 'rgba(139,197,63,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,197,63,0.25)',
  },
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  fullTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  fullTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
  fullName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#D4D4D4',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  callBtn: {
    backgroundColor: green,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  callBtnText: {
    color: '#050505',
    fontSize: 12,
    fontWeight: '900',
  },
  footerHint: {
    color: muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
});
