import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebaseConfig';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { useRouter } from 'expo-router';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('CONTROL'); // Default to CONTROL
  const [company, setCompany] = useState('14'); // Default to Verfrut
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();

  const handleRegister = async () => {
    if (!email || !password || !name || !role || !company) {
      Alert.alert('Error', 'Todos los campos son obligatorios.');
      return;
    }

    const isAdmin = (auth.currentUser?.email || '')?.trim().toLowerCase() === 'gpanta@verfrut.pe';
    if (!isAdmin) {
      Alert.alert('Acceso Denegado', 'Solo el administrador maestro puede registrar nuevos usuarios.');
      return;
    }

    // Using a secondary app instance to create user without kicking admin out (same pattern as web)
    try {
      setLoading(true);
      
      let secondaryApp = getApps().find(a => a.name === "SecondaryAppRegister");
      if (!secondaryApp) {
        secondaryApp = initializeApp(firebaseConfig, "SecondaryAppRegister");
      }
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
      
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role: role,
        companyId: company,
        createdAt: new Date().toISOString()
      });

      await signOut(secondaryAuth);
      try {
        await deleteApp(secondaryApp);
      } catch (e) {
        console.log("Error deleting secondary app:", e);
      }

      Alert.alert('Éxito', 'Usuario creado correctamente.', [
        { text: 'Aceptar', onPress: () => router.back() }
      ]);

    } catch (error) {
      console.error(error);
      Alert.alert('Error de registro', error.message || 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1">
        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ 
            padding: 24, 
            paddingTop: Platform.OS === 'android' ? insets.top + 20 : 20, 
            paddingBottom: 60 
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button - Moved down for better accessibility */}
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100 mb-8"
          >
            <Text className="text-xl text-slate-900">←</Text>
          </TouchableOpacity>

          <View className="mb-10">
            <Text className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Administración</Text>
            <Text className="text-4xl font-black text-slate-900 tracking-tighter">Nuevo Usuario</Text>
            <Text className="text-slate-400 mt-2 font-medium leading-5">Configura una nueva cuenta de acceso para el personal.</Text>
          </View>

          <View className="space-y-6">
            <View>
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nombre Completo</Text>
              <TextInput
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-base text-slate-900 font-bold focus:border-indigo-500"
                placeholder="Ej. Juan Pérez"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View>
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Correo Electrónico</Text>
              <TextInput
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-base text-slate-900 font-bold focus:border-indigo-500"
                placeholder="usuario@verfrut.pe"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View>
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Contraseña</Text>
              <TextInput
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 text-base text-slate-900 font-bold focus:border-indigo-500"
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {/* Role Selector */}
            <View>
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Rol del Usuario</Text>
              <View className="flex-row gap-3">
                {['CONTROL', 'ENCARGADO'].map((r) => (
                  <TouchableOpacity 
                    key={r}
                    onPress={() => setRole(r)}
                    activeOpacity={0.8}
                    className={`flex-1 py-4 rounded-2xl border items-center justify-center 
                      ${role === r ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-white border-slate-100'}`}
                  >
                    <Text className={`font-black text-[10px] uppercase tracking-widest ${role === r ? 'text-white' : 'text-slate-400'}`}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Company Selector */}
            <View>
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Sede / Empresa</Text>
              <View className="flex-row gap-3">
                {[
                  { id: '9', name: 'Rapel' },
                  { id: '14', name: 'Verfrut' },
                  { id: '23', name: 'Avanti' }
                ].map((c) => (
                  <TouchableOpacity 
                    key={c.id}
                    onPress={() => setCompany(c.id)}
                    activeOpacity={0.8}
                    className={`flex-1 py-4 rounded-2xl border items-center justify-center 
                      ${company === c.id ? 'bg-slate-900 border-slate-900 shadow-lg shadow-slate-100' : 'bg-white border-slate-100'}`}
                  >
                    <Text className={`font-black text-[10px] uppercase tracking-widest ${company === c.id ? 'text-white' : 'text-slate-400'}`}>
                      {c.name} ({c.id})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
              className={`w-full py-6 rounded-[2rem] mt-6 flex-row justify-center items-center shadow-2xl shadow-indigo-200 ${loading ? 'bg-slate-300' : 'bg-indigo-600 border border-indigo-500'}`}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <View className="flex-row items-center">
                  <Text className="text-white font-black uppercase tracking-widest text-xs mr-2">Crear Usuario</Text>
                  <Text className="text-lg">✨</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
