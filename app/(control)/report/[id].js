import React, { useState, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, FlatList } from 'react-native';
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

const WorkerCard = memo(({ person, index, updatePersonObservation }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-4">
      {/* Cabecera compacta: Indice y Nombre (Tappeable para expandir) */}
      <TouchableOpacity 
        activeOpacity={0.7} 
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center mb-2"
      >
        <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center mr-3">
            <Text className="text-blue-800 font-bold text-xs">{index + 1}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-800" numberOfLines={1}>{person.nombreCompleto}</Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            DNI: {person.dni || 'N/A'} • Cód: {person.codigo || 'N/A'}
          </Text>
        </View>
        <View className="bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
           <Text className="text-xs text-gray-500 font-medium">{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* Contenido Expandible (Datos del Excel) */}
      {expanded && person.datosExtra && Object.keys(person.datosExtra).length > 0 && (
        <View className="bg-gray-50 rounded-xl p-3 mt-2 border border-gray-100 flex-row flex-wrap">
          {Object.entries(person.datosExtra).map(([key, value]) => (
            <View key={key} className="w-1/2 flex-col mb-1.5 pr-2">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{key}</Text>
              <Text className="text-xs font-medium text-gray-800 mt-0.5" numberOfLines={2}>{value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Alerta del sistema en caso de haberla */}
      {person.respuestaObservacion ? (
        <View className="bg-red-50 p-2 rounded-lg mt-2 border border-red-100">
          <Text className="text-xs text-red-600 font-medium">⚠️ Obs. Sistema: {person.respuestaObservacion}</Text>
        </View>
      ) : null}
      
      {/* Botones de Observación Compactos */}
      <View className="mt-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row -mx-1">
          {OBSERVACIONES.map(obs => {
            const isSelected = person.observacion === obs;
            return (
               <TouchableOpacity
                 key={obs}
                 onPress={() => updatePersonObservation(person.id, obs)}
                 className={`mx-1 px-3 py-1.5 rounded-full border ${isSelected ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200' : 'bg-gray-50 border-gray-200'}`}
               >
                 <Text className={`text-xs ${isSelected ? 'text-white font-bold' : 'text-gray-600 font-medium'}`}>
                   {obs}
                 </Text>
               </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
});

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams();
  const [report, setReport] = useState(null);
  const [people, setPeople] = useState([]);
  const [filteredPeople, setFilteredPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // States for filtering
  const [availableRutas, setAvailableRutas] = useState([]);
  const [availableZonas, setAvailableZonas] = useState([]);
  const [selectedRuta, setSelectedRuta] = useState('Todas');
  const [selectedZona, setSelectedZona] = useState('Todas');

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
        setFilteredPeople(peopleList);

        // 3. Extraer valores únicos de rutas y zonas para los filtros
        const rutasSet = new Set();
        const zonasSet = new Set();

        peopleList.forEach(p => {
           if (p.datosExtra) {
              // Buscar keys que coincidan con "ruta" o "zona" de forma general (case-insensitive)
              Object.keys(p.datosExtra).forEach(key => {
                 const upperKey = key.toUpperCase();
                 if (upperKey.includes('RUTA') || upperKey.includes('BUS')) {
                    const val = p.datosExtra[key]?.trim();
                    if (val) rutasSet.add(val);
                 }
                 if (upperKey.includes('ZONA') || upperKey.includes('FUNDO')) {
                    const val = p.datosExtra[key]?.trim();
                    if (val) zonasSet.add(val);
                 }
              });
           }
        });

        const sortedRutas = Array.from(rutasSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        const sortedZonas = Array.from(zonasSet).sort();

        setAvailableRutas(['Todas', ...sortedRutas]);
        setAvailableZonas(['Todas', ...sortedZonas]);

      } catch (error) {
        console.error("Error fetching detail:", error);
        if (error.code === 'permission-denied') {
          Alert.alert(
            'Error de Permisos', 
            'No tienes permisos suficientes para ver este reporte. Por favor, verifica las reglas de seguridad en la consola de Firebase.'
          );
        } else {
          Alert.alert('Error', `No se pudo cargar el detalle del reporte: ${error.message}`);
        }
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
    setFilteredPeople(prev => prev.map(p => 
      p.id === personId ? { ...p, observacion: newValue } : p
    ));
  };

  // Lógica de filtrado
  useEffect(() => {
     let result = people;

     if (selectedRuta !== 'Todas') {
        result = result.filter(p => {
           if (!p.datosExtra) return false;
           return Object.entries(p.datosExtra).some(([key, val]) => (key.toUpperCase().includes('RUTA') || key.toUpperCase().includes('BUS')) && val?.trim() === selectedRuta);
        });
     }

     if (selectedZona !== 'Todas') {
        result = result.filter(p => {
           if (!p.datosExtra) return false;
           return Object.entries(p.datosExtra).some(([key, val]) => (key.toUpperCase().includes('ZONA') || key.toUpperCase().includes('FUNDO')) && val?.trim() === selectedZona);
        });
     }

     setFilteredPeople(result);
  }, [selectedRuta, selectedZona, people]);

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
        <View className="flex-row items-center mt-2 mb-4">
          <Text className="text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-md text-sm">
            Total Trabajadores: {filteredPeople.length} / {people.length}
          </Text>
        </View>

        {/* Filters Section */}
        {availableRutas.length > 1 && (
           <View className="mb-3">
              <Text className="text-xs font-bold text-gray-500 mb-1.5 uppercase">Filtrar por Ruta:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row -mx-1">
                 {availableRutas.map(ruta => (
                    <TouchableOpacity 
                      key={ruta} 
                      onPress={() => setSelectedRuta(ruta)}
                      className={`mx-1 px-4 py-2 rounded-full border ${selectedRuta === ruta ? 'bg-blue-600 border-blue-700 shadow-sm' : 'bg-white border-gray-200'}`}
                    >
                       <Text className={`text-sm ${selectedRuta === ruta ? 'text-white font-bold' : 'text-gray-700 font-medium'}`}>{ruta}</Text>
                    </TouchableOpacity>
                 ))}
              </ScrollView>
           </View>
        )}

        {availableZonas.length > 1 && (
           <View>
              <Text className="text-xs font-bold text-gray-500 mb-1.5 uppercase">Filtrar por Zona:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row -mx-1">
                 {availableZonas.map(zona => (
                    <TouchableOpacity 
                      key={zona} 
                      onPress={() => setSelectedZona(zona)}
                      className={`mx-1 px-4 py-2 rounded-full border ${selectedZona === zona ? 'bg-blue-600 border-blue-700 shadow-sm' : 'bg-white border-gray-200'}`}
                    >
                       <Text className={`text-sm ${selectedZona === zona ? 'text-white font-bold' : 'text-gray-700 font-medium'}`}>{zona}</Text>
                    </TouchableOpacity>
                 ))}
              </ScrollView>
           </View>
         )}
      </View>

      <FlatList
        data={filteredPeople}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        renderItem={({ item, index }) => (
           <WorkerCard 
             person={item} 
             index={index} 
             updatePersonObservation={updatePersonObservation} 
           />
        )}
      />
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
