import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

/**
 * Bridges the native splash screen to the first rendered frame.
 *
 * The native splash disappears the moment React mounts, which on a cold start
 * leaves a bare background flashing before auth state resolves. This overlay
 * paints the same artwork as the native splash, hides the native one, then
 * fades itself out so the transition reads as one continuous screen.
 *
 * Replaces the Expo template's animated logo, which rendered Expo's own
 * branding and referenced template artwork removed during the Nexora rebrand.
 */
const BRAND_GROUND = '#0A1A20';

export function AnimatedSplashOverlay() {
  // Lazy useState rather than useRef().current: the value must be created
  // once, and reading a ref during render is flagged as unsafe by the React
  // Compiler lint rules.
  const [opacity] = useState(() => new Animated.Value(1));
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;

    SplashScreen.hideAsync()
      .catch(() => {
        // Already hidden, or unavailable on this platform — either way the
        // overlay should still fade out rather than stay stuck on screen.
      })
      .finally(() => {
        if (cancelled) return;
        Animated.timing(opacity, {
          toValue: 0,
          duration: 350,
          delay: 120,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && !cancelled) setHidden(true);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [opacity]);

  if (hidden) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <Image
        source={require('@/assets/images/splash-icon.png')}
        style={styles.mark}
        contentFit="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BRAND_GROUND,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  mark: { width: 140, height: 140 },
});
