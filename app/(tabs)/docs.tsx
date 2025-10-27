import { AppFooter } from "@/components/app-footer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocale } from "@/hooks/use-locale";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bluetooth,
  CheckCircle,
  Cloud,
  ExternalLink,
  Heart,
  Mail,
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
  const { strings } = useLocale();

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            {strings.docs.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {strings.docs.subtitle}
          </ThemedText>
        </ThemedView>

        {/* Getting Started */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {strings.docs.gettingStarted}
          </ThemedText>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Smartphone size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                {strings.docs.appOverview}
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              {strings.docs.appOverviewDescription}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Bluetooth size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                {strings.docs.deviceConnection}
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              {strings.docs.deviceConnectionDescription}
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.linkButton,
                { borderColor: Colors[theme].tint, marginTop: 12 },
              ]}
              onPress={() =>
                openLink(
                  "https://github.com/become-hub/become-monitor/blob/main/docs/polar-360-connection-guide.md"
                )
              }
            >
              <View style={styles.linkContent}>
                <ThemedText style={styles.linkText}>
                  {strings.docs.polar360SetupGuide}
                </ThemedText>
                <ExternalLink size={16} />
              </View>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>

        {/* Features */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {strings.docs.keyFeatures}
          </ThemedText>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Heart size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                {strings.docs.heartRateMonitoring}
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              {strings.docs.heartRateMonitoringDescription}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <BarChart3 size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                {strings.docs.hrvAnalysis}
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              {strings.docs.hrvAnalysisDescription}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Cloud size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                {strings.docs.cloudIntegration}
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              {strings.docs.cloudIntegrationDescription}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Technical Details */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {strings.docs.technicalSpecs}
          </ThemedText>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Activity size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                {strings.docs.hrvMetrics}
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              {strings.docs.hrvMetricsDescription}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Bluetooth size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                {strings.docs.supportedDevices}
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              {strings.docs.supportedDevicesDescription}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Device Guides */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {strings.docs.deviceGuides}
          </ThemedText>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Bluetooth size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                {strings.docs.polar360ConnectionGuide}
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              {strings.docs.polar360GuideDescription}
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.linkButton,
                { borderColor: Colors[theme].tint, marginTop: 12 },
              ]}
              onPress={() =>
                openLink(
                  "https://github.com/become-hub/become-monitor/blob/main/docs/polar-360-connection-guide.md"
                )
              }
            >
              <View style={styles.linkContent}>
                <ThemedText style={styles.linkText}>
                  {strings.docs.viewPolar360Guide}
                </ThemedText>
                <ExternalLink size={16} />
              </View>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>

        {/* Resources */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {strings.docs.resources}
          </ThemedText>

          <TouchableOpacity
            style={[styles.linkButton, { borderColor: Colors[theme].tint }]}
            onPress={() => openLink("https://become-hub.com")}
          >
            <View style={styles.linkContent}>
              <Wifi size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.linkText}>
                {strings.docs.becomeHubWebsite}
              </ThemedText>
              <ExternalLink size={16} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkButton, { borderColor: Colors[theme].tint }]}
            onPress={() => openLink("mailto:support@become-hub.com")}
          >
            <View style={styles.linkContent}>
              <Mail size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.linkText}>
                {strings.docs.becomeSupport}
              </ThemedText>
              <ExternalLink size={16} />
            </View>
          </TouchableOpacity>
        </ThemedView>

        {/* Troubleshooting */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {strings.docs.troubleshooting}
          </ThemedText>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <AlertTriangle size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                {strings.docs.connectionIssues}
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              {strings.docs.connectionIssuesDescription}
            </ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <CheckCircle size={20} color={Colors[theme].tint} />
              <ThemedText style={styles.cardTitle}>
                {strings.docs.dataQuality}
              </ThemedText>
            </View>
            <ThemedText style={styles.cardText}>
              {strings.docs.dataQualityDescription}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Footer */}
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
});
