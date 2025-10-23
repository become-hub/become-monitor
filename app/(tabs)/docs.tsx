import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bluetooth,
  BookOpen,
  CheckCircle,
  Cloud,
  ExternalLink,
  Github,
  Heart,
  Smartphone,
  Wifi,
} from "lucide-react-native";
import React from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

export default function DocsScreen() {
  const { theme } = useTheme();

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Documentation
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Learn how to use Become Monitor effectively
          </ThemedText>
        </ThemedView>

        {/* Getting Started */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Getting Started
          </ThemedText>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Smartphone size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>App Overview</ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              Become Monitor is a professional heart rate variability (HRV)
              monitoring app designed for athletes, health professionals, and
              wellness enthusiasts.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Bluetooth size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                Device Connection
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              Connect your Polar device (H10, OH1, Verity Sense) via Bluetooth
              to start real-time heart rate and HRV monitoring.
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Features */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Key Features
          </ThemedText>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Heart size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                Heart Rate Monitoring
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              Real-time heart rate tracking with contact detection and signal
              quality indicators.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <BarChart3 size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>HRV Analysis</ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              Advanced HRV calculations including RMSSD, LF/HF power analysis
              for comprehensive autonomic nervous system assessment.
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Cloud size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                Cloud Integration
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              Secure data transmission to Become Hub for analysis, storage, and
              professional insights.
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Technical Details */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Technical Specifications
          </ThemedText>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Activity size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>HRV Metrics</ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              • RMSSD (Root Mean Square of Successive Differences){"\n"}• LF
              Power (Low Frequency){"\n"}• HF Power (High Frequency){"\n"}•
              30-second rolling window analysis
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Bluetooth size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                Supported Devices
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              • Polar H10 (Chest strap){"\n"}• Polar OH1 (Optical sensor){"\n"}•
              Polar Verity Sense (Optical sensor){"\n"}• Bluetooth Low Energy
              (BLE) compatible
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Resources */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Resources
          </ThemedText>

          <TouchableOpacity
            style={[styles.linkButton, { borderColor: Colors[theme].tint }]}
            onPress={() => openLink("https://become-hub.com")}
          >
            <View style={styles.linkContent}>
              <Wifi size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.linkText}>
                Become Hub Website
              </ThemedText>
              <ExternalLink size={16} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { borderColor: Colors[theme].tint }]}
            onPress={() => openLink("https://support.polar.com")}
          >
            <View style={styles.linkContent}>
              <BookOpen size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.linkText}>Polar Support</ThemedText>
              <ExternalLink size={16} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { borderColor: Colors[theme].tint }]}
            onPress={() => openLink("https://github.com/become-hub")}
          >
            <View style={styles.linkContent}>
              <Github size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.linkText}>GitHub Repository</ThemedText>
              <ExternalLink size={16} />
            </View>
          </TouchableOpacity>
        </ThemedView>

        {/* Troubleshooting */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Troubleshooting
          </ThemedText>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <AlertTriangle size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                Connection Issues
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              • Ensure Bluetooth is enabled{"\n"}• Check device battery level
              {"\n"}• Restart the app if needed{"\n"}• Clear stored
              authentication data
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <CheckCircle size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>Data Quality</ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              • Ensure good skin contact{"\n"}• Avoid movement during
              measurement{"\n"}• Check for interference from other devices{"\n"}
              • Allow 30 seconds for stable readings
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Footer */}
        <ThemedView style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Become Monitor v1.0.0{"\n"}
            Professional HRV Monitoring Solution
          </ThemedText>
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
  title: {
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  section: {
    padding: 20,
    paddingTop: 10,
  },
  sectionTitle: {
    marginBottom: 15,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
  linkButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  linkContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkText: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
    marginLeft: 12,
  },
  footer: {
    padding: 20,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: "center",
  },
});
