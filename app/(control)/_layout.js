import { Stack } from 'expo-router';

export default function ControlLayout() {
  return (
    <Stack>
      <Stack.Screen name="dashboard" options={{ title: 'Panel de Control' }} />
      <Stack.Screen name="report/[id]" options={{ title: 'Detalle de Reporte' }} />
    </Stack>
  );
}
