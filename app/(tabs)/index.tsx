import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { BookOpen } from "lucide-react-native";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";

export default function HomeScreen() {
  const { theme } = useTheme();
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
        {/* Header */}
        <ThemedView style={styles.header}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.becomeLogo}
              contentFit="contain"
            />
          </View>
          <ThemedText type="title" style={styles.deviceTitle}>
            Scegli il tuo device
          </ThemedText>
          <ThemedText style={styles.deviceDescription}>
            Connetti il tuo dispositivo Polar 360 per iniziare a monitorare le
            tue prestazioni nelle app Become Hub
          </ThemedText>
        </ThemedView>

        {/* Card Polar 360 */}
        <ThemedView style={styles.section}>
          <ThemedView
            style={[styles.card, { borderColor: Colors[theme].border }]}
          >
            {/* Logo Polar in alto a destra */}
            <View style={styles.poweredByContainer}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ThemedText
                  style={[
                    styles.poweredByText,
                    { marginRight: 6, fontWeight: "500", fontSize: 13 },
                  ]}
                >
                  powered by
                </ThemedText>
                <Image
                  source={require("@/assets/images/polar-logo.webp")}
                  style={[styles.polarLogo]}
                  contentFit="contain"
                />
              </View>
            </View>

            {/* Image centrale */}
            <View style={styles.cardImageContainer}>
              <Image
                source={require("@/assets/images/polar360.webp")}
                style={styles.polarImage}
                contentFit="contain"
              />
            </View>

            {/* Content */}
            <View style={styles.cardContent}>
              <ThemedText type="subtitle" style={styles.cardTitle}>
                Polar 360
              </ThemedText>
              <ThemedText style={styles.cardText}>
                Collega il tuo dispositivo Polar 360 per iniziare ad usare le
                app di Become Hub Performance e Food
              </ThemedText>
              <TouchableOpacity
                style={[styles.cardButton, { borderColor: Colors[theme].tint }]}
                onPress={handleStartPress}
              >
                <ThemedText
                  style={[styles.cardButtonText, { color: Colors[theme].tint }]}
                >
                  Connetti Polar 360
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>

          {/* Link alla documentazione */}
          <TouchableOpacity style={styles.docsLink} onPress={handleDocsPress}>
            <BookOpen size={16} color={Colors[theme].tint} />
            <ThemedText
              style={[styles.docsLinkText, { color: Colors[theme].tint }]}
            >
              Scopri come connettere il dispositivo la prima volta
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
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
    marginBottom: 24,
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  card: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    position: "relative",
  },
  poweredByContainer: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  cardImageContainer: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  polarImage: {
    width: 200,
    height: 200,
  },
  cardContent: {
    width: "100%",
    alignItems: "center",
  },
  cardTitle: {
    marginBottom: 12,
    textAlign: "center",
  },
  cardText: {
    fontSize: 16,
    opacity: 0.8,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 20,
  },
  cardButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 2,
  },
  cardButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  docsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 8,
  },
  docsLinkText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
