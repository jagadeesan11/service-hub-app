import { useMemo, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const KNOB = 52;
/** How far along the track counts as "meant it". */
const COMMIT_AT = 0.82;

/**
 * Slide to confirm.
 *
 * Assigning a job commits a person and a bay to it and tells the customer, so
 * it gets a gesture rather than a button — the same reason a phone asks you to
 * slide to power off. A stray tap on a phone in a workshop should not reassign
 * someone's morning.
 *
 * PanResponder rather than a gesture library: it is built into React Native,
 * and this is one axis with no competing gestures around it.
 */
export function SlideToConfirm({
  label,
  confirmingLabel,
  onConfirm,
  disabled,
}: {
  label: string;
  confirmingLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const [past, setPast] = useState(false);

  // Held in a memo rather than a ref: the value is read while rendering, and a
  // ref read there is a render-phase side effect.
  const x = useMemo(() => new Animated.Value(0), []);

  const max = Math.max(trackWidth - KNOB - 8, 1);

  const responder = useMemo(() => {
    // How far along a drag is, derived from the gesture every time rather than
    // remembered between callbacks. The release event carries `dx` just as the
    // move event does, so there is no progress to store — no ref, no mutable
    // closure, and nothing that can fall out of step with the finger.
    const progressOf = (dx: number) => Math.max(0, Math.min(max, dx)) / max;

    const settle = () => {
      Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start();
      setPast(false);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        x.setValue(Math.max(0, Math.min(max, gesture.dx)));
        setPast(progressOf(gesture.dx) > COMMIT_AT);
      },
      onPanResponderRelease: (_, gesture) => {
        if (progressOf(gesture.dx) <= COMMIT_AT) {
          settle();
          return;
        }
        // Settle at the end before firing, so the control looks committed
        // rather than snapping back under a screen that is changing.
        Animated.timing(x, { toValue: max, duration: 90, useNativeDriver: false }).start(() =>
          onConfirm(),
        );
      },
      onPanResponderTerminate: settle,
    });
  }, [max, onConfirm, x]);

  function measure(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={measure}
      style={[
        styles.track,
        {
          backgroundColor: disabled ? theme.surfaceSunk : theme.primarySoft,
          borderColor: disabled ? theme.border : theme.primary,
        },
      ]}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
    >
      <ThemedText
        type="smallBold"
        themeColor={disabled ? 'textMuted' : 'primary'}
        style={styles.label}
        numberOfLines={1}
      >
        {past ? confirmingLabel : label}
      </ThemedText>

      {!disabled && (
        <Animated.View
          {...responder.panHandlers}
          style={[styles.knob, { backgroundColor: theme.primary, transform: [{ translateX: x }] }]}
        >
          <ThemedText type="smallBold" style={{ color: theme.primaryText }}>
            ›
          </ThemedText>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: KNOB + 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  label: { textAlign: 'center', paddingHorizontal: KNOB },
  knob: {
    position: 'absolute',
    left: 4,
    width: KNOB,
    height: KNOB,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
