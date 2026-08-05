/**
 * Shared Metric Card — optional live heart pulse + smooth number transitions
 */

import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useTheme } from "@/contexts/ThemeContext";
import type { LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";
import { monitorStyles } from "./monitor-styles";

const LIVE_HEART = "#EF4444";

/** One cardiac cycle: systole (lub) + diastole kick (dub) + rest. Soft glow only during beats. */
function createHeartbeatCycle(
  scale: Animated.Value,
  glow: Animated.Value
): Animated.CompositeAnimation {
  const softIn = Easing.out(Easing.cubic);
  const softOut = Easing.inOut(Easing.cubic);

  return Animated.parallel([
    Animated.sequence([
      // lub
      Animated.timing(scale, {
        toValue: 1.14,
        duration: 120,
        easing: softIn,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.97,
        duration: 140,
        easing: softOut,
        useNativeDriver: true,
      }),
      Animated.delay(50),
      // dub
      Animated.timing(scale, {
        toValue: 1.08,
        duration: 100,
        easing: softIn,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 280,
        easing: softOut,
        useNativeDriver: true,
      }),
    ]),
    Animated.sequence([
      Animated.timing(glow, {
        toValue: 0.18,
        duration: 120,
        easing: softIn,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 0,
        duration: 200,
        easing: softOut,
        useNativeDriver: true,
      }),
      Animated.delay(50),
      Animated.timing(glow, {
        toValue: 0.1,
        duration: 100,
        easing: softIn,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 0,
        duration: 320,
        easing: softOut,
        useNativeDriver: true,
      }),
    ]),
  ]);
}

function bpmToIntervalMs(bpm: number): number {
  const clamped = Math.min(180, Math.max(45, bpm));
  return Math.round(60000 / clamped);
}

interface MetricCardProps {
  label: string;
  value: string | number;
  unit: string;
  icon?: LucideIcon;
  highlighted?: boolean;
  fullWidth?: boolean;
  /** Heartbeat pulse on the icon every second while live. */
  pulse?: boolean;
  style?: ViewStyle;
}

function useSmoothNumber(value: string | number, durationMs = 420): string | number {
  const [display, setDisplay] = useState<string | number>(value);
  const displayRef = useRef(typeof value === "number" ? value : 0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof value !== "number") {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      setDisplay(value);
      return;
    }

    const from = displayRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }

    const startedAt = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      const rounded =
        Number.isInteger(to) && Number.isInteger(from)
          ? Math.round(next)
          : Math.round(next * 10) / 10;
      displayRef.current = rounded;
      setDisplay(rounded);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = to;
        setDisplay(to);
        frameRef.current = null;
      }
    };

    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [value, durationMs]);

  return display;
}

export function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  highlighted = false,
  fullWidth = false,
  pulse = false,
  style,
}: MetricCardProps) {
  const { theme } = useTheme();
  const isLive = pulse && typeof value === "number" && value > 0;
  const iconColor = isLive ? LIVE_HEART : Colors[theme].tint;
  const displayValue = useSmoothNumber(value);
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const bpmRef = useRef(72);

  useEffect(() => {
    if (typeof value === "number" && value > 0) {
      bpmRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (!isLive) {
      scale.stopAnimation();
      glow.stopAnimation();
      scale.setValue(1);
      glow.setValue(0);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cycle: Animated.CompositeAnimation | null = null;

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }
      const intervalMs = bpmToIntervalMs(bpmRef.current);
      // Soft lub-dub ~690ms; rest fills the remainder of the RR interval.
      const restMs = Math.max(80, intervalMs - 690);
      timeoutId = setTimeout(runCycle, restMs);
    };

    const runCycle = () => {
      if (cancelled) {
        return;
      }
      scale.setValue(1);
      glow.setValue(0);
      cycle = createHeartbeatCycle(scale, glow);
      cycle.start(({ finished }) => {
        if (finished && !cancelled) {
          scheduleNext();
        }
      });
    };

    runCycle();

    return () => {
      cancelled = true;
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
      cycle?.stop();
      scale.stopAnimation();
      glow.stopAnimation();
      scale.setValue(1);
      glow.setValue(0);
    };
  }, [isLive, scale, glow]);

  return (
    <View
      style={[
        monitorStyles.metricCard,
        fullWidth && monitorStyles.metricCardFull,
        highlighted && monitorStyles.metricCardHighlight,
        {
          borderColor: highlighted ? Colors[theme].tint : Colors[theme].border,
        },
        style,
      ]}
    >
      {Icon && (
        <View style={monitorStyles.metricIconContainer}>
          <Animated.View
            style={[
              monitorStyles.metricIconPulseHalo,
              {
                opacity: glow,
                transform: [{ scale }],
              },
            ]}
            pointerEvents="none"
          />
          <Animated.View style={{ transform: [{ scale }], zIndex: 1 }}>
            <Icon
              size={24}
              color={iconColor}
              fill={isLive ? LIVE_HEART : "transparent"}
            />
          </Animated.View>
        </View>
      )}
      <ThemedText style={monitorStyles.metricLabel}>{label}</ThemedText>
      <ThemedText style={monitorStyles.metricValue}>{displayValue}</ThemedText>
      <ThemedText style={monitorStyles.metricUnit}>{unit}</ThemedText>
    </View>
  );
}
