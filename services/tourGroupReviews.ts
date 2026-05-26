import { addDoc, serverTimestamp } from 'firebase/firestore';
import { devError } from '@/utils/devLog';
import { getTourGroupReviewsCollectionRef } from '@/firebase/firestore';
import { DEFAULT_PARTICIPANT_SENDER_NAME } from '@/services/tourGroupChat';

export type TourGroupReview = {
  id: string;
  bookingId?: string;
  rating: number;
  driverRating: number;
  guideRating: number;
  comment: string;
  senderName: string;
  createdAt?: unknown;
};

export type SendTourGroupReviewInput = {
  bookingId: string;
  rating: number;
  driverRating: number;
  guideRating: number;
  comment: string;
  senderName?: string;
};

export type TourGroupReviewStats = {
  count: number;
  averageRating: number;
  averageDriverRating: number;
  averageGuideRating: number;
};

export function normalizeTourGroupReview(
  id: string,
  raw: Record<string, unknown>,
): TourGroupReview {
  return {
    id,
    bookingId: raw.bookingId ? String(raw.bookingId) : undefined,
    rating: Number(raw.rating || 0),
    driverRating: Number(raw.driverRating || 0),
    guideRating: Number(raw.guideRating || 0),
    comment: String(raw.comment || ''),
    senderName: String(raw.senderName || DEFAULT_PARTICIPANT_SENDER_NAME),
    createdAt: raw.createdAt,
  };
}

export function computeTourGroupReviewStats(
  reviews: TourGroupReview[],
): TourGroupReviewStats {
  if (reviews.length === 0) {
    return {
      count: 0,
      averageRating: 0,
      averageDriverRating: 0,
      averageGuideRating: 0,
    };
  }

  const totals = reviews.reduce(
    (acc, review) => ({
      rating: acc.rating + review.rating,
      driverRating: acc.driverRating + review.driverRating,
      guideRating: acc.guideRating + review.guideRating,
    }),
    { rating: 0, driverRating: 0, guideRating: 0 },
  );

  const count = reviews.length;

  return {
    count,
    averageRating: totals.rating / count,
    averageDriverRating: totals.driverRating / count,
    averageGuideRating: totals.guideRating / count,
  };
}

export function formatReviewAverage(value: number) {
  if (!value) return '0.0';
  return value.toFixed(1);
}

export async function sendTourGroupReview(
  groupId: string,
  input: SendTourGroupReviewInput,
) {
  const normalizedGroupId = groupId.trim();
  const normalizedBookingId = input.bookingId.trim();

  if (!normalizedGroupId) {
    throw new Error('groupId is required');
  }

  if (!normalizedBookingId) {
    throw new Error('bookingId is required');
  }

  if (!input.rating || !input.driverRating || !input.guideRating) {
    throw new Error('All ratings are required');
  }

  try {
    await addDoc(getTourGroupReviewsCollectionRef(normalizedGroupId), {
      bookingId: normalizedBookingId,
      rating: input.rating,
      driverRating: input.driverRating,
      guideRating: input.guideRating,
      comment: input.comment.trim(),
      senderName: input.senderName?.trim() || DEFAULT_PARTICIPANT_SENDER_NAME,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    devError('[PROMISE DENIED - tourGroupReviews - sendReview]', error);
    throw error;
  }
}

export function findReviewByBookingId(
  reviews: TourGroupReview[],
  bookingId: string,
) {
  return reviews.find((review) => review.bookingId === bookingId) ?? null;
}

export function getLatestTourGroupReviews(
  reviews: TourGroupReview[],
  limit = 3,
) {
  const getTimestamp = (value: unknown) => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'object' && value !== null && 'toDate' in value) {
      const timestamp = value as { toDate?: () => Date };
      return timestamp.toDate?.()?.getTime() ?? 0;
    }
    return 0;
  };

  return [...reviews]
    .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt))
    .slice(0, limit);
}
