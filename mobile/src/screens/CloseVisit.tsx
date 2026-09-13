import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "../Icons";
import { supabase } from "../lib/supabase";
import { colors, font, radius, spacing } from "../theme";
import { Card, Muted, PrimaryButton, Screen } from "../ui";
import { FadeIn } from "../anim";
import type { EngineerJob } from "./EngineerHome";

interface SupplierRow {
  supplier_id: string;
  company_name: string;
  attended: boolean;
}

export default function CloseVisit({
  job,
  onDone,
  onBack,
}: {
  job: EngineerJob;
  onDone: () => void;
  onBack: () => void;
}) {
  const [visitHappened, setVisitHappened] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from("cycle_suppliers")
      .select("supplier_id, supplier:supplier_companies(company_name)")
      .eq("cycle_id", job.cycle_id)
      .then(({ data }) =>
        setSuppliers(
          (data ?? []).map((r: any) => ({
            supplier_id: r.supplier_id,
            company_name: r.supplier?.company_name ?? "Supplier",
            attended: false,
          })),
        ),
      );
  }, [job.cycle_id]);

  function toggle(id: string) {
    setSuppliers((rows) => rows.map((r) => (r.supplier_id === id ? { ...r, attended: !r.attended } : r)));
  }

  async function submit() {
    const attendedIds = suppliers.filter((s) => s.attended).map((s) => s.supplier_id);
    if (visitHappened && attendedIds.length === 0) {
      Alert.alert("No attendance marked", "Mark at least one supplier as attended, or set the visit as not happened.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("rpc_close_visit", {
      p_cycle_id: job.cycle_id,
      p_visit_happened: visitHappened,
      p_attended_supplier_ids: attendedIds,
    });
    if (error) {
      setSubmitting(false);
      Alert.alert("Could not close visit", error.message);
      return;
    }
    supabase.functions.invoke("send-sms", { body: {} }).catch(() => {});
    setSubmitting(false);
    Alert.alert("Visit closed", "Procurement has been notified for final closure.", [
      { text: "OK", onPress: onDone },
    ]);
  }

  const visitDate = job.selected_time
    ? new Date(job.selected_time).toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <Screen>
      <FadeIn>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Icon name="chevron-left" size={22} color={colors.onPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Close visit</Text>
            <Muted small>PR {job.pr_reference} {"·"} {visitDate}</Muted>
          </View>
        </View>
      </FadeIn>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <FadeIn delay={90} style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.sm }}>
          <Text style={styles.sectionTitle}>Did the visit happen?</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Pressable
              onPress={() => setVisitHappened(true)}
              style={[styles.choice, visitHappened && styles.choiceActive]}
            >
              <Icon name="check" size={15} color={visitHappened ? colors.onPrimary : colors.textMuted} />
              <Text style={[styles.choiceText, visitHappened && { color: colors.onPrimary }]}>Yes</Text>
            </Pressable>
            <Pressable
              onPress={() => setVisitHappened(false)}
              style={[styles.choice, !visitHappened && styles.choiceDanger]}
            >
              <Icon name="x" size={15} color={!visitHappened ? colors.onPrimary : colors.textMuted} />
              <Text style={[styles.choiceText, !visitHappened && { color: colors.onPrimary }]}>No</Text>
            </Pressable>
          </View>
        </Card>

        {visitHappened && (
          <Card style={{ gap: spacing.sm }}>
            <Text style={styles.sectionTitle}>Who attended?</Text>
            <Muted small>Tap each supplier that was present at the site.</Muted>
            {suppliers.map((s) => (
              <Pressable
                key={s.supplier_id}
                onPress={() => toggle(s.supplier_id)}
                style={[styles.supplierRow, s.attended && styles.supplierRowActive]}
              >
                <Text style={[styles.supplierName, s.attended && { color: colors.text, fontWeight: "700" }]}>
                  {s.company_name}
                </Text>
                <View style={[styles.checkbox, s.attended && styles.checkboxActive]}>
                  {s.attended && <Icon name="check" size={13} color={colors.onPrimary} />}
                </View>
              </Pressable>
            ))}
            <Muted small>
              Attended suppliers cannot be re-selected if this job is recirculated later.
            </Muted>
          </Card>
        )}

        <PrimaryButton
          label={visitHappened ? "Close visit & notify Procurement" : "Report visit did not happen"}
          onPress={submit}
          loading={submitting}
        />
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
  sectionTitle: { color: colors.text, fontSize: font.body, fontWeight: "800" },
  choice: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceActive: { backgroundColor: colors.success },
  choiceDanger: { backgroundColor: colors.danger },
  choiceText: { color: colors.textMuted, fontSize: font.body, fontWeight: "700" },
  supplierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  supplierRowActive: { borderColor: colors.success, backgroundColor: "#132A1C" },
  supplierName: { color: colors.textMuted, fontSize: font.body },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.success, borderColor: colors.success },
});
