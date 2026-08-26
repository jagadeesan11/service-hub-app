import { Stack } from 'expo-router';

export default function BookingsStackLayout() {
  return (
    <Stack>
      {/* Same as Home: the screen already renders 'Bookings' as a display
          heading, so the header repeated it directly above. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[bookingId]" options={{ title: 'Booking' }} />
      <Stack.Screen name="feedback/[bookingId]" options={{ title: 'Rate this service' }} />
    </Stack>
  );
}
