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
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const gold = '#D4A017';
const green = '#2ECC71';

export default function PaymentsScreen() {
  const [selectedMethod, setSelectedMethod] = useState('Espèces');

  const loadPaymentMethod = async () => {
    const method = await AsyncStorage.getItem('paymentMethod');
    if (method) {
      setSelectedMethod(method);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPaymentMethod();
    }, [])
  );

  const selectMethod = async (method: string) => {
    setSelectedMethod(method);
    await AsyncStorage.setItem('paymentMethod', method);

    Alert.alert(
      'Méthode enregistrée',
      `${method} est maintenant votre méthode de paiement préférée.`
    );
  };

  const cardComingSoon = () => {
    Alert.alert(
      'Carte bancaire',
      'Le paiement par carte sera ajouté plus tard avec un système sécurisé.'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={28} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Paiements</Text>

          <View style={{ width: 28 }} />
        </View>

        <Text style={styles.sectionTitle}>Méthodes de paiement</Text>

        <PaymentMethod
          icon="cash-outline"
          title="Espèces"
          subtitle="Paiement en espèces à la fin du trajet"
          active={selectedMethod === 'Espèces'}
          onPress={() => selectMethod('Espèces')}
        />
<PaymentMethod
  icon="wallet-outline"
  title="Wallet PROTAXI24"
  subtitle="Portefeuille interne bientôt disponible"
  tag="À venir"
  active={false}
  onPress={() =>
    Alert.alert(
      'Wallet PROTAXI24',
      'Le portefeuille PROTAXI24 sera ajouté plus tard.'
    )
  }
/>

<PaymentMethod
  icon="card-outline"
  title="Carte bancaire"
  subtitle="Paiement sécurisé bientôt disponible"
  tag="À venir"
  active={false}
  onPress={cardComingSoon}
/>
        
         
        <View style={styles.activeBox}>
          <Ionicons name="checkmark-circle" size={25} color={green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeTitle}>Méthode active</Text>
            <Text style={styles.activeText}>{selectedMethod}</Text>
          </View>
        </View>

        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Historique des paiements</Text>
        </View>

        <View style={styles.historyBox}>
          <PaymentRow title="Aéroport Alger" date="16 Mai 2025 • 14:32" price="4 500 DZD" />
          <PaymentRow title="Hôtel El Aurassi" date="14 Mai 2025 • 09:15" price="7 000 DZD" />
          <PaymentRow title="Centre Ville" date="12 Mai 2025 • 18:47" price="2 200 DZD" last />
        </View>

        <View style={styles.secureBox}>
          <View style={styles.secureIcon}>
            <Ionicons name="shield-checkmark-outline" size={38} color={gold} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.secureTitle}>Paiements sécurisés PROTAXI24</Text>
            <Text style={styles.secureText}>
              Le paiement en ligne sera ajouté plus tard. Pour le moment, le paiement se fait à la fin du trajet.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PaymentMethod({ icon, title, subtitle, tag, active, onPress }: any) {
  return (
    <TouchableOpacity
      style={[styles.methodCard, active && styles.methodCardActive]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.left}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={25} color={gold} />
        </View>

        <View style={styles.textBox}>
          <Text style={styles.methodTitle}>{title}</Text>
          <Text style={styles.methodSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.rightBox}>
        {tag && <Text style={styles.tag}>{tag}</Text>}

        {active ? (
          <Ionicons name="checkmark-circle" size={24} color={green} />
        ) : (
          <Ionicons name="chevron-forward" size={22} color="#777" />
        )}
      </View>
    </TouchableOpacity>
  );
}

function PaymentRow({ title, date, price, last }: any) {
  return (
    <View style={[styles.paymentRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.smallIconBox}>
        <Ionicons name="car" size={20} color={gold} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.payTitle}>{title}</Text>
        <Text style={styles.payDate}>{date}</Text>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.payPrice}>{price}</Text>
        <Text style={styles.paidText}>Payé</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 44,
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

  sectionTitle: {
    color: '#FFF',
    fontSize: 21,
    fontWeight: '900',
    marginBottom: 16,
  },

  methodCard: {
    minHeight: 84,
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

  methodCardActive: {
    borderColor: 'rgba(46,204,113,0.45)',
    backgroundColor: 'rgba(46,204,113,0.06)',
  },

  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212,160,23,0.08)',
    marginRight: 14,
  },

  textBox: {
    flex: 1,
  },

  methodTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },

  methodSubtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },

  rightBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  tag: {
    color: gold,
    fontSize: 12,
    fontWeight: '900',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.45)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginRight: 8,
  },

  activeBox: {
    minHeight: 70,
    borderRadius: 20,
    backgroundColor: 'rgba(46,204,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46,204,113,0.35)',
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  activeTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },

  activeText: {
    color: green,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },

  historyHeader: {
    marginTop: 6,
  },

  historyBox: {
    borderRadius: 22,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },

  paymentRow: {
    minHeight: 82,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },

  smallIconBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(212,160,23,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  payTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },

  payDate: {
    color: '#888',
    fontSize: 12,
    marginTop: 5,
  },

  payPrice: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
  },

  paidText: {
    color: green,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 5,
  },

  secureBox: {
    marginTop: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  secureIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: 'rgba(212,160,23,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },

  secureTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },

  secureText: {
    color: '#AAA',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
});