import { AppFooter } from "@/components/app-footer";
import { PolarDeviceCard } from "@/components/polar-device-card";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { BookOpen } from "lucide-react-native";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocale } from "@/hooks/use-locale";
import { POLAR_PRODUCT_LIST } from "@/services/polar-products";

export default function HomeScreen() {
  const { theme } = useTheme();
  const { strings, language } = useLocale();
  const router = useRouter();

  const handleStartPress = () => {
    router.push("/(tabs)/monitor");
  };

  const handleDocsPress = () => {
    router.push("/(tabs)/docs");
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.becomeLogo}
              contentFit="contain"
            />
          </View>
          <ThemedText type="title" style={styles.deviceTitle}>
            {strings.home.title}
          </ThemedText>
          <ThemedText style={styles.deviceDescription}>
            {language === "en"
              ? "Connect a Polar device to start monitoring performance in Become Hub apps"
              : "Connetti un dispositivo Polar per iniziare a monitorare le tue prestazioni nelle app Become Hub"}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
          <View style={styles.poweredByRow}>
            <ThemedText style={styles.poweredByText}>powered by</ThemedText>
            <Image
              source={require("@/assets/images/polar-logo.webp")}
              style={styles.polarLogo}
              contentFit="contain"
            />
          </View>

          {POLAR_PRODUCT_LIST.map((product) => (
            <PolarDeviceCard
              key={product.id}
              product={product}
              description={
                language === "en"
                  ? product.shortDescriptionEn
                  : product.shortDescriptionIt
              }
              ctaLabel={
                language === "en"
                  ? `Connect ${product.displayName}`
                  : `Connetti ${product.displayName}`
              }
              onPress={handleStartPress}
            />
          ))}

          <TouchableOpacity style={styles.docsLink} onPress={handleDocsPress}>
            <BookOpen size={16} color={Colors[theme].tint} />
            <ThemedText
              style={[styles.docsLinkText, { color: Colors[theme].tint }]}
            >
              {language === "en"
                ? "Learn how to connect a device for the first time"
                : "Scopri come connettere il dispositivo la prima volta"}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <AppFooter />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  logoContainer: {
    marginBottom: 20,
    paddingVertical: 20,
  },
  becomeLogo: {
    width: 120,
    height: 120,
  },
  deviceTitle: {
    marginBottom: 8,
  },
  deviceDescription: {
    fontSize: 16,
    opacity: 0.7,
    lineHeight: 22,
    marginBottom: 12,
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  poweredByRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginBottom: 12,
  },
  polarLogo: {
    width: 60,
    height: 30,
  },
  poweredByText: {
    fontSize: 12,
    opacity: 0.6,
    fontWeight: "500",
  },
  docsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 8,
  },
  docsLinkText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
