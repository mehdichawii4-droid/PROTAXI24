import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const gold = '#D4A017';
const red = '#FF4B4B';

export default function SettingsScreen() {
  const [darkMode, setDarkMode] = useState(true);
  const [notifications, setNotifications] = useState(true);

  const loadSettings = async () => {
    const data = await AsyncStorage.getItem('settings');

    if (data) {
      const settings = JSON.parse(data);
      setDarkMode(settings.darkMode ?? true);
      setNotifications(settings.notifications ?? true);
    }
  };

  const saveSettings = async (newDarkMode: boolean, newNotifications: boolean) => {
    await AsyncStorage.setItem(
      'settings',
      JSON.stringify({
        darkMode: newDarkMode,
        notifications: newNotifications,
      })
    );
  };

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const toggleDarkMode = async (value: boolean) => {
    setDarkMode(value);
    await saveSettings(value, notifications);
  };

  const toggleNotifications = async (value: boolean) => {
    setNotifications(value);
    await saveSettings(darkMode, value);
  };

  const clearCache = async () => {
    await AsyncStorage.removeItem('temporaryCache');

    Alert.alert('Cache vidé', 'Le cache temporaire de l’application a été nettoyé.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Paramètres</Text>

          <View style={{ width: 28 }} />
        </View>

        <View style={styles.heroBox}>
          <View style={styles.heroIcon}>
            <Ionicons name="settings" size={46} color={gold} />
          </View>

          <Text style={styles.heroTitle}>Paramètres</Text>
          <Text style={styles.heroSubtitle}>
            Gérez vos préférences et votre compte PROTAXI24.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Préférences</Text>

        <SettingSwitch
          icon="moon-outline"
          title="Mode sombre"
          subtitle="Interface premium sombre"
          value={darkMode}
          onValueChange={toggleDarkMode}
        />

        <SettingSwitch
          icon="notifications-outline"
          title="Notifications"
          subtitle="Recevoir les alertes de réservation"
          value={notifications}
          onValueChange={toggleNotifications}
        />

        <SettingItem
          icon="language-outline"
          title="Langue"
          subtitle="Français"
          rightText="FR"
          onPress={() => Alert.alert('Langue', 'Langue actuelle : Français')}
        />

        <Text style={styles.sectionTitle}>Sécurité</Text>

        <SettingItem
          icon="lock-closed-outline"
          title="Confidentialité"
          subtitle="Données stockées localement"
          onPress={() =>
            Alert.alert(
              'Confidentialité',
              'Vos informations sont enregistrées localement sur votre téléphone. Le cloud sera ajouté avec Firebase plus tard.'
            )
          }
        />

        <SettingItem
          icon="shield-checkmark-outline"
          title="Sécurité du compte"
          subtitle="Connexion sécurisée bientôt"
          onPress={() =>
            Alert.alert(
              'Sécurité du compte',
              'La connexion sécurisée sera ajoutée lors de l’intégration Firebase.'
            )
          }
        />

        <Text style={styles.sectionTitle}>Informations</Text>

        <SettingItem
          icon="information-circle-outline"
          title="À propos"
          subtitle="Version 1.0.0"
          onPress={() =>
            Alert.alert(
              'PROTAXI24',
              'Application premium de réservation taxi à Guelma.\nVersion 1.0.0'
            )
          }
        />

        <SettingItem
          icon="document-text-outline"
          title="Conditions d’utilisation"
          subtitle="Règles de réservation"
          onPress={() =>
            Alert.alert(
              'Conditions d’utilisation',
              'Toute réservation envoyée reste en attente jusqu’à confirmation de PROTAXI24 par téléphone ou WhatsApp.'
            )
          }
        />

        <SettingItem
          icon="help-circle-outline"
          title="FAQ"
          subtitle="Questions fréquentes"
          onPress={() => router.push('/support')}
        />

        <Text style={styles.sectionTitle}>Autres</Text>

        <SettingItem
          icon="trash-bin-outline"
          title="Vider le cache"
          subtitle="Nettoyer les données temporaires"
          rightText="OK"
          onPress={clearCache}
        />

        <Text style={styles.sectionTitle}>Compte</Text>

        <TouchableOpacity
          style={styles.logoutCard}
          activeOpacity={0.85}
          onPress={() =>
            Alert.alert(
              'Déconnexion',
              'La déconnexion sera disponible après l’intégration du compte client.'
            )
          }
        >
          <View style={styles.left}>
            <View style={styles.redIconBox}>
              <Ionicons name="log-out-outline" size={24} color={red} />
            </View>

            <View>
              <Text style={styles.logoutText}>Se déconnecter</Text>
              <Text style={styles.itemSubtitle}>Quitter le compte</Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={22} color="#777" />
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>PROTAXI24</Text>
          <Text style={styles.footerText}>Merci de nous faire confiance 💛</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingSwitch({ icon, title, subtitle, value, onValueChange }: any) {
  return (
    <View style={styles.settingCard}>
      <View style={styles.left}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={24} color={gold} />
        </View>

        <View style={styles.itemTextBox}>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#333', true: gold }}
        thumbColor="#FFF"
      />
    </View>
  );
}

function SettingItem({ icon, title, subtitle, onPress, rightText }: any) {
  return (
    <TouchableOpacity style={styles.settingCard} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.left}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={24} color={gold} />
        </View>

        <View style={styles.itemTextBox}>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.rightBox}>
        {rightText && <Text style={styles.rightText}>{rightText}</Text>}
        <Ionicons name="chevron-forward" size={22} color="#777" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  scroll: { paddingHorizontal: 20, paddingBottom: 44 },

  header: {
    paddingTop: 18,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },

  heroBox: {
    alignItems: 'center',
    marginBottom: 30,
  },

  heroIcon: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212,160,23,0.08)',
    marginBottom: 16,
  },

  heroTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },

  heroSubtitle: {
    color: '#AAA',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },

  sectionTitle: {
    color: gold,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 14,
  },

  settingCard: {
    minHeight: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212,160,23,0.08)',
    marginRight: 14,
  },

  redIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,75,75,0.08)',
    marginRight: 14,
  },

  itemTextBox: { flex: 1 },

  itemTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },

  itemSubtitle: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },

  rightBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  rightText: {
    color: gold,
    fontSize: 13,
    fontWeight: '900',
    marginRight: 6,
  },

  logoutCard: {
    minHeight: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.22)',
    marginBottom: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  logoutText: {
    color: red,
    fontSize: 16,
    fontWeight: '900',
  },

  footer: {
    marginTop: 30,
    alignItems: 'center',
  },

  footerBrand: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
  },

  footerText: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
});