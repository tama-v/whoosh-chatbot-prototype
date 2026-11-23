import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, errorMessage } from "../api";
import { colors, fonts, radius } from "../theme";
import type { AuthResponse, AuthUser, Language } from "../types";
import { formatDate, formatDateTime, initials } from "../utils";
import { WhooshMark } from "../components/WhooshMark";
import { Badge, Button, Card, Field, ScreenHeader } from "../components/ui";

type AuthMode = "login" | "register";

export function AccountScreen({
  user,
  language,
  onAuth,
  onLogout,
  onLanguageChange,
}: {
  user: AuthUser | null;
  language: Language;
  onAuth: (response: AuthResponse) => void;
  onLogout: () => void;
  onLanguageChange: (language: Language) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const submitAuth = useCallback(async () => {
    if (submitting) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setAuthError("Lengkapi email dan kata sandi terlebih dahulu.");
      return;
    }
    if (mode === "register") {
      if (name.trim().length < 2) {
        setAuthError("Nama minimal 2 karakter.");
        return;
      }
      if (password.length < 8) {
        setAuthError("Kata sandi minimal 8 karakter.");
        return;
      }
    }
    setSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);
    try {
      const response =
        mode === "login"
          ? await api.login(cleanEmail, password)
          : await api.register(name.trim(), cleanEmail, password);
      onAuth(response);
      setPassword("");
      setAuthNotice(
        response.user.role === "admin"
          ? "Berhasil masuk sebagai admin. Dashboard admin tersedia di versi web."
          : "Berhasil masuk. Data tamu Anda sudah dipindahkan ke akun ini.",
      );
      setName("");
      setEmail("");
    } catch (requestError) {
      setAuthError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }, [email, mode, name, onAuth, password, submitting]);

  const confirmLogout = useCallback(() => {
    Alert.alert("Keluar dari akun?", "Riwayat tetap tersimpan di akun dan dapat dibuka saat masuk kembali.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Keluar",
        style: "destructive",
        onPress: () => {
          void api.logout().catch(() => undefined);
          onLogout();
          setAuthNotice("Anda telah keluar. Mode tamu kembali aktif.");
        },
      },
    ]);
  }, [onLogout]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Akun"
        subtitle={user ? "Sesi perangkat aktif" : "Masuk, daftar, atau lanjut sebagai tamu"}
        right={
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>{user ? initials(user.name) : "TAMU"}</Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {user ? (
            <>
              <Card style={styles.profileCard}>
                <View style={styles.profileTop}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{initials(user.name)}</Text>
                  </View>
                  <View style={styles.profileCopy}>
                    <View style={styles.profileNameRow}>
                      <Text style={styles.profileName} numberOfLines={1}>
                        {user.name}
                      </Text>
                      <Badge
                        label={user.role === "admin" ? "Admin" : "Penumpang"}
                        color={user.role === "admin" ? colors.amber : colors.green}
                        background={user.role === "admin" ? colors.goldSoft : colors.greenSoft}
                        icon={user.role === "admin" ? "shield-checkmark-outline" : "person-outline"}
                      />
                    </View>
                    <Text style={styles.profileEmail} numberOfLines={1}>
                      {user.email}
                    </Text>
                    <View style={styles.sessionRow}>
                      <View style={styles.sessionDot} />
                      <Text style={styles.sessionText}>Sesi aktif</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.profileDivider} />
                <View style={styles.profileMetaRow}>
                  <View style={styles.profileMeta}>
                    <Text style={styles.profileMetaLabel}>Bergabung</Text>
                    <Text style={styles.profileMetaValue}>{formatDate(user.created_at)}</Text>
                  </View>
                  <View style={styles.profileMeta}>
                    <Text style={styles.profileMetaLabel}>Login terakhir</Text>
                    <Text style={styles.profileMetaValue}>{formatDateTime(user.last_login_at)}</Text>
                  </View>
                </View>
                <View style={styles.profileActions}>
                  <Button label="Keluar" icon="log-out-outline" variant="danger" onPress={confirmLogout} full />
                </View>
              </Card>

              {authNotice ? (
                <View style={styles.noticeCard}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                  <Text style={styles.noticeText}>{authNotice}</Text>
                  <Pressable onPress={() => setAuthNotice(null)} hitSlop={8}>
                    <Ionicons name="close" size={14} color={colors.muted} />
                  </Pressable>
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>Preferensi jawaban</Text>
              <Card style={styles.preferenceCard}>
                <View style={styles.preferenceRow}>
                  <View style={styles.preferenceIcon}>
                    <Ionicons name="language-outline" size={18} color={colors.maroon} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.preferenceTitle}>Bahasa jawaban</Text>
                    <Text style={styles.preferenceText}>
                      Pertanyaan tetap bisa dalam bahasa apa pun; pilihan ini mengarahkan bahasa jawaban.
                    </Text>
                  </View>
                </View>
                <View style={styles.languageRow}>
                  <Pressable
                    onPress={() => onLanguageChange("id")}
                    style={[styles.languageOption, language === "id" && styles.languageOptionActive]}
                  >
                    <Text style={[styles.languageOptionText, language === "id" && styles.languageOptionTextActive]}>
                      Bahasa Indonesia
                    </Text>
                    {language === "id" ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
                  </Pressable>
                  <Pressable
                    onPress={() => onLanguageChange("en")}
                    style={[styles.languageOption, language === "en" && styles.languageOptionActive]}
                  >
                    <Text style={[styles.languageOptionText, language === "en" && styles.languageOptionTextActive]}>
                      English
                    </Text>
                    {language === "en" ? <Ionicons name="checkmark" size={15} color={colors.white} /> : null}
                  </Pressable>
                </View>
              </Card>
            </>
          ) : (
            <>
              {authNotice ? (
                <View style={styles.noticeCard}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                  <Text style={styles.noticeText}>{authNotice}</Text>
                  <Pressable onPress={() => setAuthNotice(null)} hitSlop={8}>
                    <Ionicons name="close" size={14} color={colors.muted} />
                  </Pressable>
                </View>
              ) : null}

              <Card style={styles.authCard}>
                <View style={styles.authBrand}>
                  <WhooshMark size={46} />
                  <View style={styles.flex}>
                    <Text style={styles.authTitle}>
                      {mode === "login" ? "Masuk ke akun Anda" : "Buat akun baru"}
                    </Text>
                    <Text style={styles.authSubtitle}>
                      {mode === "login"
                        ? "Lanjutkan riwayat dan laporan yang tersimpan."
                        : "Data tamu Anda akan dipindahkan ke akun baru."}
                    </Text>
                  </View>
                </View>

                <View style={styles.segment}>
                  <Pressable
                    onPress={() => {
                      setMode("login");
                      setAuthError(null);
                    }}
                    style={[styles.segmentItem, mode === "login" && styles.segmentItemActive]}
                  >
                    <Text style={[styles.segmentText, mode === "login" && styles.segmentTextActive]}>Masuk</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setMode("register");
                      setAuthError(null);
                    }}
                    style={[styles.segmentItem, mode === "register" && styles.segmentItemActive]}
                  >
                    <Text style={[styles.segmentText, mode === "register" && styles.segmentTextActive]}>
                      Daftar
                    </Text>
                  </Pressable>
                </View>

                {mode === "register" ? (
                  <Field
                    label="Nama"
                    placeholder="Nama lengkap atau panggilan"
                    value={name}
                    onChangeText={setName}
                    icon="person-outline"
                    maxLength={60}
                    autoCapitalize="words"
                    textContentType="name"
                  />
                ) : null}
                <Field
                  label="Email"
                  placeholder="nama@contoh.com"
                  value={email}
                  onChangeText={setEmail}
                  icon="mail-outline"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={160}
                  textContentType="emailAddress"
                />
                <Field
                  label="Kata sandi"
                  placeholder={mode === "register" ? "Minimal 8 karakter" : "Kata sandi akun"}
                  value={password}
                  onChangeText={setPassword}
                  icon="lock-closed-outline"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={200}
                  textContentType={mode === "register" ? "newPassword" : "password"}
                  hint={mode === "register" ? "Gunakan kata sandi unik, bukan kata sandi umum." : undefined}
                  right={
                    <Pressable
                      onPress={() => setShowPassword((value) => !value)}
                      hitSlop={8}
                      accessibilityLabel={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={19}
                        color={colors.muted}
                      />
                    </Pressable>
                  }
                />
                {authError ? (
                  <View style={styles.authError}>
                    <Ionicons name="alert-circle-outline" size={15} color={colors.red} />
                    <Text style={styles.authErrorText}>{authError}</Text>
                  </View>
                ) : null}
                <Button
                  label={mode === "login" ? "Masuk" : "Daftar dan masuk"}
                  icon={mode === "login" ? "log-in-outline" : "person-add-outline"}
                  onPress={() => void submitAuth()}
                  loading={submitting}
                  full
                />
                <Text style={styles.authFoot}>
                  {mode === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
                  <Text
                    style={styles.authLink}
                    onPress={() => {
                      setMode(mode === "login" ? "register" : "login");
                      setAuthError(null);
                    }}
                  >
                    {mode === "login" ? "Daftar gratis" : "Masuk di sini"}
                  </Text>
                </Text>
                <View style={styles.guestBox}>
                  <Ionicons name="information-circle-outline" size={17} color={colors.maroon} />
                  <Text style={styles.guestBoxText}>
                    Tidak ingin mendaftar? Anda tetap bisa chat dan membuat laporan sebagai tamu.
                  </Text>
                </View>
              </Card>

              <Text style={styles.sectionTitle}>Preferensi jawaban</Text>
              <Card style={styles.preferenceCard}>
                <View style={styles.preferenceRow}>
                  <View style={styles.preferenceIcon}>
                    <Ionicons name="language-outline" size={18} color={colors.maroon} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.preferenceTitle}>Bahasa jawaban</Text>
                    <Text style={styles.preferenceText}>Bisa diubah kapan saja dari layar chat.</Text>
                  </View>
                </View>
                <View style={styles.languageRow}>
                  <Pressable
                    onPress={() => onLanguageChange("id")}
                    style={[styles.languageOption, language === "id" && styles.languageOptionActive]}
                  >
                    <Text style={[styles.languageOptionText, language === "id" && styles.languageOptionTextActive]}>
                      Bahasa Indonesia
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onLanguageChange("en")}
                    style={[styles.languageOption, language === "en" && styles.languageOptionActive]}
                  >
                    <Text style={[styles.languageOptionText, language === "en" && styles.languageOptionTextActive]}>
                      English
                    </Text>
                  </Pressable>
                </View>
              </Card>
            </>
          )}

          <Text style={styles.sectionTitle}>Tentang aplikasi</Text>
          <Card style={styles.aboutCard}>
            <View style={styles.aboutHead}>
              <WhooshMark size={40} />
              <View style={styles.flex}>
                <Text style={styles.aboutTitle}>Whoosh AI · Heiser</Text>
                <Text style={styles.aboutSubtitle}>Asisten perjalanan</Text>
              </View>
              <Badge label="v1.0" color={colors.maroon} background={colors.maroonSoft} />
            </View>
            <View style={styles.aboutDivider} />
            <InfoRow icon="chatbubble-ellipses-outline" label="Chat" value="Jawaban dengan sumber" />
            <InfoRow icon="volume-high-outline" label="Suara" value="Tanya dan dengarkan jawaban" />
            <InfoRow icon="document-text-outline" label="Laporan" value="Bisa dilacak dengan nomor tiket" />
            <InfoRow icon="person-circle-outline" label="Akun" value="Riwayat tersimpan di akunmu" />
            <View style={styles.aboutNotice}>
              <Ionicons name="information-circle-outline" size={16} color={colors.maroon} />
              <Text style={styles.aboutNoticeText}>
                Informasi penting tetap harus diverifikasi melalui kanal resmi.
              </Text>
            </View>
          </Card>

          <Text style={styles.footerNote}>
            Bukan layanan resmi operator. Verifikasi info penting di kanal resmi.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={15} color={colors.maroon} />
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
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
  headerAvatar: {
    minWidth: 44,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: fonts.bold,
    letterSpacing: 0.6,
  },
  content: {
    padding: 14,
    paddingBottom: 36,
    gap: 12,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.greenSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#B9DFCD",
    padding: 12,
  },
  noticeText: {
    flex: 1,
    color: "#2C6B55",
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: fonts.medium,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: fonts.bold,
    marginTop: 2,
    marginLeft: 2,
  },
  profileCard: {
    padding: 16,
  },
  profileTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  profileAvatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.maroon,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.maroonSoft,
  },
  profileAvatarText: {
    color: colors.white,
    fontSize: 19,
    fontWeight: fonts.heavy,
    letterSpacing: 0.5,
  },
  profileCopy: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  profileName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: fonts.heavy,
    maxWidth: "64%",
  },
  profileEmail: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
  },
  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  sessionText: {
    color: colors.green,
    fontSize: 10,
    fontWeight: fonts.semibold,
  },
  profileDivider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 13,
  },
  profileMetaRow: {
    flexDirection: "row",
    gap: 12,
  },
  profileMeta: {
    flex: 1,
  },
  profileMetaLabel: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: fonts.bold,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  profileMetaValue: {
    color: colors.inkSoft,
    fontSize: 11.5,
    fontWeight: fonts.semibold,
  },
  adminBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#F0D9AE",
    padding: 11,
    marginTop: 13,
  },
  adminTitle: {
    color: colors.amber,
    fontSize: 11.5,
    fontWeight: fonts.bold,
  },
  adminText: {
    color: "#7A5417",
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 2,
  },
  profileActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  preferenceCard: {
    padding: 14,
  },
  preferenceRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  preferenceIcon: {
    width: 33,
    height: 33,
    borderRadius: 11,
    backgroundColor: colors.maroonSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  preferenceTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: fonts.bold,
  },
  preferenceText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  languageRow: {
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
  },
  languageOption: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  languageOptionActive: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
  },
  languageOptionText: {
    color: colors.inkSoft,
    fontSize: 11.5,
    fontWeight: fonts.semibold,
  },
  languageOptionTextActive: {
    color: colors.white,
  },
  authCard: {
    padding: 16,
  },
  authBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 14,
  },
  authTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: fonts.heavy,
    lineHeight: 23,
  },
  authSubtitle: {
    color: colors.muted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.creamDeep,
    borderRadius: radius.sm,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 14,
  },
  segmentItem: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentItemActive: {
    backgroundColor: colors.maroon,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: fonts.bold,
  },
  segmentTextActive: {
    color: colors.white,
  },
  authError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: colors.redSoft,
    borderRadius: radius.sm,
    padding: 9,
    marginBottom: 10,
  },
  authErrorText: {
    flex: 1,
    color: colors.red,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: fonts.medium,
  },
  authFoot: {
    color: colors.muted,
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 11,
  },
  authLink: {
    color: colors.maroon,
    fontWeight: fonts.bold,
  },
  guestBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: colors.creamDeep,
    borderRadius: radius.sm,
    padding: 9,
    marginTop: 13,
  },
  guestBoxText: {
    flex: 1,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 15,
  },
  serverCard: {
    padding: 14,
  },
  serverHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginBottom: 11,
  },
  serverStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingTop: 2,
  },
  serverDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  serverStatusText: {
    color: colors.muted,
    fontSize: 9.5,
    fontWeight: fonts.semibold,
  },
  serverField: {
    marginBottom: 8,
  },
  serverActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resetText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: fonts.semibold,
    textDecorationLine: "underline",
    marginLeft: "auto",
  },
  healthCard: {
    backgroundColor: colors.cream,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    marginTop: 11,
    gap: 6,
  },
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  healthLabel: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: fonts.medium,
  },
  healthValue: {
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: fonts.semibold,
    flexShrink: 1,
    textAlign: "right",
  },
  healthError: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: colors.redSoft,
    borderRadius: radius.sm,
    padding: 9,
    marginTop: 10,
  },
  healthErrorText: {
    flex: 1,
    color: colors.red,
    fontSize: 10.5,
    lineHeight: 15,
  },
  serverHint: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 9,
  },
  aboutCard: {
    padding: 14,
  },
  aboutHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  aboutTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: fonts.bold,
  },
  aboutSubtitle: {
    color: colors.muted,
    fontSize: 10.5,
    marginTop: 2,
  },
  aboutDivider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 11,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
  infoRowLabel: {
    width: 92,
    color: colors.muted,
    fontSize: 11,
  },
  infoRowValue: {
    flex: 1,
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: fonts.semibold,
    textAlign: "right",
  },
  aboutNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: colors.maroonSoft,
    borderRadius: radius.sm,
    padding: 9,
    marginTop: 9,
  },
  aboutNoticeText: {
    flex: 1,
    color: colors.maroonDark,
    fontSize: 10,
    lineHeight: 15,
  },
  footerNote: {
    color: colors.muted,
    fontSize: 9.5,
    lineHeight: 14,
    textAlign: "center",
    paddingHorizontal: 18,
    marginTop: 4,
  },
});
