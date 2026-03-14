import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useLocalSearchParams, useRouter } from 'expo-router';

const OBSERVACIONES = [
  "Sin observación",
  "Generó marcación",
  "Olvidó marcar",
  "Falta justificada",
  "Tardanza",
  "Permiso"
];

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams();
  const [report, setReport] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        // 1. Get report metadata
        const reportRef = doc(db, 'reports', id);
        const reportSnap = await getDoc(reportRef);
        
        if (reportSnap.exists()) {
          setReport({ id: reportSnap.id, ...reportSnap.data() });
        } else {
          Alert.alert('Error', 'El reporte no existe.');
          router.back();
          return;
        }

        // 2. Get people
        const peopleRef = collection(db, `reports/${id}/people`);
        const peopleSnap = await getDocs(peopleRef);
        const peopleList = peopleSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Si no tiene observación previa o está vacía, le ponemos la primera por defecto
          observacion: doc.data().observacion || "Sin observación"
        }));
        
        setPeople(peopleList);
      } catch (error) {
        console.error("Error fetching detail:", error);
        Alert.alert('Error', 'No se pudo cargar el detalle del reporte.');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchReportData();
  }, [id]);

  const updatePersonObservation = (personId, newValue) => {
    setPeople(prev => prev.map(p => 
      p.id === personId ? { ...p, observacion: newValue } : p
    ));
  };

  const handleCerrarReporte = async () => {
    Alert.alert(
      "Cerrar Reporte",
      "¿Estás seguro de cerrar este reporte? Una vez cerrado no se podrán modificar las observaciones.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, Cerrar", 
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true);
              
              // 1. Update all people observations
              const updatePromises = people.map(p => {
                const pRef = doc(db, `reports/${id}/people`, p.id);
                return updateDoc(pRef, { observacion: p.observacion });
              });
              await Promise.all(updatePromises);

              // 2. Mark report as CLOSED
              const reportRef = doc(db, 'reports', id);
              await updateDoc(reportRef, { status: 'CLOSED' });

              Alert.alert('¡Éxito!', 'El reporte ha sido cerrado y guardado correctamente.');
              router.replace('/(control)/dashboard');
            } catch (error) {
              console.error("Error closing report:", error);
              Alert.alert('Error', 'Hubo un problema al intentar cerrar el reporte.');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-4 text-gray-500">Cargando personal...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white p-6 pt-12 border-b border-gray-200 shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Text className="text-blue-600 font-semibold text-base flex-row items-center">← Volver</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">Reporte del {report?.date}</Text>
        <View className="flex-row items-center mt-2">
          <Text className="text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-md text-sm">
            Total Trabajadores: {people.length}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {people.map((person, index) => (
          <View key={person.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4">
            <View className="flex-row items-center mb-3 border-b border-gray-50 pb-3">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                 <Text className="text-blue-800 font-bold">{index + 1}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-800">{person.nombreCompleto}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">DNI: {person.dni || 'N/A'} • Cód: {person.codigo || 'N/A'}</Text>
                {person.respuestaObservacion ? (
                  <Text className="text-xs text-red-500 mt-1 italic">Obs Sistema: {person.respuestaObservacion}</Text>
                ) : null}
              </View>
            </View>
            
            <Text className="text-sm font-semibold text-gray-700 mb-2">Observación del Control:</Text>
            <View className="flex-row flex-wrap gap-2">
              {OBSERVACIONES.map(obs => (
                <TouchableOpacity
                  key={obs}
                  onPress={() => updatePersonObservation(person.id, obs)}
                  className={`px-3 py-2 rounded-lg border ${person.observacion === obs ? 'bg-blue-600 border-blue-600' : 'bg-gray-50 border-gray-200'}`}
                >
                  <Text className={`text-sm ${person.observacion === obs ? 'text-white font-bold' : 'text-gray-600'}`}>
                    {obs}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Floating Action Button for Closing Report */}
      <View className="absolute bottom-0 w-full p-6 bg-white border-t border-gray-100">
        <TouchableOpacity 
          onPress={handleCerrarReporte}
          disabled={saving}
          className={`w-full py-4 rounded-xl flex-row justify-center items-center shadow-lg ${saving ? 'bg-red-400' : 'bg-red-600 shadow-red-200'}`}
        >
          {saving ? (
             <ActivityIndicator color="white" />
          ) : (
             <Text className="text-white font-bold text-lg text-center">🔒 Guardar y Cerrar Reporte</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
