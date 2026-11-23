import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  configureApi,
  DEFAULT_API_BASE,
  errorMessage,
  normalizeBase,
  api,
} from "./src/api";
import { WhooshMark } from "./src/components/WhooshMark";
import { LoadingDots } from "./src/components/ui";
import { AccountScreen } from "./src/screens/AccountScreen";
import { ChatScreen } from "./src/screens/ChatScreen";
import { ComplaintsScreen } from "./src/screens/ComplaintsScreen";
import {
  ensureGuestId,
  readApiBase,
  readLanguage,
  readToken,
  writeLanguage,
  writeToken,
} from "./src/storage";
import { colors, fonts, radius, shadows } from "./src/theme";
import type { AuthResponse, AuthUser, Language } from "./src/types";

type Tab = "chat" | "reports" | "account";

const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "chat", label: "Chat", icon: "chatbubble-ellipses-outline", activeIcon: "chatbubble-ellipses" },
  { id: "reports", label: "Laporan", icon: "document-text-outline", activeIcon: "document-text" },
  { id: "account", label: "Akun", icon: "person-circle-outline", activeIcon: "person-circle" },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

function AppShell() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [language, setLanguage] = useState<Language>("id");
  const [authVersion, setAuthVersion] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));

    void (async () => {
      try {
        const [storedBase, storedToken, guest, storedLanguage] = await Promise.all([
          readApiBase(),
          readToken(),
          ensureGuestId(),
          readLanguage(),
        ]);
        const normalizedBase = normalizeBase(storedBase ?? DEFAULT_API_BASE);
        configureApi({ base: normalizedBase, token: storedToken, guest });
        setLanguage(storedLanguage ?? "id");
        setReady(true);

        if (storedToken) {
          void api
            .me()
            .then((result) => setUser(result.user))
            .catch(async () => {
              await writeToken(null);
              configureApi({ token: null });
            });
        }
      } catch (bootFailure) {
        setBootError(errorMessage(bootFailure));
        setReady(true);
      }
    })();

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleAuth = (response: AuthResponse) => {
    const token = response.access_token ?? null;
    configureApi({ token });
    void writeToken(token);
    setUser(response.user);
    setAuthVersion((value) => value + 1);
    setTab("chat");
  };

  const handleLogout = () => {
    configureApi({ token: null });
    void writeToken(null);
    setUser(null);
    setAuthVersion((value) => value + 1);
    setTab("chat");
  };

  const handleLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    void writeLanguage(nextLanguage);
  };

  if (!ready) {
    return (
      <LinearGradient
        colors={[colors.maroonDeep, colors.maroonDark, colors.maroon]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.splash}
      >
        <StatusBar style="light" />
        <View style={styles.splashGlow} />
        <View style={styles.splashMark}>
          <WhooshMark size={72} />
        </View>
        <Text style={styles.splashTitle}>Heiser</Text>
        <Text style={styles.splashSubtitle}>Asisten perjalanan Whoosh AI</Text>
        <View style={styles.splashLoading}>
          <LoadingDots color={colors.white} size={8} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.layers}>
        <View style={[styles.layer, tab !== "chat" && styles.hidden]}>
          <ChatScreen
            language={language}
            onLanguageChange={handleLanguage}
            onOpenAccount={() => setTab("account")}
            userName={user?.name ?? null}
          />
        </View>
        <View style={[styles.layer, tab !== "reports" && styles.hidden]}>
          <ComplaintsScreen
            userName={user?.name ?? null}
            onOpenAccount={() => setTab("account")}
            authVersion={authVersion}
          />
        </View>
        <View style={[styles.layer, tab !== "account" && styles.hidden]}>
          <AccountScreen
            user={user}
            language={language}
            onAuth={handleAuth}
            onLogout={handleLogout}
            onLanguageChange={handleLanguage}
          />
        </View>
      </View>

      {bootError ? (
        <View style={styles.bootError}>
          <Ionicons name="information-circle-outline" size={15} color={colors.maroonDark} />
          <Text style={styles.bootErrorText}>{bootError}</Text>
        </View>
      ) : null}

      {!keyboardOpen ? (
        <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 7) }]}>
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item.label}
                onPress={() => setTab(item.id)}
                style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.75 }]}
              >
                <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
                  <Ionicons
                    name={active ? item.activeIcon : item.icon}
                    size={21}
                    color={active ? colors.white : colors.muted}
                  />
                </View>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  layers: {
    flex: 1,
  },
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  hidden: {
    display: "none",
  },
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  splashGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  splashMark: {
    width: 88,
    height: 88,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  splashTitle: {
    color: colors.white,
    fontSize: 34,
    fontWeight: fonts.heavy,
    letterSpacing: 0.5,
    marginTop: 18,
  },
  splashSubtitle: {
    color: "rgba(255,248,241,0.72)",
    fontSize: 12.5,
    fontWeight: fonts.medium,
    marginTop: 3,
  },
  splashLoading: {
    marginTop: 22,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 7,
    paddingHorizontal: 10,
    ...shadows.card,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  tabIconWrap: {
    width: 38,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    backgroundColor: colors.maroon,
    ...shadows.card,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: fonts.semibold,
  },
  tabLabelActive: {
    color: colors.maroon,
    fontWeight: fonts.bold,
  },
  bootError: {
    position: "absolute",
    top: 44,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: colors.goldSoft,
    borderRadius: radius.sm,
    padding: 9,
    borderWidth: 1,
    borderColor: "#F0D9AE",
  },
  bootErrorText: {
    flex: 1,
    color: colors.maroonDark,
    fontSize: 10.5,
    lineHeight: 15,
  },
});
