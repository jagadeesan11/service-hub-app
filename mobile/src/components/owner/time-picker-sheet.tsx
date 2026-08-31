import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatClock } from '@/lib/scheduling';

/**
 * Picking an opening or closing time.
 *
 * A list rather than the platform clock picker: a shop opens on the half hour,
 * and spinning a minute wheel to land on 9:00 is more work than choosing it.
 * It replaced a tap-to-step control, which saved correctly but gave no sign it
 * was editable at all — you had to already know.
 */
export function TimePickerSheet({
  visible,
  title,
  times,
  selected,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  times: string[];
  selected: string;
  onPick: (time: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const current = selected.slice(0, 5);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Tapping the dimmed area closes, which is what people try first. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />

      <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
        <View style={styles.head}>
          <ThemedText type="heading">{title}</ThemedText>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="smallBold" themeColor="primary">
              Cancel
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {times.map((time) => {
            const on = time === current;
            return (
              <Pressable
                key={time}
                onPress={() => onPick(time)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [
                  styles.option,
                  { borderColor: theme.border },
                  on && { backgroundColor: theme.primarySoft, borderColor: theme.primary },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <ThemedText type="bodyMedium" themeColor={on ? 'primary' : 'text'}>
                  {formatClock(time)}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { flexGrow: 0 },
  option: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
});
