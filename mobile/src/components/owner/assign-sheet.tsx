import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SlideToConfirm } from '@/components/owner/slide-to-confirm';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { OwnerTechnician } from '@/hooks/use-owner';

/**
 * Choosing who takes a job.
 *
 * A sheet rather than a screen: picking a technician is a decision about the
 * job you are already looking at, and pushing a route would bury it.
 */
export function AssignSheet({
  visible,
  technicians,
  currentTechnicianId,
  jobLine,
  busy,
  onAssign,
  onClose,
}: {
  visible: boolean;
  technicians: OwnerTechnician[];
  currentTechnicianId: string | null;
  jobLine: string;
  busy?: boolean;
  onAssign: (technicianId: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [picked, setPicked] = useState<string | null>(currentTechnicianId);

  const choice = picked ?? currentTechnicianId ?? technicians[0]?.id ?? null;
  const chosen = technicians.find((t) => t.id === choice);
  const firstName = chosen ? chosen.name.split(' ')[0] : '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />

        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />

          <View style={styles.head}>
            <ThemedText type="heading">Who takes this?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {jobLine}
            </ThemedText>
          </View>

          {technicians.length === 0 ? (
            <View style={styles.empty}>
              <ThemedText type="bodyMedium">No technicians yet</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Add someone to the team before assigning work.
              </ThemedText>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
              {technicians.map((t) => {
                const on = t.id === choice;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setPicked(t.id)}
                    accessibilityRole="radio"
                    aria-checked={on}
                    accessibilityLabel={t.name}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: on ? theme.primarySoft : theme.surface,
                        borderColor: on ? theme.primary : theme.border,
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: on ? theme.primary : theme.surfaceSunk },
                      ]}
                    >
                      <ThemedText
                        type="smallBold"
                        style={{ color: on ? theme.primaryText : theme.textSecondary }}
                      >
                        {initialsOf(t.name)}
                      </ThemedText>
                    </View>

                    <View style={styles.optionCopy}>
                      <ThemedText type="bodyMedium">{t.name}</ThemedText>
                      {t.phone ? (
                        <ThemedText type="caption" themeColor="textMuted">
                          {t.phone}
                        </ThemedText>
                      ) : null}
                    </View>

                    {t.id === currentTechnicianId && (
                      <ThemedText type="caption" themeColor="textMuted">
                        On it now
                      </ThemedText>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {technicians.length > 0 && (
            <View style={styles.footer}>
              <SlideToConfirm
                label={busy ? 'Assigning…' : `Slide to give it to ${firstName}`}
                confirmingLabel="Release to confirm"
                disabled={busy || !choice}
                onConfirm={() => choice && onAssign(choice)}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingBottom: Spacing.five,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: Radius.full,
    marginTop: Spacing.two,
  },
  head: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: 2 },
  list: { marginTop: Spacing.three },
  listInner: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: { flex: 1, gap: 1 },
  empty: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.five, gap: 2 },
  footer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
});
