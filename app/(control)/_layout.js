import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function ControlLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="report/[id]" />
    </Stack>
  );
}
