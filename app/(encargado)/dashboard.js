import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, FlatList, StatusBar } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { collection, addDoc, doc, setDoc, query, where, onSnapshot, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useAuth } from '../../context/auth';
import { useRouter } from 'expo-router';

// Función para convertir número de serie de Excel a Fecha JS
const excelDateToJSDate = (excelDate) => {
  const timestamp = Math.round((excelDate - 25569) * 86400 * 1000);
  const dateObj = new Date(timestamp);
  const localOffsetInMs = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() + localOffsetInMs);
};

// Función para formatear fecha a DD/MM/YYYY de forma manual (evita problemas de locale)
const formatDateToES = (date) => {
  if (!(date instanceof Date) || isNaN(date)) return String(date);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function EncargadoDashboard() {
  const { userData, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const router = useRouter();

  useEffect(() => {
    if (!userData?.companyId) return;

    const q = query(
      collection(db, 'reports'),
      where('companyId', '==', userData.companyId)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reportesObtenidos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const sortedReports = reportesObtenidos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setReports(sortedReports);
    }, (error) => {
      console.error("Error en snapshot listener de reportes:", error);
      if (error.code === 'permission-denied') {
        Alert.alert('Error de Permisos', 'No tienes permisos suficientes.');
      } else {
        Alert.alert('Error', `Problema al cargar reportes: ${error.message}`);
      }
    });

    return () => unsubscribe();
  }, [userData]);

  if (authLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  if (!userData) {
    return (
      <View className="flex-1 justify-center items-center bg-white p-8">
        <Text className="text-xl font-bold text-gray-800 mb-4">Perfil no encontrado</Text>
        <TouchableOpacity onPress={() => auth.signOut()} className="bg-indigo-600 px-6 py-3 rounded-xl">
           <Text className="text-white font-bold">Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSignOut = () => {
    auth.signOut();
    router.replace('/');
  };

  const handleEliminarReporte = (reportId, date) => {
    Alert.alert(
      "Eliminar Reporte",
      `¿Borrar reporte del ${date}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, Eliminar", 
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const peopleRef = collection(db, `reports/${reportId}/people`);
              const peopleSnapshot = await getDocs(peopleRef);
              const deletePromises = peopleSnapshot.docs.map(personDoc => 
                deleteDoc(doc(db, `reports/${reportId}/people`, personDoc.id))
              );
              await Promise.all(deletePromises);
              await deleteDoc(doc(db, 'reports', reportId));
              Alert.alert('Eliminado', 'El reporte ha sido eliminado.');
            } catch (error) {
               Alert.alert('Error', error.message);
            } finally {
               setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDescargarExcel = async (reportId, date, companyId) => {
    try {
      setLoading(true);
      const peopleRef = collection(db, `reports/${reportId}/people`);
      const peopleSnapshot = await getDocs(peopleRef);
      if (peopleSnapshot.empty) {
        Alert.alert('Aviso', 'Reporte sin trabajadores.');
        setLoading(false);
        return;
      }
      const excelData = peopleSnapshot.docs.map(doc => {
        const data = doc.data();
        const rowData = {
          'Nombre Completo': data.nombreCompleto || '',
          'DNI': data.dni || '',
          'Código': data.codigo || ''
        };
        if (data.datosExtra && typeof data.datosExtra === 'object') {
          Object.keys(data.datosExtra).forEach(key => {
            rowData[key] = data.datosExtra[key];
          });
        }
        rowData['Observación de Control'] = data.observacion || 'Sin observación';
        return rowData;
      });
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Asistencia");
      const excelBase64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      const fileUri = `${FileSystem.documentDirectory}Reporte_${date.replace(/\//g, '-')}.xlsx`;
      await FileSystem.writeAsStringAsync(fileUri, excelBase64, { encoding: 'base64' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo generar el Excel.');
    } finally {
      setLoading(false);
    }
  };

  const procesarExcel = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
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
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          if (jsonData.length < 2) {
            Alert.alert('Error', 'Excel vacío.');
            setLoading(false);
            return;
          }
          const headers = jsonData[0];
          const rows = jsonData.slice(1);
          const nameIndex = headers.findIndex(h => typeof h === 'string' && h.toUpperCase().includes('NOMBRE'));
          const dniIndex = headers.findIndex(h => typeof h === 'string' && h.toUpperCase().includes('DNI'));
          const codeIndex = headers.findIndex(h => typeof h === 'string' && h.toUpperCase().includes('CODIGO'));
          const dateIndex = headers.findIndex(h => typeof h === 'string' && h.toUpperCase().includes('FECHA'));
          let reportDate = formatDateToES(new Date());
          if (dateIndex !== -1 && rows[0] && rows[0][dateIndex]) {
             const rawDate = rows[0][dateIndex];
             reportDate = typeof rawDate === 'number' ? formatDateToES(excelDateToJSDate(rawDate)) : String(rawDate);
          }
          const reportRef = await addDoc(collection(db, 'reports'), {
            companyId: userData.companyId || 'N/A',
            date: reportDate,
            uploadedBy: auth.currentUser?.uid || 'Unknown',
            status: 'OPEN',
            createdAt: new Date().toISOString()
          });
          const batchPromises = rows.map(async (row) => {
            if (!row || !row[nameIndex]) return;
            const datosExtra = {};
            headers.forEach((headerName, index) => {
               if (headerName && index !== nameIndex && index !== dniIndex && index !== codeIndex && index !== dateIndex && row[index] != null) {
                  datosExtra[String(headerName)] = String(row[index]);
               }
            });
            const personaRef = doc(collection(db, `reports/${reportRef.id}/people`));
            return setDoc(personaRef, {
              nombreCompleto: String(row[nameIndex] || ''),
              dni: dniIndex !== -1 ? String(row[dniIndex] || '') : '',
              codigo: codeIndex !== -1 ? String(row[codeIndex] || '') : '',
              datosExtra: datosExtra,
              observacion: 'Sin observación',
              reviewed: false
            });
          });
          await Promise.all(batchPromises);
          Alert.alert('Éxito', 'Reporte subido.');
        } catch (err) {
          Alert.alert('Error', 'Fallo al procesar.');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(blob);
    } catch (error) {
      setLoading(false);
    }
  };

  const isAdmin = (auth.currentUser?.email || userData?.email || '')?.trim().toLowerCase() === 'gpanta@verfrut.pe';

  return (
    <View className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      
      {/* Header Premium */}
      <View className="px-6 pt-12 pb-10 bg-white border-b border-slate-100 shadow-sm rounded-b-[3.5rem] z-10">
         <View className="flex-row justify-between items-center mb-8">
            <View className="flex-row items-center">
               <View className="relative">
                 <View className="w-14 h-14 bg-indigo-100 rounded-2xl items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                   <Text className="text-2xl">👤</Text>
                 </View>
                 <View className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" />
               </View>
               <View className="ml-4">
                  <View className="flex-row items-center mb-0.5">
                    <Text className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mr-2">En Línea</Text>
                    <View className="h-[1px] w-4 bg-indigo-100" />
                  </View>
                  <Text className="text-2xl font-black text-slate-950 tracking-tighter leading-none" numberOfLines={1}>
                    {userData?.name ? userData.name.split(' ')[0] : 'Encargado'}
                  </Text>
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                    {userData?.role || 'Personal'} • {userData?.companyId === '9' ? 'Rapel' : 'Verfrut'}
                  </Text>
               </View>
            </View>
            <View className="flex-row items-center">
               {isAdmin && (
                  <TouchableOpacity 
                    onPress={() => router.push('/register')}
                    className="w-12 h-12 bg-indigo-50 rounded-2xl items-center justify-center border border-indigo-100 mr-2 shadow-sm"
                  >
                    <Text className="text-xl">➕</Text>
                  </TouchableOpacity>
               )}
               <TouchableOpacity 
                 onPress={handleSignOut} 
                 className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100"
               >
                 <Text className="text-xl">🚪</Text>
               </TouchableOpacity>
            </View>
         </View>

         <View>
            <Text className="text-lg font-black text-slate-900 tracking-tight">Gestión Operativa</Text>
            <View className="flex-row items-center mt-1">
               <View className="w-2 h-2 rounded-full bg-indigo-500 mr-2" />
               <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                 {userData?.companyId === '9' ? 'Rapel' : 'Verfrut'} (Empresa {userData?.companyId})
               </Text>
            </View>
         </View>
      </View>

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View 
          style={{ borderRadius: 40 }}
          className="bg-white p-8 shadow-2xl shadow-indigo-500/5 border border-slate-100 mb-8"
        >
          <Text className="text-xl font-black text-slate-900 mb-2 tracking-tighter">Subir Reporte</Text>
          <Text className="text-slate-400 mb-8 text-xs font-medium leading-4">
            Selecciona el Excel para extraer la información diaria.
          </Text>

          <TouchableOpacity 
            onPress={procesarExcel}
            disabled={loading}
            activeOpacity={0.8}
            className={`w-full py-6 rounded-full flex-row justify-center items-center shadow-2xl shadow-indigo-400/20 ${loading ? 'bg-slate-400' : 'bg-indigo-600'}`}
          >
            {loading ? <ActivityIndicator color="white" /> : (
              <View className="flex-row items-center">
                <Text className="text-xl mr-3">📄</Text>
                <Text className="text-white font-black uppercase tracking-widest text-[10px]">Cargar Plantilla</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View className="bg-white p-8 rounded-[3.5rem] shadow-2xl shadow-indigo-500/5 border border-slate-100 flex-1 min-h-[300px]">
          <Text className="text-xl font-black text-slate-950 mb-6 tracking-tighter">Historial</Text>
          
          {reports.length === 0 ? (
             <View className="py-10 items-center">
                <Text className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">Sin reportes</Text>
             </View>
          ) : (
            reports.map((item) => (
              <View 
                key={item.id} 
                style={{ borderRadius: 32 }}
                className="bg-slate-50 p-6 flex-row justify-between items-center mb-5 border border-slate-100/50 shadow-sm"
              >
                 <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                       <View className={`w-1.5 h-1.5 rounded-full ${item.status === 'CLOSED' ? 'bg-emerald-500' : 'bg-indigo-600'} mr-2`} />
                       <Text className={`text-[9px] font-black ${item.status === 'CLOSED' ? 'text-emerald-600' : 'text-indigo-600'} uppercase tracking-widest`}>
                          {item.status === 'CLOSED' ? 'Finalizado' : 'Abierto'}
                       </Text>
                    </View>
                    <Text className="text-base font-black text-slate-900 tracking-tighter">Día {item.date}</Text>
                 </View>
                 <View className="flex-row items-center gap-2">
                    {item.status === 'CLOSED' && (
                       <TouchableOpacity 
                          onPress={() => handleDescargarExcel(item.id, item.date, item.companyId)}
                          className="bg-emerald-50 w-11 h-11 rounded-full items-center justify-center border border-emerald-100"
                       >
                          <Text className="text-lg">📥</Text>
                       </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                       onPress={() => handleEliminarReporte(item.id, item.date)}
                       className="bg-rose-50 w-11 h-11 rounded-full items-center justify-center border border-rose-100"
                     >
                       <Text className="text-lg">🗑️</Text>
                    </TouchableOpacity>
                 </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
