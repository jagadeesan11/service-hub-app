import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CANNED_REPLIES, starsOf } from '@/lib/feedback-board';

/**
 * Writing back to a customer who left a review.
 *
 * The suggestions fill the box rather than send: a complaint answered in
 * visibly canned words is worse than a slow reply, so every one of them has to
 * pass under the owner's eye before it goes.
 */
export function ReplySheet({
  visible,
  customer,
  rating,
  service,
  comment,
  busy,
  onSend,
  onClose,
}: {
  visible: boolean;
  customer: string;
  rating: number;
  service: string;
  comment: string | null;
  busy?: boolean;
  onSend: (reply: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState('');

  const canSend = draft.trim().length > 0 && !busy;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />

        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />

          <View style={styles.head}>
            <ThemedText type="heading">Reply to {customer.split(' ')[0]}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {starsOf(rating)} · {service}
            </ThemedText>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
            {comment ? (
              <View style={[styles.quote, { backgroundColor: theme.surfaceSunk }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {comment}
                </ThemedText>
              </View>
            ) : null}

            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write your reply…"
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              maxLength={1000}
              accessibilityLabel="Your reply"
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            />

            <ThemedText type="caption" themeColor="textMuted">
              Suggestions — tap to fill, then edit
            </ThemedText>

            {CANNED_REPLIES.map((text) => (
              <Pressable
                key={text}
                onPress={() => setDraft(text)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.canned,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <ThemedText type="small" themeColor="textSecondary">
                  {text}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label={busy ? 'Sending…' : 'Send reply'}
              loading={busy}
              disabled={!canSend}
              onPress={() => onSend(draft)}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
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
    maxHeight: '86%',
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
  scroll: { marginTop: Spacing.three },
  scrollInner: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  quote: { borderRadius: Radius.md, padding: Spacing.three },
  input: {
    minHeight: 104,
    textAlignVertical: 'top',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
    fontSize: 15,
  },
  canned: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  footer: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
});
