import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * The shop-side app.
 *
 * A separate tab group rather than extra tabs on the customer app: an owner
 * and a customer share an account system but nothing else. The root router
 * sends each role to its own group, so neither ever renders the other's
 * navigation.
 *
 * Four tabs, not eight. The tab bar carries the work that happens all day —
 * the board, the jobs on it, what the shop sells, what customers said — and
 * everything you set up occasionally (team, earnings, reports, bills, hours)
 * lives behind the Shop screen instead. Eight tabs left each one too narrow to
 * read and buried the two that actually get used.
 *
 * Every route in this directory is a tab, and only these four are here. Shop, a
 * job, a bill and the setup screens live one level up in the parent stack —
 * put beside these they would be tabs with no button, which is exactly how
 * they came to be unreachable.
 */
export default function OwnerTabsLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}
    >
      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="tray.full.fill" md="inbox" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="jobs">
        <NativeTabs.Trigger.Label>Jobs</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="wrench.and.screwdriver.fill" md="build" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="catalog">
        <NativeTabs.Trigger.Label>Catalog</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="grid_view" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="feedback">
        <NativeTabs.Trigger.Label>Feedback</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="star.fill" md="star" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
