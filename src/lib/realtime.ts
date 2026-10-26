import { useEffect } from 'react';
import { supabase } from './supabase';
import { useQueryClient } from '@tanstack/react-query';

export function useTripRealtime(tripId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tripId) return;

    const channel = supabase
      .channel('trip:' + tripId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions', filter: 'trip_id=eq.' + tripId }, () => {
        queryClient.invalidateQueries({ queryKey: ['contributions', tripId] });
        queryClient.invalidateQueries({ queryKey: ['fund_balance', tripId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: 'trip_id=eq.' + tripId }, () => {
        queryClient.invalidateQueries({ queryKey: ['expenses', tripId] });
        queryClient.invalidateQueries({ queryKey: ['fund_balance', tripId] });
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [tripId, queryClient]);
}