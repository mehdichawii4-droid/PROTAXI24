import { addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { EXPERIENCE_OPTION_CATALOG } from '@/constants/experiencesPrivateCatalog';
import {
  getFirestoreDb,
  getTourBookingDocRef,
  getTourBookingsCollectionRef,
} from '@/firebase/firestore';
import { matchOrCreateTourGroup } from '@/services/tourGroupMatching';
import { generateTourTicketCode } from '@/services/tourGroupTicket';
import { calculateGroupPaymentAmounts } from '@/services/tourGroupPayment';
import { devError, devLog, devWarn } from '@/utils/devLog';

const NO_EXTRA_OPTIONS_LABEL = 'Aucune option supplémentaire';

/** Dérive guideRequested depuis le champ options (libellé catalogue « Guide local »). */
export function deriveGuideRequestedFromOptions(options: string): boolean {
  const guideLabel = EXPERIENCE_OPTION_CATALOG.guide.label;
  const normalized = options.trim();

  if (!normalized || normalized === NO_EXTRA_OPTIONS_LABEL) {
    return false;
  }

  return normalized
    .split(',')
    .map((segment) => segment.trim())
    .includes(guideLabel);
}

export type CreateTourBookingInput = {
  clientUid: string;
  experienceTitle: string;
  circuitName: string;
  formula?: string;
  bookingMode: 'private' | 'group';
  duration: string;
  steps: string;
  options: string;
  travelers: string;
  date: string;
  meetingPoint: string;
  notes: string;
  price: string;
  source: string;
  groupDeparture?: string;
  groupMeetingPoint?: string;
  groupSpotsLeft?: string;
  groupTravelers?: string;
  partnerFields?: Record<string, string>;
};

export type CreateTourBookingResult = {
  bookingId: string;
  summaryParams: Record<string, string>;
  groupMatch?: {
    groupId: string;
    booked: string;
    remaining: string;
  };
};

export class CreateTourBookingError extends Error {
  code: 'FIRESTORE_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'CreateTourBookingError';
    this.code = 'FIRESTORE_FAILED';
  }
}

export async function createTourBooking(
  input: CreateTourBookingInput,
): Promise<CreateTourBookingResult> {
  const {
    clientUid,
    experienceTitle,
    circuitName,
    formula = '',
    bookingMode,
    duration,
    steps,
    options,
    travelers,
    date,
    meetingPoint,
    notes,
    price,
    source,
    groupDeparture = '',
    groupMeetingPoint = '',
    groupSpotsLeft = '',
    groupTravelers = '',
    partnerFields = {},
  } = input;

  const isGroupMode = bookingMode === 'group';
  const guideRequested = deriveGuideRequestedFromOptions(options);

  try {
    getFirestoreDb();

    const groupTicketCode = isGroupMode ? generateTourTicketCode(experienceTitle) : '';
    const groupPaymentAmounts = isGroupMode
      ? calculateGroupPaymentAmounts(price, Number(travelers) || 1)
      : null;

    const bookingDoc = await addDoc(getTourBookingsCollectionRef(), {
      clientUid,
      experience: experienceTitle,
      circuitName: circuitName || experienceTitle,
      formula,
      bookingMode,
      duration,
      steps,
      options,
      travelers,
      date,
      meetingPoint,
      notes,
      price,
      groupDeparture: isGroupMode ? groupDeparture : '',
      groupMeetingPoint: isGroupMode ? groupMeetingPoint : '',
      groupSpotsLeft: isGroupMode ? groupSpotsLeft : '',
      groupTravelers: isGroupMode ? groupTravelers : '',
      status: 'pending',
      ticketCode: groupTicketCode,
      checkInStatus: isGroupMode ? 'pending' : '',
      paymentStatus: isGroupMode ? 'unpaid' : '',
      depositAmount: groupPaymentAmounts?.depositAmount ?? 0,
      remainingAmount: groupPaymentAmounts?.remainingAmount ?? 0,
      paymentMethod: isGroupMode ? 'cash' : '',
      source,
      guideRequested,
      ...partnerFields,
      createdAt: serverTimestamp(),
    });

    let matchedGroupId = '';
    let matchedGroupBooked = '';
    let matchedGroupRemaining = '';

    if (isGroupMode) {
      try {
        devLog('[createTourBooking] groupMatching:before', {
          bookingId: bookingDoc.id,
          experience: experienceTitle,
          date,
          departure: groupDeparture,
          meetingPoint: groupMeetingPoint,
        });

        const groupMatch = await matchOrCreateTourGroup({
          experience: experienceTitle,
          date,
          departure: groupDeparture,
          meetingPoint: groupMeetingPoint,
          participant: {
            bookingId: bookingDoc.id,
            displayName: 'Voyageur PROTAXI',
            travelersCount: Number(travelers) || 1,
            status: 'pending',
          },
        });

        devLog('[createTourBooking] groupMatching:success', groupMatch);

        matchedGroupId = groupMatch.groupId;
        matchedGroupBooked = String(groupMatch.booked);
        matchedGroupRemaining = String(groupMatch.remaining);

        if (bookingDoc.id.trim() && groupMatch.groupId.trim()) {
          await updateDoc(getTourBookingDocRef(bookingDoc.id), {
            groupId: groupMatch.groupId,
          });
        } else {
          devWarn('[createTourBooking] groupMatching:skipBookingUpdate', {
            bookingId: bookingDoc.id,
            groupId: groupMatch.groupId,
          });
        }

        devLog('[createTourBooking] groupMatching:bookingUpdated', {
          bookingId: bookingDoc.id,
          groupId: groupMatch.groupId,
        });
      } catch (groupError) {
        devError('CONFIRM EXPERIENCE ERROR FULL:', groupError);
        devError('[createTourBooking] groupMatching:error', groupError);
        devLog(groupError);

        if (groupError instanceof Error) {
          devLog('[createTourBooking] groupMatching:error message:', groupError.message);
          devLog('[createTourBooking] groupMatching:error stack:', groupError.stack);
        }

        if (groupError && typeof groupError === 'object' && 'code' in groupError) {
          devLog(
            '[createTourBooking] groupMatching:error code:',
            (groupError as { code?: string }).code,
          );
        }
      }
    }

    const summaryParams: Record<string, string> = {
      experience: experienceTitle,
      duration,
      steps,
      options,
      travelers,
      date,
      meetingPoint,
      notes,
      price,
      circuitName: circuitName || experienceTitle,
      source,
      bookingMode,
      tourBookingId: bookingDoc.id,
    };

    if (formula) {
      summaryParams.formula = formula;
    }

    if (isGroupMode) {
      summaryParams.groupDeparture = groupDeparture;
      summaryParams.groupSpotsLeft = matchedGroupRemaining || groupSpotsLeft;
      summaryParams.groupTravelers = matchedGroupBooked || groupTravelers;
      summaryParams.groupMeetingPoint = groupMeetingPoint;
      if (matchedGroupId) {
        summaryParams.groupId = matchedGroupId;
        summaryParams.groupBooked = matchedGroupBooked;
        summaryParams.groupRemaining = matchedGroupRemaining;
      }
    }

    const result: CreateTourBookingResult = {
      bookingId: bookingDoc.id,
      summaryParams,
    };

    if (matchedGroupId) {
      result.groupMatch = {
        groupId: matchedGroupId,
        booked: matchedGroupBooked,
        remaining: matchedGroupRemaining,
      };
    }

    return result;
  } catch (error) {
    devError('CONFIRM EXPERIENCE ERROR FULL:', error);
    devError('Tour booking Firestore error:', error);
    devLog(error);

    if (error instanceof Error) {
      devLog('Tour booking error message:', error.message);
      devLog('Tour booking error stack:', error.stack);
    }

    throw new CreateTourBookingError(
      error instanceof Error ? error.message : 'Tour booking creation failed',
    );
  }
}
