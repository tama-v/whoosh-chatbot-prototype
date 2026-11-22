import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radius, shadows } from "../theme";

export type IoniconName = ComponentProps<typeof Ionicons>["name"];

type TextVariant = "display" | "title" | "heading" | "body" | "small" | "tiny" | "eyebrow";

const textVariants: Record<TextVariant, TextStyle> = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: fonts.heavy, color: colors.ink },
  title: { fontSize: 22, lineHeight: 28, fontWeight: fonts.bold, color: colors.ink },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: fonts.bold, color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, fontWeight: fonts.regular, color: colors.inkSoft },
  small: { fontSize: 13, lineHeight: 19, fontWeight: fonts.regular, color: colors.muted },
  tiny: { fontSize: 11, lineHeight: 15, fontWeight: fonts.medium, color: colors.muted },
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: fonts.bold,
    color: colors.maroon,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
};

export function AppText({
  variant = "body",
  style,
  children,
  numberOfLines,
  onPress,
}: {
  variant?: TextVariant;
  style?: TextStyle | TextStyle[];
  children: ReactNode;
  numberOfLines?: number;
  onPress?: () => void;
}) {
  return (
    <Text style={[textVariants[variant], style]} numberOfLines={numberOfLines} onPress={onPress}>
      {children}
    </Text>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  label,
  onPress,
  icon,
  loading,
  disabled,
  variant = "primary",
  full,
  compact,
}: {
  label: string;
  onPress: () => void;
  icon?: IoniconName;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  full?: boolean;
  compact?: boolean;
}) {
  const palette =
    variant === "primary"
      ? { bg: colors.maroon, border: colors.maroon, text: colors.white }
      : variant === "secondary"
        ? { bg: colors.goldSoft, border: colors.goldSoft, text: colors.maroonDark }
        : variant === "danger"
          ? { bg: colors.redSoft, border: colors.redSoft, text: colors.red }
          : { bg: "transparent", border: colors.lineStrong, text: colors.maroon };
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: inactive ? 0.55 : 1,
        },
        full && styles.fullWidth,
        compact && styles.buttonCompact,
        pressed && !inactive && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : icon ? (
        <Ionicons name={icon} size={compact ? 16 : 18} color={palette.text} />
      ) : null}
      <Text style={[styles.buttonLabel, { color: palette.text, fontSize: compact ? 13 : 15 }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color = colors.maroon,
  background = "rgba(255,255,255,0.16)",
  size = 20,
  label,
  disabled,
}: {
  icon: IoniconName;
  onPress: () => void;
  color?: string;
  background?: string;
  size?: number;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: background, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({
  label,
  color,
  background,
  icon,
}: {
  label: string;
  color?: string;
  background?: string;
  icon?: IoniconName;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: background ?? colors.creamDeep }]}>
      {icon ? <Ionicons name={icon} size={11} color={color ?? colors.muted} /> : null}
      <Text style={[styles.badgeText, { color: color ?? colors.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

type FieldProps = TextInputProps & {
  label?: string;
  icon?: IoniconName;
  error?: string | null;
  hint?: string;
  right?: ReactNode;
  containerStyle?: ViewStyle;
};

export function Field({
  label,
  icon,
  error,
  hint,
  right,
  containerStyle,
  style,
  multiline,
  ...props
}: FieldProps) {
  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.fieldBox, multiline && styles.fieldBoxMultiline, error ? styles.fieldBoxError : null]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.muted} style={styles.fieldIcon} /> : null}
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor="#AD9697"
          style={[styles.fieldInput, multiline && styles.fieldInputMultiline, style]}
        />
        {right}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  right,
  compact,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  compact?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[colors.maroonDeep, colors.maroonDark, colors.maroon]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 12 }, compact && styles.headerCompact]}
    >
      <View style={styles.headerGlowLarge} />
      <View style={styles.headerGlowSmall} />
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>{subtitle ? "WHOOSH AI · MANDIRI" : "WHOOSH AI"}</Text>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.headerActions}>{right}</View> : null}
      </View>
    </LinearGradient>
  );
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

export function LoadingDots({ color = colors.maroon, size = 7 }: { color?: string; size?: number }) {
  const values = useRef([new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)]).current;

  useEffect(() => {
    const animations = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(value, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0.35, duration: 320, useNativeDriver: true }),
          Animated.delay(280),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [values]);

  return (
    <View style={styles.dotsRow}>
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            marginRight: index === values.length - 1 ? 0 : 5,
            opacity: value,
            transform: [
              {
                translateY: value.interpolate({ inputRange: [0.35, 1], outputRange: [0, -3] }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonCompact: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonLabel: {
    fontWeight: fonts.bold,
    letterSpacing: 0.1,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    ...shadows.card,
  },
  badge: {
    height: 24,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: fonts.bold,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: fonts.bold,
    color: colors.inkSoft,
    marginBottom: 7,
    letterSpacing: 0.1,
  },
  fieldBox: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    paddingHorizontal: 14,
  },
  fieldBoxMultiline: {
    alignItems: "flex-start",
    minHeight: 112,
    paddingTop: 12,
    paddingBottom: 12,
  },
  fieldBoxError: {
    borderColor: colors.red,
    backgroundColor: colors.redSoft,
  },
  fieldIcon: {
    marginRight: 9,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: Platform.OS === "web" ? 10 : 0,
    minHeight: 46,
  },
  fieldInputMultiline: {
    minHeight: 86,
    textAlignVertical: "top",
    paddingTop: 0,
  },
  fieldError: {
    marginTop: 6,
    color: colors.red,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: fonts.medium,
  },
  fieldHint: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  headerCompact: {
    paddingBottom: 16,
  },
  headerGlowLarge: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.06)",
    right: -70,
    top: -100,
  },
  headerGlowSmall: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(216,162,74,0.16)",
    right: 42,
    bottom: -80,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14,
  },
  headerCopy: {
    flex: 1,
  },
  headerEyebrow: {
    color: "rgba(255,248,241,0.72)",
    fontSize: 10.5,
    fontWeight: fonts.bold,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: fonts.heavy,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    marginTop: 3,
    color: "rgba(255,248,241,0.76)",
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: fonts.medium,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    width: "100%",
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 12,
  },
});
