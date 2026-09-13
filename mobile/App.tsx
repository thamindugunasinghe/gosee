import React, { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { colors } from "./src/theme";
import { GhostButton, Muted, Screen } from "./src/ui";
import LoginScreen from "./src/screens/LoginScreen";
import OtpScreen from "./src/screens/OtpScreen";
import EngineerHome, { type EngineerJob } from "./src/screens/EngineerHome";
import JobDetail from "./src/screens/JobDetail";
import TimeScheduler from "./src/screens/TimeScheduler";
import CloseVisit from "./src/screens/CloseVisit";
import SupplierHome from "./src/screens/SupplierHome";

interface Profile {
  id: string;
  name: string;
  role: string;
}

type EngineerRoute =
  | { name: "inbox" }
  | { name: "detail"; job: EngineerJob }
  | { name: "scheduler"; job: EngineerJob }
  | { name: "close"; job: EngineerJob };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [route, setRoute] = useState<EngineerRoute>({ name: "inbox" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setOtpPhone(null);
        setRoute({ name: "inbox" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("id, name, role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setProfile(data as Profile));
  }, [session]);

  function signOut() {
    supabase.auth.signOut();
  }

  let content: React.ReactNode;

  if (booting) {
    content = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  } else if (!session) {
    content = otpPhone ? (
      <OtpScreen phone={otpPhone} onBack={() => setOtpPhone(null)} />
    ) : (
      <LoginScreen onOtpSent={setOtpPhone} />
    );
  } else if (!profile) {
    content = (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  } else if (profile.role === "engineer") {
    if (route.name === "detail") {
      content = (
        <JobDetail
          job={route.job}
          onBack={() => setRoute({ name: "inbox" })}
          onSelectTime={() => setRoute({ name: "scheduler", job: route.job })}
          onCloseVisit={() => setRoute({ name: "close", job: route.job })}
        />
      );
    } else if (route.name === "close") {
      content = (
        <CloseVisit
          job={route.job}
          onBack={() => setRoute({ name: "detail", job: route.job })}
          onDone={() => setRoute({ name: "inbox" })}
        />
      );
    } else if (route.name === "scheduler") {
      content = (
        <TimeScheduler
          job={route.job}
          onBack={() => setRoute({ name: "detail", job: route.job })}
          onDone={() => setRoute({ name: "inbox" })}
        />
      );
    } else {
      content = (
        <EngineerHome
          name={profile.name}
          onOpenJob={(job) => setRoute({ name: "detail", job })}
          onSignOut={signOut}
        />
      );
    }
  } else if (profile.role === "supplier_contact") {
    content = <SupplierHome name={profile.name} onSignOut={signOut} />;
  } else {
    content = (
      <Screen style={styles.center}>
        <Text style={styles.deniedTitle}>Use the web dashboard</Text>
        <Muted>This app is for Engineers and Suppliers. Procurement uses the browser dashboard.</Muted>
        <GhostButton label="Sign out" onPress={signOut} style={{ alignSelf: "stretch", marginTop: 16 }} />
      </Screen>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <SafeAreaView style={styles.safe}>{content}</SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  deniedTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
});
