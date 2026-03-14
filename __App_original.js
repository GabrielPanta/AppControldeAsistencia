import './global.css'; // NativeWind v4 requires a global CSS file
import { ExpoRoot } from 'expo-router';
import Head from 'expo-router/head';

// Provide the current context to the Expo Root.
export default function App() {
  const ctx = require.context('./app');
  return (
    <>
      <Head>
        <title>Control de Asistencia</title>
      </Head>
      <ExpoRoot context={ctx} />
    </>
  );
}
