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
    View
} from 'react-native';

const gold = '#D4A017';

const missionTypes = [
  { name: 'Business', icon: 'briefcase-outline', price: 4000 },
  { name: 'Personnel', icon: 'person-outline', price: 3000 },
  { name: 'Médical', icon: 'medical-outline', price: 3500 },
  { name: 'Famille', icon: 'people-outline', price: 4500 },
  { name: 'Shopping', icon: 'bag-handle-outline', price: 3000 },
  { name: 'VIP', icon: 'diamond-outline', price: 6000 },
];

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function mapServiceToMissionType(service: string) {
  if (service === 'Guide touristique') return 'VIP';
  if (service === 'Circuit touristique') return 'Famille';
  if (service === 'Expérience locale') return 'Personnel';
  return 'Business';
}

function buildInitialNotes(
  service: string,
  circuitName: string,
  custom?: {
    formula?: string;
    duration?: string;
    steps?: string;
    options?: string;
    estimatedPrice?: string;
  },
) {
  const lines: string[] = [];

  if (service && circuitName) {
    lines.push(`Service : ${service} — ${circuitName}`);
  } else if (service) {
    lines.push(`Service demandé : ${service}`);
  }

  if (custom?.formula) {
    lines.push(`Expérience : ${custom.formula}${custom.duration ? ` (${custom.duration})` : ''}`);
  }
  if (custom?.steps) {
    lines.push(`Inclus : ${custom.steps}`);
  }
  if (custom?.options) {
    lines.push(`Options : ${custom.options}`);
  }
  if (custom?.estimatedPrice) {
    lines.push(`Prix estimé configurateur : ${Number(custom.estimatedPrice).toLocaleString('fr-FR')} DA`);
  }

  return lines.join('\n');
}

function DiscoverSourceBadge() {
  return (
    <View style={styles.discoverBadge}>
      <Ionicons name="compass-outline" size={12} color={gold} />
      <Text style={styles.discoverBadgeText}>Depuis Découvrir Guelma</Text>
    </View>
  );
}


export default function PriseEnChargeScreen() {
  const params = useLocalSearchParams<{
    service?: string | string[];
    circuitName?: string | string[];
    source?: string | string[];
    formula?: string | string[];
    duration?: string | string[];
    steps?: string | string[];
    options?: string | string[];
    estimatedPrice?: string | string[];
  }>();

  const incomingService = normalizeParam(params.service);
  const incomingCircuitName = normalizeParam(params.circuitName);
  const incomingSource = normalizeParam(params.source);
  const incomingFormula = normalizeParam(params.formula);
  const incomingDuration = normalizeParam(params.duration);
  const incomingSteps = normalizeParam(params.steps);
  const incomingOptions = normalizeParam(params.options);
  const incomingEstimatedPrice = normalizeParam(params.estimatedPrice);
  const fromDiscoverGuelma = incomingSource === 'discover-guelma';
  const isCustomCircuit = incomingCircuitName === 'Circuit sur mesure';

  const [missionType, setMissionType] = useState(() =>
    incomingService ? mapServiceToMissionType(incomingService) : 'Business',
  );
  const [departure, setDeparture] = useState('Guelma, Algérie');
  const [destination, setDestination] = useState(() => {
    if (isCustomCircuit && incomingSteps) {
      return incomingSteps;
    }
    if (incomingCircuitName) {
      return `${incomingCircuitName}, Guelma`;
    }
    return '';
  });
  const [tripType, setTripType] = useState('Aller simple');
  const [rideMode, setRideMode] = useState('Maintenant');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  
  const [passengers, setPassengers] = useState(1);
  const [bags, setBags] = useState(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState(() =>
    buildInitialNotes(incomingService, incomingCircuitName, {
      formula: incomingFormula,
      duration: incomingDuration,
      steps: incomingSteps,
      options: incomingOptions,
      estimatedPrice: incomingEstimatedPrice,
    }),
  );

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const selectedMission = missionTypes.find((item) => item.name === missionType);

 const estimatedPrice = useMemo(() => {
  const base = selectedMission?.price || 0;
  const tripBonus =
    tripType === 'Aller-retour'
      ? base
      : 0;

  return base + tripBonus;
}, [selectedMission, tripType]);

  const formattedPrice = `${estimatedPrice.toLocaleString('fr-FR')} DA`;

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

 const goToConfirmation = () => {

  if (!destination || !fullName) {
    Alert.alert(
      'Informations manquantes',
      'Veuillez remplir la destination et votre nom pour continuer.'
    );
    return;
  }

  router.push({
      pathname: '/prise-en-charge-summary',
      params: {
        service: incomingService || 'Prise en charge',
        mode: missionType,
        airport: destination || 'Destination à confirmer',
        address: departure || 'Départ à confirmer',
        date: rideMode === 'Réserver plus tard' ? date || 'À confirmer' : 'Maintenant',
        time: rideMode === 'Réserver plus tard' ? time || 'À confirmer' : 'Maintenant',
        passengers: `${passengers}`,
        bags: `${bags}`,
                  tripType:
  tripType === 'Aller simple'
    ? 'Aller simple'
    : 'Aller-retour',
        price: String(formattedPrice).replace(' DA', '').replace(/\s/g, ''),
        ...(incomingCircuitName ? { circuitName: incomingCircuitName } : {}),
        ...(incomingFormula ? { formula: incomingFormula } : {}),
        ...(incomingSteps ? { steps: incomingSteps } : {}),
        ...(incomingOptions ? { options: incomingOptions } : {}),
        ...(incomingEstimatedPrice ? { estimatedPrice: incomingEstimatedPrice } : {}),
        ...(fromDiscoverGuelma ? { source: incomingSource } : {}),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={26} color="#FFF" />
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>PRISE EN CHARGE</Text>
            <Text style={styles.subtitle}>Chauffeur privé premium</Text>
          </View>

          <TouchableOpacity style={styles.helpBtn}>
            <Ionicons name="shield-checkmark-outline" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>

        {fromDiscoverGuelma ? <DiscoverSourceBadge /> : null}

        <ImageBackground
  source={require('../assets/images/prise-en-charge.jpg')}
  style={styles.heroCard}
  imageStyle={styles.heroImage}
>
  <View style={styles.heroOverlay}>
    <View style={styles.heroIcon}>
      <MaterialCommunityIcons
        name="account-tie"
        size={44}
        color={gold}
      />
    </View>

    <Text style={styles.heroTitle}>
      Votre chauffeur dédié
    </Text>

    <Text style={styles.heroText}>
      Une prise en charge premium pour vos rendez-vous,
      voyages, courses importantes et déplacements privés.
    </Text>
  </View>
</ImageBackground>

        <View style={styles.benefitRow}>
          <Benefit icon="shield-checkmark-outline" title="Sécurité" sub="chauffeur fiable" />
          <Benefit icon="car-sport-outline" title="Confort" sub="service privé" />
          <Benefit icon="time-outline" title="Ponctuel" sub="24h/24" />
        </View>

        <SectionTitle text="1. Type de prise en charge" />

        <View style={styles.grid}>
          {missionTypes.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={[styles.typeCard, missionType === item.name && styles.activeCard]}
              onPress={() => setMissionType(item.name)}
            >
              <Ionicons
                name={item.icon as any}
                size={25}
                color={missionType === item.name ? gold : '#FFF'}
              />

              <Text
                numberOfLines={1}
                style={[styles.typeText, missionType === item.name && styles.activeText]}
              >
                {item.name}
              </Text>

              {missionType === item.name && (
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={14} color="#111" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <SectionTitle text="2. Trajet" />

        <View style={styles.routeBox}>
          <View style={styles.routeLine}>
            <Ionicons name="location-outline" size={23} color="#4ADE80" />
            <TextInput
              style={styles.routeInput}
              placeholder="Adresse de départ"
              placeholderTextColor="#777"
              value={departure}
              onChangeText={setDeparture}
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.routeLine}>
            <Ionicons name="location-outline" size={23} color={gold} />
            <TextInput
              style={styles.routeInput}
              placeholder="Destination"
              placeholderTextColor="#777"
              value={destination}
              onChangeText={setDestination}
            />
          </View>
        </View>

        <View style={styles.choiceRow}>
          {['Aller simple', 'Aller-retour'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.choiceCard, tripType === item && styles.activeCard]}
              onPress={() => setTripType(item)}
            >
              <Ionicons
                name={item === 'Aller simple' ? 'arrow-forward-outline' : 'repeat-outline'}
                size={22}
                color={tripType === item ? gold : '#AAA'}
              />

              <Text style={[styles.choiceText, tripType === item && styles.activeText]}>
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionTitle text="3. Date et attente" />

        <View style={styles.modeBox}>
          <View style={styles.modeTop}>
            <Ionicons name="calendar-outline" size={22} color={gold} />
            <Text style={styles.modeLabel}>Mode</Text>

            <View style={styles.modeButtons}>
              {['Maintenant', 'Réserver plus tard'].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.modeBtn, rideMode === item && styles.modeBtnActive]}
                  onPress={() => setRideMode(item)}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.modeBtnText, rideMode === item && styles.activeText]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {rideMode === 'Réserver plus tard' && (
  <>
    <View style={styles.separator} />

    <TouchableOpacity
      style={styles.modeLine}
      onPress={() => setShowDatePicker(true)}
    >
      <Ionicons
        name="calendar-outline"
        size={22}
        color={gold}
      />

      <Text style={styles.modeLabel}>
        Date
      </Text>

      <Text style={styles.modeValue}>
        {date || 'Choisir'}
      </Text>
    </TouchableOpacity>

    <View style={styles.separator} />

    <TouchableOpacity
      style={styles.modeLine}
      onPress={() => setShowTimePicker(true)}
    >
      <Ionicons
        name="time-outline"
        size={22}
        color={gold}
      />

      <Text style={styles.modeLabel}>
        Heure
      </Text>

      <Text style={styles.modeValue}>
        {time || 'Choisir'}
      </Text>
    </TouchableOpacity>
  </>
)}
</View>
        <SectionTitle text="4. Passagers et bagages" />

        <CounterBox
          icon="people-outline"
          label="Passagers"
          value={passengers}
          setValue={setPassengers}
          min={1}
        />

        <CounterBox
          icon="briefcase-outline"
          label="Bagages"
          value={bags}
          setValue={setBags}
          min={0}
        />

        <SectionTitle text="5. Coordonnées client" />

        <InputBox
          icon="person-outline"
          placeholder="Nom complet"
          value={fullName}
          onChangeText={setFullName}
        />

        <View style={{ height: 10 }} />

        <InputBox
          icon="call-outline"
          placeholder="Téléphone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <View style={styles.noteBox}>
          <Ionicons name="chatbox-ellipses-outline" size={23} color={gold} />
          <TextInput
            placeholder="Notes : consignes, attente, arrêt rapide..."
            placeholderTextColor="#888"
            value={notes}
            onChangeText={setNotes}
            style={styles.noteInput}
            multiline
            maxLength={200}
          />
        </View>

        <Text style={styles.counterChars}>{notes.length}/200</Text>

        <View style={styles.priceBox}>
          <View style={styles.priceTop}>
            <Text style={styles.priceLabel}>Prix estimé</Text>
            <Ionicons name="information-circle-outline" size={22} color="#FFF" />
          </View>

          <Text style={styles.price}>{formattedPrice}</Text>

          <Text style={styles.priceSub}>
            Tarif indicatif • Le prix final sera confirmé avant départ
          </Text>
        </View>

        <TouchableOpacity style={styles.mainBtn} activeOpacity={0.9} onPress={goToConfirmation}>
          <Text style={styles.mainBtnText}>Continuer</Text>

          <View style={styles.mainBtnIcon}>
            <Ionicons name="arrow-forward" size={25} color="#FFF" />
          </View>
        </TouchableOpacity>

        <View style={styles.bottomInfo}>
          <InfoItem icon="shield-checkmark-outline" text="Chauffeur privé fiable" />
          <InfoItem icon="car-outline" text="Service confortable" />
          <InfoItem icon="cash-outline" text="Prix confirmé avant départ" />
        </View>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(formatDate(selectedDate));
          }}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={new Date()}
          mode="time"
          display="default"
          is24Hour
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime) setTime(formatTime(selectedTime));
          }}
        />
      )}
    </SafeAreaView>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function Benefit({ icon, title, sub }: any) {
  return (
    <View style={styles.benefitCard}>
      <Ionicons name={icon} size={22} color={gold} />
      <Text style={styles.benefitTitle}>{title}</Text>
      <Text style={styles.benefitSub}>{sub}</Text>
    </View>
  );
}

function InputBox({
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
}: any) {
  return (
    <View style={styles.inputBox}>
      <Ionicons name={icon} size={23} color={gold} />

      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#888"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function CounterBox({ icon, label, value, setValue, min = 1 }: any) {
  return (
    <View style={styles.counterBox}>
      <Ionicons name={icon} size={24} color={gold} />

      <Text style={styles.counterLabel}>{label}</Text>

      <TouchableOpacity
        style={styles.counterBtn}
        onPress={() => setValue(Math.max(min, value - 1))}
      >
        <Ionicons name="remove" size={21} color="#FFF" />
      </TouchableOpacity>

      <Text style={styles.counterValue}>{value}</Text>

      <TouchableOpacity style={styles.counterBtn} onPress={() => setValue(value + 1)}>
        <Ionicons name="add" size={21} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

function InfoItem({ icon, text }: any) {
  return (
    <View style={styles.infoItem}>
      <Ionicons name={icon} size={22} color={gold} />
      <Text style={styles.infoItemText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  scroll: { paddingHorizontal: 18, paddingBottom: 35 },

  header: {
    paddingTop: 20,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  backBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
  },

  helpBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },

  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitle: {
    color: '#BEBEBE',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },

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
    marginBottom: 12,
  },

  discoverBadgeText: {
    color: gold,
    fontSize: 11,
    fontWeight: '800',
  },

  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.45)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    padding: 22,
    marginBottom: 18,
  },
  heroImage: {
  borderRadius: 28,
},

heroOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.60)',
  padding: 22,
  justifyContent: 'flex-end',
},

  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#171307',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  heroTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
  },

  heroText: {
    color: '#CFCFCF',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },

  benefitRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 20,
  },

  benefitCard: {
    flex: 1,
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRightWidth: 1,
    borderRightColor: '#1F1F1F',
  },

  benefitTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 7,
  },

  benefitSub: {
    color: '#999',
    fontSize: 11,
    marginTop: 2,
  },

  sectionTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 10,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  typeCard: {
    width: '31.5%',
    height: 92,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 5,
  },

  activeCard: {
    borderColor: gold,
    backgroundColor: 'rgba(212,160,23,0.08)',
  },

  activeText: {
    color: gold,
  },

  typeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 9,
  },

  checkCircle: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
  },

  routeBox: {
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    marginBottom: 12,
  },

  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
    paddingHorizontal: 16,
    gap: 11,
  },

  routeInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },

  separator: {
    height: 1,
    backgroundColor: '#222',
  },

  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },

  choiceCard: {
    flex: 1,
    height: 58,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  choiceText: {
    color: '#AAA',
    fontSize: 14,
    fontWeight: '900',
  },

  modeBox: {
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    marginBottom: 18,
  },

  modeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
    paddingHorizontal: 15,
    gap: 10,
  },

  modeLabel: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },

  modeButtons: {
    flexDirection: 'row',
    backgroundColor: '#090909',
    borderRadius: 14,
    padding: 3,
  },

  modeBtn: {
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 11,
    justifyContent: 'center',
  },

  modeBtnActive: {
    borderWidth: 1,
    borderColor: gold,
    backgroundColor: '#171307',
  },

  modeBtnText: {
    color: '#999',
    fontSize: 11,
    fontWeight: '900',
  },

  modeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingHorizontal: 15,
    gap: 10,
  },

  modeValue: {
    color: gold,
    fontSize: 13,
    fontWeight: '900',
  },

  inputBox: {
    height: 58,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },

  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    marginLeft: 11,
  },

  counterBox: {
    height: 62,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 10,
  },

  counterLabel: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 12,
  },

  counterBtn: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },

  counterValue: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    marginHorizontal: 16,
  },

  noteBox: {
    minHeight: 105,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 15,
    paddingTop: 15,
    marginTop: 10,
  },

  noteInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    marginLeft: 11,
    minHeight: 85,
    textAlignVertical: 'top',
  },

  counterChars: {
    color: '#777',
    textAlign: 'right',
    marginTop: 6,
    fontSize: 12,
  },

  priceBox: {
    marginTop: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: gold,
    backgroundColor: 'rgba(18,18,18,0.96)',
    padding: 18,
  },

  priceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  priceLabel: {
    color: '#DDD',
    fontSize: 15,
  },

  price: {
    color: gold,
    fontSize: 36,
    fontWeight: '900',
    marginTop: 8,
  },

  priceSub: {
    color: '#CFCFCF',
    fontSize: 13,
    marginTop: 4,
  },

  mainBtn: {
    marginTop: 18,
    height: 66,
    borderRadius: 22,
    backgroundColor: gold,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  mainBtnText: {
    flex: 1,
    textAlign: 'center',
    color: '#111',
    fontSize: 18,
    fontWeight: '900',
  },

  mainBtnIcon: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#101010',
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomInfo: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    padding: 15,
    gap: 12,
  },

  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  infoItemText: {
    color: '#DDD',
    fontSize: 13.5,
    fontWeight: '700',
  },
});