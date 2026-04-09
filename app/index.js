import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
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
    <View className="flex-1 bg-slate-50">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
        >
          <View className="bg-white px-8 py-12 rounded-[2.5rem] shadow-sm border border-slate-100">
            <View className="items-center mb-10">
              <View className="w-20 h-20 bg-blue-50 rounded-[1.5rem] items-center justify-center mb-6 border border-blue-100">
                <Text className="text-3xl">🏢</Text>
              </View>
              <Text className="text-4xl font-black text-slate-800 tracking-tighter leading-none">Bienvenido</Text>
              <Text className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-[2px] text-center">
                Ingresa para gestionar asistencia
              </Text>
            </View>

            <View className="space-y-5">
              <View>
                <Text className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest pl-1">Correo Electrónico</Text>
                <TextInput
                  className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-base text-slate-800 focus:border-blue-500 focus:bg-white transition-all shadow-none"
                  placeholder="admin@empresa.com"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <View>
                <Text className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest pl-1">Contraseña</Text>
                <TextInput
                  className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 text-base text-slate-800 focus:border-blue-500 focus:bg-white transition-all shadow-none"
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                />
              </View>

              <TouchableOpacity 
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
                className={`w-full h-14 rounded-2xl mt-4 flex-row justify-center items-center shadow-md shadow-blue-200 ${loading ? 'bg-blue-400' : 'bg-blue-600'}`}
              >
                {loading ? (
                   <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-black text-lg tracking-tight">Iniciar Sesión</Text>
                )}
              </TouchableOpacity>

              <View className="flex-row justify-center items-center mt-8">
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest text-center">
                  Acceso exclusivo para personal autorizado
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
