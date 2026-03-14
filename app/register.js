import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useRouter } from 'expo-router';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(''); // 'ENCARGADO' or 'CONTROL'
  const [company, setCompany] = useState(''); // '9' or '14'
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  const handleRegister = async () => {
    if (!email || !password || !name || !role || !company) {
      Alert.alert('Error', 'Todos los campos son obligatorios.');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      // Save extra user info to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: email.trim(),
        name: name.trim(),
        role: role,
        companyId: company,
        createdAt: new Date().toISOString()
      });

      // Auto login will happen due to AuthContext listener, but we can navigate manually 
      if (role === 'ENCARGADO') {
        router.replace('/(encargado)/dashboard');
      } else {
        router.replace('/(control)/dashboard');
      }

    } catch (error) {
      console.error(error);
      Alert.alert('Error de registro', error.message || 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ padding: 32, paddingBottom: 64 }}>
      <TouchableOpacity onPress={() => router.back()} className="mb-4">
        <Text className="text-gray-500 font-medium">← Volver al login</Text>
      </TouchableOpacity>

      <Text className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2 mt-4">Crea una cuenta</Text>
      <Text className="text-base text-gray-500 mb-8">
        Regístrate para comenzar a gestionar el control de asistencia.
      </Text>

      <View className="space-y-4">
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1">Nombre Completo</Text>
          <TextInput
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-800 focus:border-blue-500"
            placeholder="Juan Perez"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View className="mt-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Correo Electrónico</Text>
          <TextInput
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-800 focus:border-blue-500"
            placeholder="ejemplo@empresa.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View className="mt-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">Contraseña</Text>
          <TextInput
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-800 focus:border-blue-500"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <View className="mt-6 mb-2">
          <Text className="text-sm font-bold text-gray-800 mb-3">SELECCIONA TU ROL</Text>
          <View className="flex-row">
            <TouchableOpacity 
              onPress={() => setRole('ENCARGADO')}
              className={`flex-1 py-3 px-2 rounded-lg border flex-row justify-center items-center mr-2 
                ${role === 'ENCARGADO' ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200'}`}
            >
              <Text className={`font-semibold text-center ${role === 'ENCARGADO' ? 'text-blue-700' : 'text-gray-600'}`}>
                Encargado
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setRole('CONTROL')}
              className={`flex-1 py-3 px-2 rounded-lg border flex-row justify-center items-center ml-2
                ${role === 'CONTROL' ? 'bg-purple-50 border-purple-500' : 'bg-white border-gray-200'}`}
            >
              <Text className={`font-semibold text-center ${role === 'CONTROL' ? 'text-purple-700' : 'text-gray-600'}`}>
                Control
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-6 mb-4">
          <Text className="text-sm font-bold text-gray-800 mb-3">SELECCIONA LA EMPRESA</Text>
          <View className="flex-row">
            <TouchableOpacity 
              onPress={() => setCompany('9')}
              className={`flex-1 py-3 px-2 rounded-lg border flex-row justify-center items-center mr-2
                ${company === '9' ? 'bg-green-50 border-green-500' : 'bg-white border-gray-200'}`}
             >
              <Text className={`font-semibold text-center ${company === '9' ? 'text-green-700' : 'text-gray-600'}`}>
                Rapel (9)
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setCompany('14')}
              className={`flex-1 py-3 px-2 rounded-lg border flex-row justify-center items-center ml-2
                ${company === '14' ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-gray-200'}`}
            >
              <Text className={`font-semibold text-center ${company === '14' ? 'text-emerald-700' : 'text-gray-600'}`}>
                Verfrut (14)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          onPress={handleRegister}
          disabled={loading}
          className={`w-full py-4 rounded-xl mt-8 flex-row justify-center items-center shadow-sm ${loading ? 'bg-gray-400' : 'bg-gray-900'}`}
        >
           {loading ? (
             <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-bold text-lg">Completar Registro</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
