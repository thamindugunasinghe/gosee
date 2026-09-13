import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "../Icons";
import { supabase } from "../lib/supabase";
import { colors, font, radius, spacing } from "../theme";
import { Card, Muted, PrimaryButton, Screen } from "../ui";
import { FadeIn } from "../anim";
import type { EngineerJob } from "./EngineerHome";

interface SchedulingConfig {
  window_hours: number;
  lead_time_hours: number;
  slot_minutes: number;
  working_days: number[];
  working_hours_start: string;
  working_hours_end: string;
  cutoff_hours: number;
}

interface Suggestion {
  suggested_time: string;
  kind: "confirmed" | "pending";
  supplier_count: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtTime(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${m} ${ampm}`;
}

function fmtHour(h: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1} ${ampm}`;
}

/** Check if a JS day number (0=Sun..6=Sat) is a weekend (Sat=6 or Sun=0). */
function isWeekend(jsDay: number): boolean {
  return jsDay === 0 || jsDay === 6;
}

const SLOT_ROW_HEIGHT = 52;
const TIMELINE_LEFT = 72;

export default function TimeScheduler({
  job,
  onDone,
  onBack,
}: {
  job: EngineerJob;
  onDone: () => void;
  onBack: () => void;
}) {
  const [cfg, setCfg] = useState<SchedulingConfig | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [selected, setSelected] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.rpc("rpc_scheduling_config").then(({ data }) => data && setCfg(data as SchedulingConfig));
    supabase
      .rpc("rpc_cycle_suggestions", { p_cycle_id: job.cycle_id })
      .then(({ data }) => data && setSuggestions(data as Suggestion[]));
  }, [job.cycle_id]);

  // Build the selectable days: from earliest valid slot to the end of the window.
  const days = useMemo(() => {
    if (!cfg) return [];
    const start = new Date(Date.now() + cfg.lead_time_hours * 3600_000);
    const end = new Date(Date.now() + cfg.window_hours * 3600_000);
    const list: Date[] = [];
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    while (d <= end) {
      list.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return list;
  }, [cfg]);

  // Auto-select the first non-weekend day
  useEffect(() => {
    if (days.length > 0) {
      const firstWorkday = days.findIndex((d) => !isWeekend(d.getDay()));
      if (firstWorkday >= 0 && isWeekend(days[dayIndex]?.getDay())) {
        setDayIndex(firstWorkday);
      }
    }
  }, [days]);

  const activeDay = days[Math.min(dayIndex, days.length - 1)] ?? null;
  const activeDayIsWeekend = activeDay ? isWeekend(activeDay.getDay()) : false;

  // Slots for the active day, marked valid/invalid against every rule.
  const slots = useMemo(() => {
    if (!cfg || days.length === 0 || activeDayIsWeekend) return [];
    const day = days[Math.min(dayIndex, days.length - 1)];
    const [sh, sm] = cfg.working_hours_start.split(":").map(Number);
    const [eh, em] = cfg.working_hours_end.split(":").map(Number);
    const leadEdge = Date.now() + cfg.lead_time_hours * 3600_000;
    const windowEdge = Date.now() + cfg.window_hours * 3600_000;
    const isoDow = day.getDay() === 0 ? 7 : day.getDay();
    const workingDay = cfg.working_days.includes(isoDow);

    const out: { time: Date; valid: boolean; isHourMark: boolean }[] = [];
    const t = new Date(day);
    t.setHours(sh, sm, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(eh, em, 0, 0);
    while (t < dayEnd) {
      const ts = t.getTime();
      out.push({
        time: new Date(t),
        valid: workingDay && ts >= leadEdge && ts <= windowEdge,
        isHourMark: t.getMinutes() === 0,
      });
      t.setMinutes(t.getMinutes() + cfg.slot_minutes);
    }
    return out;
  }, [cfg, days, dayIndex, activeDayIsWeekend]);

  const suggestionTimes = useMemo(
    () => new Map(suggestions.map((s) => [new Date(s.suggested_time).getTime(), s])),
    [suggestions],
  );

  async function confirm() {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("rpc_select_time", {
      p_cycle_id: job.cycle_id,
      p_time: selected.toISOString(),
    });
    if (error) {
      setSubmitting(false);
      Alert.alert("Could not select time", error.message);
      return;
    }
    // Deliver the queued supplier invitation SMSes right away.
    supabase.functions.invoke("send-sms", { body: {} }).catch(() => {});
    setSubmitting(false);
    Alert.alert("Time selected", "All selected suppliers have been invited by SMS.", [
      { text: "OK", onPress: onDone },
    ]);
  }

  return (
    <Screen>
      <FadeIn>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Icon name="chevron-left" size={22} color={colors.onPrimary} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Select visit time</Text>
            <Muted small>PR {job.pr_reference} {"\u00B7"} one time, next {cfg?.window_hours ?? 72}h</Muted>
          </View>
        </View>
      </FadeIn>

      {suggestions.length > 0 && (
        <Card style={styles.suggestCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="lightbulb" size={14} color={colors.warning} />
            <Text style={styles.suggestTitle}>Suppliers already on site</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {suggestions.map((s, i) => {
              const d = new Date(s.suggested_time);
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    const di = days.findIndex((day) => day.toDateString() === d.toDateString());
                    if (di >= 0) setDayIndex(di);
                  }}
                  style={[styles.suggestChip, s.kind === "confirmed" ? styles.suggestConfirmed : styles.suggestPending]}
                >
                  <Text style={styles.suggestChipText}>
                    {DAY_NAMES[d.getDay()]} {fmtTime(d)} {"\u00B7"} {s.supplier_count} supplier{s.supplier_count > 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.suggestKind}>{s.kind === "confirmed" ? "confirmed visit" : "pending visit"}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>
      )}

      {/* Day selector */}
      <View style={styles.dayRow}>
        {days.map((d, i) => {
          const active = i === dayIndex;
          const weekend = isWeekend(d.getDay());
          return (
            <Pressable
              key={i}
              onPress={() => {
                setDayIndex(i);
                setSelected(null);
              }}
              style={[
                styles.dayCard,
                active && !weekend && styles.dayCardActive,
                active && weekend && styles.dayCardWeekendActive,
                weekend && !active && styles.dayCardWeekend,
              ]}
            >
              <Text style={[
                styles.dayName,
                active && !weekend && { color: colors.onPrimary },
                weekend && { color: colors.textFaint },
              ]}>{DAY_NAMES[d.getDay()]}</Text>
              <Text style={[
                styles.dayNum,
                active && !weekend && { color: colors.onPrimary },
                weekend && !active && { color: colors.textFaint },
                weekend && active && { color: colors.textMuted },
              ]}>{d.getDate()}</Text>
              <Text style={[
                styles.dayMonth,
                active && !weekend && { color: "#DBEAFE" },
                weekend && { color: colors.textFaint },
              ]}>{MONTHS[d.getMonth()]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Weekend message or Timeline */}
      {activeDayIsWeekend ? (
        <View style={styles.weekendBlock}>
          <Icon name="ban" size={48} color={colors.textFaint} />
          <Text style={styles.weekendTitle}>No visits on weekends</Text>
          <Muted small>Select a working day to schedule a visit</Muted>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.timelineContainer}>
          {slots.map(({ time, valid, isHourMark }, idx) => {
            const isSelected = selected?.getTime() === time.getTime();
            const suggestion = suggestionTimes.get(time.getTime());
            const isLast = idx === slots.length - 1;

            return (
              <View key={time.getTime()} style={styles.timelineRow}>
                {/* Time label column */}
                <View style={styles.timeLabelCol}>
                  <Text style={[
                    styles.timeLabel,
                    !valid && { color: colors.textFaint },
                    isSelected && { color: colors.primary, fontWeight: "800" },
                  ]}>
                    {fmtTime(time)}
                  </Text>
                </View>

                {/* Timeline track */}
                <View style={styles.trackCol}>
                  {/* Vertical line */}
                  <View style={[
                    styles.trackLine,
                    idx === 0 && { top: "50%" },
                    isLast && { bottom: "50%", height: "50%" },
                  ]} />
                  {/* Node dot */}
                  <View style={[
                    styles.trackDot,
                    isSelected && { backgroundColor: colors.primary, width: 12, height: 12, borderRadius: 6 },
                    suggestion && !isSelected && { backgroundColor: colors.success },
                    !valid && !isSelected && { backgroundColor: colors.textFaint, opacity: 0.4 },
                  ]} />
                </View>

                {/* Slot bar */}
                <Pressable
                  disabled={!valid}
                  onPress={() => setSelected(time)}
                  style={[
                    styles.slotBar,
                    !valid && styles.slotBarDisabled,
                    suggestion && valid && styles.slotBarSuggested,
                    isSelected && styles.slotBarSelected,
                  ]}
                >
                  <Text style={[
                    styles.slotBarText,
                    !valid && { color: colors.textFaint },
                    isSelected && { color: colors.onPrimary, fontWeight: "800" },
                  ]}>
                    {fmtTime(time)}
                  </Text>
                  {suggestion && !isSelected && (
                    <View style={styles.suggestionBadge}>
                      <Text style={styles.suggestionBadgeText}>
                        {suggestion.supplier_count} sup
                      </Text>
                    </View>
                  )}
                  {isSelected && (
                    <Icon name="check" size={16} color={colors.onPrimary} />
                  )}
                </Pressable>
              </View>
            );
          })}
          {slots.length === 0 && <Muted>Loading timeline...</Muted>}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        {selected ? (
          <Card style={styles.footerCard}>
            <View style={{ flex: 1 }}>
              <Muted small>Visit time</Muted>
              <Text style={styles.footerTime}>
                {DAY_NAMES[selected.getDay()]} {selected.getDate()} {MONTHS[selected.getMonth()]} {"\u00B7"} {fmtTime(selected)}
              </Text>
            </View>
            <PrimaryButton label="Confirm" onPress={confirm} loading={submitting} style={{ paddingHorizontal: 28 }} />
          </Card>
        ) : (
          <Card style={styles.footerCard}>
            <Muted small>Pick a highlighted slot {"\u2014"} suppliers respond Available / Not available</Muted>
          </Card>
        )}
      </View>
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

  suggestCard: { marginBottom: spacing.md, gap: spacing.sm },
  suggestTitle: { color: colors.text, fontWeight: "700", fontSize: font.small },
  suggestChip: { borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5 },
  suggestConfirmed: { borderColor: colors.success, backgroundColor: "#132A1C" },
  suggestPending: { borderColor: colors.warning, backgroundColor: "#2A2213" },
  suggestChipText: { color: colors.text, fontSize: font.small, fontWeight: "700" },
  suggestKind: { color: colors.textMuted, fontSize: font.tiny },

  dayRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  dayCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: 2,
  },
  dayCardActive: { backgroundColor: colors.primary },
  dayCardWeekend: { backgroundColor: colors.surface, opacity: 0.6 },
  dayCardWeekendActive: { backgroundColor: colors.surfaceAlt, borderWidth: 1.5, borderColor: colors.border },
  dayName: { color: colors.textMuted, fontSize: font.small, fontWeight: "700" },
  dayNum: { color: colors.text, fontSize: 24, fontWeight: "800" },
  dayMonth: { color: colors.textFaint, fontSize: font.tiny },

  // Weekend block
  weekendBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    paddingBottom: 80,
  },
  weekendTitle: {
    color: colors.textMuted,
    fontSize: font.heading,
    fontWeight: "800",
  },

  // Timeline
  timelineContainer: {
    paddingBottom: spacing.xl,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    height: SLOT_ROW_HEIGHT,
  },
  timeLabelCol: {
    width: TIMELINE_LEFT,
    paddingRight: spacing.sm,
    alignItems: "flex-end",
  },
  timeLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: "600",
  },

  // Track (vertical line + dots)
  trackCol: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  trackLine: {
    position: "absolute",
    width: 1.5,
    backgroundColor: colors.border,
    top: 0,
    bottom: 0,
  },
  trackDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
    zIndex: 1,
  },

  // Slot bar
  slotBar: {
    flex: 1,
    height: SLOT_ROW_HEIGHT - 6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  slotBarDisabled: {
    opacity: 0.3,
  },
  slotBarSuggested: {
    borderColor: colors.success,
    backgroundColor: "#132A1C",
  },
  slotBarSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotBarText: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: "600",
  },
  suggestionBadge: {
    backgroundColor: "#132A1C",
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.success,
  },
  suggestionBadgeText: {
    color: colors.success,
    fontSize: font.tiny,
    fontWeight: "800",
  },

  footer: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.lg },
  footerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.xl,
  },
  footerTime: { color: colors.text, fontSize: font.body, fontWeight: "800" },
});
