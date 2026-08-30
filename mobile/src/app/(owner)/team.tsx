import { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TechnicianSheet } from '@/components/owner/technician-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui/card';
import { ErrorState, SkeletonList } from '@/components/ui/feedback';
import { Radius, Spacing } from '@/constants/theme';
import { useOwnerBookings, type OwnerTechnician } from '@/hooks/use-owner';
import { useSaveTechnician, useSetTechnicianStatus, useTeam } from '@/hooks/use-owner-team';
import { useTheme } from '@/hooks/use-theme';
import { canRemove, initialsOf, isInABay, openJobsFor } from '@/lib/team';

export default function OwnerTeamScreen() {
  const [editing, setEditing] = useState<OwnerTechnician | null>(null);
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const team = useTeam();
  const bookings = useOwnerBookings();
  const save = useSaveTechnician();
  const setStatus = useSetTechnicianStatus();

  const busy = save.isPending || setStatus.isPending;
  const sheetOpen = adding || editing !== null;

  async function run(fn: () => Promise<unknown>) {
    setProblem(null);
    try {
      await fn();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={team.isRefetching}
              onRefresh={() => {
                void team.refetch();
                void bookings.refetch();
              }}
            />
          }
        >
          <View style={styles.header}>
            <ThemedText type="title">Team</ThemedText>
            <Pressable onPress={() => setAdding(true)} accessibilityRole="button" hitSlop={6}>
              <ThemedText type="smallBold" themeColor="primary">
                Add
              </ThemedText>
            </Pressable>
          </View>

          {problem && (
            <View style={styles.body}>
              <ThemedText type="small" themeColor="error">
                {problem}
              </ThemedText>
            </View>
          )}

          {team.isLoading ? (
            <View style={styles.body}>
              <SkeletonList count={3} height={72} />
            </View>
          ) : team.isError ? (
            <View style={styles.body}>
              <ErrorState message={(team.error as Error).message} onRetry={() => team.refetch()} />
            </View>
          ) : (team.data ?? []).length === 0 ? (
            <View style={styles.body}>
              <Card style={styles.empty}>
                <ThemedText type="bodyMedium">Nobody on the team yet</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Add someone before assigning work.
                </ThemedText>
              </Card>
            </View>
          ) : (
            <View style={styles.stack}>
              {(team.data ?? []).map((t) => (
                <TechnicianRow
                  key={t.id}
                  technician={t}
                  openJobs={openJobsFor(t.id, bookings.data)}
                  busy={isInABay(t.id, bookings.data)}
                  onPress={() => setEditing(t)}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {sheetOpen && (
          <TechnicianSheet
            visible
            technician={editing}
            openJobs={editing ? openJobsFor(editing.id, bookings.data) : 0}
            busy={busy}
            onClose={() => {
              setEditing(null);
              setAdding(false);
            }}
            onSave={(input) =>
              void run(async () => {
                await save.mutateAsync({ ...input, id: editing?.id ?? null });
                setEditing(null);
                setAdding(false);
              })
            }
            onSetStatus={
              editing
                ? (status) =>
                    void run(async () => {
                      // Re-checked here as well as in the sheet: the board may
                      // have moved since it opened, and standing someone down
                      // mid-job leaves work with nobody on it.
                      if (status === 'inactive') {
                        const check = canRemove(editing.id, editing.name, bookings.data);
                        if (!check.allowed) throw new Error(check.reason!);
                      }
                      await setStatus.mutateAsync({ id: editing.id, status });
                      setEditing(null);
                    })
                : undefined
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function TechnicianRow({
  technician,
  openJobs,
  busy,
  onPress,
}: {
  technician: OwnerTechnician;
  openJobs: number;
  busy: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const off = technician.status !== 'active';

  const state = off
    ? { label: 'Stood down', fg: theme.textMuted, bg: theme.surfaceSunk }
    : busy
      ? { label: 'In a bay', fg: theme.warning, bg: theme.warningSoft }
      : { label: 'Free', fg: theme.success, bg: theme.successSoft };

  return (
    // The Card itself is not pressable. Two tap targets live inside it as
    // siblings — "open this person" and "call them" — because nesting one
    // pressable in another gives an ambiguous tap on native and is invalid
    // HTML on web, where each Pressable renders as a <button>.
    <Card style={styles.row}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${technician.name}`}
        style={({ pressed }) => [styles.rowMain, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: off ? theme.surfaceSunk : theme.primarySoft },
          ]}
        >
          <ThemedText type="smallBold" style={{ color: off ? theme.textMuted : theme.primary }}>
            {initialsOf(technician.name)}
          </ThemedText>
        </View>

        <View style={styles.rowCopy}>
          <ThemedText type="bodyMedium" numberOfLines={1}>
            {technician.name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
            {[
              openJobs > 0 ? `${openJobs} job${openJobs > 1 ? 's' : ''} on` : 'No open jobs',
              technician.rating_count > 0 && technician.rating_avg !== null
                ? `★ ${technician.rating_avg.toFixed(1)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        </View>
      </Pressable>

      {technician.phone ? (
        <Pressable
          onPress={() => Linking.openURL(`tel:${technician.phone!.replace(/\s/g, '')}`)}
          accessibilityRole="button"
          accessibilityLabel={`Call ${technician.name}`}
          hitSlop={8}
        >
          <ThemedText type="caption" themeColor="primary">
            Call
          </ThemedText>
        </Pressable>
      ) : null}

      <View style={[styles.badge, { backgroundColor: state.bg }]}>
        <ThemedText type="caption" style={{ color: state.fg }}>
          {state.label}
        </ThemedText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { paddingBottom: Spacing.six },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  body: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  stack: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowCopy: { flex: 1, gap: 1 },
  badge: { borderRadius: Radius.full, paddingHorizontal: Spacing.two, paddingVertical: 1 },
  empty: { gap: 2 },
});
