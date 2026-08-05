import { AppFooter } from "@/components/app-footer";
import { PolarSetupGuideModal } from "@/components/polar-setup-guide-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { isDeviceAvailable } from "@/constants/device-availability";
import { LocaleStrings } from "@/constants/locale";
import {
  getAvailableSignalDevices,
  getSignalValue,
  POLAR_SIGNAL_ROWS,
} from "@/constants/polar-signal-comparison";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocale } from "@/hooks/use-locale";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bluetooth,
  BookOpen,
  CheckCircle,
  Cloud,
  ExternalLink,
  Heart,
  Mail,
  Smartphone,
  Wifi,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

function docString(docs: LocaleStrings["docs"], key: string): string {
  const short = key.replace(/^docs\./, "") as keyof LocaleStrings["docs"];
  const value = docs[short];
  return typeof value === "string" ? value : key;
}

export default function DocsScreen() {
  const { theme } = useTheme();
  const { strings } = useLocale();
  const comparisonDevices = getAvailableSignalDevices();
  const showMuse2 = isDeviceAvailable("muse_2");
  const [polarGuideVisible, setPolarGuideVisible] = useState(false);

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <ThemedView style={styles.container}>
      <PolarSetupGuideModal
        visible={polarGuideVisible}
        onClose={() => setPolarGuideVisible(false)}
      />
      <ScrollView style={styles.scrollView}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            {strings.docs.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {strings.docs.subtitle}
          </ThemedText>
        </ThemedView>

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
              onPress={() => setPolarGuideVisible(true)}
            >
              <View style={styles.linkContent}>
                <BookOpen size={16} color={Colors[theme].tint} />
                <ThemedText style={styles.linkText}>
                  {strings.docs.polar360SetupGuide}
                </ThemedText>
              </View>
            </TouchableOpacity>
            {showMuse2 && (
              <TouchableOpacity
                style={[
                  styles.linkButton,
                  { borderColor: Colors[theme].tint, marginTop: 12 },
                ]}
                onPress={() =>
                  openLink(
                    "https://github.com/become-hub/become-monitor/blob/main/docs/muse-2-connection-guide.md"
                  )
                }
              >
                <View style={styles.linkContent}>
                  <ThemedText style={styles.linkText}>
                    {strings.docs.muse2ConnectionGuide}
                  </ThemedText>
                  <ExternalLink size={16} />
                </View>
              </TouchableOpacity>
            )}
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {strings.docs.deviceComparison}
          </ThemedText>
          <ThemedText style={styles.comparisonIntro}>
            {strings.docs.deviceComparisonIntro}
          </ThemedText>

          <ThemedView style={styles.comparisonCard}>
            <View style={styles.comparisonTable}>
              <View style={styles.comparisonHeaderRow}>
                <View style={styles.comparisonMetricCol} />
                  {comparisonDevices.map((device) => (
                    <View key={device.column} style={styles.comparisonDeviceCol}>
                      <ThemedText
                        style={styles.comparisonDeviceHeader}
                        numberOfLines={1}
                      >
                        {device.shortLabel}
                      </ThemedText>
                    </View>
                  ))}
              </View>

              {POLAR_SIGNAL_ROWS.map((row) => (
                <View key={row.id} style={styles.comparisonRow}>
                  <View style={styles.comparisonMetricCol}>
                    <ThemedText
                      style={styles.comparisonMetricLabel}
                      numberOfLines={2}
                    >
                      {docString(strings.docs, row.metricKey)}
                    </ThemedText>
                  </View>
                  {comparisonDevices.map((device) => {
                    const value = getSignalValue(row, device.column);
                    const isNo = value.toLowerCase() === "no";
                    return (
                      <View
                        key={device.column}
                        style={styles.comparisonDeviceCol}
                      >
                        <ThemedText
                          style={[
                            styles.metricValue,
                            isNo && styles.metricValueNo,
                          ]}
                        >
                          {value}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ThemedView>
        </ThemedView>

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
              onPress={() => setPolarGuideVisible(true)}
            >
              <View style={styles.linkContent}>
                <BookOpen size={16} color={Colors[theme].tint} />
                <ThemedText style={styles.linkText}>
                  {strings.docs.viewPolar360Guide}
                </ThemedText>
              </View>
            </TouchableOpacity>
          </ThemedView>

          {showMuse2 && (
            <ThemedView style={styles.card}>
              <View style={styles.cardHeader}>
                <Bluetooth size={20} color={Colors[theme].tint} />
                <ThemedText style={styles.cardTitle}>
                  {strings.docs.muse2ConnectionGuide}
                </ThemedText>
              </View>
              <ThemedText style={styles.cardText}>
                {strings.docs.muse2GuideDescription}
              </ThemedText>
              <TouchableOpacity
                style={[
                  styles.linkButton,
                  { borderColor: Colors[theme].tint, marginTop: 12 },
                ]}
                onPress={() =>
                  openLink(
                    "https://github.com/become-hub/become-monitor/blob/main/docs/muse-2-connection-guide.md"
                  )
                }
              >
                <View style={styles.linkContent}>
                  <ThemedText style={styles.linkText}>
                    {strings.docs.viewMuse2Guide}
                  </ThemedText>
                  <ExternalLink size={16} />
                </View>
              </TouchableOpacity>
            </ThemedView>
          )}
        </ThemedView>

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
  comparisonIntro: {
    fontSize: 14,
    opacity: 0.75,
    lineHeight: 20,
    marginBottom: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  comparisonCard: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    overflow: "hidden",
  },
  comparisonTable: {
    width: "100%",
  },
  comparisonHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.12)",
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  comparisonMetricCol: {
    flex: 1.6,
    paddingRight: 8,
    justifyContent: "center",
  },
  comparisonDeviceCol: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingLeft: 4,
  },
  comparisonDeviceHeader: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    lineHeight: 16,
  },
  comparisonMetricLabel: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
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
  metricValue: {
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.9,
    textAlign: "right",
  },
  metricValueNo: {
    color: "#9CA3AF",
    fontWeight: "500",
    opacity: 1,
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
    gap: 12,
  },
  linkText: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
  },
});
