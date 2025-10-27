import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { StyleSheet } from "react-native";
import packageJson from "../package.json";

export function AppFooter() {
  return (
    <ThemedView style={styles.footer}>
      <ThemedText style={styles.footerText}>
        Become Monitor v{packageJson.version}
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
