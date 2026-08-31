import { Stack } from 'expo-router';

/**
 * The shop-side app: a stack, with the tab bar as its first screen.
 *
 * The tabs cannot be the top of this group. NativeTabs turns every child route
 * into a tab, so a screen sitting beside `inbox` and friends is not something
 * you can push — it is a tab with no button, unreachable. That is what left
 * Shop blank and job cards dead to the touch. The customer app hit the same
 * wall and solved it the same way (see `settings` in the root layout).
 *
 * So: everything reached *from* a tab — Shop and the screens behind it, a job,
 * a bill — lives here instead, one level up, and pushes over the tab bar the
 * way the design shows.
 *
 * Screens that draw their own back control get no native header; the ones that
 * were written as tabs, and so have no way back of their own, keep one.
 */
export default function OwnerLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* These two draw their own back control, so they get no native header.
          Every other screen here was written as a tab and has no way back of
          its own — taking the header off them would strand you. */}
      <Stack.Screen name="shop" options={{ headerShown: false }} />
      <Stack.Screen name="job/[bookingId]" options={{ headerShown: false }} />

      <Stack.Screen name="invoice/[invoiceId]" options={{ title: 'Bill' }} />
      <Stack.Screen name="service/[serviceId]" options={{ title: 'Service' }} />
      <Stack.Screen name="team" options={{ title: 'Technicians' }} />
      <Stack.Screen name="reports" options={{ title: 'Reports' }} />
      <Stack.Screen name="invoices" options={{ title: 'Invoices' }} />
      <Stack.Screen name="hours" options={{ title: 'Hours & availability' }} />
    </Stack>
  );
}
