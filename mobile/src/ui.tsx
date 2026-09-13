// Shared UI building blocks for the dark card design.
import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Icon, { type IconName } from "./Icons";
import { colors, font, radius, spacing } from "./theme";

/** Wraps a Pressable so it springs down slightly while pressed. */
function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return { scale, onPressIn: () => to(0.96), onPressOut: () => to(1) };
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return <Text style={[styles.muted, small && { fontSize: font.small }]}>{children}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const press = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && { backgroundColor: colors.primaryPressed },
          (disabled || loading) && { opacity: 0.5 },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.primaryBtnText}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function GhostButton({ label, onPress, style }: { label: string; onPress: () => void; style?: ViewStyle }) {
  const press = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale: press.scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.7 }, style]}
      >
        <Text style={styles.ghostBtnText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textFaint} {...props} style={[styles.input, props.style]} />;
}

export function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pill, active ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt }]}
    >
      <Text style={[styles.pillText, active ? { color: colors.onPrimary } : { color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

export function IconChip({ color, icon }: { color: string; icon: IconName }) {
  return (
    <View style={[styles.iconChip, { backgroundColor: color }]}>
      <Icon name={icon} size={18} color={colors.onPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: "800",
  },
  muted: {
    color: colors.textMuted,
    fontSize: font.body,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontSize: font.body,
    fontWeight: "700",
  },
  ghostBtn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    alignItems: "center",
  },
  ghostBtnText: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: font.body,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillText: {
    fontSize: font.small,
    fontWeight: "700",
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
