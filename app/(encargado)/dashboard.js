import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, FlatList } from 'react-native';
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
  // Según Excel, 1 = 1 Ene 1900. Se resta 25569 días para igualarlo al 1 Ene 1970 UNIX epoch.
  // Luego se multiplica por 86400 (segundos al día) y por 1000 (milisegundos).
  const timestamp = Math.round((excelDate - 25569) * 86400 * 1000);
  const dateObj = new Date(timestamp);
  // Sumamos el offset de zona horaria local que el navegador pueda aplicar
  const localOffsetInMs = dateObj.getTimezoneOffset() * 60000;
  return new Date(dateObj.getTime() + localOffsetInMs);
};

export default function EncargadoDashboard() {
  const { userData, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const router = useRouter();

  useEffect(() => {
    if (!userData?.companyId) return;

    // Escuchar cambios en los reportes de la misma empresa
    const q = query(
      collection(db, 'reports'),
      where('companyId', '==', userData.companyId)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reportesObtenidos = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // ORDENAR LOCALMENTE
      const sortedReports = reportesObtenidos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setReports(sortedReports);
    }, (error) => {
      console.error("Error en snapshot listener de reportes:", error);
      if (error.code === 'permission-denied') {
        Alert.alert(
          'Error de Permisos', 
          'No tienes permisos suficientes para ver los reportes. Por favor, verifica las reglas de seguridad en la consola de Firebase o contacta al administrador.'
        );
      } else {
        Alert.alert('Error', `Hubo un problema al cargar los reportes: ${error.message}`);
      }
    });


    return () => unsubscribe();
  }, [userData]);

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

  const handleEliminarReporte = (reportId, date) => {
    Alert.alert(
      "Eliminar Reporte",
      `¿Estás seguro de que deseas eliminar permanentemente el reporte del ${date}? Esta acción borrará la asistencia de todo el personal.`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, Eliminar", 
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              
              // 1. Borrar todas las personas (subcolección) primero
              const peopleRef = collection(db, `reports/${reportId}/people`);
              const peopleSnapshot = await getDocs(peopleRef);
              
              const deletePromises = peopleSnapshot.docs.map(personDoc => 
                deleteDoc(doc(db, `reports/${reportId}/people`, personDoc.id))
              );
              
              await Promise.all(deletePromises);

              // 2. Borrar documento del reporte
              await deleteDoc(doc(db, 'reports', reportId));

              Alert.alert('Eliminado', 'El reporte ha sido eliminado correctamente.');

            } catch (error) {
               console.error("Error deleting report:", error);
               Alert.alert('Error', `Hubo un problema intentando eliminar el reporte: ${error.message}`);
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
      
      // 1. Obtener todas las personas de este reporte
      const peopleRef = collection(db, `reports/${reportId}/people`);
      const peopleSnapshot = await getDocs(peopleRef);
      
      if (peopleSnapshot.empty) {
        Alert.alert('Aviso', 'Este reporte no tiene trabajadores registrados.');
        setLoading(false);
        return;
      }

      // 2. Transformar los datos a formato plano para Excel
      const excelData = peopleSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Estructura base
        const rowData = {
          'Nombre Completo': data.nombreCompleto || '',
          'DNI': data.dni || '',
          'Código': data.codigo || ''
        };

        // Añadir datos extra dinámicos
        if (data.datosExtra && typeof data.datosExtra === 'object') {
          Object.keys(data.datosExtra).forEach(key => {
            rowData[key] = data.datosExtra[key];
          });
        }

        // Añadir observación del controlador al final
        rowData['Observación de Control'] = data.observacion || 'Sin observación';
        
        return rowData;
      });

      // 3. Crear el libro y la hoja de cálculo
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Asistencia");

      // 4. Generar binario en Base64 seguro para RN
      const excelBase64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

      // 5. Escribir archivo temporal
      const fileUri = `${FileSystem.documentDirectory}Reporte_${date.replace(/\//g, '-')}_C${companyId}.xlsx`;
      await FileSystem.writeAsStringAsync(fileUri, excelBase64, {
        encoding: 'base64',  // <-- Solucionado: string directo en vez de Enumerador que tira TypeError
      });

      // 6. Compartir / Descargar usando menú nativo
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
           mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           dialogTitle: `Descargar Reporte ${date}`,
        });
      } else {
        Alert.alert('Error', 'Compartir archivos no está disponible en este dispositivo.');
      }

    } catch (error) {
      console.error("Error generating excel:", error);
      Alert.alert('Error', 'Hubo un problema generando el archivo Excel.');
    } finally {
      setLoading(false);
    }
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
          let reportDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
          if (dateIndex !== -1 && rows[0] && rows[0][dateIndex]) {
             const rawDate = rows[0][dateIndex];
             if (typeof rawDate === 'number') {
                // Es un número de serie de Excel
                const dateObj = excelDateToJSDate(rawDate);
                reportDate = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
             } else {
                // Es texto normal
                reportDate = String(rawDate);
             }
          }

           // 1. Create the main report document
          const reportRef = await addDoc(collection(db, 'reports'), {
            companyId: userData.companyId || 'N/A',
            date: reportDate,
            uploadedBy: auth.currentUser?.uid || 'Unknown',
            status: 'OPEN',
            columnOrder: headers,
            createdAt: new Date().toISOString()
          });

          // 2. Add each person to the subcollection
          const batchPromises = rows.map(async (row) => {
            // Skip empty rows
            if (!row || row.length === 0 || !row[nameIndex]) return;

            // Collect all extra original columns dynamically
            const datosExtra = {};
            headers.forEach((headerName, index) => {
               // Only store if there's an actual value and it's not one of our main mapped columns
               if (
                  headerName && 
                  index !== nameIndex && 
                  index !== dniIndex && 
                  index !== codeIndex && 
                  index !== dateIndex && 
                  row[index] !== undefined &&
                  row[index] !== null
                ) {
                  // Save as string for safety
                  datosExtra[String(headerName)] = String(row[index]);
               }
            });

            const personaRef = doc(collection(db, `reports/${reportRef.id}/people`));
            return setDoc(personaRef, {
              nombreCompleto: nameIndex !== -1 ? String(row[nameIndex] || '') : 'Desconocido',
              dni: dniIndex !== -1 ? String(row[dniIndex] || '') : '',
              codigo: codeIndex !== -1 ? String(row[codeIndex] || '') : '',
              datosExtra: datosExtra,
              observacion: 'Sin observación',
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

      <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex-1">
        <Text className="text-lg font-bold text-gray-800 mb-4">Reportes Recientes</Text>
        
        {reports.length === 0 ? (
           <Text className="text-gray-500 text-center py-4">Aún no hay reportes subidos.</Text>
        ) : (
          reports.map((item) => (
            <View key={item.id} className="bg-gray-50 p-4 rounded-lg flex-row justify-between items-center mb-3 border border-gray-100">
               <View className="flex-1">
                  <Text className="font-semibold text-gray-800">Reporte del {item.date}</Text>
                  <Text className="text-xs text-gray-500 mt-1 font-bold tracking-wider">
                     <Text className={item.status === 'CLOSED' ? 'text-green-600' : 'text-blue-600'}>
                        {item.status === 'CLOSED' ? 'CERRADO' : 'ABIERTO'}
                     </Text> • {item.companyId === '9' ? 'Rapel' : 'Verfrut'}
                  </Text>
               </View>
               <View className="flex-row items-center space-x-2">
                  {item.status === 'CLOSED' && (
                     <TouchableOpacity 
                        onPress={() => handleDescargarExcel(item.id, item.date, item.companyId)}
                        className="bg-green-100 p-2 rounded-full w-10 h-10 items-center justify-center border border-green-200"
                        title="Descargar Excel"
                     >
                        <Text className="text-green-700 text-xl text-center">📥</Text>
                     </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                     onPress={() => handleEliminarReporte(item.id, item.date)}
                     className="bg-red-50 p-2 rounded-full w-10 h-10 items-center justify-center ml-2 border border-red-100"
                     title="Eliminar Reporte"
                   >
                     <Text className="text-red-600 text-xl text-center">🗑️</Text>
                  </TouchableOpacity>
               </View>
            </View>
          ))
        )}
      </View>

    </ScrollView>
  );
}
