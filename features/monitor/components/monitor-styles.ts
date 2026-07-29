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
    padding: 24,
    paddingTop: 8,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusValue: {
    fontSize: 16,
  },
  authCodeContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "rgba(255, 152, 0, 0.1)",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FF9800",
  },
  authCodeLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "600",
  },
  authCode: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    color: "#FF9800",
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
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  discoveredItemText: {
    flex: 1,
    marginRight: 12,
    gap: 8,
  },
  discoveredName: {
    fontSize: 15,
    fontWeight: "600",
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
