import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import {
  getUserNotifications,
  setUserNotifications,
  type UserNotificationItem,
} from '@/services/userNotificationInbox';

const gold = '#D4A017';
const red = '#FF4B4B';
const green = '#2ECC71';
const blue = '#008CFF';

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);

  const loadNotifications = useCallback(async () => {
    const uid = profile?.uid;
    if (!uid) {
      setNotifications([]);
      return;
    }

    const list = await getUserNotifications(uid);
    const sorted = [...list].sort(
      (a, b) => Number(b.id || 0) - Number(a.id || 0)
    );
    setNotifications(sorted);
  }, [profile?.uid]);

  useFocusEffect(
    useCallback(() => {
      void loadNotifications();
    }, [loadNotifications])
  );

  const markAllAsRead = async () => {
    const uid = profile?.uid;
    if (!uid) {
      return;
    }

    const updated = notifications.map((item) => ({ ...item, read: true }));
    setNotifications(updated);
    await setUserNotifications(uid, updated);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const clearNotifications = () => {
    const uid = profile?.uid;
    if (!uid) {
      return;
    }

    Alert.alert(
      'Supprimer les notifications',
      'Voulez-vous vraiment supprimer toutes les notifications ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          style: 'destructive',
          onPress: async () => {
            await setUserNotifications(uid, []);
            setNotifications([]);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const getIcon = (message: string) => {
    const text = String(message || '').toLowerCase();

    if (text.includes('annul')) return 'close-circle';
    if (text.includes('termin')) return 'checkmark-done-circle';
    if (text.includes('arriv')) return 'location';
    if (text.includes('route')) return 'car-sport';
    if (text.includes('confirm')) return 'shield-checkmark';
    return 'notifications';
  };

  const getColor = (message: string) => {
    const text = String(message || '').toLowerCase();

    if (text.includes('annul')) return red;
    if (text.includes('termin')) return green;
    if (text.includes('arriv')) return blue;
    if (text.includes('route')) return blue;
    if (text.includes('confirm')) return green;
    return gold;
  };

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSub}>
              {notifications.length} notification{notifications.length > 1 ? 's' : ''}
            </Text>
          </View>

          <TouchableOpacity onPress={loadNotifications} style={styles.headerBtn}>
            <Ionicons name="refresh" size={24} color={gold} />
          </TouchableOpacity>
        </View>

        {unreadCount > 0 && (
          <View style={styles.unreadBox}>
            <View>
              <Text style={styles.unreadTitle}>{unreadCount} nouvelle notification</Text>
              <Text style={styles.unreadSub}>Consultez les dernières activités PROTAXI24.</Text>
            </View>

            <TouchableOpacity style={styles.readBtn} onPress={markAllAsRead}>
              <Text style={styles.readText}>Marquer lu</Text>
            </TouchableOpacity>
          </View>
        )}

        {notifications.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} activeOpacity={0.85} onPress={clearNotifications}>
            <Ionicons name="trash-outline" size={20} color={red} />
            <Text style={styles.clearText}>Tout supprimer</Text>
          </TouchableOpacity>
        )}

        {notifications.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={58} color={gold} />
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.emptyText}>Les mises à jour de vos réservations apparaîtront ici.</Text>
          </View>
        )}

        {notifications.map((item) => {
          const color = getColor(item.message);
          const icon = getIcon(item.message);
          const isUnread = !item.read;

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, isUnread && styles.cardUnread]}
              activeOpacity={0.88}
              onPress={() => router.push('/reservation')}
            >
              <View style={[styles.iconBox, { borderColor: color }]}>
                <Ionicons name={icon as any} size={25} color={color} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.cardTop}>
                  <Text style={styles.title}>{item.title || 'PROTAXI24'}</Text>
                  {isUnread && <View style={styles.dot} />}
                </View>

                <Text style={styles.message}>{item.message || 'Nouvelle activité.'}</Text>
                <Text style={styles.date}>{item.date || ''}</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  header: {
    paddingTop: 18,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerCenter: {
    alignItems: 'center',
  },

  headerTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },

  headerSub: {
    color: '#AAA',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  unreadBox: {
    borderRadius: 22,
    backgroundColor: 'rgba(212,160,23,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.45)',
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  unreadTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },

  unreadSub: {
    color: '#CCC',
    fontSize: 12,
    marginTop: 4,
  },

  readBtn: {
    backgroundColor: gold,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
  },

  readText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '900',
  },

  clearBtn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.4)',
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  clearText: {
    color: red,
    fontSize: 15,
    fontWeight: '900',
  },

  emptyBox: {
    marginTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
    borderRadius: 24,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.25)',
  },

  emptyTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 15,
  },

  emptyText: {
    color: '#AAA',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },

  card: {
    minHeight: 92,
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 14,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },

  cardUnread: {
    borderColor: 'rgba(212,160,23,0.45)',
    backgroundColor: 'rgba(212,160,23,0.06)',
  },

  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: gold,
  },

  message: {
    color: '#CCC',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },

  date: {
    color: '#777',
    fontSize: 12,
    marginTop: 6,
  },
});