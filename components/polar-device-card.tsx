import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import {
  PolarProduct,
  PolarProductId,
} from "@/features/devices/polar/polar-products";

const PRODUCT_IMAGES: Record<PolarProductId, number> = {
  polar_360: require("@/assets/images/polar360.webp"),
  polar_loop: require("@/assets/images/polar-loop.png"),
  polar_h10: require("@/assets/images/polar-h10.png"),
};

type PolarDeviceCardProps = {
  product: PolarProduct;
  description: string;
  ctaLabel: string;
  onPress: () => void;
};

export function PolarDeviceCard({
  product,
  description,
  ctaLabel,
  onPress,
}: PolarDeviceCardProps) {
  const { theme } = useTheme();

  return (
    <ThemedView
      style={[styles.card, { borderColor: Colors[theme].border }]}
    >
      <Image
        source={PRODUCT_IMAGES[product.id]}
        style={styles.image}
        contentFit="contain"
      />
      <View style={styles.content}>
        <View style={styles.poweredByRow}>
          <ThemedText style={styles.poweredByText}>powered by</ThemedText>
          <Image
            source={require("@/assets/images/polar-logo.webp")}
            style={styles.polarLogo}
            contentFit="contain"
          />
        </View>
        <ThemedText type="subtitle" style={styles.title}>
          {product.displayName}
        </ThemedText>
        <ThemedText style={styles.text}>{description}</ThemedText>
        <TouchableOpacity
          style={[styles.button, { borderColor: Colors[theme].tint }]}
          onPress={onPress}
        >
          <ThemedText
            style={[styles.buttonText, { color: Colors[theme].tint }]}
          >
            {ctaLabel}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 14,
  },
  image: {
    width: 88,
    height: 88,
  },
  content: {
    flex: 1,
  },
  poweredByRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginBottom: 6,
  },
  polarLogo: {
    width: 52,
    height: 24,
  },
  poweredByText: {
    fontSize: 11,
    opacity: 0.6,
    fontWeight: "500",
  },
  title: {
    marginBottom: 6,
    fontSize: 17,
  },
  text: {
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 18,
    marginBottom: 10,
  },
  button: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
