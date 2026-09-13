import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "../Icons";
import { supabase } from "../lib/supabase";
import { colors, font, spacing } from "../theme";
import { Card, Muted, PrimaryButton, Screen } from "../ui";
import { FadeIn } from "../anim";
import type { EngineerJob } from "./EngineerHome";

interface SupplierRow {
  company_name: string;
  response_status: string;
}

const RESPONSE_COLORS: Record<string, string> = {
  available: colors.success,
  not_available: colors.danger,
  pending: colors.warning,
  no_response: colors.textFaint,
};

export default function JobDetail({
  job,
  onSelectTime,
  onCloseVisit,
  onBack,
}: {
  job: EngineerJob;
  onSelectTime: () => void;
  onCloseVisit: () => void;
  onBack: () => void;
}) {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);

  useEffect(() => {
    supabase
      .from("cycle_suppliers")
      .select("response_status, supplier:supplier_companies(company_name)")
      .eq("cycle_id", job.cycle_id)
      .then(({ data }) =>
        setSuppliers(
          (data ?? []).map((r: any) => ({
            company_name: r.supplier?.company_name ?? "Supplier",
            response_status: r.response_status,
          })),
        ),
      );
  }, [job.cycle_id]);

  const canSelectTime = ["AWAITING_ENGINEER_TIME", "RESCHEDULE_REQUIRED"].includes(job.cycle_status);
  const selectedTime = job.selected_time ? new Date(job.selected_time) : null;
  const canCloseVisit =
    job.cycle_status === "AWAITING_ENGINEER_CLOSE" ||
    (["CONFIRMED", "VISIT_PENDING"].includes(job.cycle_status) &&
      selectedTime !== null &&
      selectedTime.getTime() < Date.now());

  return (
    <Screen>
      <FadeIn>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Icon name="chevron-left" size={22} color={colors.onPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>PR {job.pr_reference}</Text>
            <Muted small>Cycle R{job.cycle_no}</Muted>
          </View>
          {job.priority === "urgent" && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentText}>URGENT</Text>
            </View>
          )}
        </View>
      </FadeIn>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <FadeIn delay={90} style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.sm }}>
          <Muted small>Description</Muted>
          <Text style={styles.body}>{job.description}</Text>
          <Muted small>Location</Muted>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="map-pin" size={14} color={colors.primary} />
            <Text style={styles.body}>{job.location}</Text>
          </View>
          {selectedTime && (
            <>
              <Muted small>Selected visit time</Muted>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="calendar" size={14} color={colors.primary} />
                <Text style={styles.time}>
                  {selectedTime.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </>
          )}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>Suppliers ({suppliers.length})</Text>
          {suppliers.map((s, i) => (
            <View key={i} style={styles.supplierRow}>
              <Text style={styles.body}>{s.company_name}</Text>
              <View style={[styles.dot, { backgroundColor: RESPONSE_COLORS[s.response_status] ?? colors.textFaint }]} />
            </View>
          ))}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Muted small>available</Muted>
            <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
            <Muted small>not available</Muted>
            <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
            <Muted small>pending</Muted>
          </View>
        </Card>

        {canSelectTime && (
          <PrimaryButton
            label={job.cycle_status === "RESCHEDULE_REQUIRED" ? "Pick a new time" : "Select visit time"}
            onPress={onSelectTime}
          />
        )}
        {canCloseVisit && <PrimaryButton label="Close visit" onPress={onCloseVisit} />}
        </FadeIn>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.text, fontSize: font.heading, fontWeight: "800" },
  urgentBadge: { backgroundColor: "#3B1519", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  urgentText: { color: colors.danger, fontSize: font.tiny, fontWeight: "800" },
  body: { color: colors.text, fontSize: font.body },
  time: { color: colors.text, fontSize: font.body, fontWeight: "700" },
  sectionTitle: { color: colors.text, fontSize: font.body, fontWeight: "800" },
  supplierRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
});
