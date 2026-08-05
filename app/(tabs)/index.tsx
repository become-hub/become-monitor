import { AppFooter } from "@/components/app-footer";
import { MuseDeviceCard } from "@/components/muse-device-card";
import { PolarDeviceCard } from "@/components/polar-device-card";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { BookOpen } from "lucide-react-native";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { isMuseFamilyAvailable } from "@/constants/device-availability";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocale } from "@/hooks/use-locale";
import { MUSE_PRODUCT_LIST } from "@/features/devices/muse/muse-products";
import { POLAR_PRODUCT_LIST } from "@/features/devices/polar/polar-products";

export default function HomeScreen() {
  const { theme } = useTheme();
  const { strings, language } = useLocale();
  const router = useRouter();
  const museAvailable = isMuseFamilyAvailable();

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
              ? museAvailable
                ? "Connect a Polar or Muse device to start monitoring in Become Hub apps"
                : "Connect a Polar device to start monitoring in Become Hub apps"
              : museAvailable
                ? "Connetti un dispositivo Polar o Muse per iniziare a monitorare nelle app Become Hub"
                : "Connetti un dispositivo Polar per iniziare a monitorare nelle app Become Hub"}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.section}>
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

          {MUSE_PRODUCT_LIST.map((product) => (
            <MuseDeviceCard
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
