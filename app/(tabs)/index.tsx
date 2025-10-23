import { Image } from "expo-image";
import { StyleSheet } from "react-native";

import { HelloWave } from "@/components/hello-wave";
import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
      headerImage={
        <Image
          source={require("@/assets/images/partial-react-logo.png")}
          style={styles.reactLogo}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Welcome to Become Monitor</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Professional HRV Monitoring</ThemedText>
        <ThemedText>
          Become Monitor is a professional heart rate variability monitoring app
          designed for athletes, health professionals, and wellness enthusiasts.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Key Features</ThemedText>
        <ThemedText>
          • Real-time heart rate monitoring with Polar devices{"\n"}• Advanced
          HRV analysis (RMSSD, LF/HF power){"\n"}• Secure cloud integration with
          Become Hub{"\n"}• Professional-grade data collection and analysis
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Getting Started</ThemedText>
        <ThemedText>
          Navigate to the{" "}
          <ThemedText type="defaultSemiBold">Vital Signs</ThemedText> tab to
          connect your Polar device and start monitoring. Check the{" "}
          <ThemedText type="defaultSemiBold">Docs</ThemedText> tab for detailed
          documentation and troubleshooting guides.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
