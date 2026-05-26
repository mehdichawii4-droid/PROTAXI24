import { collection, onSnapshot } from 'firebase/firestore';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';

import {
  CITY_VEHICLES,
  getCityVehicleDef,
  type CityVehicleDef,
  type CityVehicleId,
} from '@/constants/cityVehicles';
import { db } from '@/firebase/firestore';
import type { DriversLiveDoc } from '@/services/driverDispatchService';
import { haversineDistanceMeters } from '@/utils/rideTracking';
import { devError } from '@/utils/devLog';

export type CityLiveDriverCard = {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: CityVehicleId;
  vehicleDef: CityVehicleDef;
  carLabel: string;
  etaMin: number;
  distanceMeters: number;
  available: boolean;
};

const VEHICLE_KEYWORDS: [RegExp, CityVehicleId][] = [
  [/access\+|access coffre/i, 'Access Coffre+'],
  [/access/i, 'Access Standard'],
  [/coffre\+?/i, 'Coffre+'],
  [/famille|enfant/i, 'Famille'],
  [/vip|premium|diamond/i, 'VIP'],
  [/van|bus|groupe/i, 'Van'],
  [/green|éco|eco|confort/i, 'Confort'],
  [/berline|standard/i, 'Berline'],
];

export function inferVehicleIdFromLabel(label?: string): CityVehicleId {
  const text = String(label || '');
  for (const [regex, id] of VEHICLE_KEYWORDS) {
    if (regex.test(text)) return id;
  }
  return 'Berline';
}

function getVehicleDef(id: CityVehicleId): CityVehicleDef {
  return getCityVehicleDef(id);
}

function isLiveDriverEligible(data: DriversLiveDoc): boolean {
  if (!data.isOnline) return false;
  if (data.isBusy) return false;
  if (data.availability && data.availability !== 'available') return false;
  if (String(data.currentRideId || '').trim()) return false;
  if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return false;
  return Number.isFinite(data.latitude) && Number.isFinite(data.longitude);
}

function estimatePickupEtaMinutes(distanceMeters: number, baseEtaMin: number): number {
  const driveMin = Math.ceil(distanceMeters / 450);
  return Math.max(3, Math.min(25, driveMin + Math.round(baseEtaMin * 0.15)));
}

function resolveCarLabel(data: DriversLiveDoc): string {
  const extended = data as DriversLiveDoc & { driverCar?: string };
  const raw = String(extended.car || extended.driverCar || '').trim();
  return raw || 'Véhicule PROTAXI';
}

type ClientCoordinate = {
  latitude: number;
  longitude: number;
};

export function useCityLiveDrivers(options: {
  visible: boolean;
  baseEtaMin: number;
}) {
  const { visible, baseEtaMin } = options;
  const [liveDocs, setLiveDocs] = useState<DriversLiveDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [clientCoordinate, setClientCoordinate] = useState<ClientCoordinate | null>(null);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (cancelled) return;

        if (lastKnown?.coords) {
          setClientCoordinate({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          });
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        setClientCoordinate({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
      } catch (error) {
        devError('[CITY LIVE DRIVERS] location unavailable', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setLiveDocs([]);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      collection(db, 'driversLive'),
      (snapshot) => {
        const drivers = snapshot.docs.map(
          (docSnap) =>
            ({
              id: docSnap.id,
              ...docSnap.data(),
            }) as DriversLiveDoc,
        );
        setLiveDocs(drivers);
        setLoading(false);
      },
      (error) => {
        devError('[CITY LIVE DRIVERS] snapshot error', error);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [visible]);

  const liveCards = useMemo((): CityLiveDriverCard[] => {
    const pickup = clientCoordinate ?? { latitude: 36.462, longitude: 7.426 };

    return liveDocs
      .filter(isLiveDriverEligible)
      .map((driver) => {
        const carLabel = resolveCarLabel(driver);
        const vehicleId = inferVehicleIdFromLabel(carLabel);
        const vehicleDef = getVehicleDef(vehicleId);
        const distanceMeters = haversineDistanceMeters(pickup, {
          latitude: driver.latitude as number,
          longitude: driver.longitude as number,
        });
        const etaMin = estimatePickupEtaMinutes(distanceMeters, baseEtaMin);

        return {
          id: String(driver.id || driver.driverId),
          driverId: String(driver.driverId || driver.id),
          driverName: String(driver.driverName || driver.name || 'Chauffeur PROTAXI'),
          vehicleId,
          vehicleDef,
          carLabel,
          etaMin: Math.max(5, etaMin + (vehicleDef.etaOffset ?? 0)),
          distanceMeters,
          available: vehicleDef.available,
        };
      })
      .sort((left, right) => left.distanceMeters - right.distanceMeters);
  }, [baseEtaMin, clientCoordinate, liveDocs]);

  const fallbackVehicleIds = useMemo(() => {
    const covered = new Set(liveCards.map((card) => card.vehicleId));
    return CITY_VEHICLES.filter((vehicle) => vehicle.available && !covered.has(vehicle.id));
  }, [liveCards]);

  return {
    liveCards,
    fallbackVehicleIds,
    loading,
    hasLiveDrivers: liveCards.length > 0,
  };
}
