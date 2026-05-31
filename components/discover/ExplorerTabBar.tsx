import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DISCOVER_CARD, DISCOVER_GREEN, DISCOVER_MUTED } from '@/components/discover/discoverTheme';

export type ExplorerTabId = 'experiences' | 'activites' | 'guides' | 'hebergements';

type ExplorerTabDef = {
  id: ExplorerTabId;
  emoji: string;
  label: string;
};

const TABS: ExplorerTabDef[] = [
  { id: 'experiences', emoji: '🏛', label: 'Expériences' },
  { id: 'activites', emoji: '🎯', label: 'Activités' },
  { id: 'guides', emoji: '🧭', label: 'Guides' },
  { id: 'hebergements', emoji: '🏨', label: 'Hébergements' },
];

type ExplorerTabBarProps = {
  activeTab: ExplorerTabId;
  onSelectTab: (tab: ExplorerTabId) => void;
};

export default function ExplorerTabBar({ activeTab, onSelectTab }: ExplorerTabBarProps) {
  return (
    <View style={styles.wrap}>
      {TABS.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, active && styles.tabActive]}
            activeOpacity={0.85}
            onPress={() => onSelectTab(tab.id)}
          >
            <Text style={styles.tabEmoji}>{tab.emoji}</Text>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: DISCOVER_CARD,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabActive: {
    borderColor: 'rgba(139,197,63,0.45)',
    backgroundColor: 'rgba(139,197,63,0.1)',
  },
  tabEmoji: {
    fontSize: 16,
    marginBottom: 4,
  },
  tabLabel: {
    color: DISCOVER_MUTED,
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: DISCOVER_GREEN,
  },
});
