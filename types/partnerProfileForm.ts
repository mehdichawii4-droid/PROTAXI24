/** Champs profil hôtel saisis dans HotelPartnerProfileForm (Lot 6). */
export type HotelPartnerProfileFormValues = {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  description: string;
  /** Optionnel — chaîne vide si absent. */
  website: string;
};

export function createEmptyHotelPartnerProfileFormValues(): HotelPartnerProfileFormValues {
  return {
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    description: '',
    website: '',
  };
}
