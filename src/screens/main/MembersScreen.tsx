import React from 'react';
import { FlatList } from 'react-native';
import { List, Chip } from 'react-native-paper';
import { useTripMembers } from '@/lib/queries';

export function MembersScreen({ route }: any) {
  const { tripId } = route.params;
  const { data: members = [] } = useTripMembers(tripId);

  return (
    <FlatList
      data={members}
      keyExtractor={(item: any) => item.id}
      style={{ backgroundColor: '#F8F9FA' }}
      renderItem={({ item }: any) => (
        <List.Item
          title={item.profiles?.full_name || 'User'}
          description={item.profiles?.email}
          right={() => <Chip compact style={{ backgroundColor: '#E8F5E9' }}>{item.role}</Chip>}
        />
      )}
    />
  );
}