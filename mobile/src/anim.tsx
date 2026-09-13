// Lightweight animations using React Native's built-in Animated API — no extra
// native deps, so it runs safely in Expo Go.
import React, { useEffect, useRef } from "react";
import { Animated, Easing, type ViewStyle } from "react-native";
import { colors, radius as radii } from "./theme";

/** Fades + slides its children up on mount. `delay` staggers list items. */
export function FadeIn({
  children,
  delay = 0,
  offset = 14,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  style?: ViewStyle | ViewStyle[];
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [t, delay]);

  return (
    <Animated.View
      style={[
        style as ViewStyle,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Pulsing placeholder block shown while data loads. */
export function Skeleton({
  height,
  width = "100%",
  radius = radii.md,
  style,
}: {
  height: number;
  width?: number | string;
  radius?: number;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { height, width: width as number, borderRadius: radius, backgroundColor: colors.surfaceAlt, opacity: pulse },
        style,
      ]}
    />
  );
}

/** A card-shaped skeleton row for list loading states. */
export function SkeletonCard() {
  return (
    <Animated.View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Skeleton height={40} width={40} radius={12} />
      <Animated.View style={{ flex: 1, gap: 8 }}>
        <Skeleton height={14} width="55%" radius={7} />
        <Skeleton height={11} width="80%" radius={6} />
      </Animated.View>
    </Animated.View>
  );
}
