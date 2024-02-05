import { checkAutomatically, checkForUpdateAsync, fetchUpdateAsync, reloadAsync, useUpdates } from 'expo-updates';
import { Button, Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native';


export default function App() {
  const {
    currentlyRunning: { updateId, isEmbeddedLaunch, isEmergencyLaunch, runtimeVersion },
    isChecking,
    isDownloading,
    isUpdateAvailable,
    isUpdatePending,
    availableUpdate,
    checkError,
    downloadError,
    downloadedUpdate,
    initializationError,
    lastCheckForUpdateTimeSinceRestart,
  } = useUpdates();

  return (
    <View style={styles.container}>
      <Text>Version: V</Text>
      <Image source={require('./assets/favicon.png')} />

      <Button title="Reload" onPress={() => reloadAsync()} />
      <Button title="Fetch bundle" onPress={fetchUpdateAsync} />
      <Button title="Check for update" onPress={checkForUpdateAsync} />

      <View style={{ width: Dimensions.get('window').width, height: 200 }}>
        <ScrollView>
          <Text>{JSON.stringify({
            checkAutomatically,
            currentlyRunning: { updateId, isEmbeddedLaunch, isEmergencyLaunch, runtimeVersion },
            isChecking,
            isDownloading,
            isUpdateAvailable,
            isUpdatePending,
            availableUpdate,
            checkError,
            downloadError,
            downloadedUpdate,
            initializationError,
            lastCheckForUpdateTimeSinceRestart
          }, null, 2)}</Text>

        </ScrollView>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
