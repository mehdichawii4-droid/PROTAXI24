import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const gold = '#D4A017';

const destinations = [
  { name: 'Gare routière', sub: 'Départ / arrivée', icon: 'bus', price: 500 },
  { name: 'Hôpital / Clinique', sub: 'Santé & urgence', icon: 'hospital-building', price: 600 },
  { name: 'Université / École', sub: 'Études & formation', icon: 'school', price: 500 },
  { name: 'Courses / Shopping', sub: 'Marché, supermarché', icon: 'cart', price: 700 },
  { name: 'Administratif', sub: 'Banque, poste, mairie', icon: 'bank', price: 600 },
  { name: 'Autre destination', sub: 'Écrire manuellement', icon: 'map-marker', price: 0 },
];

const suggestions = [
  'Gare routière',
  'Université',
  'Hôpital',
  'Centre-ville',
  'Marché',
];

export default function CityScreen() {
  const [destinationType, setDestinationType] = useState('Gare routière');
  const [customDestination, setCustomDestination] = useState('');
  const [pickup, setPickup] = useState('Ma position actuelle, Guelma');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [rideMode, setRideMode] = useState<'Maintenant' | 'Réserver plus tard'>('Maintenant');
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [waitingTime, setWaitingTime] = useState(0);
  const [passengers, setPassengers] = useState(1);
  const [bags, setBags] = useState(0);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const [region, setRegion] = useState({
    latitude: 36.462,
    longitude: 7.426,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({});

      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    })();
  }, []);

  const selectedDestination = destinations.find(
    (item) => item.name === destinationType
  );

  const finalDestination =
    destinationType === 'Autre destination'
      ? customDestination || 'Destination à préciser'
      : destinationAddress || destinationType;

  const estimatedPrice = useMemo(() => {
    const base = selectedDestination?.price || 0;
    const waitPrice = waitingTime * 30;
    return base + waitPrice;
  }, [selectedDestination, waitingTime]);

  const formattedPrice =
    estimatedPrice > 0
      ? `${estimatedPrice.toLocaleString('fr-FR')} DA`
      : 'Sur confirmation';

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Veuillez autoriser la localisation.');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});

    setRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });

    setPickup('Ma position actuelle');
  };

  const confirmCity = () => {
    if (!destinationAddress || !fullName || !phone) {
  Alert.alert(
    'Informations manquantes',
    'Veuillez remplir la destination, le nom et le téléphone.'
  );
  return;
}
    if (!pickup.trim()) {
      Alert.alert('Départ manquant', 'Veuillez saisir un lieu de départ.');
      return;
    }

    if (destinationType === 'Autre destination' && !customDestination.trim()) {
      Alert.alert('Destination manquante', 'Veuillez écrire votre destination.');
      return;
    }

    router.push({
      pathname: '/city-summary',
      params: {
        service: 'Ville 24H',
        destinationType,
        departure: pickup,
        destination: finalDestination,
        rideMode,
        date:
          rideMode === 'Réserver plus tard'
            ? date.toLocaleDateString('fr-FR')
            : 'Maintenant',
        time:
          rideMode === 'Réserver plus tard'
            ? date.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Maintenant',
        waitingTime: `${waitingTime} min`,
        passengers: `${passengers} passager${passengers > 1 ? 's' : ''}`,
        bags: `${bags} bagage${bags > 1 ? 's' : ''}`,
        fullName: fullName || 'Client PROTAXI',
        phone: phone || 'Non renseigné',
        notes: notes || 'Aucune note',
        price: formattedPrice,
      },
    });
  };

  const openDatePicker = () => {
    setShowDate(!showDate);
    setShowTime(false);
  };

  const openTimePicker = () => {
    setShowTime(!showTime);
    setShowDate(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={26} color="#FFF" />
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>VILLE 24H</Text>
            <Text style={styles.subtitle}>Service urbain premium</Text>
          </View>

          <TouchableOpacity style={styles.helpBtn}>
            <Ionicons name="help-circle-outline" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>
          <MapView style={styles.map} region={region}>
            <Marker coordinate={region} title="Position actuelle" />
          </MapView>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={23} color={gold} />

          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Course en ville rapide et privée</Text>
            <Text style={styles.infoText}>
              Choisissez votre destination, indiquez votre point de départ et
              confirmez votre demande en quelques secondes.
            </Text>
          </View>
        </View>

        <SectionTitle text="1. Destination" />

        <InputBox
          icon="search-outline"
          placeholder="Où souhaitez-vous aller ? Ex : Gare, hôpital..."
          value={destinationAddress}
          onChangeText={setDestinationAddress}
        />

        <SuggestionRow items={suggestions} onSelect={setDestinationAddress} />
        <View style={{ marginTop: 10 }}>
  <InputBox
    icon="location-outline"
    placeholder="Adresse exacte de destination"
    value={destinationAddress}
    onChangeText={setDestinationAddress}
  />
</View>

        <View style={styles.grid}>
          {destinations.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={[
                styles.destCard,
                destinationType === item.name && styles.destCardActive,
              ]}
              onPress={() => setDestinationType(item.name)}
            >
              <View style={styles.destIcon}>
                <MaterialCommunityIcons
                  name={item.icon as any}
                  size={25}
                  color={gold}
                />
              </View>

              <Text
                numberOfLines={2}
                style={[
                  styles.destName,
                  destinationType === item.name && styles.destNameActive,
                ]}
              >
                {item.name}
              </Text>

              <Text numberOfLines={1} style={styles.destSub}>
                {item.sub}
              </Text>

              {destinationType === item.name && (
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={15} color="#111" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {destinationType === 'Autre destination' && (
          <View style={{ marginTop: 10 }}>
            <InputBox
              icon="map-outline"
              placeholder="Écrire votre destination"
              value={customDestination}
              onChangeText={setCustomDestination}
            />
          </View>
        )}

        <SectionTitle text="2. Lieu de prise en charge" />

        <InputBox
          icon="home-outline"
          placeholder="Adresse de départ"
          value={pickup}
          onChangeText={setPickup}
          rightIcon="locate-outline"
          onRightPress={useMyLocation}
        />

        <TouchableOpacity style={styles.locationBtn} onPress={useMyLocation}>
          <Ionicons name="navigate" size={20} color={gold} />
          <Text style={styles.locationText}>Utiliser ma position actuelle</Text>
        </TouchableOpacity>

        <SectionTitle text="3. Type de course" />

        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[
              styles.modeCard,
              rideMode === 'Maintenant' && styles.modeActive,
            ]}
            onPress={() => setRideMode('Maintenant')}
          >
            <Ionicons
              name="flash-outline"
              size={24}
              color={rideMode === 'Maintenant' ? '#111' : gold}
            />
            <Text
              style={[
                styles.modeText,
                rideMode === 'Maintenant' && styles.modeTextActive,
              ]}
            >
              Maintenant
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeCard,
              rideMode === 'Réserver plus tard' && styles.modeActive,
            ]}
            onPress={() => setRideMode('Réserver plus tard')}
          >
            <Ionicons
              name="calendar-outline"
              size={24}
              color={rideMode === 'Réserver plus tard' ? '#111' : gold}
            />
            <Text
              style={[
                styles.modeText,
                rideMode === 'Réserver plus tard' && styles.modeTextActive,
              ]}
            >
              Réserver
            </Text>
          </TouchableOpacity>
        </View>

        {rideMode === 'Réserver plus tard' && (
          <>
            <SectionTitle text="4. Date et heure" />
            <DateTimeBoxes
              date={date}
              openDatePicker={openDatePicker}
              openTimePicker={openTimePicker}
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
                if (selectedDate) setDate(selectedDate);
              }}
            />

            <TouchableOpacity
              style={styles.closePickerBtn}
              onPress={() => setShowDate(false)}
            >
              <Text style={styles.closePickerText}>Valider la date</Text>
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
                if (selectedDate) setDate(selectedDate);
              }}
            />

            <TouchableOpacity
              style={styles.closePickerBtn}
              onPress={() => setShowTime(false)}
            >
              <Text style={styles.closePickerText}>Valider l’heure</Text>
            </TouchableOpacity>
          </View>
        )}

        <SectionTitle text="5. Passagers, bagages et attente" />

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

        <CounterBox
          icon="time-outline"
          label="Attente"
          value={waitingTime}
          setValue={setWaitingTime}
          min={0}
          step={15}
          suffix=" min"
        />

        <SectionTitle text="6. Coordonnées client" />

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
            placeholder="Notes : étage, urgence, arrêt rapide..."
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
            Paiement à la fin du trajet • Tarif confirmé avant départ
          </Text>
        </View>

        <TouchableOpacity
          style={styles.mainBtn}
          activeOpacity={0.9}
          onPress={confirmCity}
        >
          <Text style={styles.mainBtnText}>Continuer</Text>

          <View style={styles.mainBtnIcon}>
            <Ionicons name="arrow-forward" size={25} color="#FFF" />
          </View>
        </TouchableOpacity>

        <View style={styles.bottomInfo}>
          <InfoItem icon="shield-checkmark-outline" text="Course sécurisée" />
          <InfoItem icon="time-outline" text="Disponible 24h/24" />
          <InfoItem icon="cash-outline" text="Prix clair avant départ" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DateTimeBoxes({ date, openDatePicker, openTimePicker }: any) {
  return (
    <View style={styles.twoCols}>
      <TouchableOpacity style={styles.smallBox} onPress={openDatePicker}>
        <Ionicons name="calendar-outline" size={23} color={gold} />

        <View>
          <Text style={styles.smallBoxLabel}>Date</Text>
          <Text style={styles.smallBoxValue}>
            {date.toLocaleDateString('fr-FR')}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.smallBox} onPress={openTimePicker}>
        <Ionicons name="time-outline" size={23} color={gold} />

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

function CounterBox({
  icon,
  label,
  value,
  setValue,
  min = 1,
  step = 1,
  suffix = '',
}: any) {
  return (
    <View style={styles.counterBox}>
      <Ionicons name={icon} size={24} color={gold} />

      <Text style={styles.counterLabel}>{label}</Text>

      <TouchableOpacity
        style={styles.counterBtn}
        onPress={() => setValue(Math.max(min, value - step))}
      >
        <Ionicons name="remove" size={21} color="#FFF" />
      </TouchableOpacity>

      <Text style={styles.counterValue}>
        {value}
        {suffix}
      </Text>

      <TouchableOpacity
        style={styles.counterBtn}
        onPress={() => setValue(value + step)}
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

  map: { flex: 1 },

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

  suggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
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

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  destCard: {
    width: '48%',
    minHeight: 112,
    backgroundColor: 'rgba(18,18,18,0.96)',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    justifyContent: 'center',
  },

  destCardActive: {
    borderColor: gold,
    backgroundColor: 'rgba(212,160,23,0.08)',
  },

  destIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#171307',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  destName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },

  destNameActive: {
    color: gold,
  },

  destSub: {
    color: '#9A9A9A',
    fontSize: 12,
    marginTop: 5,
  },

  checkCircle: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
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

  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },

  modeCard: {
    flex: 1,
    height: 70,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(18,18,18,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modeActive: {
    backgroundColor: gold,
    borderColor: gold,
  },

  modeText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 5,
  },

  modeTextActive: {
    color: '#111',
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
    fontSize: 18,
    fontWeight: '900',
    marginHorizontal: 14,
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