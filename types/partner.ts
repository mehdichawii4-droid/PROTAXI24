export type PartnerType = 'hotel' | 'agency' | 'transport';

export type PartnerBookingType = 'transfer' | 'tour';

export type PartnerProfileRecord = {
  uid: string;
  companyName: string;
  partnerType: PartnerType;
  contactName: string;
  phone: string;
  email: string;
  isActive: boolean;
  createdAt?: unknown;
};

export type PartnerReservationItem = {
  id: string;
  kind: 'transfer' | 'excursion';
  title: string;
  subtitle: string;
  status: string;
  dateLabel: string;
  priceLabel: string;
  createdAtMs: number;
};

export type AdminPartnerListItem = {
  uid: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  partnerType: PartnerType;
  partnerTypeLabel: string;
  isActive: boolean;
  statusLabel: 'Actif' | 'Suspendu';
  totalBookings: number;
  totalRevenue: number;
  createdAt?: unknown;
};

export type AdminPartnerBookingPreview = {
  id: string;
  kind: 'transfer' | 'excursion';
  title: string;
  subtitle: string;
  status: string;
  priceLabel: string;
};

export type AdminPartnerDetail = Omit<AdminPartnerListItem, 'uid'> & {
  uid: string;
  recentBookings: AdminPartnerBookingPreview[];
};
