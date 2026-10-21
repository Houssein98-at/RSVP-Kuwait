import { useState, useEffect } from 'react';
import type { Guest } from '../types';
import { subscribeToGuests, subscribeToRecentArrivals } from '../services/firestore';
import { useAuth } from '../contexts/AuthContext';

export function useGuests() {
  const { adminUser } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [recentArrivals, setRecentArrivals] = useState<Guest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!adminUser) {
      setGuests([]);
      setRecentArrivals([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubGuests = subscribeToGuests((liveGuests) => {
      setGuests(liveGuests);
      setLoading(false);
    });

    const unsubArrivals = subscribeToRecentArrivals((liveArrivals) => {
      setRecentArrivals(liveArrivals);
    });

    return () => {
      unsubGuests();
      unsubArrivals();
    };
  }, [adminUser]);

  const checkedInCount = guests.filter((g) => g.attendanceStatus === 'CHECKED_IN').length;
  const notArrivedCount = guests.length - checkedInCount;

  return {
    guests,
    recentArrivals,
    loading,
    checkedInCount,
    notArrivedCount,
    totalGuests: guests.length,
  };
}
