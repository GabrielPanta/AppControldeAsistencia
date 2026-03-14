import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor, llena todos los campos.');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Get role from Firestore
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const { role } = userDoc.data();
        if (role === 'ENCARGADO') {
          router.replace('/(encargado)/dashboard');
        } else if (role === 'CONTROL') {
          router.replace('/(control)/dashboard');
        } else {
          Alert.alert('Error', 'Rol no válido');
          auth.signOut();
        }
      } else {
        Alert.alert('Error', 'No se encontró el perfil del usuario');
        auth.signOut();
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error de autenticación', 'Correo o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white justify-center px-8">
      <View className="items-center mb-10">
        <View className="w-24 h-24 bg-blue-100 rounded-full items-center justify-center mb-4">
          <Text className="text-4xl">🏢</Text>
        </View>
        <Text className="text-3xl font-extrabold text-gray-900 tracking-tight">Bienvenido</Text>
        <Text className="text-base text-gray-500 mt-2 text-center">
          Ingresa para gestionar la asistencia
        </Text>
      </View>

      <View className="space-y-4">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1">Correo Electrónico</Text>
          <TextInput
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-800 focus:border-blue-500 focus:bg-white transition-colors"
            placeholder="ejemplo@empresa.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1 mt-4">Contraseña</Text>
          <TextInput
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-800 focus:border-blue-500 focus:bg-white transition-colors"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          onPress={handleLogin}
          disabled={loading}
          className={`w-full py-4 rounded-xl mt-6 flex-row justify-center items-center shadow-sm shadow-blue-200 ${loading ? 'bg-blue-400' : 'bg-blue-600'}`}
        >
          {loading ? (
             <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-bold text-lg">Iniciar Sesión</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500">¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/register')}>
            <Text className="text-blue-600 font-semibold">Regístrate aquí</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
