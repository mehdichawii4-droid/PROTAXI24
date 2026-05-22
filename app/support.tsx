import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
    Alert,
    Linking,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const gold = '#D4A017';
const phoneDisplay = '+213 671 421 448';
const phoneLink = '+213671421448';

export default function SupportScreen() {
  const callSupport = () => {
    Linking.openURL(`tel:${phoneLink}`);
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent(
      'Bonjour PROTAXI24, j’ai besoin d’assistance.'
    );

    Linking.openURL(`https://wa.me/${phoneLink.replace('+', '')}?text=${message}`);
  };

  const sendMail = () => {
    Linking.openURL('mailto:support@protaxi24.com');
  };

  const openFaq = (title: string, message: string) => {
    Alert.alert(title, message);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Support</Text>

          <View style={{ width: 28 }} />
        </View>

        <View style={styles.heroBox}>
          <View style={styles.heroIcon}>
            <Ionicons name="headset" size={42} color={gold} />
          </View>

          <Text style={styles.heroTitle}>Assistance PROTAXI24</Text>

          <Text style={styles.heroSubtitle}>
            Notre équipe est disponible 24h/24 pour vous aider.
          </Text>
        </View>

        <SupportCard
          icon="call-outline"
          title="Appeler"
          subtitle="Assistance directe"
          onPress={callSupport}
        />

        <SupportCard
          icon="logo-whatsapp"
          title="WhatsApp"
          subtitle="Chat rapide avec support"
          onPress={openWhatsApp}
        />

        <SupportCard
          icon="mail-outline"
          title="Email"
          subtitle="support@protaxi24.com"
          onPress={sendMail}
        />

        <Text style={styles.faqTitle}>Questions fréquentes</Text>

        <FAQItem
          icon="calendar-outline"
          title="Comment modifier ma réservation ?"
          onPress={() =>
            openFaq(
              'Modifier une réservation',
              'Ouvrez Mes réservations, choisissez votre réservation, puis contactez PROTAXI24 par WhatsApp ou téléphone pour modifier les détails.'
            )
          }
        />

        <FAQItem
          icon="close-circle-outline"
          title="Comment annuler une course ?"
          onPress={() =>
            openFaq(
              'Annuler une course',
              'Ouvrez Mes réservations, puis appuyez sur Annuler. Votre réservation passera automatiquement au statut Annulée.'
            )
          }
        />

        <FAQItem
          icon="card-outline"
          title="Modes de paiement disponibles"
          onPress={() =>
            openFaq(
              'Paiement',
              'Pour le moment, le paiement se fait à la fin du trajet. Le paiement en ligne sera ajouté plus tard.'
            )
          }
        />

        <FAQItem
          icon="car-outline"
          title="Temps d’attente chauffeur"
          onPress={() =>
            openFaq(
              'Temps d’attente',
              'Votre chauffeur vous contactera avant l’heure de prise en charge. Nous conseillons d’être prêt 10 minutes avant.'
            )
          }
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Support disponible 24h/24</Text>
          <Text style={styles.footerPhone}>{phoneDisplay}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SupportCard({ icon, title, subtitle, onPress }: any) {
  return (
    <TouchableOpacity style={styles.actionCard} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.left}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={24} color={gold} />
        </View>

        <View>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={22} color="#777" />
    </TouchableOpacity>
  );
}

function FAQItem({ icon, title, onPress }: any) {
  return (
    <TouchableOpacity style={styles.faqItem} activeOpacity={0.85} onPress={onPress}>
      <Ionicons name={icon} size={22} color={gold} />
      <Text style={styles.faqText}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color="#777" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

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
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
  },

  heroSubtitle: {
    color: '#AAA',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },

  actionCard: {
    minHeight: 78,
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  left: {
    flexDirection: 'row',
    alignItems: 'center',
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

  cardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },

  cardSubtitle: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },

  faqTitle: {
    color: gold,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 16,
  },

  faqItem: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  faqText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 14,
    flex: 1,
  },

  footer: {
    marginTop: 24,
    alignItems: 'center',
  },

  footerText: {
    color: '#888',
    fontSize: 14,
  },

  footerPhone: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8,
  },
});