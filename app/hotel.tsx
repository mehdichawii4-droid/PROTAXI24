import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
    Alert,
    ImageBackground,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const gold = '#D4A017';
const goldLight = '#FFD700';
const card = '#0E0E0E';
const border = '#262626';

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function DiscoverSourceBadge() {
  return (
    <View style={styles.discoverBadge}>
      <Ionicons name="compass-outline" size={12} color={gold} />
      <Text style={styles.discoverBadgeText}>Depuis Découvrir Guelma</Text>
    </View>
  );
}

export default function HotelScreen() {
  const params = useLocalSearchParams<{
    hotelName?: string | string[];
    source?: string | string[];
    partnerId?: string | string[];
    partnerName?: string | string[];
  }>();

  const incomingHotelName = normalizeParam(params.hotelName);
  const incomingSource = normalizeParam(params.source);
  const partnerId = normalizeParam(params.partnerId);
  const partnerName = normalizeParam(params.partnerName);
  const fromDiscoverGuelma = incomingSource === 'discover-guelma';
  const fromPartner = incomingSource === 'partner';

  const [country, setCountry] = useState('Algérie');
  const [destination, setDestination] = useState(
    incomingHotelName ? 'Autre destination' : 'Constantine',
  );
  const [customDestination, setCustomDestination] = useState(
    incomingHotelName ? 'Guelma' : '',
  );
  const [tripType, setTripType] = useState('Aller / Retour');
  const [departure, setDeparture] = useState('Guelma, Algérie');
  const [hotelAddress, setHotelAddress] = useState(incomingHotelName || '');
  const [goDate, setGoDate] = useState('');
  const [goTime, setGoTime] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [passengers, setPassengers] = useState(2);
  const [bags, setBags] = useState(2);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState(() =>
    incomingHotelName ? `Hôtel partenaire sélectionné : ${incomingHotelName}` : '',
  );
  const [showGoDate, setShowGoDate] = useState(false);
  const [showGoTime, setShowGoTime] = useState(false);
  const [showReturnDate, setShowReturnDate] = useState(false);
  const [showReturnTime, setShowReturnTime] = useState(false);

  const algeriaDestinations = [
    { name: 'Constantine', sub: 'Hôtels & séjour', price: 8500 },
    { name: 'Annaba', sub: 'Hôtels & bord de mer', price: 7000 },
    { name: 'Alger', sub: 'Hôtels & affaires', price: 22000 },
    { name: 'Oran', sub: 'Hôtels & vacances', price: 36000 },
  ];

  const tunisiaDestinations = [
    { name: 'Tunis', sub: 'Centre-ville', price: 26000 },
    { name: 'Hammamet', sub: 'Vacances & resort', price: 30000 },
    { name: 'Sousse', sub: 'Séjour touristique', price: 34000 },
    { name: 'Tabarka', sub: 'Hôtels & plage', price: 18000 },
  ];

  const destinations = country === 'Algérie' ? algeriaDestinations : tunisiaDestinations;

  const selectedPrice = useMemo(() => {
    const found = destinations.find((item) => item.name === destination);
    if (!found) return 0;
    return tripType === 'Aller / Retour' ? found.price * 2 : found.price;
  }, [destination, destinations, tripType]);

  const finalDestination =
    destination === 'Autre destination'
      ? customDestination || 'Destination à préciser'
      : destination;

  const formattedPrice =
    selectedPrice > 0 ? `${selectedPrice.toLocaleString('fr-FR')} DA` : 'Sur devis';

  const selectCountry = (item: string) => {
    setCountry(item);
    setDestination(item === 'Algérie' ? 'Constantine' : 'Tunis');
    setCustomDestination('');
  };

  const formatDate = (selectedDate: Date) => {
    const day = selectedDate.getDate();
    const month = selectedDate.getMonth() + 1;
    const year = selectedDate.getFullYear();
    return `${day < 10 ? '0' : ''}${day}/${month < 10 ? '0' : ''}${month}/${year}`;
  };

  const formatTime = (selectedTime: Date) => {
    const hours = selectedTime.getHours();
    const minutes = selectedTime.getMinutes();
    return `${hours < 10 ? '0' : ''}${hours}:${minutes < 10 ? '0' : ''}${minutes}`;
  };

  const goToSummary = () => {
    if (!hotelAddress || !fullName || !phone) {
  Alert.alert(
    'Informations manquantes',
    'Veuillez remplir le nom, le téléphone et l’adresse de l’hôtel.'
  );
  return;
}
    router.push({
      pathname: '/hotel-summary',
      params: {
        service: 'Hôtel & séjour',
        country,
        destination: finalDestination,
        transferType: tripType,
        departure,
        hotelAddress,
        date: goDate || 'À confirmer',
        time: goTime || 'À confirmer',
        returnDate: tripType === 'Aller / Retour' ? returnDate || 'À confirmer' : 'Aucun retour',
        returnTime: tripType === 'Aller / Retour' ? returnTime || 'À confirmer' : 'Aucun retour',
        passengers: `${passengers} passager${passengers > 1 ? 's' : ''}`,
        bags: `${bags} bagage${bags > 1 ? 's' : ''}`,
        fullName: fullName || 'Client PROTAXI',
        phone: phone || 'Non renseigné',
        notes: notes || 'Aucune note',
        price: formattedPrice,
        ...(incomingHotelName ? { hotelName: incomingHotelName } : {}),
        ...(fromDiscoverGuelma ? { source: incomingSource } : {}),
        ...(fromPartner && partnerId
          ? { source: 'partner', partnerId, partnerName }
          : {}),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={25} color="#FFF" />
        </TouchableOpacity>

        {fromDiscoverGuelma ? <DiscoverSourceBadge /> : null}

        <ImageBackground
          source={require('../assets/images/hotel.jpg')}
          style={styles.heroCard}
          imageStyle={styles.heroImageStyle}
        >
          <View style={styles.overlay}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLogo}>PROTAXI</Text>
              <Text style={styles.heroBadge}>HOTEL PREMIUM</Text>
            </View>

            <View>
              <Text style={styles.heroMainTitle}>Réservation Hôtel</Text>
              <Text style={styles.heroSubtitle}>Algérie • Tunisie • Aller-retour</Text>
              <View style={styles.progressBack}>
                <View style={styles.progressFront} />
              </View>
            </View>

            <View style={styles.heroContent}>
              <Text style={styles.step}>Étape 1 sur 4</Text>
              <Text style={styles.heroTitle}>Organisez votre séjour</Text>
              <Text style={styles.heroText}>
                Réservez votre trajet vers votre hôtel en toute simplicité.
              </Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.sectionHeader}>
          <Ionicons name="location-outline" size={21} color={gold} />
          <Text style={styles.sectionTitle}>Choisir la destination</Text>
        </View>

        <View style={styles.countryRow}>
          {['Algérie', 'Tunisie'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.countryCard, country === item && styles.activeCard]}
              onPress={() => selectCountry(item)}
            >
              <Text style={[styles.countryText, country === item && styles.activeText]}>
                {item === 'Algérie' ? '🇩🇿 Algérie' : '🇹🇳 Tunisie'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.grid}>
          {destinations.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={[styles.destCard, destination === item.name && styles.activeCard]}
              onPress={() => setDestination(item.name)}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.destName, destination === item.name && styles.activeText]}>
                {item.name}
              </Text>
              <Text numberOfLines={2} style={styles.destSub}>{item.sub}</Text>

              {destination === item.name && (
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={15} color="#111" />
                </View>
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.destCard, destination === 'Autre destination' && styles.activeCard]}
            onPress={() => setDestination('Autre destination')}
          >
            <Text numberOfLines={2} adjustsFontSizeToFit style={[styles.destName, destination === 'Autre destination' && styles.activeText]}>
              Autre destination
            </Text>
            <Text style={styles.destSub}>Écrire manuellement</Text>

            {destination === 'Autre destination' && (
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={15} color="#111" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {destination === 'Autre destination' && (
          <TextInput
            style={styles.input}
            placeholder={country === 'Algérie' ? 'Ex : Jijel, Tlemcen...' : 'Ex : Djerba, Nabeul...'}
            placeholderTextColor="#777"
            value={customDestination}
            onChangeText={setCustomDestination}
          />
        )}

        <View style={styles.sectionHeader}>
          <Ionicons name="swap-horizontal-outline" size={22} color={gold} />
          <Text style={styles.sectionTitle}>Type de voyage</Text>
        </View>

        <View style={styles.transferRow}>
          {['Aller simple', 'Aller / Retour'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.transferCard, tripType === item && styles.activeCard]}
              onPress={() => setTripType(item)}
            >
              <View style={styles.transferIconBox}>
                <Ionicons
                  name={item === 'Aller simple' ? 'arrow-forward-outline' : 'repeat-outline'}
                  size={24}
                  color={tripType === item ? goldLight : '#FFF'}
                />
              </View>

              <View style={styles.transferTextBox}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.transferTitle, tripType === item && styles.activeText]}>
                  {item}
                </Text>
                <Text style={styles.destSub}>
                  {item === 'Aller simple' ? 'Une seule course' : 'Départ + retour'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={gold} />
          <Text style={styles.infoText}>
            Le prix peut être ajusté selon l’hôtel, l’heure et le trajet exact.
          </Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.sectionHeader}>
          <Ionicons name="business-outline" size={21} color={gold} />
          <Text style={styles.sectionTitle}>Informations du séjour</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Lieu de départ"
          placeholderTextColor="#777"
          value={departure}
          onChangeText={setDeparture}
        />

        <TextInput
          style={styles.input}
          placeholder="Nom de l’hôtel / adresse"
          placeholderTextColor="#777"
          value={hotelAddress}
          onChangeText={setHotelAddress}
        />

        <View style={styles.row}>
          <TouchableOpacity style={[styles.modernInput, styles.half]} onPress={() => setShowGoDate(true)}>
            <Text style={styles.labelMini}>Date aller</Text>
            <View style={styles.inputRow}>
              <Ionicons name="calendar-outline" size={18} color={gold} />
              <Text style={goDate ? styles.dateText : styles.placeholderText}>{goDate || 'Choisir'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.modernInput, styles.half]} onPress={() => setShowGoTime(true)}>
            <Text style={styles.labelMini}>Heure aller</Text>
            <View style={styles.inputRow}>
              <Ionicons name="time-outline" size={18} color={gold} />
              <Text style={goTime ? styles.dateText : styles.placeholderText}>{goTime || 'Choisir'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {tripType === 'Aller / Retour' && (
          <View style={styles.row}>
            <TouchableOpacity style={[styles.modernInput, styles.half]} onPress={() => setShowReturnDate(true)}>
              <Text style={styles.labelMini}>Date retour</Text>
              <View style={styles.inputRow}>
                <Ionicons name="calendar-number-outline" size={18} color={gold} />
                <Text style={returnDate ? styles.dateText : styles.placeholderText}>{returnDate || 'Choisir'}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modernInput, styles.half]} onPress={() => setShowReturnTime(true)}>
              <Text style={styles.labelMini}>Heure retour</Text>
              <View style={styles.inputRow}>
                <Ionicons name="time-outline" size={18} color={gold} />
                <Text style={returnTime ? styles.dateText : styles.placeholderText}>{returnTime || 'Choisir'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.row}>
          <CounterBox title="Passagers" icon="people-outline" value={passengers} onMinus={() => setPassengers(Math.max(1, passengers - 1))} onPlus={() => setPassengers(passengers + 1)} />
          <CounterBox title="Bagages" icon="briefcase-outline" value={bags} onMinus={() => setBags(Math.max(0, bags - 1))} onPlus={() => setBags(bags + 1)} />
        </View>

        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={21} color={gold} />
          <Text style={styles.sectionTitle}>Vos coordonnées</Text>
        </View>

        <View style={styles.row}>
          <TextInput style={[styles.input, styles.half]} placeholder="Nom complet" placeholderTextColor="#777" value={fullName} onChangeText={setFullName} />
          <TextInput style={[styles.input, styles.half]} placeholder="Téléphone" placeholderTextColor="#777" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        </View>

        <View style={styles.sectionHeader}>
          <Ionicons name="create-outline" size={21} color={gold} />
          <Text style={styles.sectionTitle}>
            Informations supplémentaires <Text style={styles.optional}>(optionnel)</Text>
          </Text>
        </View>

        <TextInput
          style={styles.noteInput}
          placeholder="Demandes spéciales, réservation hôtel, précision..."
          placeholderTextColor="#777"
          multiline
          maxLength={200}
          value={notes}
          onChangeText={setNotes}
        />

        <Text style={styles.counterChars}>{notes.length}/200</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <MaterialCommunityIcons name="car-estate" size={23} color={goldLight} />
            <Text style={styles.summaryTitle}>Estimation de trajet</Text>
          </View>

          <SummaryLine label="Trajet" value={`${departure} → ${finalDestination}`} />
          <SummaryLine label="Pays" value={country} />
          <SummaryLine label="Type" value={tripType} />

          <View style={styles.priceLine}>
            <Text style={styles.priceLabel}>Prix estimé</Text>
            <Text style={styles.price}>{formattedPrice}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={goToSummary}>
          <Ionicons name="paper-plane-outline" size={22} color="#111" />
          <Text style={styles.buttonText}>Voir le résumé et envoyer</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Votre demande sera traitée par PROTAXI. Le prix final sera confirmé selon le trajet exact.
        </Text>
      </ScrollView>

      {showGoDate && (
        <DateTimePicker value={new Date()} mode="date" display="default" onChange={(event, selectedDate) => {
          setShowGoDate(false);
          if (selectedDate) setGoDate(formatDate(selectedDate));
        }} />
      )}

      {showGoTime && (
        <DateTimePicker value={new Date()} mode="time" display="default" is24Hour onChange={(event, selectedTime) => {
          setShowGoTime(false);
          if (selectedTime) setGoTime(formatTime(selectedTime));
        }} />
      )}

      {showReturnDate && (
        <DateTimePicker value={new Date()} mode="date" display="default" onChange={(event, selectedDate) => {
          setShowReturnDate(false);
          if (selectedDate) setReturnDate(formatDate(selectedDate));
        }} />
      )}

      {showReturnTime && (
        <DateTimePicker value={new Date()} mode="time" display="default" is24Hour onChange={(event, selectedTime) => {
          setShowReturnTime(false);
          if (selectedTime) setReturnTime(formatTime(selectedTime));
        }} />
      )}
    </SafeAreaView>
  );
}

function CounterBox({ title, icon, value, onMinus, onPlus }: any) {
  return (
    <View style={[styles.counterBox, styles.half]}>
      <View style={styles.counterHeader}>
        <Ionicons name={icon} size={19} color={gold} />
        <Text style={styles.counterLabel}>{title}</Text>
      </View>

      <View style={styles.counterLine}>
        <TouchableOpacity style={styles.counterButton} onPress={onMinus}>
          <Text style={styles.counterBtn}>−</Text>
        </TouchableOpacity>

        <Text style={styles.counterValue}>{value}</Text>

        <TouchableOpacity style={styles.counterButton} onPress={onPlus}>
          <Text style={styles.counterBtn}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SummaryLine({ label, value }: any) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030303', paddingHorizontal: 18 },
  backBtn: { marginTop: 44, width: 44, height: 44, borderRadius: 22, backgroundColor: card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: border, zIndex: 2 },
  discoverBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
    marginBottom: 12,
  },
  discoverBadgeText: {
    color: gold,
    fontSize: 11,
    fontWeight: '800',
  },
 heroCard: {
  height: 340,
  borderRadius: 28,
  overflow: 'hidden',
  borderWidth: 1.5,
  borderColor: 'rgba(255,215,0,0.45)',
  marginBottom: 24,
  backgroundColor: '#111',
},
heroImage: {
  borderRadius: 28,
},
  heroImageStyle: { borderRadius: 30 },
  overlay: { flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.35)', padding: 22, justifyContent: 'space-between' },
  heroTop: { alignItems: 'center', marginTop: 32 },
  heroLogo: { color: goldLight, fontSize: 29, fontWeight: '900', letterSpacing: 2 },
  heroBadge: { color: '#D8D8D8', fontSize: 11, fontWeight: '900', marginTop: 4, letterSpacing: 1.5 },
  heroMainTitle: { color: '#FFF', fontSize: 31, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  heroSubtitle: { color: '#DDD', textAlign: 'center', marginTop: 7, fontSize: 14 },
  progressBack: { height: 4, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 4, marginTop: 22 },
  progressFront: { width: '34%', height: 4, backgroundColor: goldLight, borderRadius: 4 },
  heroContent: { backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  step: { color: goldLight, fontWeight: '900', marginBottom: 10, fontSize: 13 },
  heroTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', lineHeight: 30 },
  heroText: { color: '#BEBEBE', marginTop: 9, fontSize: 14, lineHeight: 21 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14, marginTop: 10 },
  sectionTitle: { color: '#FFF', fontSize: 17, fontWeight: '900', flexShrink: 1 },
  countryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  countryCard: { flex: 1, height: 60, backgroundColor: card, borderRadius: 20, borderWidth: 1, borderColor: border, justifyContent: 'center', alignItems: 'center' },
  countryText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  destCard: { width: '48%', minHeight: 95, backgroundColor: card, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: border, justifyContent: 'center' },
  activeCard: { borderColor: gold, backgroundColor: '#171307' },
  destName: { color: '#FFF', fontSize: 16, fontWeight: '900', paddingRight: 22 },
  destSub: { color: '#9A9A9A', fontSize: 12, marginTop: 7 },
  activeText: { color: goldLight },
  checkCircle: { position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 11, backgroundColor: goldLight, justifyContent: 'center', alignItems: 'center' },
  transferRow: { flexDirection: 'row', justifyContent: 'space-between' },
  transferCard: { width: '48%', minHeight: 88, backgroundColor: card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  transferIconBox: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#151515', justifyContent: 'center', alignItems: 'center' },
  transferTextBox: { flex: 1 },
  transferTitle: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#101010', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 18, padding: 14, marginTop: 14, marginBottom: 18, gap: 10 },
  infoText: { color: '#A8A8A8', fontSize: 12, lineHeight: 19, flex: 1 },
  separator: { height: 1, backgroundColor: '#202020', marginBottom: 16 },
  input: { backgroundColor: card, borderRadius: 20, paddingHorizontal: 16, height: 60, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: border, marginBottom: 14 },
  modernInput: { backgroundColor: card, borderRadius: 20, borderWidth: 1, borderColor: border, justifyContent: 'center', paddingHorizontal: 16, height: 66, marginBottom: 14 },
  labelMini: { color: goldLight, fontSize: 11, fontWeight: '900', marginBottom: 5, letterSpacing: 0.7 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { color: '#FFF', fontSize: 15, fontWeight: '800', marginLeft: 9 },
  placeholderText: { color: '#777', fontSize: 13, marginLeft: 9 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  half: { flex: 1 },
  counterBox: { backgroundColor: card, borderRadius: 20, padding: 15, borderWidth: 1, borderColor: border, marginBottom: 14 },
  counterHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  counterLabel: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  counterLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counterButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#151515', justifyContent: 'center', alignItems: 'center' },
  counterBtn: { color: '#FFF', fontSize: 25, marginTop: -2 },
  counterValue: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  optional: { color: '#888', fontSize: 13 },
  noteInput: { backgroundColor: card, borderRadius: 20, paddingHorizontal: 16, paddingTop: 16, minHeight: 105, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: border, textAlignVertical: 'top' },
  counterChars: { color: '#777', textAlign: 'right', marginTop: 6, marginBottom: 16, fontSize: 12 },
  summaryCard: { backgroundColor: card, borderRadius: 24, borderWidth: 1, borderColor: '#4A3C08', padding: 18, marginBottom: 18 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  summaryTitle: { color: goldLight, fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 11, gap: 12 },
  summaryLabel: { color: '#999', fontSize: 13 },
  summaryValue: { color: '#FFF', fontSize: 13, fontWeight: '900', flexShrink: 1, textAlign: 'right' },
  priceLine: { borderTopWidth: 1, borderTopColor: '#2A2A2A', marginTop: 8, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: '#AAA', fontSize: 13, fontWeight: '800' },
  price: { color: goldLight, fontSize: 20, fontWeight: '900' },
  button: { backgroundColor: goldLight, height: 64, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: 4, flexDirection: 'row', gap: 10 },
  buttonText: { color: '#111', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
  footer: { color: '#858585', textAlign: 'center', marginTop: 18, marginBottom: 45, fontSize: 12, lineHeight: 19 },
});