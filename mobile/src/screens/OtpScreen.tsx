import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";
import { colors, font, radius, spacing } from "../theme";
import { GhostButton, Muted, PrimaryButton, Screen, Title } from "../ui";
import { FadeIn } from "../anim";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function OtpScreen({ phone, onBack }: { phone: string; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  async function verify(fullCode: string) {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: fullCode, type: "sms" });
    setLoading(false);
    if (error) {
      setError("Invalid or expired code. Try again.");
      setCode("");
    }
    // On success the auth listener in App.tsx routes to the right home screen.
  }

  function onChange(text: string) {
    const digits = text.replace(/[^\d]/g, "").slice(0, OTP_LENGTH);
    setCode(digits);
    if (digits.length === OTP_LENGTH) verify(digits);
  }

  async function resend() {
    setCooldown(RESEND_SECONDS);
    await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  }

  return (
    <Screen style={styles.screen}>
      <FadeIn style={{ gap: spacing.md }}>
      <Title>Enter code</Title>
      <Muted>
        We sent a {OTP_LENGTH}-digit code to {phone}
      </Muted>

      {/* Hidden input drives the six visual digit boxes */}
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={onChange}
        keyboardType="number-pad"
        autoFocus
        maxLength={OTP_LENGTH}
        style={styles.hiddenInput}
      />
      <View style={styles.boxes} onTouchEnd={() => inputRef.current?.focus()}>
        {Array.from({ length: OTP_LENGTH }).map((_, i) => {
          const filled = i < code.length;
          const isActive = i === code.length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                isActive && { borderColor: colors.primary },
                filled && { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Text style={styles.boxText}>{code[i] ?? ""}</Text>
            </View>
          );
        })}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <PrimaryButton
        label="Verify"
        onPress={() => verify(code)}
        disabled={code.length < OTP_LENGTH}
        loading={loading}
      />
      <GhostButton
        label={cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        onPress={() => cooldown === 0 && resend()}
      />
      <GhostButton label="Use a different number" onPress={onBack} />
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center", gap: spacing.md },
  hiddenInput: { position: "absolute", opacity: 0, height: 1, width: 1 },
  boxes: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginVertical: spacing.md },
  box: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  boxText: { color: colors.text, fontSize: 24, fontWeight: "700" },
  error: { color: colors.danger, fontSize: font.small, textAlign: "center" },
});
