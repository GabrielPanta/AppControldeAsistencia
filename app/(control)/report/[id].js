import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, FlatList, Modal, SafeAreaView } from 'react-native';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { useLocalSearchParams, useRouter } from 'expo-router';

const RESPUESTAS_OPTIONS = [
  "Indicó Generar Marcación",
  "Olvidó marcar",
  "Ausente",
  "Tardanza",
  "Permiso",
  "Canje",
  "Otro"
];

const STYLES_COMPLETION = {
  active: { bg: "bg-blue-50/50", text: "text-blue-600", border: "border-blue-100", accent: "bg-blue-600" },
  pending: { bg: "bg-slate-50/30", text: "text-slate-400", border: "border-slate-100/50", accent: "bg-slate-200" }
};

const FilterChip = ({ icon, label, value, onPress }) => {
  const isActive = value !== 'Todas';
  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.8}
      className={`flex-row items-center px-6 py-3.5 rounded-2xl border ${isActive ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-200' : 'bg-white border-slate-100 shadow-sm shadow-slate-50'}`}
    >
      <Text className="mr-2 text-sm">{icon}</Text>
      <Text className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-slate-500'}`}>
        {isActive ? `${label}: ${value}` : label}
      </Text>
      {!isActive && <Text className="ml-2.5 text-slate-300 text-[10px]">▼</Text>}
    </TouchableOpacity>
  );
};

const FilterModal = ({ visible, title, options, selectedValue, onSelect, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View className="flex-1 bg-black/40 justify-end">
      <TouchableOpacity activeOpacity={1} onPress={onClose} className="flex-1" />
      <View className="bg-white rounded-t-[3.5rem] p-8 max-h-[70%] shadow-2xl">
        <View className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
        <View className="flex-row justify-between items-center mb-8">
          <Text className="text-2xl font-black text-slate-800 tracking-tighter">{title}</Text>
          <TouchableOpacity onPress={onClose} className="bg-slate-100 w-10 h-10 rounded-full items-center justify-center">
            <Text className="text-slate-400 font-bold text-sm">✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={options}
          keyExtractor={item => item}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onSelect(item)}
              activeOpacity={0.8}
              className={`py-6 px-8 rounded-full mb-4 flex-row justify-between items-center border ${selectedValue === item ? 'bg-indigo-600 border-indigo-500 shadow-xl shadow-indigo-200' : 'bg-slate-50 border-slate-100'}`}
            >
              <Text className={`text-[16px] font-black tracking-tight ${selectedValue === item ? 'text-white' : 'text-slate-600'}`}>{item}</Text>
              {selectedValue === item && <Text className="text-white text-lg">✓</Text>}
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  </Modal>
);

const WorkerDetailModal = ({ visible, person, onClose, onSelectRespuesta, options }) => {
  const [showPicker, setShowPicker] = useState(false);
  if (!person) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <TouchableOpacity activeOpacity={1} onPress={onClose} className="flex-1" />
        <View className="bg-white rounded-t-[3rem] p-8 max-h-[92%] shadow-2xl">
          <View className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
          
          <View className="flex-row justify-between items-start mb-6">
            <View className="flex-1 pr-6">
              <Text className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Ficha del Trabajador</Text>
              <Text className="text-3xl font-black text-slate-950 leading-tight mb-3 tracking-tighter">{person.nombreCompleto}</Text>
              <View className="flex-row items-center bg-slate-50 self-start px-4 py-2 rounded-2xl border border-slate-100">
                <Text className="text-[11px] font-black text-slate-500 uppercase tracking-widest">DNI: {person.dni || '---'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} className="bg-slate-50 w-12 h-12 rounded-[1.5rem] items-center justify-center border border-slate-100">
              <Text className="text-slate-400 font-bold text-lg">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
             {/* Observation from EXCEL as Reference */}
             <View className="bg-amber-50/50 p-6 rounded-[2.5rem] border border-amber-100/50 mb-10">
                <View className="flex-row items-center gap-2.5 mb-2.5">
                   <Text className="text-sm">📋</Text>
                   <Text className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Observación Original (Excel)</Text>
                </View>
                <Text className="text-[15px] text-amber-800 font-bold leading-relaxed">{person.observacion || 'Sin observación'}</Text>
             </View>

             <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Seleccionar Respuesta</Text>
             
             {/* Combobox Style Selection Premium */}
             <TouchableOpacity 
                onPress={() => setShowPicker(true)}
                activeOpacity={0.7}
                className={`flex-row justify-between items-center p-7 rounded-full mb-10 border-2 ${person.respuestaObservacion ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}
             >
                <View className="flex-1">
                   {person.respuestaObservacion ? (
                      <Text className="text-[18px] font-black text-blue-600 tracking-tight">{person.respuestaObservacion}</Text>
                   ) : (
                      <Text className="text-[18px] font-bold text-slate-300">Seleccionar...</Text>
                   )}
                </View>
                <View className="bg-white w-10 h-10 rounded-full items-center justify-center shadow-sm">
                   <Text className="text-blue-600 text-lg font-black">▼</Text>
                </View>
             </TouchableOpacity>

             <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-2">Detalles Adicionales</Text>
             <View className="bg-slate-50/30 rounded-[2.5rem] p-7 border border-slate-100">
                {person.datosExtra && Object.entries(person.datosExtra).map(([key, value], idx) => (
                   <View key={key} className={`pb-5 mb-5 ${idx !== Object.keys(person.datosExtra).length - 1 ? 'border-b border-slate-200/30' : ''}`}>
                      <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{key}</Text>
                      <View className="bg-white/50 p-4 rounded-2xl border border-slate-100/50">
                        <Text className="text-[15px] font-bold text-slate-800 tracking-tight">{String(value || '---').trim()}</Text>
                      </View>
                   </View>
                ))}
             </View>
          </ScrollView>

          <TouchableOpacity 
            onPress={onClose}
            className="w-full bg-slate-950 py-7 rounded-full flex-row justify-center items-center shadow-2xl shadow-slate-300"
          >
            <Text className="text-white font-black uppercase tracking-widest text-[10px]">Cerrar Detalle</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FilterModal
        visible={showPicker}
        title="Seleccionar Respuesta"
        options={options}
        selectedValue={person.respuestaObservacion}
        onSelect={(val) => { onSelectRespuesta(person.id, val); setShowPicker(false); }}
        onClose={() => setShowPicker(false)}
      />
    </Modal>
  );
};

const WorkerCard = memo(({ person, index, onSelectRespuesta, options }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const status = person.respuestaObservacion ? 'active' : 'pending';
  const styles = STYLES_COMPLETION[status];

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setModalVisible(true)}
        className="mb-5"
      >
        <View className={`bg-white rounded-[2.5rem] flex-row items-center border ${styles.border} shadow-sm shadow-blue-500/5`}>
          {/* Status Indicator Bar */}
          <View className={`w-2 h-24 ${styles.accent}`} />
          
          <View className="flex-1 pl-5 pr-6 py-5 flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center mb-1.5">
                <Text className="text-[10px] font-black text-slate-300 uppercase tracking-widest">TRABAJADOR #{index + 1}</Text>
                {person.respuestaObservacion && (
                  <View className="ml-3 bg-blue-600/10 px-2.5 py-1 rounded-full">
                    <Text className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Completado</Text>
                  </View>
                )}
              </View>
              <Text className="text-[18px] font-black text-slate-900 tracking-tighter mb-1" numberOfLines={1}>
                {person.nombreCompleto}
              </Text>
              
              {person.respuestaObservacion ? (
                <View className="flex-row items-center">
                  <Text className="text-[11px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 overflow-hidden">
                    {person.respuestaObservacion}
                  </Text>
                </View>
              ) : (
                <Text className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">DNI: {person.dni || '---'}</Text>
              )}
            </View>

            <View className="items-end">
              <View className={`w-12 h-12 rounded-2xl items-center justify-center ${person.respuestaObservacion ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-slate-50 border border-slate-100'}`}>
                {person.respuestaObservacion ? (
                   <Text className="text-white text-lg font-black">✓</Text>
                ) : (
                   <Text className="text-xl">👤</Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <WorkerDetailModal
        visible={modalVisible}
        person={person}
        options={options}
        onSelectRespuesta={onSelectRespuesta}
        onClose={() => setModalVisible(false)}
      />
    </>
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
  const [selectedDigitacion, setSelectedDigitacion] = useState('Todas');
  const [selectedObsFilter, setSelectedObsFilter] = useState('Todas');

  const [search, setSearch] = useState('');
  const [showRutaModal, setShowRutaModal] = useState(false);
  const [showZonaModal, setShowZonaModal] = useState(false);
  const [showDigitacionModal, setShowDigitacionModal] = useState(false);
  const [showObsFilterModal, setShowObsFilterModal] = useState(false);

  const [digitacionColumn, setDigitacionColumn] = useState(null);
  const [zonaColumn, setZonaColumn] = useState(null);

  const router = useRouter();

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        const reportRef = doc(db, 'reports', id);
        const reportSnap = await getDoc(reportRef);

        if (reportSnap.exists()) {
          setReport({ id: reportSnap.id, ...reportSnap.data() });
        } else {
          Alert.alert('Error', 'El reporte no existe.');
          router.back();
          return;
        }

        const peopleRef = collection(db, `reports/${id}/people`);
        const peopleSnap = await getDocs(peopleRef);
        const peopleList = peopleSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          observacion: doc.data().observacion || "Sin observación"
        }));

        setPeople(peopleList);
        setFilteredPeople(peopleList);

        const rutasSet = new Set();
        const zonasSet = new Set();

        peopleList.forEach(p => {
          if (p.datosExtra) {
            Object.keys(p.datosExtra).forEach(key => {
              const upperKey = key.toUpperCase().trim();
              if (upperKey.includes('RUTA') || upperKey.includes('BUS')) {
                const val = p.datosExtra[key]?.trim();
                if (val) rutasSet.add(val);
              }
              if (upperKey.includes('ZONA') || upperKey.includes('FUNDO')) {
                const val = p.datosExtra[key]?.trim();
                if (val) zonasSet.add(val);
                setZonaColumn(key);
              }
              if (upperKey.includes('DIGITACION')) {
                setDigitacionColumn(key);
              }
            });
          }
        });

        const sortedRutas = Array.from(rutasSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const sortedZonas = Array.from(zonasSet).sort();

        setAvailableRutas(['Todas', ...sortedRutas]);
        setAvailableZonas(['Todas', ...sortedZonas]);

      } catch (error) {
        console.error("Error fetching detail:", error);
        Alert.alert('Error', `No se pudo cargar el detalle del reporte: ${error.message}`);
      } finally {
        setLoading(false);
      }

    };

    if (id) fetchReportData();
  }, [id]);

  const uniqueObservations = useMemo(() => {
    const set = new Set();
    people.forEach(p => {
      if (p.observacion) set.add(p.observacion.trim());
    });
    return Array.from(set).sort();
  }, [people]);

  const updatePersonRespuesta = (personId, newValue) => {
    setPeople(prev => prev.map(p =>
      p.id === personId ? { ...p, respuestaObservacion: newValue } : p
    ));
    setFilteredPeople(prev => prev.map(p =>
      p.id === personId ? { ...p, respuestaObservacion: newValue } : p
    ));
  };

  useEffect(() => {
    let result = people;

    if (search && search.trim() !== '') {
      const s = search.toLowerCase();
      result = result.filter(p =>
        p.nombreCompleto.toLowerCase().includes(s) ||
        (p.dni && p.dni.includes(s)) ||
        (p.codigo && p.codigo.includes(s))
      );
    }

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

    if (selectedDigitacion !== 'Todas' && digitacionColumn) {
      result = result.filter(p => {
        const val = String(p.datosExtra?.[digitacionColumn] || '').toUpperCase().trim();
        if (selectedDigitacion === 'SI') {
          return val.startsWith('S') || val.includes('DIGITACION');
        } else {
          return val.startsWith('N') || val === '';
        }
      });
    }

    if (selectedObsFilter !== 'Todas') {
      result = result.filter(p => p.observacion === selectedObsFilter);
    }

    setFilteredPeople(result);
  }, [selectedRuta, selectedZona, selectedDigitacion, selectedObsFilter, search, people, digitacionColumn]);

  const handleCerrarReporte = async () => {
    const pendingCount = people.filter(p => !p.respuestaObservacion).length;
    
    if (pendingCount > 0) {
      Alert.alert(
        "Reporte Incompleto",
        `Faltan ${pendingCount} trabajadores por revisar. Debes asignar una respuesta a todos antes de finalizar el reporte.`,
        [{ text: "Entendido" }]
      );
      return;
    }

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
              const updatePromises = people.map(p => {
                const pRef = doc(db, `reports/${id}/people`, p.id);
                return updateDoc(pRef, { respuestaObservacion: p.respuestaObservacion });
              });
              await Promise.all(updatePromises);

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
        <Text className="mt-4 text-slate-500 font-bold uppercase tracking-widest text-[9px]">Cargando personal...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header Compacto Blue Premium */}
      <View className="bg-white pt-4 border-b border-slate-100 z-10 shadow-sm">
        <View className="px-6 pb-6 flex-row items-center justify-between">
           <View className="flex-row items-center flex-1 pr-4">
              <TouchableOpacity 
                onPress={() => router.back()} 
                activeOpacity={0.7}
                className="mr-5 w-11 h-11 bg-white rounded-full items-center justify-center border border-slate-200 shadow-sm shadow-slate-100"
              >
                 <Text className="text-xl text-blue-600 font-bold">←</Text>
              </TouchableOpacity>
              <View>
                 <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Reporte Diario</Text>
                 <Text className="text-xl font-black text-slate-950 tracking-tighter" numberOfLines={1}>{report?.date}</Text>
              </View>
           </View>
            <View className="bg-indigo-600 px-5 py-2.5 rounded-2xl shadow-lg shadow-indigo-100 border border-indigo-500">
              <Text className="text-[12px] font-black text-white">
                 {Math.round((people.filter(p => !!p.respuestaObservacion).length / people.length) * 100)}%
              </Text>
            </View>
        </View>

        {/* Micro Barra de Progreso Neón */}
        <View className="h-[3px] w-full bg-slate-100">
           <View 
              className="h-full bg-indigo-600 shadow-md shadow-indigo-400" 
              style={{ width: `${(people.filter(p => !!p.respuestaObservacion).length / people.length) * 100}%` }} 
           />
        </View>

        {/* Acción: Buscador y Filtros */}
        <View className="py-6 bg-slate-50/20">
           {/* Buscador Premium */}
           <View className="px-6 mb-5">
              <View className="bg-white flex-row items-center px-6 py-4 rounded-3xl border border-slate-200/50 shadow-sm shadow-slate-100">
                 <Text className="mr-3 text-lg opacity-60">🔍</Text>
                 <TextInput 
                   className="flex-1 text-[16px] text-slate-800 font-bold"
                   placeholder="Buscar por nombre, DNI o código..."
                   value={search}
                   onChangeText={setSearch}
                   placeholderTextColor="#94a3b8"
                 />
              </View>
           </View>

           {/* Chips de Filtro Horizontal Premium */}
           <ScrollView 
             horizontal 
             showsHorizontalScrollIndicator={false} 
             contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}
           >
              <FilterChip 
                 icon="🚌" label="Ruta" value={selectedRuta} 
                 onPress={() => setShowRutaModal(true)} 
              />
              <FilterChip 
                 icon="🏡" label="Zona" value={selectedZona} 
                 onPress={() => setShowZonaModal(true)} 
              />
              <FilterChip 
                 icon="⌨️" label="Digitación" value={selectedDigitacion} 
                 onPress={() => setShowDigitacionModal(true)} 
              />
              <FilterChip 
                 icon="📋" label="Observación" value={selectedObsFilter} 
                 onPress={() => setShowObsFilterModal(true)} 
              />
           </ScrollView>
        </View>

        {/* Modales Compartidos */}
        <FilterModal visible={showRutaModal} title="Filtrar por Ruta" options={availableRutas} selectedValue={selectedRuta} onSelect={(val) => { setSelectedRuta(val); setShowRutaModal(false); }} onClose={() => setShowRutaModal(false)} />
        <FilterModal visible={showZonaModal} title="Filtrar por Zona" options={availableZonas} selectedValue={selectedZona} onSelect={(val) => { setSelectedZona(val); setShowZonaModal(false); }} onClose={() => setShowZonaModal(false)} />
        <FilterModal visible={showDigitacionModal} title="Filtrar por Digitación" options={['Todas', 'SI', 'NO']} selectedValue={selectedDigitacion} onSelect={(val) => { setSelectedDigitacion(val); setShowDigitacionModal(false); }} onClose={() => setShowDigitacionModal(false)} />
        <FilterModal visible={showObsFilterModal} title="Filtrar por Observación (Excel)" options={['Todas', ...uniqueObservations]} selectedValue={selectedObsFilter} onSelect={(val) => { setSelectedObsFilter(val); setShowObsFilterModal(false); }} onClose={() => setShowObsFilterModal(false)} />
      </View>

      <FlatList
        data={filteredPeople}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 18, paddingBottom: 110 }}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={false}
        ListEmptyComponent={() => (
          <View className="items-center justify-center py-20 px-10">
            <View className="bg-slate-50 w-28 h-28 rounded-[3rem] items-center justify-center mb-8 border border-slate-100 shadow-sm shadow-blue-50/20">
              <Text className="text-5xl">👥</Text>
            </View>
            <Text className="text-xl font-black text-slate-950 text-center mb-3 tracking-tighter">Sin resultados</Text>
            <Text className="text-[13px] text-slate-400 text-center leading-relaxed px-4">
              Ajusta los filtros o cambia los términos de búsqueda para encontrar al personal.
            </Text>
            {(search || selectedRuta !== 'Todas' || selectedZona !== 'Todas' || selectedDigitacion !== 'Todas' || selectedObsFilter !== 'Todas') && (
              <TouchableOpacity
                onPress={() => {
                  setSearch('');
                  setSelectedRuta('Todas');
                  setSelectedZona('Todas');
                  setSelectedDigitacion('Todas');
                  setSelectedObsFilter('Todas');
                }}
                className="mt-8 bg-blue-600 px-8 py-3.5 rounded-2xl shadow-lg shadow-blue-100"
              >
                <Text className="text-white font-black uppercase text-[10px] tracking-widest">Limpiar Filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item, index }) => (
          <WorkerCard
            person={item}
            index={index}
            onSelectRespuesta={updatePersonRespuesta}
            options={RESPUESTAS_OPTIONS}
          />
        )}
      />

      {/* Botón de Acción Flotante (Azul Vibrante) */}
      <View className="absolute bottom-0 w-full px-8 py-10 bg-white/90 border-t border-slate-100 shadow-2xl">
        <TouchableOpacity
          onPress={handleCerrarReporte}
          disabled={saving}
          activeOpacity={0.8}
          className={`w-full py-6 rounded-full flex-row justify-center items-center shadow-2xl ${
            saving 
              ? 'bg-slate-400' 
              : (people.filter(p => !p.respuestaObservacion).length > 0 
                  ? 'bg-slate-950 border-2 border-slate-800 shadow-slate-200' 
                  : 'bg-indigo-600 shadow-indigo-400 border border-indigo-500')
          }`}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center">
                 <Text className="text-white text-base">
                    {people.filter(p => !p.respuestaObservacion).length > 0 ? '⏳' : '✓'}
                 </Text>
              </View>
              <Text className="text-white font-black text-sm text-center uppercase tracking-widest pt-0.5">
                 {people.filter(p => !p.respuestaObservacion).length > 0 
                   ? `Pendientes: ${people.filter(p => !p.respuestaObservacion).length}` 
                   : 'Finalizar Reporte Ahora'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

