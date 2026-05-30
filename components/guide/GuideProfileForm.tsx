import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  GUIDE_SPECIALTY_DEFS,
  GUIDE_YEARS_EXPERIENCE_OPTIONS,
  getGuideExperiencePickerOptions,
  getGuideSpecialtyLabel,
} from '@/constants/guideCatalog';
import type { GuideExperienceId, GuideSpecialty, GuideYearsExperience } from '@/firebase/types';
import type { GuideProfileFormValues } from '@/types/guideProfileForm';
import type { GuideFieldError } from '@/types/guide';
import { getGuideProfileFieldError } from '@/utils/guideProfileFormValidation';

const green = '#8BC53F';
const card = '#0E0E0E';
const border = '#262626';
const muted = '#8A8A8A';
const red = '#FF5A5A';

const LANGUAGE_PRESETS = ['fr', 'ar', 'en'] as const;
const BIO_MIN = 50;
const BIO_MAX = 300;
const MAX_SPECIALTIES = 3;

const EXPERIENCE_OPTIONS = getGuideExperiencePickerOptions();

export type GuideProfileFormProps = {
  /** Valeurs contrôlées du formulaire profil. */
  value: GuideProfileFormValues;
  /** Mise à jour partielle (le parent fusionne dans son state). */
  onChange: (patch: Partial<GuideProfileFormValues>) => void;
  /** Erreurs métier (ex. retour validateGuideProfileFormValues). */
  fieldErrors?: GuideFieldError[];
  /** Lecture seule (dashboard statut suspendu, etc.). */
  readOnly?: boolean;
};

function showMaxSpecialtiesMessage() {
  const message = `Maximum ${MAX_SPECIALTIES} spécialités par guide.`;
  if (Platform.OS === 'web') {
    window.alert(message);
    return;
  }
  Alert.alert('Spécialités', message);
}

function FieldBlock({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export default function GuideProfileForm({
  value,
  onChange,
  fieldErrors = [],
  readOnly = false,
}: GuideProfileFormProps) {
  const [customLanguage, setCustomLanguage] = useState('');

  const bioLength = value.bio.trim().length;
  const errorsByField = useMemo(() => fieldErrors, [fieldErrors]);

  const update = useCallback(
    (patch: Partial<GuideProfileFormValues>) => {
      if (readOnly) return;
      onChange(patch);
    },
    [onChange, readOnly],
  );

  const toggleSpecialty = useCallback(
    (id: GuideSpecialty) => {
      if (readOnly) return;
      const selected = value.specialties.includes(id);
      if (selected) {
        update({
          specialties: value.specialties.filter((item) => item !== id),
        });
        return;
      }
      if (value.specialties.length >= MAX_SPECIALTIES) {
        showMaxSpecialtiesMessage();
        return;
      }
      update({ specialties: [...value.specialties, id] });
    },
    [readOnly, update, value.specialties],
  );

  const toggleExperience = useCallback(
    (id: GuideExperienceId) => {
      if (readOnly) return;
      const selected = value.allowedExperienceIds.includes(id);
      if (selected) {
        update({
          allowedExperienceIds: value.allowedExperienceIds.filter((item) => item !== id),
        });
        return;
      }
      update({ allowedExperienceIds: [...value.allowedExperienceIds, id] });
    },
    [readOnly, update, value.allowedExperienceIds],
  );

  const toggleLanguage = useCallback(
    (lang: string) => {
      if (readOnly) return;
      const code = lang.trim().toLowerCase();
      if (!code) return;
      const has = value.languages.includes(code);
      if (has) {
        const next = value.languages.filter((item) => item !== code);
        update({ languages: next.length ? next : value.languages });
        return;
      }
      update({ languages: [...value.languages, code] });
    },
    [readOnly, update, value.languages],
  );

  const addCustomLanguage = useCallback(() => {
    if (readOnly) return;
    const code = customLanguage.trim().toLowerCase();
    if (!code) return;
    toggleLanguage(code);
    setCustomLanguage('');
  }, [customLanguage, readOnly, toggleLanguage]);

  const bioHint =
    bioLength > 0 && bioLength < BIO_MIN
      ? getGuideProfileFieldError(errorsByField, 'bio') ??
        `Encore ${BIO_MIN - bioLength} caractère${BIO_MIN - bioLength > 1 ? 's' : ''} minimum.`
      : bioLength > BIO_MAX
        ? getGuideProfileFieldError(errorsByField, 'bio') ??
          `Dépassez la limite de ${BIO_MAX} caractères.`
        : getGuideProfileFieldError(errorsByField, 'bio');

  return (
    <View style={styles.root}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Contact & présentation</Text>

        <FieldBlock
          label="Téléphone *"
          error={getGuideProfileFieldError(errorsByField, 'phone')}
        >
          <TextInput
            style={[styles.input, readOnly && styles.inputReadOnly]}
            value={value.phone}
            onChangeText={(phone) => update({ phone })}
            placeholder="0555 00 00 00"
            placeholderTextColor={muted}
            keyboardType="phone-pad"
            editable={!readOnly}
          />
        </FieldBlock>

        <FieldBlock
          label={`Biographie * (${bioLength}/${BIO_MAX})`}
          error={bioHint}
        >
          <TextInput
            style={[styles.input, styles.textArea, readOnly && styles.inputReadOnly]}
            value={value.bio}
            onChangeText={(bio) => update({ bio })}
            placeholder="Présentez votre parcours (50 à 300 caractères)"
            placeholderTextColor={muted}
            multiline
            textAlignVertical="top"
            editable={!readOnly}
          />
        </FieldBlock>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Expérience professionnelle</Text>

        <Text style={styles.fieldLabel}>Années d&apos;expérience *</Text>
        {getGuideProfileFieldError(errorsByField, 'yearsExperience') ? (
          <Text style={styles.fieldError}>
            {getGuideProfileFieldError(errorsByField, 'yearsExperience')}
          </Text>
        ) : null}
        <View style={styles.chipRow}>
          {GUIDE_YEARS_EXPERIENCE_OPTIONS.map((option) => {
            const active = value.yearsExperience === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.chip, active && styles.chipActive, readOnly && styles.chipDisabled]}
                onPress={() => update({ yearsExperience: option.id as GuideYearsExperience })}
                disabled={readOnly}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Langues *</Text>
        {getGuideProfileFieldError(errorsByField, 'languages') ? (
          <Text style={styles.fieldError}>
            {getGuideProfileFieldError(errorsByField, 'languages')}
          </Text>
        ) : null}
        <View style={styles.chipRow}>
          {LANGUAGE_PRESETS.map((lang) => {
            const active = value.languages.includes(lang);
            return (
              <Pressable
                key={lang}
                style={[styles.chip, active && styles.chipActive, readOnly && styles.chipDisabled]}
                onPress={() => toggleLanguage(lang)}
                disabled={readOnly}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {lang.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!readOnly ? (
          <View style={styles.customLangRow}>
            <TextInput
              style={[styles.input, styles.customLangInput]}
              value={customLanguage}
              onChangeText={setCustomLanguage}
              placeholder="Autre (ex. it)"
              placeholderTextColor={muted}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.addLangBtn} onPress={addCustomLanguage}>
              <Text style={styles.addLangBtnText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <Text style={styles.hintText}>Sélection : {value.languages.join(', ') || '—'}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Spécialités (max. {MAX_SPECIALTIES})</Text>
        {getGuideProfileFieldError(errorsByField, 'specialties') ? (
          <Text style={styles.fieldError}>
            {getGuideProfileFieldError(errorsByField, 'specialties')}
          </Text>
        ) : null}
        <Text style={styles.hintText}>
          Sélectionnées : {value.specialties.map(getGuideSpecialtyLabel).join(', ') || '—'} (
          {value.specialties.length}/{MAX_SPECIALTIES})
        </Text>
        <View style={styles.chipRowWrap}>
          {GUIDE_SPECIALTY_DEFS.map((item) => {
            const active = value.specialties.includes(item.id);
            return (
              <Pressable
                key={item.id}
                style={[styles.chip, active && styles.chipActive, readOnly && styles.chipDisabled]}
                onPress={() => toggleSpecialty(item.id)}
                disabled={readOnly}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Expériences PROTAXI souhaitées *</Text>
        {getGuideProfileFieldError(errorsByField, 'allowedExperienceIds') ? (
          <Text style={styles.fieldError}>
            {getGuideProfileFieldError(errorsByField, 'allowedExperienceIds')}
          </Text>
        ) : null}
        <Text style={styles.hintText}>
          {value.allowedExperienceIds.length} expérience
          {value.allowedExperienceIds.length > 1 ? 's sélectionnées' : ' sélectionnée'}
        </Text>
        {EXPERIENCE_OPTIONS.map((option) => {
          const checked = value.allowedExperienceIds.includes(option.id);
          return (
            <Pressable
              key={option.id}
              style={[styles.experienceRow, readOnly && styles.chipDisabled]}
              onPress={() => toggleExperience(option.id)}
              disabled={readOnly}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={checked ? green : muted}
              />
              <Text style={styles.experienceLabel}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  sectionCard: {
    backgroundColor: card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    gap: 10,
  },
  sectionTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  fieldBlock: { gap: 6 },
  fieldLabel: { color: muted, fontSize: 11, fontWeight: '700' },
  fieldError: { color: red, fontSize: 11, fontWeight: '600' },
  input: {
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
  },
  inputReadOnly: { opacity: 0.65 },
  textArea: { minHeight: 100, paddingTop: 12 },
  hintText: { color: muted, fontSize: 11, lineHeight: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: '#111',
  },
  chipActive: {
    backgroundColor: 'rgba(139,197,63,0.14)',
    borderColor: 'rgba(139,197,63,0.4)',
  },
  chipDisabled: { opacity: 0.55 },
  chipText: { color: muted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: green },
  customLangRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  customLangInput: { flex: 1 },
  addLangBtn: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addLangBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  experienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  experienceLabel: { color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1 },
});
