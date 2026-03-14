import { Stack } from 'expo-router';

export default function EncargadoLayout() {
  return (
    <Stack>
      <Stack.Screen name="dashboard" options={{ title: 'Panel de Encargado' }} />
    </Stack>
  );
}
