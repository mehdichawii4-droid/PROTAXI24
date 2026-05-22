import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { getDistance } from 'geolib';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { AnimatedRegion, Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { db } from '../firebaseConfig';
import { GOOGLE_MAPS_API_KEY } from '../googleMapsConfig';


const gold = '#D4A017';

const airports = [
  'Annaba (AAE)',
  'Constantine (CZL)',
  'Alger (ALG)',
  'Tunis (TUN)',
  'Autre aéroport',
];

const suggestions = [
  'Maison',
  'Hôtel',
  'Université',
  'Gare',
  'Centre-ville',
];

export default function ReservationDetailsScreen() {
  const mapRef = useRef<MapView>(null);
  const [mode, setMode] = useState<'deposer' | 'recuperer'>(
    'deposer'
  );

  const [airport, setAirport] = useState('Annaba (AAE)');

  const [address, setAddress] = useState('');

  const [flightNumber, setFlightNumber] = useState('');

  const [passengers, setPassengers] = useState(2);

  const [bags, setBags] = useState(2);
  

  const [tripType, setTripType] = useState<
    'simple' | 'retour'
  >('simple');

  const [customAirport, setCustomAirport] = useState('');

  const [date, setDate] = useState(new Date());

  const [showDate, setShowDate] = useState(false);

  const [showTime, setShowTime] = useState(false);

  const [distanceKm, setDistanceKm] = useState(0);

  const [eta, setEta] = useState(0);
  const [driverPosition] = useState(
  new AnimatedRegion({
    latitude: 36.4621,
    longitude: 7.4261,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  })
);

  const [region, setRegion] = useState({
    latitude: 36.7525,
    longitude: 3.042,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  useEffect(() => {
    (async () => {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        return;
      }

      const location =
        await Location.getCurrentPositionAsync({});

      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    })();
  }, []);
useEffect(() => {
  const unsubscribe = onSnapshot(
    doc(db, 'driversLive', 'DRV-001'),
    (docSnap) => {
      const data = docSnap.data();

      if (data?.latitude && data?.longitude) {
        driverPosition.setValue({
  latitude: data.latitude,
  longitude: data.longitude,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
});

mapRef.current?.fitToCoordinates(
  [
    {
      latitude: region.latitude,
      longitude: region.longitude,
    },
    {
      latitude: data.latitude,
      longitude: data.longitude,
    },
  ],
  {
    edgePadding: {
      top: 120,
      right: 70,
      bottom: 120,
      left: 70,
    },
    animated: true,
  }
);
      }
    }
  );

  return () => unsubscribe();
}, []);
  let basePrice = 4000;

  let isCustomPrice = false;

  if (airport.includes('Constantine')) {
    basePrice = 5000;
  }

  if (airport.includes('Alger')) {
    basePrice = 20000;
  }

  if (airport.includes('Tunis')) {
    basePrice = 20000;
  }

  if (airport === 'Autre aéroport') {
    isCustomPrice = true;
  }

  const price = isCustomPrice
    ? 0
    : tripType === 'retour'
    ? Math.round(basePrice * 2 * 0.95)
    : basePrice;

  const openDatePicker = () => {
    setShowDate(!showDate);
    setShowTime(false);
  };

  const openTimePicker = () => {
    setShowTime(!showTime);
    setShowDate(false);
  };

  const useMyLocation = async () => {
    const { status } =
      await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission refusée',
        'Veuillez autoriser la localisation.'
      );
      return;
    }

    const location =
      await Location.getCurrentPositionAsync({});

    setRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });

    setAddress('Ma position actuelle');
   const driverLat = 36.4621;
const driverLng = 7.4261;

const distance = getDistance(
  {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  },
  {
    latitude: driverLat,
    longitude: driverLng,
  }
);

const km = distance / 1000;

setDistanceKm(km);

const estimatedMinutes = Math.max(
  1,
  Math.round((km / 40) * 60)
);

setEta(estimatedMinutes);
  };

 const confirmReservation = async () => {
    if (!address.trim()) {
      Alert.alert(
        'Adresse manquante',
        'Veuillez saisir une adresse.'
      );
      return;
    }

    if (
      airport === 'Autre aéroport' &&
      !customAirport.trim()
    ) {
      Alert.alert(
        'Aéroport manquant',
        'Veuillez écrire le nom de l’aéroport.'
      );
      return;
    }

    if (
      mode === 'recuperer' &&
      !flightNumber.trim()
    ) {
      Alert.alert(
        'Vol manquant',
        'Veuillez entrer le numéro du vol.'
      );
      return;
    }
    await addDoc(collection(db, 'rides'), {
  client: 'Client PROTAXI',
  phone: '+213555000000',

  service: 'Transfert aéroport',

  departure: address,

  destination:
    airport === 'Autre aéroport'
      ? customAirport
      : airport,

  price: isCustomPrice
    ? 'Sur devis'
    : `${price} DA`,

  time: date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }),

  passengers,

  bags,

  tripType,

  flightNumber,

  status: 'En attente',

  createdAt: new Date(),
});

    router.push({
      pathname: '/confirmation',
      params: {
        service: 'Transfert aéroport',

        mode: mode,

        airport:
          airport === 'Autre aéroport'
            ? customAirport
            : airport,

        address: address,

        date: date.toLocaleDateString('fr-FR'),

        time: date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),

        passengers: passengers.toString(),

        bags: bags.toString(),

        tripType: tripType,

        price: isCustomPrice
          ? '0'
          : price.toString(),

        priceLabel: isCustomPrice
          ? 'Sur devis'
          : '',
      },
    });
  };
const driverLat = 36.4621;
const driverLng = 7.4261;
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons
              name="arrow-back"
              size={26}
              color="#FFF"
            />
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>AÉROPORT</Text>

            <Text style={styles.subtitle}>
              Transfert aéroport
            </Text>
          </View>

          <TouchableOpacity style={styles.helpBtn}>
            <Ionicons
              name="help-circle-outline"
              size={26}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>
  <MapView
  ref={mapRef}
    style={styles.map}
    region={region}
  >
    <Marker coordinate={region} title="Vous" />

   <Marker.Animated
  coordinate={driverPosition as any}
  title="Taxi Mehdi 24"
>
  <Ionicons name="car-sport" size={34} color={gold} />
</Marker.Animated>

   <MapViewDirections
  origin={{
    latitude: driverLat,
    longitude: driverLng,
  }}
  destination={{
    latitude: region.latitude,
    longitude: region.longitude,
  }}
  apikey={GOOGLE_MAPS_API_KEY}
  strokeWidth={5}
  strokeColor={gold}
/>
  </MapView>
</View>

        <View style={styles.modeBox}>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              mode === 'deposer' &&
                styles.modeActive,
            ]}
            onPress={() => setMode('deposer')}
          >
            <Ionicons
              name="airplane"
              size={28}
              color={
                mode === 'deposer'
                  ? '#111'
                  : '#AAA'
              }
            />

            <Text
              style={[
                styles.modeTitle,
                mode === 'deposer' &&
                  styles.modeTitleActive,
              ]}
            >
              DÉPOSER
            </Text>

            <Text
              style={[
                styles.modeText,
                mode === 'deposer' &&
                  styles.modeTextActive,
              ]}
            >
              À L’AÉROPORT
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeBtn,
              mode === 'recuperer' &&
                styles.modeActive,
            ]}
            onPress={() => setMode('recuperer')}
          >
            <Ionicons
              name="airplane-outline"
              size={28}
              color={
                mode === 'recuperer'
                  ? '#111'
                  : '#AAA'
              }
            />

            <Text
              style={[
                styles.modeTitle,
                mode === 'recuperer' &&
                  styles.modeTitleActive,
              ]}
            >
              RÉCUPÉRER
            </Text>

            <Text
              style={[
                styles.modeText,
                mode === 'recuperer' &&
                  styles.modeTextActive,
              ]}
            >
              À L’AÉROPORT
            </Text>
          </TouchableOpacity>
        </View>
                <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={23}
            color={gold}
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>
              {mode === 'deposer'
                ? 'Organisez votre transfert vers l’aéroport'
                : 'Planifiez la récupération à l’aéroport'}
            </Text>

            <Text style={styles.infoText}>
              {mode === 'deposer'
                ? 'Indiquez le lieu de départ et l’aéroport de destination.'
                : 'Indiquez les informations du vol et l’adresse de destination.'}
            </Text>
          </View>
        </View>

        {mode === 'deposer' ? (
          <>
            <SectionTitle text="1. Lieu de départ" />

            <InputBox
              icon="home-outline"
              placeholder="Adresse de départ (domicile, hôtel...)"
              value={address}
              onChangeText={setAddress}
              rightIcon="locate-outline"
              onRightPress={useMyLocation}
            />

            <TouchableOpacity
              style={styles.locationBtn}
              onPress={useMyLocation}
            >
              <Ionicons name="navigate" size={20} color={gold} />
              <Text style={styles.locationText}>
                Utiliser ma position actuelle
              </Text>
            </TouchableOpacity>

            <SuggestionRow
              items={suggestions}
              onSelect={setAddress}
            />

            <SectionTitle text="2. Aéroport de destination" />

            <AirportSelector
              airport={airport}
              setAirport={setAirport}
            />

            {airport === 'Autre aéroport' && (
              <View style={{ marginTop: 12 }}>
                <InputBox
                  icon="airplane-outline"
                  placeholder="Écrire le nom de l’aéroport"
                  value={customAirport}
                  onChangeText={setCustomAirport}
                />
              </View>
            )}

            <SectionTitle text="3. Date et heure de départ" />

            <DateTimeBoxes
              date={date}
              openDatePicker={openDatePicker}
              openTimePicker={openTimePicker}
            />
          </>
        ) : (
          <>
            <SectionTitle text="1. Aéroport d’arrivée" />

            <AirportSelector
              airport={airport}
              setAirport={setAirport}
            />

            {airport === 'Autre aéroport' && (
              <View style={{ marginTop: 12 }}>
                <InputBox
                  icon="airplane-outline"
                  placeholder="Écrire le nom de l’aéroport"
                  value={customAirport}
                  onChangeText={setCustomAirport}
                />
              </View>
            )}

            <SectionTitle text="2. Informations du vol" />

            <InputBox
              icon="airplane-outline"
              placeholder="Numéro de vol ex: AH5017"
              value={flightNumber}
              onChangeText={setFlightNumber}
            />

            <DateTimeBoxes
              date={date}
              openDatePicker={openDatePicker}
              openTimePicker={openTimePicker}
            />

            <View style={styles.blueBox}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#4DA3FF"
              />

              <Text style={styles.blueText}>
                Nous suivrons votre vol pour ajuster l’heure de prise en charge.
              </Text>
            </View>

            <SectionTitle text="3. Adresse de destination" />

            <InputBox
              icon="home-outline"
              placeholder="Adresse où déposer le client"
              value={address}
              onChangeText={setAddress}
              rightIcon="locate-outline"
              onRightPress={useMyLocation}
            />

            <SuggestionRow
              items={suggestions}
              onSelect={setAddress}
            />
          </>
        )}

        {showDate && (
          <View style={styles.pickerBox}>
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              minimumDate={new Date()}
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setDate(selectedDate);
                }
              }}
            />

            <TouchableOpacity
              style={styles.closePickerBtn}
              onPress={() => setShowDate(false)}
            >
              <Text style={styles.closePickerText}>
                Valider la date
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showTime && (
          <View style={styles.pickerBox}>
            <DateTimePicker
              value={date}
              mode="time"
              display="spinner"
              is24Hour
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setDate(selectedDate);
                }
              }}
            />

            <TouchableOpacity
              style={styles.closePickerBtn}
              onPress={() => setShowTime(false)}
            >
              <Text style={styles.closePickerText}>
                Valider l’heure
              </Text>
            </TouchableOpacity>
          </View>
        )}

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

        <SectionTitle text="5. Type de transfert" />

        <View style={styles.tripRow}>
          <TouchableOpacity
            style={[
              styles.tripBtn,
              tripType === 'simple' && styles.tripActive,
            ]}
            onPress={() => setTripType('simple')}
          >
            <Ionicons
              name="arrow-forward-circle-outline"
              size={30}
              color={tripType === 'simple' ? gold : '#DDD'}
            />

            <Text style={styles.tripText}>Aller simple</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tripBtn,
              tripType === 'retour' && styles.tripActive,
            ]}
            onPress={() => setTripType('retour')}
          >
            <Ionicons
              name="repeat-outline"
              size={30}
              color={tripType === 'retour' ? gold : '#DDD'}
            />

            <Text style={styles.tripText}>Aller-retour</Text>

            <Text style={styles.tripDiscount}>-5%</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.priceBox}>
          <View style={styles.priceTop}>
            <Text style={styles.priceLabel}>Prix estimé</Text>

            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#FFF"
            />
          </View>

          <Text style={styles.price}>
            {isCustomPrice ? (
              'Sur devis'
            ) : (
              <>
                {price.toLocaleString('fr-FR')}{' '}
                <Text style={styles.dzd}>DZD</Text>
              </>
            )}
          </Text>

          {tripType === 'retour' && !isCustomPrice && (
            <Text style={styles.discountLine}>
              Réduction aller-retour appliquée : -5%
            </Text>
          )}

          <Text style={styles.priceSub}>
            Paiement à la fin du trajet • Tarif estimatif
          </Text>
        </View>
<View style={styles.priceBox}>
  <Text style={styles.priceLabel}>
    ETA chauffeur
  </Text>

  <Text style={styles.price}>
    🚖 {eta} min
  </Text>

  <Text style={styles.priceSub}>
    Distance : {distanceKm.toFixed(1)} km
  </Text>
</View>
        <TouchableOpacity
          style={styles.mainBtn}
          activeOpacity={0.9}
          onPress={confirmReservation}
        >
          <Text style={styles.mainBtnText}>Continuer</Text>

          <View style={styles.mainBtnIcon}>
            <Ionicons
              name="arrow-forward"
              size={25}
              color="#FFF"
            />
          </View>
        </TouchableOpacity>

        <View style={styles.bottomInfo}>
          <InfoItem
            icon="shield-checkmark-outline"
            text="Chauffeurs professionnels"
          />

          <InfoItem
            icon="card-outline"
            text="Paiement à la fin du trajet"
          />

          <InfoItem
            icon="time-outline"
            text="Disponible 24h/24"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function DateTimeBoxes({
  date,
  openDatePicker,
  openTimePicker,
}: any) {
  return (
    <View style={styles.twoCols}>
      <TouchableOpacity
        style={styles.smallBox}
        onPress={openDatePicker}
      >
        <Ionicons
          name="calendar-outline"
          size={23}
          color={gold}
        />

        <View>
          <Text style={styles.smallBoxLabel}>Date</Text>
          <Text style={styles.smallBoxValue}>
            {date.toLocaleDateString('fr-FR')}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.smallBox}
        onPress={openTimePicker}
      >
        <Ionicons
          name="time-outline"
          size={23}
          color={gold}
        />

        <View>
          <Text style={styles.smallBoxLabel}>Heure</Text>
          <Text style={styles.smallBoxValue}>
            {date.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function InputBox({
  icon,
  placeholder,
  value,
  onChangeText,
  rightIcon,
  onRightPress,
}: any) {
  return (
    <View style={styles.inputBox}>
      <Ionicons name={icon} size={23} color={gold} />

      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#888"
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
      />

      {rightIcon && (
        <TouchableOpacity onPress={onRightPress}>
          <Ionicons name={rightIcon} size={24} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function SuggestionRow({ items, onSelect }: any) {
  return (
    <View style={styles.suggestionWrap}>
      {items.map((item: string) => (
        <TouchableOpacity
          key={item}
          style={styles.suggestion}
          onPress={() => onSelect(item)}
        >
          <Text style={styles.suggestionText}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function AirportSelector({ airport, setAirport }: any) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.airportBox}
        activeOpacity={0.85}
        onPress={() => setOpen(!open)}
      >
        <Ionicons name="airplane" size={24} color={gold} />
        <Text style={styles.airportText}>{airport}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={22}
          color="#FFF"
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.dropdownBox}>
          {airports.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.dropdownItem}
              onPress={() => {
                setAirport(item);
                setOpen(false);
              }}
            >
              <Text style={styles.dropdownText}>{item}</Text>

              {airport === item && (
                <Ionicons
                  name="checkmark-circle"
                  size={21}
                  color={gold}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.smallLabel}>Aéroports populaires</Text>

      <View style={styles.suggestionWrap}>
        {airports.map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.airportChip,
              airport === item && styles.airportChipActive,
            ]}
            onPress={() => setAirport(item)}
          >
            <Text
              style={[
                styles.airportChipText,
                airport === item && styles.airportChipTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function CounterBox({
  icon,
  label,
  value,
  setValue,
  min = 1,
}: any) {
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

      <TouchableOpacity
        style={styles.counterBtn}
        onPress={() => setValue(value + 1)}
      >
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
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
  },

  subtitle: {
    color: '#BEBEBE',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },

  mapContainer: {
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
  },

  map: {
    flex: 1,
  },

  modeBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20,20,20,0.9)',
    borderRadius: 24,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    marginBottom: 14,
  },

  modeBtn: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },

  modeActive: {
    backgroundColor: gold,
  },

  modeTitle: {
    color: '#AAA',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 5,
  },

  modeTitleActive: {
    color: '#111',
  },

  modeText: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },

  modeTextActive: {
    color: '#111',
  },

  infoBox: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: gold,
    backgroundColor: 'rgba(212,160,23,0.08)',
    padding: 15,
    marginBottom: 20,
  },

  infoTitle: {
    color: gold,
    fontSize: 15,
    fontWeight: '900',
  },

  infoText: {
    color: '#D8D8D8',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19,
  },

  sectionTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 10,
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

  locationBtn: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.45)',
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 10,
  },

  locationText: {
    color: gold,
    fontSize: 14,
    fontWeight: '800',
  },

  suggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },

  suggestion: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(20,20,20,0.9)',
  },

  suggestionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  airportBox: {
    height: 58,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },

  airportText: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    marginLeft: 11,
    fontWeight: '700',
  },

  smallLabel: {
    color: '#AAA',
    marginTop: 12,
    fontSize: 13,
  },

  airportChip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(20,20,20,0.9)',
  },

  airportChipActive: {
    backgroundColor: gold,
    borderColor: gold,
  },

  airportChipText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  airportChipTextActive: {
    color: '#111',
    fontWeight: '900',
  },

  twoCols: {
    flexDirection: 'row',
    gap: 12,
  },

  smallBox: {
    flex: 1,
    height: 70,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },

  smallBoxLabel: {
    color: '#AAA',
    fontSize: 12,
  },

  smallBoxValue: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },

  pickerBox: {
    marginTop: 14,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
  },

  closePickerBtn: {
    height: 48,
    backgroundColor: gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closePickerText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },

  blueBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(77,163,255,0.7)',
    backgroundColor: 'rgba(77,163,255,0.08)',
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },

  blueText: {
    flex: 1,
    color: '#CFE8FF',
    fontSize: 12.5,
    lineHeight: 18,
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
    fontSize: 21,
    fontWeight: '900',
    marginHorizontal: 18,
  },

  tripRow: {
    flexDirection: 'row',
    gap: 12,
  },

  tripBtn: {
    flex: 1,
    height: 88,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  tripActive: {
    borderColor: gold,
    backgroundColor: 'rgba(212,160,23,0.07)',
  },

  tripText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 7,
  },

  tripDiscount: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
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

  dzd: {
    fontSize: 18,
  },

  discountLine: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
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

  dropdownBox: {
    marginTop: 8,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(18,18,18,0.98)',
    overflow: 'hidden',
  },

  dropdownItem: {
    height: 52,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },

  dropdownText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  heroImage: {
  borderRadius: 28,
},

heroOverlay: {
  flex: 1,
  justifyContent: 'flex-end',
  padding: 22,
  backgroundColor: 'rgba(0,0,0,0.30)',
},

heroMini: {
  color: '#FFD700',
  fontSize: 14,
  fontWeight: '900',
  letterSpacing: 1,
},

heroBig: {
  color: '#FFF',
  fontSize: 34,
  fontWeight: '900',
  marginTop: 6,
},

heroSub: {
  color: '#DDD',
  fontSize: 15,
  marginTop: 4,
},
});