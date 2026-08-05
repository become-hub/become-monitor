/**
 * Monitor Feature Styles
 * StyleSheet for monitor components (8pt grid polish applied)
 */

import { StyleSheet } from "react-native";

export const monitorStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 60,
    zIndex: 20,
    overflow: "visible",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
    zIndex: 21,
  },
  title: {
    flex: 1,
    marginBottom: 0,
  },
  deviceMenuWrap: {
    position: "relative",
    zIndex: 22,
  },
  deviceMenuButton: {
    padding: 4,
  },
  deviceMenuDropdown: {
    position: "absolute",
    top: 32,
    right: 0,
    minWidth: 180,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 30,
  },
  deviceMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deviceMenuItemText: {
    fontSize: 14,
    fontWeight: "500",
  },
  deviceMenuItemTextDanger: {
    fontSize: 14,
    fontWeight: "500",
    color: "#EF4444",
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  statusSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  statusPanel: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusCompactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
  statusCompactLabel: {
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.55,
    width: 78,
  },
  statusCompactValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  statusAccordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 4,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.12)",
  },
  statusAccordionTitle: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.55,
  },
  statusAccordionBody: {
    paddingTop: 4,
    paddingBottom: 2,
    gap: 2,
  },
  statusDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 5,
  },
  statusDetailLabel: {
    fontSize: 12,
    opacity: 0.55,
    width: 90,
  },
  statusDetailValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
  },
  authCodeContainer: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  authCodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  authCodeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  authCodeHeaderText: {
    flex: 1,
    gap: 2,
  },
  authCodeEyebrow: {
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  authCodeLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  authCodeDigits: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  authCodeDigit: {
    minWidth: 44,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  authCodeDigitText: {
    fontSize: 26,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  authCodeHint: {
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.6,
    textAlign: "center",
  },
  authCode: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 4,
  },
  notification: {
    position: "absolute",
    top: 60,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 8,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  notificationSuccess: {
    backgroundColor: "#10B981",
  },
  notificationError: {
    backgroundColor: "#EF4444",
  },
  notificationText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
    flex: 1,
  },
  notificationCloseButton: {
    padding: 4,
    marginLeft: 8,
  },
  metricsSection: {
    padding: 24,
    paddingTop: 8,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  waitingText: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
    textAlign: "center",
  },
  metricsGrid: {
    gap: 16,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 16,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  metricCardFull: {
    flex: 1,
  },
  metricCardHighlight: {
    borderWidth: 2,
  },
  metricIconContainer: {
    marginBottom: 8,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  metricIconPulseHalo: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.35)",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  metricLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
    fontWeight: "500",
    textAlign: "center",
  },
  metricValue: {
    fontSize: 32,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  metricUnit: {
    fontSize: 14,
    opacity: 0.6,
    fontWeight: "400",
    textAlign: "center",
  },
  controlsSection: {
    padding: 24,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  scanButton: {
    // backgroundColor set dynamically
  },
  disconnectButton: {
    backgroundColor: "#F44336",
  },
  reconnectButton: {
    backgroundColor: "#2196F3",
    marginTop: 8,
  },
  ablyReconnectButton: {
    backgroundColor: "#9C27B0",
    marginTop: 8,
  },
  discoveredList: {
    marginTop: 16,
    gap: 8,
  },
  discoveredTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  connectingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  connectingText: {
    fontSize: 14,
    opacity: 0.8,
  },
  discoveredItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  discoveredIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  discoveredDeviceImage: {
    width: 48,
    height: 48,
  },
  discoveredItemText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  discoveredName: {
    fontSize: 16,
    fontWeight: "600",
  },
  discoveredDeviceId: {
    fontSize: 12,
    opacity: 0.45,
    fontFamily: "monospace",
  },
  productBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  productBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  connectHint: {
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 0,
  },
  connectedButtons: {
    width: "100%",
    gap: 8,
  },
  flushButton: {
    marginTop: 0,
  },
  clearButton: {
    backgroundColor: "#FF9800",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  successMessage: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderWidth: 2,
    borderColor: "#4CAF50",
    alignItems: "center",
  },
  successText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4CAF50",
  },
  infoSection: {
    padding: 24,
    paddingTop: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
});
