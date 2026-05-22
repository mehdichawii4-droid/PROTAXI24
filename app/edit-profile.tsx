import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const gold = '#D4A017';

export default function EditProfileScreen() {
  const [name, setName] = useState('Client PROTAXI24');
  const [phone, setPhone] = useState('+213 671 421 448');
  const [email, setEmail] = useState('client@protaxi24.com');
  const [city, setCity] = useState('Guelma');
  const [image, setImage] = useState<string | null>(null);

  const loadProfile = async () => {
    const data = await AsyncStorage.getItem('profile');

    if (data) {
      const profile = JSON.parse(data);

      setName(profile.name || 'Client PROTAXI24');
      setPhone(profile.phone || '+213 671 421 448');
      setEmail(profile.email || 'client@protaxi24.com');
      setCity(profile.city || 'Guelma');
      setImage(profile.image || null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const pickImage = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission refusée',
        'Autorise l’accès aux photos.'
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const saveProfile = async () => {
    const profile = {
      name,
      phone,
      email,
      city,
      image,
      createdAt: '18 Mai 2026',
    };

    await AsyncStorage.setItem(
      'profile',
      JSON.stringify(profile)
    );

    Alert.alert(
      'Profil enregistré',
      'Vos informations ont été mises à jour.',
      [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
            >
              <Ionicons
                name="arrow-back"
                size={28}
                color="#FFF"
              />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>
              Modifier profil
            </Text>

            <View style={{ width: 28 }} />
          </View>

          <View style={styles.avatarBox}>
            <View style={styles.avatar}>
              {image ? (
                <Image
                  source={{ uri: image }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons
                  name="person-outline"
                  size={58}
                  color={gold}
                />
              )}
            </View>

            <TouchableOpacity
              style={styles.cameraBtn}
              onPress={pickImage}
            >
              <Ionicons
                name="camera"
                size={18}
                color="#111"
              />
            </TouchableOpacity>
          </View>

          <Input
            label="Nom complet"
            value={name}
            onChangeText={setName}
            icon="person-outline"
          />

          <Input
            label="Téléphone"
            value={phone}
            onChangeText={setPhone}
            icon="call-outline"
            keyboardType="phone-pad"
          />

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            icon="mail-outline"
            keyboardType="email-address"
          />

          <Input
            label="Ville"
            value={city}
            onChangeText={setCity}
            icon="location-outline"
          />

          <TouchableOpacity
            style={styles.mainBtn}
            activeOpacity={0.9}
            onPress={saveProfile}
          >
            <Text style={styles.mainBtnText}>
              Enregistrer
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Input({
  label,
  value,
  onChangeText,
  icon,
  keyboardType = 'default',
}: any) {
  return (
    <View style={styles.inputBox}>
      <Ionicons
        name={icon}
        size={22}
        color={gold}
      />

      <View
        style={{
          flex: 1,
          marginLeft: 12,
        }}
      >
        <Text style={styles.label}>
          {label}
        </Text>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholderTextColor="#666"
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },

  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 42,
  },

  header: {
    paddingTop: 18,
    marginBottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitle: {
    color: '#FFF',
    fontSize: 23,
    fontWeight: '900',
  },

  avatarBox: {
    alignItems: 'center',
    marginBottom: 34,
  },

  avatar: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 2,
    borderColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor:
      'rgba(212,160,23,0.08)',
    overflow: 'hidden',
  },

  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },

  cameraBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -28,
    marginLeft: 82,
  },

  inputBox: {
    minHeight: 82,
    borderRadius: 20,
    backgroundColor:
      'rgba(18,18,18,0.96)',
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.07)',
    marginBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  label: {
    color: '#888',
    fontSize: 13,
    marginBottom: 5,
  },

  input: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    padding: 0,
  },

  mainBtn: {
    height: 62,
    borderRadius: 20,
    backgroundColor: gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },

  mainBtnText: {
    color: '#111',
    fontSize: 17,
    fontWeight: '900',
  },
});