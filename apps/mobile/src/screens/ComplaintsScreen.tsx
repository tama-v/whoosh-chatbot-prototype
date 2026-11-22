import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, errorMessage } from "../api";
import {
  colors,
  categoryLabels,
  fonts,
  priorityMeta,
  radius,
  shadows,
  statusMeta,
} from "../theme";
import type {
  Complaint,
  ComplaintAnalysis,
  ComplaintCategory,
  Priority,
} from "../types";
import { formatDate, formatDateTime, initials, isValidDateInput } from "../utils";
import { Badge, Button, Card, Field, IconButton, LoadingDots, ScreenHeader } from "../components/ui";

const CATEGORY_ORDER: ComplaintCategory[] = [
  "lost_and_found",
  "ticket_issue",
  "boarding_issue",
  "station_facility",
  "train_service",
  "other",
];

export function ComplaintsScreen({
  userName,
  onOpenAccount,
  authVersion,
}: {
  userName: string | null;
  onOpenAccount: () => void;
  authVersion: number;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"list" | "new">("list");
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [station, setStation] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [trainInfo, setTrainInfo] = useState("");
  const [contact, setContact] = useState("");
  const [analysis, setAnalysis] = useState<ComplaintAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      try {
        const result = await api.complaints();
        setItems(result.items ?? []);
      } catch (requestError) {
        setLoadError(errorMessage(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [authVersion, load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const label = item.category_label ?? categoryLabels[item.category] ?? "";
      return (
        item.ticket_number.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle) ||
        label.toLowerCase().includes(needle)
      );
    });
  }, [items, search]);

  const resetForm = useCallback(() => {
    setDescription("");
    setCategory(null);
    setStation("");
    setTravelDate("");
    setTrainInfo("");
    setContact("");
    setAnalysis(null);
    setFormError(null);
    setFormNotice(null);
  }, []);

  const validate = useCallback((): string | null => {
    if (!description.trim() || description.trim().length < 10) {
      return "Ceritakan masalah minimal 10 karakter agar laporan dapat dianalisis.";
    }
    if (!category) return "Pilih kategori laporan atau gunakan tombol Analisis.";
    if (travelDate.trim() && !isValidDateInput(travelDate.trim())) {
      return "Format tanggal perjalanan harus YYYY-MM-DD, misalnya 2026-11-21.";
    }
    return null;
  }, [category, description, travelDate]);

  const analyze = useCallback(async () => {
    if (analyzing) return;
    if (!description.trim() || description.trim().length < 10) {
      setFormError("Tulis deskripsi minimal 10 karakter sebelum analisis.");
      return;
    }
    if (travelDate.trim() && !isValidDateInput(travelDate.trim())) {
      setFormError("Format tanggal perjalanan harus YYYY-MM-DD, misalnya 2026-11-21.");
      return;
    }
    setAnalyzing(true);
    setFormError(null);
    try {
      const result = await api.analyzeComplaint({
        description: description.trim(),
        station: station.trim() || null,
        train_info: trainInfo.trim() || null,
        travel_date: travelDate.trim() || null,
      });
      setAnalysis(result);
      setCategory(result.category);
      setFormNotice(`Kategori terdeteksi: ${result.category_label}. Anda tetap bisa menggantinya.`);
    } catch (requestError) {
      setFormError(errorMessage(requestError));
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, description, station, trainInfo, travelDate]);

  const submit = useCallback(async () => {
    if (submitting) return;
    const validation = validate();
    if (validation) {
      setFormError(validation);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await api.createComplaint({
        category: category as ComplaintCategory,
        description: description.trim(),
        station: station.trim() || null,
        train_info: trainInfo.trim() || null,
        travel_date: travelDate.trim() || null,
        contact: contact.trim() || null,
        priority: (analysis?.priority ?? "medium") as Priority,
        summary: analysis?.summary ?? null,
      });
      setItems((previous) => [created, ...previous]);
      setHighlight(created.ticket_number);
      setTab("list");
      resetForm();
      setSelected(created);
    } catch (requestError) {
      setFormError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }, [analysis, category, contact, description, resetForm, station, submitting, trainInfo, travelDate, validate]);

  const goNew = useCallback(() => {
    setHighlight(null);
    setTab("new");
  }, []);

  const status = selected ? statusMeta[selected.status] : null;
  const priority = selected ? priorityMeta[selected.priority] : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Laporan"
        subtitle={userName ? "Tersimpan ke akun Anda" : "Tersimpan untuk tamu ini"}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={userName ? "Buka akun" : "Masuk atau daftar"}
            onPress={onOpenAccount}
            style={({ pressed }) => [styles.accountPill, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.accountPillText}>{userName ? initials(userName) : "TAMU"}</Text>
          </Pressable>
        }
      />

      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          <Pressable
            onPress={() => setTab("list")}
            style={[styles.segmentItem, tab === "list" && styles.segmentItemActive]}
          >
            <Ionicons
              name="documents-outline"
              size={15}
              color={tab === "list" ? colors.white : colors.muted}
            />
            <Text style={[styles.segmentText, tab === "list" && styles.segmentTextActive]}>
              Laporan saya
            </Text>
          </Pressable>
          <Pressable
            onPress={goNew}
            style={[styles.segmentItem, tab === "new" && styles.segmentItemActive]}
          >
            <Ionicons name="add-circle-outline" size={15} color={tab === "new" ? colors.white : colors.muted} />
            <Text style={[styles.segmentText, tab === "new" && styles.segmentTextActive]}>
              Buat laporan
            </Text>
          </Pressable>
        </View>
      </View>

      {tab === "list" ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={colors.maroon} />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.infoCard}>
                <View style={styles.infoIcon}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.maroon} />
                </View>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoTitle}>Simulasi laporan internal</Text>
                  <Text style={styles.infoText}>
                    Laporan tidak terhubung ke operator dan bukan tiket resmi. Gunakan untuk demonstrasi alur
                    keluhan.
                  </Text>
                </View>
              </View>
              {highlight ? (
                <View style={styles.successCard}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                  <View style={styles.successCopy}>
                    <Text style={styles.successTitle}>Laporan simulasi dibuat</Text>
                    <Text style={styles.successText}>
                      Nomor tiket {highlight}. Buka detail untuk melihat ringkasan.
                    </Text>
                  </View>
                  <Pressable onPress={() => setHighlight(null)} hitSlop={8}>
                    <Ionicons name="close" size={15} color={colors.muted} />
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={17} color={colors.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Cari nomor tiket atau kata kunci"
                  placeholderTextColor="#A58E8F"
                  style={styles.searchInput}
                />
                {search ? (
                  <Pressable onPress={() => setSearch("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={colors.lineStrong} />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.listTitleRow}>
                <Text style={styles.listTitle}>Daftar laporan</Text>
                <Badge label={`${filtered.length} laporan`} icon="layers-outline" />
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.empty}>
                <LoadingDots />
                <Text style={styles.emptyText}>Memuat laporan…</Text>
              </View>
            ) : loadError ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={36} color={colors.lineStrong} />
                <Text style={styles.emptyTitle}>Tidak dapat memuat laporan</Text>
                <Text style={styles.emptyText}>{loadError}</Text>
                <Button label="Coba lagi" icon="refresh" onPress={() => void load()} compact />
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="folder-open-outline" size={38} color={colors.lineStrong} />
                <Text style={styles.emptyTitle}>
                  {search ? "Laporan tidak ditemukan" : "Belum ada laporan"}
                </Text>
                <Text style={styles.emptyText}>
                  {search
                    ? "Coba kata kunci lain atau hapus pencarian."
                    : "Buat laporan simulasi pertama untuk mencoba alur analisis dan nomor tiket."}
                </Text>
                {!search ? <Button label="Buat laporan" icon="add" onPress={goNew} compact /> : null}
              </View>
            )
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const itemStatus = statusMeta[item.status];
            const itemPriority = priorityMeta[item.priority];
            return (
              <Pressable
                onPress={() => setSelected(item)}
                style={({ pressed }) => [styles.reportCard, pressed && styles.reportCardPressed]}
              >
                <View style={styles.reportTop}>
                  <View style={styles.ticketWrap}>
                    <Ionicons name="receipt-outline" size={15} color={colors.maroon} />
                    <Text style={styles.ticketText}>{item.ticket_number}</Text>
                  </View>
                  <Badge label={itemStatus.label} color={itemStatus.color} background={itemStatus.bg} />
                </View>
                <Text style={styles.reportCategory}>{item.category_label ?? categoryLabels[item.category]}</Text>
                <Text style={styles.reportDescription} numberOfLines={2}>
                  {item.description}
                </Text>
                <View style={styles.reportMeta}>
                  <Badge label={itemPriority.label} color={itemPriority.color} background={itemPriority.bg} />
                  <View style={styles.reportMetaItem}>
                    <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                    <Text style={styles.reportMetaText}>{formatDate(item.created_at)}</Text>
                  </View>
                  {item.station ? (
                    <View style={styles.reportMetaItem}>
                      <Ionicons name="location-outline" size={12} color={colors.muted} />
                      <Text style={styles.reportMetaText} numberOfLines={1}>
                        {item.station}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formIntro}>
              <View style={styles.formIntroIcon}>
                <Ionicons name="create-outline" size={21} color={colors.maroon} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.formTitle}>Ceritakan kendala Anda</Text>
                <Text style={styles.formSubtitle}>
                  Isi kronologi singkat. Analisis kategori bersifat simulasi aturan sederhana.
                </Text>
              </View>
            </View>

            <Card style={styles.formCard}>
              <Field
                label="Deskripsi masalah"
                placeholder="Contoh: Saya tertinggal tas hitam di area tunggu Gate 3 sekitar pukul 14.00."
                value={description}
                onChangeText={(value) => {
                  setDescription(value);
                  if (formError) setFormError(null);
                }}
                multiline
                maxLength={4000}
                icon="chatbox-ellipses-outline"
                hint={`${description.length}/4000 karakter · minimal 10 karakter`}
              />

              <Text style={styles.chipLabel}>Kategori</Text>
              <View style={styles.categoryGrid}>
                {CATEGORY_ORDER.map((value) => {
                  const active = category === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => {
                        setCategory(value);
                        setFormError(null);
                      }}
                      style={({ pressed }) => [
                        styles.categoryChip,
                        active && styles.categoryChipActive,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Ionicons
                        name={
                          value === "lost_and_found"
                            ? "briefcase-outline"
                            : value === "ticket_issue"
                              ? "ticket-outline"
                              : value === "boarding_issue"
                                ? "walk-outline"
                                : value === "station_facility"
                                  ? "business-outline"
                                  : value === "train_service"
                                    ? "train-outline"
                                    : "ellipsis-horizontal-outline"
                        }
                        size={14}
                        color={active ? colors.white : colors.maroon}
                      />
                      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                        {categoryLabels[value]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.twoColumns}>
                <Field
                  label="Stasiun"
                  placeholder="Contoh: Halim"
                  value={station}
                  onChangeText={setStation}
                  icon="location-outline"
                  containerStyle={styles.column}
                  maxLength={120}
                />
                <Field
                  label="Tanggal perjalanan"
                  placeholder="YYYY-MM-DD"
                  value={travelDate}
                  onChangeText={setTravelDate}
                  icon="calendar-outline"
                  containerStyle={styles.column}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </View>

              <View style={styles.twoColumns}>
                <Field
                  label="Nomor kereta"
                  placeholder="Contoh: G123"
                  value={trainInfo}
                  onChangeText={setTrainInfo}
                  icon="train-outline"
                  containerStyle={styles.column}
                  maxLength={120}
                />
                <Field
                  label="Kontak"
                  placeholder="Email atau WhatsApp"
                  value={contact}
                  onChangeText={setContact}
                  icon="call-outline"
                  containerStyle={styles.column}
                  maxLength={160}
                  autoCapitalize="none"
                />
              </View>

              <Button
                label={analyzing ? "Menganalisis…" : "Analisis kategori"}
                icon="sparkles-outline"
                onPress={() => void analyze()}
                loading={analyzing}
                variant="secondary"
                full
              />
              {!category ? (
                <Text style={styles.formHint}>
                  Opsional: tekan Analisis untuk mendeteksi kategori dan prioritas secara otomatis.
                </Text>
              ) : null}

              {analysis ? (
                <View style={styles.analysisCard}>
                  <View style={styles.analysisHead}>
                    <Ionicons name="sparkles" size={16} color={colors.amber} />
                    <Text style={styles.analysisTitle}>Hasil analisis simulasi</Text>
                  </View>
                  <View style={styles.analysisBadges}>
                    <Badge label={analysis.category_label} color={colors.maroon} background={colors.maroonSoft} />
                    <Badge
                      label={`Prioritas ${priorityMeta[analysis.priority].label}`}
                      color={priorityMeta[analysis.priority].color}
                      background={priorityMeta[analysis.priority].bg}
                    />
                  </View>
                  <Text style={styles.analysisSummary}>{analysis.summary}</Text>
                  {analysis.missing_fields.length ? (
                    <View style={styles.missingWrap}>
                      <Text style={styles.missingTitle}>Informasi yang sebaiknya dilengkapi</Text>
                      {analysis.missing_fields.map((field) => (
                        <View key={field} style={styles.missingRow}>
                          <Ionicons name="ellipse" size={5} color={colors.gold} />
                          <Text style={styles.missingText}>{field}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Text style={styles.analysisNotice}>{analysis.notice}</Text>
                </View>
              ) : null}

              {formNotice ? (
                <View style={styles.formNotice}>
                  <Ionicons name="information-circle-outline" size={15} color={colors.maroon} />
                  <Text style={styles.formNoticeText}>{formNotice}</Text>
                </View>
              ) : null}
              {formError ? (
                <View style={styles.formError}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.red} />
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              ) : null}

              <Button
                label={submitting ? "Mengirim laporan…" : "Kirim laporan simulasi"}
                icon="send-outline"
                onPress={() => void submit()}
                loading={submitting}
                full
              />
              <Text style={styles.formFoot}>
                Dengan mengirim, Anda memahami bahwa laporan ini adalah simulasi internal dan bukan tiket resmi
                operator.
              </Text>
            </Card>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected ? (
          <View style={styles.detailScreen}>
            <View style={[styles.detailHeader, { paddingTop: Math.max(insets.top, 16) }]}>
              <View>
                <Text style={styles.detailEyebrow}>DETAIL LAPORAN</Text>
                <Text style={styles.detailTicket}>{selected.ticket_number}</Text>
              </View>
              <IconButton
                icon="close"
                label="Tutup detail"
                color={colors.ink}
                background={colors.creamDeep}
                onPress={() => setSelected(null)}
              />
            </View>
            <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
              <View style={styles.detailBadges}>
                {status ? <Badge label={status.label} color={status.color} background={status.bg} /> : null}
                {priority ? (
                  <Badge label={`Prioritas ${priority.label}`} color={priority.color} background={priority.bg} />
                ) : null}
                <Badge label={selected.category_label ?? categoryLabels[selected.category]} icon="pricetag-outline" />
              </View>

              <Card>
                <Text style={styles.detailLabel}>Deskripsi</Text>
                <Text style={styles.detailDescription}>{selected.description}</Text>
                {selected.summary ? (
                  <>
                    <View style={styles.detailDivider} />
                    <Text style={styles.detailLabel}>Ringkasan simulasi</Text>
                    <Text style={styles.detailText}>{selected.summary}</Text>
                  </>
                ) : null}
              </Card>

              <Card style={styles.detailInfoCard}>
                <DetailRow icon="calendar-outline" label="Dibuat" value={formatDateTime(selected.created_at)} />
                <DetailRow icon="location-outline" label="Stasiun" value={selected.station ?? "—"} />
                <DetailRow icon="calendar-number-outline" label="Tanggal perjalanan" value={formatDate(selected.travel_date)} />
                <DetailRow icon="train-outline" label="Nomor kereta" value={selected.train_info ?? "—"} />
                <DetailRow icon="call-outline" label="Kontak" value={selected.contact ?? "—"} last />
              </Card>

              <View style={styles.detailNotice}>
                <Ionicons name="shield-checkmark-outline" size={17} color={colors.maroon} />
                <Text style={styles.detailNoticeText}>
                  Laporan ini disimpan di database lokal prototipe. Status tindak lanjut hanya untuk demonstrasi
                  dan tidak dikirim ke operator.
                </Text>
              </View>

              <Button label="Tutup" onPress={() => setSelected(null)} full />
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <View style={styles.detailRowIcon}>
        <Ionicons name={icon} size={15} color={colors.maroon} />
      </View>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  flex: {
    flex: 1,
  },
  accountPill: {
    height: 36,
    minWidth: 50,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  accountPillText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: fonts.bold,
    letterSpacing: 0.6,
  },
  segmentWrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 2,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.creamDeep,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segmentItem: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
  },
  segmentItemActive: {
    backgroundColor: colors.maroon,
    ...shadows.card,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: fonts.bold,
  },
  segmentTextActive: {
    color: colors.white,
  },
  listContent: {
    padding: 14,
    paddingBottom: 32,
  },
  listHeader: {
    gap: 11,
    marginBottom: 12,
  },
  infoCard: {
    flexDirection: "row",
    gap: 11,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 13,
    ...shadows.card,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.maroonSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCopy: {
    flex: 1,
  },
  infoTitle: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: fonts.bold,
    marginBottom: 2,
  },
  infoText: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 16,
  },
  successCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    backgroundColor: colors.greenSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#B9DFCD",
    padding: 12,
  },
  successCopy: {
    flex: 1,
  },
  successTitle: {
    color: colors.green,
    fontSize: 12.5,
    fontWeight: fonts.bold,
  },
  successText: {
    color: "#2C6B55",
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 13.5,
    paddingVertical: Platform.OS === "web" ? 10 : 0,
  },
  listTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  listTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: fonts.bold,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 13,
    ...shadows.card,
  },
  reportCardPressed: {
    transform: [{ scale: 0.993 }],
    borderColor: colors.lineStrong,
  },
  reportTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  ticketWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
  },
  ticketText: {
    color: colors.maroon,
    fontSize: 11.5,
    fontWeight: fonts.bold,
    letterSpacing: 0.4,
  },
  reportCategory: {
    color: colors.ink,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: fonts.bold,
    marginTop: 9,
  },
  reportDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  reportMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  reportMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    maxWidth: 130,
  },
  reportMetaText: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: fonts.medium,
  },
  separator: {
    height: 9,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 38,
    paddingHorizontal: 22,
    gap: 7,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: fonts.bold,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 4,
  },
  formContent: {
    padding: 14,
    paddingBottom: 34,
  },
  formIntro: {
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
    marginBottom: 12,
  },
  formIntroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.maroonSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  formTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: fonts.bold,
  },
  formSubtitle: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  formCard: {
    padding: 15,
  },
  chipLabel: {
    color: colors.inkSoft,
    fontSize: 12.5,
    fontWeight: fonts.bold,
    marginBottom: 7,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 15,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
  },
  categoryChipActive: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
  },
  categoryChipText: {
    color: colors.maroonDark,
    fontSize: 11,
    fontWeight: fonts.semibold,
  },
  categoryChipTextActive: {
    color: colors.white,
  },
  twoColumns: {
    flexDirection: "row",
    gap: 9,
  },
  column: {
    flex: 1,
  },
  formHint: {
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 7,
  },
  analysisCard: {
    marginTop: 13,
    marginBottom: 13,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#F0D9AE",
    padding: 12,
  },
  analysisHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  analysisTitle: {
    color: colors.amber,
    fontSize: 12,
    fontWeight: fonts.bold,
  },
  analysisBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 7,
  },
  analysisSummary: {
    color: colors.inkSoft,
    fontSize: 11.5,
    lineHeight: 17,
  },
  missingWrap: {
    marginTop: 8,
    gap: 3,
  },
  missingTitle: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: fonts.bold,
    marginBottom: 2,
  },
  missingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  missingText: {
    color: colors.inkSoft,
    fontSize: 11,
    lineHeight: 16,
  },
  analysisNotice: {
    color: colors.amber,
    fontSize: 9.5,
    lineHeight: 14,
    marginTop: 8,
    fontStyle: "italic",
  },
  formNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: colors.maroonSoft,
    borderRadius: radius.sm,
    padding: 9,
    marginBottom: 10,
  },
  formNoticeText: {
    flex: 1,
    color: colors.maroonDark,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: fonts.medium,
  },
  formError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: colors.redSoft,
    borderRadius: radius.sm,
    padding: 9,
    marginBottom: 10,
  },
  formErrorText: {
    flex: 1,
    color: colors.red,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: fonts.medium,
  },
  formFoot: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    marginTop: 9,
  },
  detailScreen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  detailEyebrow: {
    color: colors.maroon,
    fontSize: 9.5,
    fontWeight: fonts.bold,
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  detailTicket: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: fonts.heavy,
    letterSpacing: 0.3,
  },
  detailContent: {
    padding: 15,
    paddingBottom: 32,
    gap: 12,
  },
  detailBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: fonts.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  detailDescription: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
  },
  detailText: {
    color: colors.inkSoft,
    fontSize: 12.5,
    lineHeight: 19,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 12,
  },
  detailInfoCard: {
    paddingVertical: 4,
    paddingHorizontal: 13,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  detailRowIcon: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: colors.maroonSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  detailRowLabel: {
    width: 112,
    color: colors.muted,
    fontSize: 11.5,
    fontWeight: fonts.medium,
  },
  detailRowValue: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: fonts.semibold,
    textAlign: "right",
  },
  detailNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
  },
  detailNoticeText: {
    flex: 1,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 16,
  },
});
