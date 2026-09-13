import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Icon from "../Icons";
import { supabase } from "../lib/supabase";
import { chipColor, colors, font, radius, spacing } from "../theme";
import { FadeIn, SkeletonCard } from "../anim";
import { Card, IconChip, Muted, Screen, Title } from "../ui";

interface Invitation {
  id: string;
  cycle_id: string;
  response_status: string;
  cycle_status: string;
  selected_time: string | null;
  response_cutoff: string | null;
  pr_reference: string;
  description: string;
  location: string;
}

function fmt(dt: string | null) {
  if (!dt) return "\u2014";
  return new Date(dt).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupplierHome({
  name,
  onSignOut,
}: {
  name: string;
  onSignOut: () => void;
}) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("cycle_suppliers")
      .select(
        "id, cycle_id, response_status, cycle:job_cycles(status, selected_time, response_cutoff, job:jobs(pr_reference, description, location))",
      )
      .not("invited_at", "is", null)
      .order("invited_at", { ascending: false });
    setInvitations(
      (data ?? []).map((r: any) => ({
        id: r.id,
        cycle_id: r.cycle_id,
        response_status: r.response_status,
        cycle_status: r.cycle?.status ?? "",
        selected_time: r.cycle?.selected_time ?? null,
        response_cutoff: r.cycle?.response_cutoff ?? null,
        pr_reference: r.cycle?.job?.pr_reference ?? "",
        description: r.cycle?.job?.description ?? "",
        location: r.cycle?.job?.location ?? "",
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(inv: Invitation, available: boolean) {
    setBusy(inv.id);
    const { data, error } = await supabase.rpc("rpc_supplier_respond", {
      p_cycle_id: inv.cycle_id,
      p_available: available,
    });
    setBusy(null);
    if (error) {
      Alert.alert("Could not save response", error.message);
      return;
    }
    supabase.functions.invoke("send-sms", { body: {} }).catch(() => {});
    if ((data as any)?.cycle_status === "CONFIRMED") {
      Alert.alert("Visit confirmed", "The visit time is now locked. Attendance is required.");
    }
    load();
  }

  const pending = invitations.filter(
    (i) => i.response_status === "pending" && ["AWAITING_SUPPLIER_RESPONSES", "CONFIRMED", "VISIT_PENDING"].includes(i.cycle_status),
  );
  const answered = invitations.filter((i) => !pending.includes(i));

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Muted small>Supplier portal</Muted>
          <Title>{name.split(" ")[0]}</Title>
        </View>
        <Pressable onPress={onSignOut} style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0)}</Text>
        </Pressable>
      </View>

      <FlatList
        data={[...pending, ...answered]}
        keyExtractor={(i) => i.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.textMuted}
          />
        }
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: spacing.sm }}>
              {[0, 1, 2].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </View>
          ) : (
            <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <Icon name="inbox" size={34} color={colors.textMuted} />
              <Muted>No invitations yet</Muted>
            </Card>
          )
        }
        renderItem={({ item, index }) => {
          const needsResponse = pending.includes(item);
          const confirmed = ["CONFIRMED", "VISIT_PENDING"].includes(item.cycle_status);
          return (
            <FadeIn delay={Math.min(index * 55, 300)}>
            <Card
              style={{
                gap: spacing.sm,
                borderWidth: 1.5,
                borderColor: needsResponse ? colors.warning : "transparent",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconChip color={chipColor(item.cycle_id)} icon={confirmed ? "check-circle" : "mail"} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>PR {item.pr_reference}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Icon name="map-pin" size={12} color={colors.textMuted} />
                    <Muted small>{item.location}</Muted>
                  </View>
                </View>
                {confirmed && (
                  <View style={styles.confirmedBadge}>
                    <Text style={styles.confirmedText}>CONFIRMED</Text>
                  </View>
                )}
              </View>

              <View style={styles.timeRow}>
                <Muted small>Visit time</Muted>
                <Text style={styles.timeText}>{fmt(item.selected_time)}</Text>
              </View>

              {needsResponse ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable
                    disabled={busy === item.id}
                    onPress={() => respond(item, true)}
                    style={[styles.respondBtn, { backgroundColor: colors.success }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Icon name="check" size={14} color={colors.onPrimary} />
                      <Text style={styles.respondText}>Available</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    disabled={busy === item.id}
                    onPress={() => respond(item, false)}
                    style={[styles.respondBtn, { backgroundColor: colors.surfaceAlt }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Icon name="x" size={14} color={colors.textMuted} />
                      <Text style={[styles.respondText, { color: colors.textMuted }]}>Not available</Text>
                    </View>
                  </Pressable>
                </View>
              ) : (
                <Muted small>
                  Your response:{" "}
                  {item.response_status === "available"
                    ? "Available"
                    : item.response_status === "not_available"
                      ? "Not available"
                      : "\u2014"}
                </Muted>
              )}
            </Card>
            </FadeIn>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.text, fontWeight: "800", fontSize: font.body },
  cardTitle: { color: colors.text, fontSize: font.body, fontWeight: "700" },
  confirmedBadge: { backgroundColor: "#132A1C", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  confirmedText: { color: colors.success, fontSize: font.tiny, fontWeight: "800" },
  timeRow: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.sm, gap: 2 },
  timeText: { color: colors.text, fontWeight: "800", fontSize: font.body },
  respondBtn: { flex: 1, borderRadius: radius.pill, paddingVertical: 12, alignItems: "center" },
  respondText: { color: colors.onPrimary, fontWeight: "800", fontSize: font.small },
});
