import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Icon, { type IconName } from "../Icons";
import { supabase } from "../lib/supabase";
import { chipColor, colors, font, radius, spacing } from "../theme";
import { FadeIn, SkeletonCard } from "../anim";
import { Card, IconChip, Muted, Pill, Screen, Title } from "../ui";

export interface EngineerJob {
  id: string;
  pr_reference: string;
  description: string;
  location: string;
  priority: "normal" | "urgent";
  cycle_id: string;
  cycle_no: number;
  cycle_status: string;
  selected_time: string | null;
}

type FilterKey = "all" | "select_time" | "visit" | "close" | "done";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "select_time", label: "Select time" },
  { key: "visit", label: "Visit pending" },
  { key: "close", label: "Close visit" },
  { key: "done", label: "Done" },
];

const ACTION_META: Record<string, { icon: IconName; hint: string }> = {
  AWAITING_ENGINEER_TIME: { icon: "calendar", hint: "Select one visit time" },
  RESCHEDULE_REQUIRED: { icon: "refresh-cw", hint: "Pick a new time — not enough suppliers" },
  AWAITING_SUPPLIER_RESPONSES: { icon: "hourglass", hint: "Waiting for supplier responses" },
  OVERRIDE_REQUIRED: { icon: "hourglass", hint: "Waiting for Procurement decision" },
  CONFIRMED: { icon: "check-circle", hint: "Visit confirmed" },
  VISIT_PENDING: { icon: "map-pin", hint: "Visit confirmed — see details" },
  AWAITING_ENGINEER_CLOSE: { icon: "edit", hint: "Mark attendance and close the visit" },
  AWAITING_PROCUREMENT_CLOSE: { icon: "clock", hint: "Closed — with Procurement now" },
  CLOSED: { icon: "flag", hint: "Completed" },
  RECIRCULATED: { icon: "rotate-cw", hint: "Recirculated" },
  CANCELLED: { icon: "ban", hint: "Cancelled" },
};

function bucket(status: string): FilterKey {
  if (status === "AWAITING_ENGINEER_TIME" || status === "RESCHEDULE_REQUIRED") return "select_time";
  if (["AWAITING_SUPPLIER_RESPONSES", "OVERRIDE_REQUIRED", "CONFIRMED", "VISIT_PENDING"].includes(status)) return "visit";
  if (status === "AWAITING_ENGINEER_CLOSE") return "close";
  return "done";
}

export default function EngineerHome({
  name,
  onOpenJob,
  onSignOut,
}: {
  name: string;
  onOpenJob: (job: EngineerJob) => void;
  onSignOut: () => void;
}) {
  const [jobs, setJobs] = useState<EngineerJob[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("jobs")
      .select("id, pr_reference, description, location, priority, cycles:job_cycles(id, cycle_no, status, selected_time)")
      .order("created_at", { ascending: false });
    const rows: EngineerJob[] = (data ?? []).map((j: any) => {
      const cycle = [...j.cycles].sort((a: any, b: any) => b.cycle_no - a.cycle_no)[0] ?? {};
      return {
        id: j.id,
        pr_reference: j.pr_reference,
        description: j.description,
        location: j.location,
        priority: j.priority,
        cycle_id: cycle.id,
        cycle_no: cycle.cycle_no ?? 0,
        cycle_status: cycle.status ?? "DRAFT",
        selected_time: cycle.selected_time ?? null,
      };
    });
    setJobs(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = jobs.filter((j) => filter === "all" || bucket(j.cycle_status) === filter);
  const actionCount = jobs.filter((j) => ["select_time", "close"].includes(bucket(j.cycle_status))).length;

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Muted small>Good day</Muted>
          <Title>{name.split(" ")[0]}</Title>
        </View>
        <Pressable onPress={onSignOut} style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0)}</Text>
        </Pressable>
      </View>

      {actionCount > 0 && (
        <Card style={styles.banner}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="zap" size={16} color={colors.warning} />
            <Text style={styles.bannerText}>
              {actionCount} job{actionCount > 1 ? "s" : ""} need{actionCount === 1 ? "s" : ""} your action
            </Text>
          </View>
        </Card>
      )}

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pill key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(j) => j.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.textMuted} />}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: spacing.sm }}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </View>
          ) : (
            <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
              <Icon name="party" size={34} color={colors.primary} />
              <Muted>No jobs here right now</Muted>
            </Card>
          )
        }
        renderItem={({ item, index }) => {
          const meta = ACTION_META[item.cycle_status] ?? { icon: "file-text" as IconName, hint: item.cycle_status };
          const needsAction = ["select_time", "close"].includes(bucket(item.cycle_status));
          return (
            <FadeIn delay={Math.min(index * 55, 330)}>
              <Pressable onPress={() => onOpenJob(item)}>
                {({ pressed }) => (
                  <Card
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      opacity: pressed ? 0.85 : 1,
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                      borderWidth: 1.5,
                      borderColor: needsAction ? colors.success : "transparent",
                    }}
                  >
                    <IconChip color={chipColor(item.id)} icon={meta.icon} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.cardTitle}>
                        PR {item.pr_reference}
                        {item.priority === "urgent" && <Text style={{ color: colors.danger }}>  {"\u2022"} URGENT</Text>}
                      </Text>
                      <Muted small>{meta.hint}</Muted>
                    </View>
                    <Icon name="chevron-right" size={22} color={colors.textFaint} />
                  </Card>
                )}
              </Pressable>
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
  banner: { backgroundColor: "#1E2A44", marginBottom: spacing.md },
  bannerText: { color: colors.text, fontWeight: "600", fontSize: font.small },
  filters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md, flexWrap: "wrap" },
  cardTitle: { color: colors.text, fontSize: font.body, fontWeight: "700" },
});
