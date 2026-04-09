import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, FlatList, Modal } from 'react-native';
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
  active: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", accent: "bg-blue-500" },
  pending: { bg: "bg-slate-50", text: "text-slate-400", border: "border-slate-100", accent: "bg-slate-200" }
};

const FilterChip = ({ icon, label, value, onPress }) => {
  const isActive = value !== 'Todas';
  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row items-center px-4 py-2.5 rounded-2xl border ${isActive ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}
    >
      <Text className="mr-2 text-xs">{icon}</Text>
      <Text className={`text-[10px] font-black uppercase tracking-tight ${isActive ? 'text-white' : 'text-slate-500'}`}>
        {isActive ? `${label}: ${value}` : label}
      </Text>
      {!isActive && <Text className="ml-2 text-slate-300 text-[10px]">▼</Text>}
    </TouchableOpacity>
  );
};

const FilterModal = ({ visible, title, options, selectedValue, onSelect, onClose }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View className="flex-1 bg-black/40 justify-end">
      <TouchableOpacity activeOpacity={1} onPress={onClose} className="flex-1" />
      <View className="bg-white rounded-t-[2.5rem] p-8 max-h-[70%] shadow-2xl">
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
              className={`py-5 px-6 rounded-2xl mb-3 flex-row justify-between items-center ${selectedValue === item ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-slate-50 border border-slate-100/50'}`}
            >
              <Text className={`text-[15px] font-black tracking-tight ${selectedValue === item ? 'text-white' : 'text-slate-700'}`}>{item}</Text>
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
              <Text className="text-sm font-black text-blue-600 uppercase tracking-widest mb-1.5">Ficha del Trabajador</Text>
              <Text className="text-2xl font-black text-slate-900 leading-tight mb-2 tracking-tight">{person.nombreCompleto}</Text>
              <View className="flex-row items-center bg-slate-50 self-start px-3 py-1.5 rounded-xl border border-slate-100">
                <Text className="text-[11px] font-black text-slate-500 uppercase tracking-wider">DNI: {person.dni || '---'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} className="bg-slate-100 w-12 h-12 rounded-2xl items-center justify-center">
              <Text className="text-slate-400 font-bold text-lg">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
            {/* Observation from EXCEL as Reference */}
            <View className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 mb-8">
              <View className="flex-row items-center gap-2 mb-2">
                <Text className="text-sm">📋</Text>
                <Text className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Observación del Excel (Referencia)</Text>
              </View>
              <Text className="text-sm text-amber-700 font-bold leading-relaxed">{person.observacion || 'Sin observación'}</Text>
            </View>

            <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Seleccionar Respuesta</Text>

            {/* Combobox Style Selection */}
            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              activeOpacity={0.7}
              className={`flex-row justify-between items-center p-5 rounded-2xl mb-8 border ${person.respuestaObservacion ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}
            >
              <View className="flex-1">
                {person.respuestaObservacion ? (
                  <Text className="text-[15px] font-black text-blue-600 tracking-tight">{person.respuestaObservacion}</Text>
                ) : (
                  <Text className="text-[15px] font-bold text-slate-300">Seleccionar respuesta...</Text>
                )}
              </View>
              <Text className="text-slate-300 text-lg">▼</Text>
            </TouchableOpacity>

            <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Información Adicional</Text>
            <View className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100">
              {person.datosExtra && Object.entries(person.datosExtra).map(([key, value], idx) => (
                <View key={key} className={`pb-4 mb-4 ${idx !== Object.keys(person.datosExtra).length - 1 ? 'border-b border-slate-200/30' : ''}`}>
                  <Text className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{key}</Text>
                  <Text className="text-[15px] font-bold text-slate-800 tracking-tight">{String(value || '---').trim()}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            onPress={onClose}
            className="w-full bg-slate-900 py-6 rounded-3xl flex-row justify-center items-center shadow-xl shadow-slate-300"
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
  const [showDetailModal, setShowDetailModal] = useState(false);

  const isComplete = !!person.respuestaObservacion;
  const style = isComplete ? STYLES_COMPLETION.active : STYLES_COMPLETION.pending;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => setShowDetailModal(true)}
      className="bg-white rounded-[1.8rem] shadow-sm border border-slate-100 mb-3 overflow-hidden flex-row min-h-[80px]"
    >
      <View className={`w-1.5 ${style.accent}`} />

      <View className="flex-1 p-4 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-2xl items-center justify-center mr-4 bg-slate-50 border border-slate-100">
            <Text className="font-black text-[10px] text-slate-400">#{index + 1}</Text>
          </View>

          <View className="flex-1 pr-2">
            <Text className="text-[15px] font-black text-slate-800 tracking-tight leading-tight" numberOfLines={1}>
              {person.nombreCompleto}
            </Text>
            <Text className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">DNI: {person.dni || '---'}</Text>
          </View>
        </View>

        {isComplete ? (
          <View className="bg-blue-50 px-3 py-2 rounded-xl border border-blue-100">
            <Text className="text-[9px] font-black text-blue-600 uppercase">REVISADO</Text>
          </View>
        ) : (
          <View className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            <Text className="text-[9px] font-black text-slate-300 uppercase">PENDIENTE</Text>
          </View>
        )}
      </View>

      <WorkerDetailModal
        visible={showDetailModal}
        person={person}
        onClose={() => setShowDetailModal(false)}
        onSelectRespuesta={onSelectRespuesta}
        options={options}
      />
    </TouchableOpacity>
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
        <Text className="mt-4 text-gray-500 font-bold">Cargando personal...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header Compacto y Organizado */}
      <View className="bg-white pt-12 border-b border-slate-100 z-10 shadow-sm">
        <View className="px-6 pb-4 flex-row items-center justify-between">
           <View className="flex-row items-center flex-1 pr-4">
              <TouchableOpacity onPress={() => router.back()} className="mr-4">
                 <Text className="text-xl text-blue-600">←</Text>
              </TouchableOpacity>
              <View>
                 <Text className="text-lg font-black text-slate-900 tracking-tighter" numberOfLines={1}>Reporte {report?.date}</Text>
                 <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ID: {id?.slice(-8).toUpperCase()}</Text>
              </View>
           </View>
           <View className="bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
              <Text className="text-[10px] font-black text-blue-600">
                 {Math.round((people.filter(p => !!p.respuestaObservacion).length / people.length) * 100)}%
              </Text>
           </View>
        </View>

        {/* Micro Barra de Progreso */}
        <View className="h-[2px] w-full bg-slate-100">
           <View 
              className="h-full bg-blue-600 shadow-sm shadow-blue-300" 
              style={{ width: `${(people.filter(p => !!p.respuestaObservacion).length / people.length) * 100}%` }} 
           />
        </View>

        {/* Acción: Buscador y Filtros */}
        <View className="py-4">
           {/* Buscador Slim */}
           <View className="px-6 mb-4">
              <View className="bg-slate-50 flex-row items-center px-5 py-3 rounded-2xl border border-slate-100">
                 <Text className="mr-3 text-base">🔍</Text>
                 <TextInput 
                   className="flex-1 text-sm text-slate-800 font-bold"
                   placeholder="Nombre, DNI o Código..."
                   value={search}
                   onChangeText={setSearch}
                   placeholderTextColor="#cbd5e1"
                 />
              </View>
           </View>

           {/* Chips de Filtro Horizontal */}
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
        contentContainerStyle={{ padding: 18, paddingBottom: 150 }}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={false}
        ListEmptyComponent={() => (
          <View className="items-center justify-center py-20 px-10">
            <View className="bg-slate-50 w-24 h-24 rounded-full items-center justify-center mb-6">
              <Text className="text-4xl text-slate-300">👥</Text>
            </View>
            <Text className="text-lg font-black text-slate-800 text-center mb-2">No se encontraron trabajadores</Text>
            <Text className="text-sm text-slate-400 text-center leading-relaxed">
              Intenta ajustar los filtros o el buscador para encontrar lo que necesitas.
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

      {/* Floating Action Button for Closing Report */}
      <View className="absolute bottom-0 w-full px-8 py-8 bg-white/90 border-t border-slate-100">
        <TouchableOpacity
          onPress={handleCerrarReporte}
          disabled={saving}
          activeOpacity={0.8}
          className={`w-full py-5 rounded-[2rem] flex-row justify-center items-center shadow-2xl ${saving ? 'bg-slate-400' : 'bg-rose-600 shadow-rose-200'}`}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-black text-xs text-center uppercase tracking-widest">🔒 Guardar y Finalizar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

