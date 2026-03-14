import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useAuth } from '../../context/auth';
import { useRouter } from 'expo-router';

export default function EncargadoDashboard() {
  const { userData, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (authLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!userData) {
    return (
      <View className="flex-1 justify-center items-center bg-white p-8">
        <Text className="text-xl font-bold text-gray-800 mb-4">No se encontró información del usuario</Text>
        <TouchableOpacity onPress={handleSignOut} className="bg-blue-600 px-6 py-3 rounded-xl">
           <Text className="text-white font-bold">Volver al Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSignOut = () => {
    auth.signOut();
    router.replace('/');
  };

  const procesarExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      setLoading(true);

      const fileUri = result.assets[0].uri;
      const response = await fetch(fileUri);
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Parse JSON with headers
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            Alert.alert('Error', 'El archivo Excel parece estar vacío o no tiene la estructura correcta.');
            setLoading(false);
            return;
          }

          // Headers are in index 0, data starts from index 1
          const headers = jsonData[0];
          const rows = jsonData.slice(1);

          // Find column indices based on our known structure
          // Nombres Y Apellidos / DNI / Codigo
          const nameIndex = headers.findIndex(h => typeof h === 'string' && h.toUpperCase().includes('NOMBRE'));
          const dniIndex = headers.findIndex(h => typeof h === 'string' && h.toUpperCase().includes('DNI'));
          const codeIndex = headers.findIndex(h => typeof h === 'string' && h.toUpperCase().includes('CODIGO'));
          const dateIndex = headers.findIndex(h => typeof h === 'string' && h.toUpperCase().includes('FECHA'));

          // Try to get the date from the first row, or use today's date
          let reportDate = new Date().toISOString().split('T')[0];
          if (dateIndex !== -1 && rows[0] && rows[0][dateIndex]) {
             // In excel, dates might be serial numbers, but for simplicity we'll just store the raw string or generic date for now
             reportDate = String(rows[0][dateIndex]);
          }

           // 1. Create the main report document
          const reportRef = await addDoc(collection(db, 'reports'), {
            companyId: userData.companyId || 'N/A',
            date: reportDate,
            uploadedBy: auth.currentUser?.uid || 'Unknown',
            status: 'OPEN',
            createdAt: new Date().toISOString()
          });

          // 2. Add each person to the subcollection
          const batchPromises = rows.map(async (row) => {
            // Skip empty rows
            if (!row || row.length === 0 || !row[nameIndex]) return;

            const personaRef = doc(collection(db, `reports/${reportRef.id}/people`));
            return setDoc(personaRef, {
              nombreCompleto: nameIndex !== -1 ? String(row[nameIndex] || '') : 'Desconocido',
              dni: dniIndex !== -1 ? String(row[dniIndex] || '') : '',
              codigo: codeIndex !== -1 ? String(row[codeIndex] || '') : '',
              observacion: '',
              respuestaObservacion: ''
            });
          });

          await Promise.all(batchPromises);

          Alert.alert('¡Éxito!', `Reporte subido correctamente. ID: ${reportRef.id}`);
        } catch (err) {
          console.error("Error al procesar data:", err);
          Alert.alert('Error', 'Hubo un problema procesando el contenido del Excel.');
        } finally {
          setLoading(false);
        }
      };

      reader.readAsArrayBuffer(blob);

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo leer el archivo.');
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 24, paddingBottom: 64 }}>
      <View className="flex-row justify-between items-center mb-8 mt-4">
         <View>
            <Text className="text-2xl font-bold text-gray-900">Hola, {userData?.name || 'Encargado'}</Text>
            <Text className="text-blue-600 font-medium mt-1">Empresa {userData?.companyId === '9' ? 'Rapel' : 'Verfrut'} ({userData?.companyId})</Text>
         </View>
         <TouchableOpacity 
           onPress={handleSignOut}
           className="bg-gray-200 px-4 py-2 rounded-lg"
         >
           <Text className="text-gray-700 font-medium text-sm">Salir</Text>
         </TouchableOpacity>
      </View>

      <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <Text className="text-lg font-bold text-gray-800 mb-2">Subir Reporte de Asistencia</Text>
        <Text className="text-gray-500 mb-6 leading-5">
          Selecciona el archivo Excel (.xlsx) con el registro diario de trabajadores. El sistema extraerá la información para el Control de Asistencia.
        </Text>

        <TouchableOpacity 
          onPress={procesarExcel}
          disabled={loading}
          className={`w-full py-4 rounded-xl flex-row justify-center items-center shadow-sm shadow-blue-200 ${loading ? 'bg-blue-400' : 'bg-blue-600'}`}
        >
          {loading ? (
             <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg ml-2">📄 Seleccionar Archivo Excel</Text>
          )}
        </TouchableOpacity>
      </View>

      <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <Text className="text-lg font-bold text-gray-800 mb-4">Reportes Recientes</Text>
        {/* Aquí luego listaremos los reportes subidos. Por ahora es un placeholder */}
        <View className="bg-gray-50 p-4 rounded-lg flex-row justify-between items-center mb-3">
           <View>
              <Text className="font-semibold text-gray-800">Reporte del día</Text>
              <Text className="text-xs text-gray-500 mt-1">Fecha: Hoy</Text>
           </View>
           <View className="bg-green-100 px-3 py-1 rounded-full">
              <Text className="text-green-700 text-xs font-bold">ABIERTO</Text>
           </View>
        </View>
      </View>

    </ScrollView>
  );
}
