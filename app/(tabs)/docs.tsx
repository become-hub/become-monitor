import { AppFooter } from "@/components/app-footer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { LocaleStrings } from "@/constants/locale";
import {
  getSignalRowsForTheme,
  POLAR_SIGNAL_THEMES,
  SignalUsedInApp,
} from "@/constants/polar-signal-comparison";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocale } from "@/hooks/use-locale";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bluetooth,
  CheckCircle,
  ChevronDown,
  ChevronUp,
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

function docString(
  docs: LocaleStrings["docs"],
  key: string
): string {
  const short = key.replace(/^docs\./, "") as keyof LocaleStrings["docs"];
  const value = docs[short];
  return typeof value === "string" ? value : key;
}

function usedLabel(
  docs: LocaleStrings["docs"],
  used: SignalUsedInApp
): string {
  switch (used) {
    case "yes":
      return docs.signalUsedYes;
    case "no":
      return docs.signalUsedNo;
    case "derived":
      return docs.signalUsedDerived;
    default:
      return docs.signalUsedNa;
  }
}

export default function DocsScreen() {
  const { theme } = useTheme();
  const { strings } = useLocale();
  const [expandedThemeId, setExpandedThemeId] = useState<string | null>(
    "sensing"
  );

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  const toggleTheme = (id: string) => {
    setExpandedThemeId((current) => (current === id ? null : id));
  };

  return (
    <ThemedView style={styles.container}>
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

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {strings.docs.deviceComparison}
          </ThemedText>
          <ThemedText style={styles.comparisonIntro}>
            {strings.docs.deviceComparisonIntro}
          </ThemedText>

          {POLAR_SIGNAL_THEMES.map((themeItem) => {
            const expanded = expandedThemeId === themeItem.id;
            const rows = getSignalRowsForTheme(themeItem.id);
            return (
              <ThemedView key={themeItem.id} style={styles.accordionCard}>
                <TouchableOpacity
                  style={styles.accordionHeader}
                  onPress={() => toggleTheme(themeItem.id)}
                  accessibilityRole="button"
                >
                  <View style={styles.accordionHeaderText}>
                    <ThemedText style={styles.cardTitle}>
                      {docString(strings.docs, themeItem.titleKey)}
                    </ThemedText>
                    <ThemedText style={styles.accordionDesc}>
                      {docString(strings.docs, themeItem.descriptionKey)}
                    </ThemedText>
                  </View>
                  {expanded ? (
                    <ChevronUp size={20} color={Colors[theme].tint} />
                  ) : (
                    <ChevronDown size={20} color={Colors[theme].tint} />
                  )}
                </TouchableOpacity>

                {expanded && (
                  <View style={styles.table}>
                    <View style={[styles.tableRow, styles.tableHeaderRow]}>
                      <ThemedText style={[styles.tableCell, styles.tableHeader]}>
                        {strings.docs.signalMetric}
                      </ThemedText>
                      <ThemedText style={[styles.tableCell, styles.tableHeader]}>
                        {strings.docs.signalPolar360}
                      </ThemedText>
                      <ThemedText style={[styles.tableCell, styles.tableHeader]}>
                        {strings.docs.signalPolarLoop}
                      </ThemedText>
                      <ThemedText style={[styles.tableCell, styles.tableHeader]}>
                        {strings.docs.signalPolarH10}
                      </ThemedText>
                      <ThemedText style={[styles.tableCell, styles.tableHeader]}>
                        {strings.docs.signalUsedInApp}
                      </ThemedText>
                    </View>
                    {rows.map((row) => (
                      <View key={row.id} style={styles.tableBlock}>
                        <View style={styles.tableRow}>
                          <ThemedText style={[styles.tableCell, styles.metricCell]}>
                            {docString(strings.docs, row.metricKey)}
                          </ThemedText>
                          <ThemedText style={styles.tableCell}>
                            {row.polar360}
                          </ThemedText>
                          <ThemedText style={styles.tableCell}>
                            {row.polarLoop}
                          </ThemedText>
                          <ThemedText style={styles.tableCell}>
                            {row.polarH10}
                          </ThemedText>
                          <ThemedText style={styles.tableCell}>
                            {usedLabel(strings.docs, row.usedInApp)}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.noteText}>
                          {strings.docs.signalNotes}:{" "}
                          {docString(strings.docs, row.scientificNoteKey)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </ThemedView>
            );
          })}
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
  accordionCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  accordionHeaderText: {
    flex: 1,
  },
  accordionDesc: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 4,
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
  table: {
    marginTop: 12,
    gap: 10,
  },
  tableHeaderRow: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.12)",
    paddingBottom: 8,
  },
  tableRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  tableBlock: {
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  tableCell: {
    width: "48%",
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.85,
    marginBottom: 4,
  },
  tableHeader: {
    fontWeight: "700",
    opacity: 1,
  },
  metricCell: {
    fontWeight: "600",
    width: "100%",
  },
  noteText: {
    fontSize: 12,
    opacity: 0.7,
    lineHeight: 16,
    marginTop: 4,
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
