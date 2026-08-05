import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { APP_VERSION } from "@/constants/app-version";
import { StyleSheet } from "react-native";

export function AppFooter() {
  return (
    <ThemedView style={styles.footer}>
      <ThemedText style={styles.footerText}>
        Augmented Monitor v{APP_VERSION}
        {"\n"}
        Professional HRV Monitoring Solution
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
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
