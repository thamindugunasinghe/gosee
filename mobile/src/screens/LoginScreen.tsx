import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { supabase, toE164 } from "../lib/supabase";
import { colors, font, spacing } from "../theme";
import { FadeIn } from "../anim";
import { Input, Muted, PrimaryButton, Screen, Title } from "../ui";

export default function LoginScreen({ onOtpSent }: { onOtpSent: (phone: string) => void }) {
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendOtp() {
    setError(null);
    if (mobile.replace(/[^\d]/g, "").length < 9) {
      setError("Enter your registered mobile number");
      return;
    }
    setLoading(true);
    const phone = toE164(mobile);
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
    setLoading(false);
    if (error) {
      setError(
        error.message.includes("not found") || error.message.includes("Signups")
          ? "This number is not registered in Go See. Contact Procurement."
          : error.message,
      );
      return;
    }
    onOtpSent(phone);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <FadeIn style={styles.hero}>
          <View style={styles.logoTile}>
            <Image source={require("../../assets/mark.png")} style={styles.mark} resizeMode="contain" />
          </View>
          <Title>Go See</Title>
          <Muted>Site visits, scheduled the easy way</Muted>
        </FadeIn>

        <FadeIn delay={120} style={styles.form}>
          <Text style={styles.label}>Mobile number</Text>
          <Input
            value={mobile}
            onChangeText={setMobile}
            placeholder="07X XXX XXXX"
            keyboardType="phone-pad"
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <PrimaryButton label="Send login code" onPress={sendOtp} loading={loading} style={{ marginTop: spacing.md }} />
          <Muted small>
            You&apos;ll receive a one-time code by SMS. Only numbers registered by Procurement can sign in.
          </Muted>
        </FadeIn>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", gap: spacing.xl },
  hero: { alignItems: "center", gap: spacing.sm },
  logoTile: {
    width: 108,
    height: 108,
    borderRadius: 26,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  mark: { width: 82, height: 82 },
  form: { gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: font.small, fontWeight: "600" },
  error: { color: colors.danger, fontSize: font.small },
});
