import { Stack } from 'expo-router';
import { AuthProvider } from '../context/auth';
import '../global.css';

export default function Layout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
      </Stack>
    </AuthProvider>
  );
}
