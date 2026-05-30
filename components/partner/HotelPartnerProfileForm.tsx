import { useCallback, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { PartnerFieldError } from '@/types/partner';
import type { HotelPartnerProfileFormValues } from '@/types/partnerProfileForm';
import {
  HOTEL_DESCRIPTION_MAX_LENGTH,
  HOTEL_DESCRIPTION_MIN_LENGTH,
  getHotelPartnerProfileFieldError,
} from '@/utils/partnerProfileFormValidation';

const gold = '#D4A017';
const card = '#0E0E0E';
const border = '#262626';
const muted = '#8A8A8A';
const red = '#FF5A5A';

export type HotelPartnerProfileFormProps = {
  /** Valeurs contrôlées du formulaire profil hôtel. */
  value: HotelPartnerProfileFormValues;
  /** Mise à jour partielle (le parent fusionne dans son state). */
  onChange: (patch: Partial<HotelPartnerProfileFormValues>) => void;
  /** Erreurs métier (ex. retour validateHotelPartnerProfileFormValues). */
  fieldErrors?: PartnerFieldError[];
  /** Lecture seule (profil certifié ou suspendu). */
  readOnly?: boolean;
};

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

export default function HotelPartnerProfileForm({
  value,
  onChange,
  fieldErrors = [],
  readOnly = false,
}: HotelPartnerProfileFormProps) {
  const descriptionLength = value.description.trim().length;
  const errorsByField = useMemo(() => fieldErrors, [fieldErrors]);

  const update = useCallback(
    (patch: Partial<HotelPartnerProfileFormValues>) => {
      if (readOnly) return;
      onChange(patch);
    },
    [onChange, readOnly],
  );

  const descriptionHint =
    descriptionLength > 0 && descriptionLength < HOTEL_DESCRIPTION_MIN_LENGTH
      ? getHotelPartnerProfileFieldError(errorsByField, 'description') ??
        `Encore ${HOTEL_DESCRIPTION_MIN_LENGTH - descriptionLength} caractère${
          HOTEL_DESCRIPTION_MIN_LENGTH - descriptionLength > 1 ? 's' : ''
        } minimum.`
      : descriptionLength > HOTEL_DESCRIPTION_MAX_LENGTH
        ? getHotelPartnerProfileFieldError(errorsByField, 'description') ??
          `Dépassez la limite de ${HOTEL_DESCRIPTION_MAX_LENGTH} caractères.`
        : getHotelPartnerProfileFieldError(errorsByField, 'description');

  return (
    <View style={styles.root}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Établissement</Text>

        <FieldBlock
          label="Nom de l'établissement *"
          error={getHotelPartnerProfileFieldError(errorsByField, 'companyName')}
        >
          <TextInput
            style={[styles.input, readOnly && styles.inputReadOnly]}
            value={value.companyName}
            onChangeText={(companyName) => update({ companyName })}
            placeholder="Ex. Hôtel El Mountazah"
            placeholderTextColor={muted}
            editable={!readOnly}
          />
        </FieldBlock>

        <FieldBlock
          label="Contact principal *"
          error={getHotelPartnerProfileFieldError(errorsByField, 'contactName')}
        >
          <TextInput
            style={[styles.input, readOnly && styles.inputReadOnly]}
            value={value.contactName}
            onChangeText={(contactName) => update({ contactName })}
            placeholder="Responsable ou réception"
            placeholderTextColor={muted}
            editable={!readOnly}
          />
        </FieldBlock>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Coordonnées</Text>

        <FieldBlock
          label="Téléphone *"
          error={getHotelPartnerProfileFieldError(errorsByField, 'phone')}
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
          label="Email *"
          error={getHotelPartnerProfileFieldError(errorsByField, 'email')}
        >
          <TextInput
            style={[styles.input, readOnly && styles.inputReadOnly]}
            value={value.email}
            onChangeText={(email) => update({ email })}
            placeholder="contact@hotel.com"
            placeholderTextColor={muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!readOnly}
          />
        </FieldBlock>

        <FieldBlock
          label="Adresse *"
          error={getHotelPartnerProfileFieldError(errorsByField, 'address')}
        >
          <TextInput
            style={[styles.input, readOnly && styles.inputReadOnly]}
            value={value.address}
            onChangeText={(address) => update({ address })}
            placeholder="Rue, quartier, code postal"
            placeholderTextColor={muted}
            editable={!readOnly}
          />
        </FieldBlock>

        <FieldBlock
          label="Ville *"
          error={getHotelPartnerProfileFieldError(errorsByField, 'city')}
        >
          <TextInput
            style={[styles.input, readOnly && styles.inputReadOnly]}
            value={value.city}
            onChangeText={(city) => update({ city })}
            placeholder="Ex. Guelma"
            placeholderTextColor={muted}
            editable={!readOnly}
          />
        </FieldBlock>

        <FieldBlock
          label="Site web (optionnel)"
          error={getHotelPartnerProfileFieldError(errorsByField, 'website')}
        >
          <TextInput
            style={[styles.input, readOnly && styles.inputReadOnly]}
            value={value.website}
            onChangeText={(website) => update({ website })}
            placeholder="https://www.votre-hotel.com"
            placeholderTextColor={muted}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!readOnly}
          />
        </FieldBlock>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Présentation</Text>

        <FieldBlock
          label={`Description de l'établissement * (${descriptionLength}/${HOTEL_DESCRIPTION_MAX_LENGTH})`}
          error={descriptionHint}
        >
          <TextInput
            style={[styles.input, styles.textArea, readOnly && styles.inputReadOnly]}
            value={value.description}
            onChangeText={(description) => update({ description })}
            placeholder={`Présentez votre hôtel (${HOTEL_DESCRIPTION_MIN_LENGTH} à ${HOTEL_DESCRIPTION_MAX_LENGTH} caractères)`}
            placeholderTextColor={muted}
            multiline
            textAlignVertical="top"
            editable={!readOnly}
          />
        </FieldBlock>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  sectionCard: {
    backgroundColor: card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  fieldBlock: { gap: 6 },
  fieldLabel: {
    color: muted,
    fontSize: 12,
    fontWeight: '700',
  },
  fieldError: {
    color: red,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  input: {
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  inputReadOnly: {
    opacity: 0.75,
    color: '#CCC',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
});
