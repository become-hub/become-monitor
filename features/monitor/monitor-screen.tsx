/**
 * Monitor Screen
 * Composition: hook + components
 */

import { AppFooter } from "@/components/app-footer";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ScrollView } from "react-native";
import { MonitorActions } from "./components/monitor-actions";
import { MonitorHeader } from "./components/monitor-header";
import { MonitorNotification } from "./components/monitor-notification";
import { MonitorStatusSection } from "./components/monitor-status-section";
import { MuseMetricsGrid } from "./components/muse-metrics-grid";
import { PolarMetricsGrid } from "./components/polar-metrics-grid";
import { monitorStyles } from "./components/monitor-styles";
import { useMonitorSession } from "./hooks/use-monitor-session";

export default function MonitorScreen() {
  const session = useMonitorSession();

  const subtitle = session.connectedDeviceId
    ? session.isMuseConnected
      ? "Monitoraggio Muse 2 (EEG, bande, HR PPG)"
      : session.isH10Connected
      ? "Monitoraggio H10 (HR, RR ECG, ECG, HRV, LF/HF)"
      : "Monitoraggio cardiaco avanzato con HRV"
    : "Connetti un dispositivo Polar o Muse per iniziare";

  return (
    <ThemedView style={monitorStyles.container}>
      <MonitorNotification
        notification={session.notification}
        onClose={() => session.setNotification(null)}
      />

      <ScrollView style={monitorStyles.scrollView}>
        <MonitorHeader
          titleDisplayName={
            session.connectedDeviceId ? session.titleDisplayName : "Polar Monitor"
          }
          subtitle={subtitle}
          connectedDeviceId={session.connectedDeviceId}
          deviceMenuOpen={session.deviceMenuOpen}
          setDeviceMenuOpen={session.setDeviceMenuOpen}
          onResetAuthSession={session.resetAuthSessionForDevice}
        />

        <MonitorStatusSection
          bluetoothStateText={session.getBluetoothStateText()}
          deviceStatusText={session.getDeviceStatusText()}
          streamingStatusText={session.getStreamingStatusText()}
          deviceCode={session.deviceCode}
          userId={session.userId}
          appId={session.appId}
          offlineRecordingStarted={session.offlineRecordingStarted}
          connectedDeviceId={session.connectedDeviceId}
          showRawEcgCards={session.showRawEcgCards}
          authToken={session.authToken}
          authCode={session.authCode}
        />

        <ThemedView style={monitorStyles.metricsSection}>
          <ThemedText type="subtitle" style={monitorStyles.sectionTitle}>
            {session.isMuseConnected
              ? "Metriche Muse 2"
              : session.isH10Connected
              ? "Metriche H10 disponibili"
              : "Metriche Cardiache"}
          </ThemedText>

          {session.isMuseConnected ? (
            <MuseMetricsGrid
              connectedDeviceId={session.connectedDeviceId}
              eegTp9={session.eegTp9}
              eegAf7={session.eegAf7}
              eegAf8={session.eegAf8}
              eegTp10={session.eegTp10}
              bandDelta={session.bandDelta}
              bandTheta={session.bandTheta}
              bandAlpha={session.bandAlpha}
              bandBeta={session.bandBeta}
              bandGamma={session.bandGamma}
              museHr={session.museHr}
              museBattery={session.museBattery}
            />
          ) : (
            <PolarMetricsGrid
              connectedDeviceId={session.connectedDeviceId}
              heartRate={session.heartRate}
              hrv={session.hrv}
              lfPower={session.lfPower}
              hfPower={session.hfPower}
              rrMs={session.rrMs}
              rrSource={session.rrSource}
              ecgMicroVolts={session.ecgMicroVolts}
              skinTemperatureC={session.skinTemperatureC}
              ppiWindowLength={session.ppiWindowLength}
              isH10Connected={session.isH10Connected}
              showRawEcgCards={session.showRawEcgCards}
              isSkinTemperatureSupported={session.isSkinTemperatureSupported}
            />
          )}
        </ThemedView>

        <MonitorActions
          connectedDeviceId={session.connectedDeviceId}
          isScanning={session.isScanning}
          isConnectingSelected={session.isConnectingSelected}
          bluetoothPowered={session.bluetoothPowered}
          discoveredDevices={session.discoveredDevices}
          foundDeviceName={session.foundDeviceName}
          isFlushingTrack={session.isFlushingTrack}
          debugMode={session.debugMode}
          authToken={session.authToken}
          disconnectButtonLabel={session.getDisconnectButtonLabel()}
          onStartScan={session.startScan}
          onSelectAndConnect={session.selectAndConnect}
          onDisconnect={session.disconnectDevice}
          onFlushTrack={() => session.handleFlushTrack(null)}
          onClearStoredAuth={session.clearStoredAuth}
        />

        <ThemedView style={monitorStyles.infoSection}>
          <ThemedText style={monitorStyles.infoText}>
            I dispositivi Polar 360 si connettono alla piattaforma Become per
            offrire esperienze VR immersive e reattive. I dati biometrici
            raccolti vengono trasmessi in tempo reale alle applicazioni Become,
            consentendo un&apos;interazione precisa tra corpo e ambiente
            virtuale.
          </ThemedText>

          <ThemedText style={monitorStyles.infoText}>
            Il sistema effettua un monitoraggio avanzato della frequenza
            cardiaca e calcola metriche HRV (RMSSD) con analisi delle bande
            LF/HF, fornendo un feedback fisiologico continuo per adattare
            dinamicamente la scena VR in base allo stato dell&apos;utente.
          </ThemedText>
        </ThemedView>

        <AppFooter />
      </ScrollView>
    </ThemedView>
  );
}
