import { formatReviewAverage } from '@/services/tourGroupReviews';
import { normalizeTourGroupTrackingStatus } from '@/services/tourGroupMatching';

export type TourAnalyticsGroup = {
  id: string;
  experience?: string;
  booked?: number;
  capacity?: number;
  remaining?: number;
  trackingStatus?: string;
  assignedGuide?: string;
  assignedDriver?: string;
  date?: string;
};

export type TourAnalyticsBooking = {
  id: string;
  experience?: string;
  circuitName?: string;
  price?: string;
  bookingMode?: string;
};

export type TourAnalyticsReview = {
  id: string;
  groupId?: string;
  rating: number;
  guideRating: number;
  driverRating: number;
};

export type ExperienceAnalytics = {
  experience: string;
  averageRating: number;
  reviewCount: number;
  totalParticipants: number;
  completionRate: number;
  groupFillRate: number;
  groupCount: number;
  completedGroups: number;
  bookingCount: number;
};

export type GuideAnalytics = {
  guideName: string;
  averageRating: number;
  reviewCount: number;
  groupCount: number;
  completedGroups: number;
};

export type TourismGlobalAnalytics = {
  activeGroups: number;
  completedGroups: number;
  averageRating: number;
  reviewCount: number;
  totalParticipants: number;
  averageFillRate: number;
  estimatedRevenue: number;
  topExperience: ExperienceAnalytics | null;
  topGuide: GuideAnalytics | null;
  experiences: ExperienceAnalytics[];
};

export type GroupPopularityAnalytics = {
  averageRating: number;
  reviewCount: number;
  totalParticipants: number;
  groupFillRate: number;
  completionRate: number;
  experienceRank: number;
  popularityLabel: string;
};

export function parseTourAnalyticsPrice(price?: string) {
  return parseInt(String(price || '0').replace(/\D/g, ''), 10) || 0;
}

export function computeGroupFillRate(booked: number, capacity: number) {
  if (!capacity) return 0;
  return Math.min(100, Math.round((booked / capacity) * 100));
}

export function computeCompletionRate(completedCount: number, totalCount: number) {
  if (!totalCount) return 0;
  return Math.round((completedCount / totalCount) * 100);
}

export function computeAverageRating(reviews: TourAnalyticsReview[]) {
  if (reviews.length === 0) return 0;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return total / reviews.length;
}

export function computeAverageGuideRating(reviews: TourAnalyticsReview[]) {
  if (reviews.length === 0) return 0;
  const total = reviews.reduce((sum, review) => sum + review.guideRating, 0);
  return total / reviews.length;
}

export function estimateTourismRevenue(bookings: TourAnalyticsBooking[]) {
  return bookings.reduce((sum, booking) => sum + parseTourAnalyticsPrice(booking.price), 0);
}

export function getReviewGroupIdFromPath(path: string) {
  const match = path.match(/tourGroups\/([^/]+)\/reviews/);
  return match?.[1] ?? '';
}

function groupByExperience(groups: TourAnalyticsGroup[], bookings: TourAnalyticsBooking[]) {
  const map = new Map<string, { groups: TourAnalyticsGroup[]; bookings: TourAnalyticsBooking[] }>();

  groups.forEach((group) => {
    const key = String(group.experience || 'Expérience PROTAXI');
    const current = map.get(key) ?? { groups: [], bookings: [] };
    current.groups.push(group);
    map.set(key, current);
  });

  bookings.forEach((booking) => {
    const key = String(booking.experience || booking.circuitName || 'Expérience PROTAXI');
    const current = map.get(key) ?? { groups: [], bookings: [] };
    current.bookings.push(booking);
    map.set(key, current);
  });

  return map;
}

export function buildExperienceAnalytics(
  experience: string,
  groups: TourAnalyticsGroup[],
  bookings: TourAnalyticsBooking[],
  reviews: TourAnalyticsReview[],
): ExperienceAnalytics {
  const groupIds = new Set(groups.map((group) => group.id));
  const experienceReviews = reviews.filter(
    (review) => !review.groupId || groupIds.has(review.groupId),
  );

  const totalParticipants = groups.reduce(
    (sum, group) => sum + Number(group.booked || 0),
    0,
  );
  const totalCapacity = groups.reduce(
    (sum, group) => sum + Number(group.capacity || 8),
    0,
  );
  const completedGroups = groups.filter(
    (group) => normalizeTourGroupTrackingStatus(group.trackingStatus) === 'completed',
  ).length;

  return {
    experience,
    averageRating: computeAverageRating(experienceReviews),
    reviewCount: experienceReviews.length,
    totalParticipants,
    completionRate: computeCompletionRate(completedGroups, groups.length),
    groupFillRate: computeGroupFillRate(totalParticipants, totalCapacity),
    groupCount: groups.length,
    completedGroups,
    bookingCount: bookings.length,
  };
}

export function computeTourismGlobalAnalytics(
  groups: TourAnalyticsGroup[],
  bookings: TourAnalyticsBooking[],
  reviews: TourAnalyticsReview[],
): TourismGlobalAnalytics {
  const experienceMap = groupByExperience(groups, bookings);
  const experiences = Array.from(experienceMap.entries())
    .map(([experience, data]) =>
      buildExperienceAnalytics(experience, data.groups, data.bookings, reviews),
    )
    .sort((a, b) => {
      if (b.totalParticipants !== a.totalParticipants) {
        return b.totalParticipants - a.totalParticipants;
      }
      return b.averageRating - a.averageRating;
    });

  const topExperience = experiences[0] ?? null;
  const topGuide = computeTopGuide(groups, reviews);

  const totalParticipants = groups.reduce(
    (sum, group) => sum + Number(group.booked || 0),
    0,
  );
  const totalCapacity = groups.reduce(
    (sum, group) => sum + Number(group.capacity || 8),
    0,
  );
  const completedGroups = groups.filter(
    (group) => normalizeTourGroupTrackingStatus(group.trackingStatus) === 'completed',
  ).length;
  const activeGroups = groups.filter(
    (group) => normalizeTourGroupTrackingStatus(group.trackingStatus) !== 'completed',
  ).length;

  return {
    activeGroups,
    completedGroups,
    averageRating: computeAverageRating(reviews),
    reviewCount: reviews.length,
    totalParticipants,
    averageFillRate: computeGroupFillRate(totalParticipants, totalCapacity),
    estimatedRevenue: estimateTourismRevenue(bookings),
    topExperience,
    topGuide,
    experiences,
  };
}

export function computeTopGuide(
  groups: TourAnalyticsGroup[],
  reviews: TourAnalyticsReview[],
): GuideAnalytics | null {
  const guideMap = new Map<
    string,
    { groupIds: Set<string>; reviews: TourAnalyticsReview[]; completedGroups: number }
  >();

  groups.forEach((group) => {
    const guideName = String(group.assignedGuide || '').trim();
    if (!guideName) return;

    const current = guideMap.get(guideName) ?? {
      groupIds: new Set<string>(),
      reviews: [],
      completedGroups: 0,
    };
    current.groupIds.add(group.id);
    if (normalizeTourGroupTrackingStatus(group.trackingStatus) === 'completed') {
      current.completedGroups += 1;
    }
    guideMap.set(guideName, current);
  });

  reviews.forEach((review) => {
    if (!review.groupId) return;
    const group = groups.find((item) => item.id === review.groupId);
    const guideName = String(group?.assignedGuide || '').trim();
    if (!guideName) return;

    const current = guideMap.get(guideName);
    if (current) {
      current.reviews.push(review);
    }
  });

  const guides = Array.from(guideMap.entries())
    .map(([guideName, data]) => ({
      guideName,
      averageRating: computeAverageGuideRating(data.reviews),
      reviewCount: data.reviews.length,
      groupCount: data.groupIds.size,
      completedGroups: data.completedGroups,
    }))
    .sort((a, b) => {
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      return b.reviewCount - a.reviewCount;
    });

  return guides[0] ?? null;
}

export function computeClientGroupPopularityAnalytics(
  group: Pick<TourAnalyticsGroup, 'id' | 'booked' | 'capacity' | 'trackingStatus'>,
  reviews: TourAnalyticsReview[],
): GroupPopularityAnalytics {
  const groupReviews = reviews.filter(
    (review) => !review.groupId || review.groupId === group.id,
  );
  const booked = Number(group.booked || 0);
  const capacity = Number(group.capacity || 8);
  const groupFillRate = computeGroupFillRate(booked, capacity);
  const completedGroups =
    normalizeTourGroupTrackingStatus(group.trackingStatus) === 'completed' ? 1 : 0;
  const popularityLabel =
    groupFillRate >= 75
      ? 'BEST SELLER'
      : groupFillRate >= 50
        ? 'TOP Tendance'
        : 'Populaire';

  return {
    averageRating: computeAverageRating(groupReviews),
    reviewCount: groupReviews.length,
    totalParticipants: booked,
    groupFillRate,
    completionRate: computeCompletionRate(completedGroups, 1),
    experienceRank: groupFillRate >= 75 ? 1 : groupFillRate >= 50 ? 2 : 3,
    popularityLabel,
  };
}

export function computeGroupPopularityAnalytics(
  experience: string,
  group: TourAnalyticsGroup,
  allGroups: TourAnalyticsGroup[],
  reviews: TourAnalyticsReview[],
): GroupPopularityAnalytics {
  const groupReviews = reviews.filter((review) => review.groupId === group.id);
  const experienceGroups = allGroups.filter((item) => item.experience === experience);
  const experiences = experienceGroups
    .map((item) => item.experience || experience)
    .filter(Boolean);
  const uniqueExperiences = Array.from(new Set(experiences));

  const rankedExperiences = uniqueExperiences
    .map((name) => {
      const relatedGroups = allGroups.filter((item) => item.experience === name);
      const participants = relatedGroups.reduce(
        (sum, item) => sum + Number(item.booked || 0),
        0,
      );
      return { name, participants };
    })
    .sort((a, b) => b.participants - a.participants);

  const experienceRank =
    rankedExperiences.findIndex((item) => item.name === experience) + 1 || 1;

  const completedGroups = normalizeTourGroupTrackingStatus(group.trackingStatus) === 'completed'
    ? 1
    : 0;

  return {
    averageRating: computeAverageRating(groupReviews),
    reviewCount: groupReviews.length,
    totalParticipants: Number(group.booked || 0),
    groupFillRate: computeGroupFillRate(Number(group.booked || 0), Number(group.capacity || 8)),
    completionRate: computeCompletionRate(completedGroups, 1),
    experienceRank,
    popularityLabel:
      experienceRank === 1
        ? 'BEST SELLER'
        : experienceRank <= 3
          ? 'TOP Tendance'
          : 'Populaire',
  };
}

export function computeStaffGuideAnalytics(
  guideName: string,
  groups: TourAnalyticsGroup[],
  reviews: TourAnalyticsReview[],
) {
  const guideGroups = groups.filter((group) => group.assignedGuide === guideName);
  const guideGroupIds = new Set(guideGroups.map((group) => group.id));
  const guideReviews = reviews.filter(
    (review) => review.groupId && guideGroupIds.has(review.groupId),
  );
  const completedToday = guideGroups.filter(
    (group) => normalizeTourGroupTrackingStatus(group.trackingStatus) === 'completed',
  ).length;

  return {
    guideName,
    satisfactionScore: computeAverageGuideRating(guideReviews),
    reviewCount: guideReviews.length,
    completedToday,
    averageExcursionRating: computeAverageRating(guideReviews),
    groupCount: guideGroups.length,
  };
}

export function computeAssignedStaffAnalytics(
  groups: TourAnalyticsGroup[],
  reviews: TourAnalyticsReview[],
  isTodayDate?: (date?: string) => boolean,
) {
  const groupIds = new Set(groups.map((group) => group.id));
  const assignedReviews = reviews.filter(
    (review) => review.groupId && groupIds.has(review.groupId),
  );
  const completedToday = groups.filter((group) => {
    if (normalizeTourGroupTrackingStatus(group.trackingStatus) !== 'completed') {
      return false;
    }
    return isTodayDate ? isTodayDate(group.date) : true;
  }).length;

  return {
    satisfactionScore: computeAverageGuideRating(assignedReviews),
    reviewCount: assignedReviews.length,
    completedToday,
    averageExcursionRating: computeAverageRating(assignedReviews),
    groupCount: groups.length,
  };
}

export function formatAnalyticsRating(value: number) {
  return formatReviewAverage(value);
}

export function formatAnalyticsPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function formatAnalyticsRevenue(value: number) {
  if (!value) return '0 DA';
  return `${value.toLocaleString('fr-FR')} DA`;
}

export function formatAnalyticsParticipants(value: number) {
  return `${value} participant${value > 1 ? 's' : ''}`;
}
