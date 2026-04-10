import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, FlatList, Alert, StatusBar, SafeAreaView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useAuth } from '../../context/auth';
import { useRouter } from 'expo-router';

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '---';
  const s = String(dateStr).trim();
  
  // 1. Caso DD/MM/YYYY o D/M/YYYY
  const slashParts = s.split('/');
  if (slashParts.length === 3) {
    const day = slashParts[0].padStart(2, '0');
    const month = slashParts[1].padStart(2, '0');
    let year = slashParts[2].split(' ')[0]; // Quitar hora si existe
    if (year.length === 2) year = '20' + year;
    return `${day}/${month}/${year}`;
  }

  // 2. Caso YYYY-MM-DD o similar (ISO)
  if (s.includes('-')) {
    const dashParts = s.split('T')[0].split('-');
    if (dashParts.length === 3) {
      if (dashParts[0].length === 4) { // YYYY-MM-DD
        return `${dashParts[2].padStart(2, '0')}/${dashParts[1].padStart(2, '0')}/${dashParts[0]}`;
      } else { // DD-MM-YYYY
        return `${dashParts[0].padStart(2, '0')}/${dashParts[1].padStart(2, '0')}/${dashParts[2]}`;
      }
    }
  }

  // 3. Fallback a objeto Date
  const d = new Date(s);
  if (!isNaN(d.getTime()) && s.length > 5) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return s;
};

const getCompanyName = (id) => {
  switch (String(id)) {
    case '9': return 'Rapel';
    case '14': return 'Verfrut';
    case '23': return 'Avanti';
    default: return 'Desconocida';
  }
};

export default function ControlDashboard() {
  const insets = useSafeAreaInsets();
  const { userData } = useAuth();
  const [reports, setReports] = useState([]);
  const [reportStats, setReportStats] = useState({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const handleSignOut = () => {
    Alert.alert(
      "Cerrar Sesión",
      "¿Estás seguro que deseas salir?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salir",
          style: "destructive",
          onPress: () => {
            auth.signOut();
            router.replace('/');
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (!userData?.companyId) return;

    // Usamos onSnapshot para que los reportes se actualicen en tiempo real
    const q = query(
      collection(db, 'reports'),
      where('companyId', '==', userData.companyId),
      where('status', 'in', ['OPEN', 'ABIERTO'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportesObtenidos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const sortedReports = reportesObtenidos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setReports(sortedReports);
      setLoading(false);

      // Cargar estadísticas de avance para cada reporte
      reportesObtenidos.forEach(async (rep) => {
        try {
          const peopleSnap = await getDocs(collection(db, `reports/${rep.id}/people`));
          const total = peopleSnap.size;
          const completed = peopleSnap.docs.filter(d => !!d.data().respuestaObservacion).length;
          setReportStats(prev => ({
            ...prev,
            [rep.id]: { total, completed }
          }));
        } catch (err) {
          console.error("Error fetching stats for", rep.id, err);
        }
      });
    }, (error) => {
      console.error("Error fetching reports:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const renderReportItem = ({ item }) => {
    const stats = reportStats[item.id] || { total: 0, completed: 0 };
    const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    return (
    <TouchableOpacity
      onPress={() => router.push(`/(control)/report/${item.id}`)}
      activeOpacity={0.7}
      style={{ borderRadius: 32 }}
      className="bg-white p-6 shadow-2xl shadow-indigo-500/5 border border-slate-100/50 mb-5 overflow-hidden"
    >
      <View className="flex-row justify-between items-center mb-5">
        <View className="flex-row items-center flex-1">
          <View 
            style={{ borderRadius: 24 }}
            className="w-16 h-16 bg-indigo-50 items-center justify-center mr-5 border border-indigo-100/50"
          >
              <Text className="text-3xl">📂</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                <View className={`w-1.5 h-1.5 rounded-full ${percentage === 100 ? 'bg-green-500' : 'bg-indigo-600'} mr-2`} />
                <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {percentage === 100 ? 'Revisión Completa' : 'Avance del Reporte'}
                </Text>
              </View>
              <Text className="text-[19px] font-black text-slate-900 tracking-tighter">Día {formatDisplayDate(item.date)}</Text>
              <Text className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mt-1">
                Empresa: {getCompanyName(item.companyId)}
              </Text>
            </View>
          </View>
          <View className="bg-indigo-600 w-11 h-11 rounded-full items-center justify-center shadow-lg shadow-indigo-200">
            <Text className="text-white font-black text-lg">→</Text>
          </View>
        </View>

        {/* Progress Section */}
        <View className="bg-slate-50/50 p-4 rounded-[1.8rem] border border-slate-100/50">
          <View className="flex-row justify-between items-center mb-3 px-1">
            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progreso</Text>
            <View className="flex-row items-center">
              <Text className="text-[11px] font-black text-slate-800">{stats.completed}</Text>
              <Text className="text-[11px] font-bold text-slate-300"> / {stats.total} revisados</Text>
            </View>
          </View>
          <View className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <View
              className={`h-full ${percentage === 100 ? 'bg-green-500' : 'bg-indigo-600'}`}
              style={{ width: `${percentage}%` }}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />

      {/* Header Premium con Estilo de Pantalla de Monitoreo */}
      <View 
        style={{ paddingTop: Platform.OS === 'android' ? insets.top + 25 : 20 }}
        className="px-6 pb-10 bg-white border-b border-slate-100 shadow-sm"
      >
        <View className="flex-row justify-between items-center mb-10">
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
                {userData?.name ? userData.name.split(' ')[0] : 'Admin'}
              </Text>
              <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                {userData?.role || 'Sistema'} • {getCompanyName(userData?.companyId)}
              </Text>
            </View>
          </View>
            <View className="flex-row items-center">
               {(auth.currentUser?.email || userData?.email || '')?.trim().toLowerCase() === 'gpanta@verfrut.pe' && (
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

        {/* Widgets Estadísticos con Iconografía */}
        <View className="flex-row gap-4">
          <View 
            style={{ borderRadius: 40 }}
            className="flex-1 bg-indigo-600 p-7 shadow-2xl shadow-indigo-500/30 border border-indigo-500 overflow-hidden relative"
          >
            {/* Background Glow Effect */}
            <View className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full" />

            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center">
                <Text className="text-sm">📋</Text>
              </View>
              <Text className="text-indigo-100 text-[9px] font-black uppercase tracking-widest opacity-90">Pendientes</Text>
            </View>
            <View className="flex-row items-baseline gap-1.5 px-1">
              <Text className="text-white text-4xl font-black tracking-tighter">{reports.length}</Text>
              <Text className="text-indigo-200 text-[10px] font-black uppercase">Reportes</Text>
            </View>
          </View>

          <View 
            style={{ borderRadius: 40 }}
            className="flex-1 bg-slate-950 p-7 shadow-2xl shadow-slate-950/20 border border-slate-900 overflow-hidden relative"
          >
            {/* Background Glow Effect */}
            <View className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full" />

            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <Text className="text-sm">🛡️</Text>
              </View>
              <Text className="text-slate-400 text-[9px] font-black uppercase tracking-widest opacity-80">Control</Text>
            </View>
            <View className="px-1">
              <Text className="text-white text-[17px] font-black tracking-tighter mb-1" numberOfLines={1}>
                {getCompanyName(userData?.companyId)}
              </Text>
              <Text className="text-indigo-500 text-[9px] font-black uppercase tracking-widest">Sede Central</Text>
            </View>
          </View>
        </View>
      </View>

      <View className="flex-1 px-6 pt-8">
        <View className="flex-row items-baseline justify-between mb-6">
          <Text className="text-xl font-black text-slate-900 tracking-tight">Reportes Abiertos</Text>
          <Text className="text-indigo-600 font-bold text-xs">{reports.length} en total</Text>
        </View>

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="text-slate-400 font-bold mt-4 uppercase tracking-widest text-[10px]">Actualizando datos...</Text>
          </View>
        ) : reports.length === 0 ? (
          <View 
            style={{ borderRadius: 40 }}
            className="bg-white p-10 border border-slate-100 items-center justify-center mt-4 shadow-sm"
          >
            <View className="w-20 h-20 bg-green-50 rounded-full items-center justify-center mb-6">
              <Text className="text-4xl">✨</Text>
            </View>
            <Text className="text-2xl font-black text-slate-900 text-center tracking-tight">¡Todo completado!</Text>
            <Text className="text-slate-400 text-center mt-3 font-medium leading-5">
              No hay reportes pendientes de revisión en este momento para tu empresa.
            </Text>
          </View>
        ) : (
          <FlatList
            data={reports}
            keyExtractor={item => item.id}
            renderItem={renderReportItem}
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
