import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { useAuth } from '../../context/auth';
import { useRouter } from 'expo-router';

export default function ControlDashboard() {
  const { userData } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const handleSignOut = () => {
    auth.signOut();
    router.replace('/');
  };

  useEffect(() => {
    if (!userData?.companyId) return;

    const fetchReports = async () => {
      try {
        setLoading(true);
        // Traer reportes de la misma empresa que estén abiertos
        const q = query(
          collection(db, 'reports'),
          where('companyId', '==', userData.companyId),
          where('status', '==', 'OPEN')
        );

        const querySnapshot = await getDocs(q);
        const reportesObtenidos = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // ORDENAR LOCALMENTE para evitar requerir un índice compuesto en Firestore de entrada
        const sortedReports = reportesObtenidos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setReports(sortedReports);
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [userData]);

  const renderReportItem = ({ item }) => (
    <TouchableOpacity 
      onPress={() => router.push(`/(control)/report/${item.id}`)}
      className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4 flex-row justify-between items-center"
    >
      <View>
        <Text className="text-lg font-bold text-gray-800">Reporte {item.date}</Text>
        <Text className="text-sm text-gray-500 mt-1">Sube: {item.companyId === '9' ? 'Rapel' : 'Verfrut'}</Text>
      </View>
      <View className="bg-blue-50 px-3 py-1.5 rounded-full">
        <Text className="text-blue-700 text-xs font-bold text-center">REVISAR →</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-gray-50">
      <View className="p-6 pb-2 pt-10 flex-row justify-between items-center bg-white border-b border-gray-100">
         <View>
            <Text className="text-xl font-extrabold text-gray-900">🔍 Control de Asistencia</Text>
            <Text className="text-blue-600 font-medium mt-1">Hola, {userData?.name || 'Control'}</Text>
         </View>
         <TouchableOpacity onPress={handleSignOut} className="bg-gray-100 px-4 py-2 rounded-lg">
           <Text className="text-gray-700 font-medium text-sm">Salir</Text>
         </TouchableOpacity>
      </View>

      <View className="flex-1 px-4 pt-6">
        <Text className="text-lg font-bold text-gray-800 mb-4 px-2">Reportes Pendientes</Text>

        {loading ? (
             <View className="flex-1 justify-center items-center">
                 <ActivityIndicator size="large" color="#2563EB" />
                 <Text className="text-gray-500 mt-4">Cargando reportes...</Text>
             </View>
        ) : reports.length === 0 ? (
            <View className="bg-white p-8 rounded-2xl border border-gray-100 items-center justify-center mt-4">
                <Text className="text-4xl mb-4">✅</Text>
                <Text className="text-xl font-bold text-gray-800 text-center">¡Todo al día!</Text>
                <Text className="text-gray-500 text-center mt-2">No hay reportes abiertos pendientes de revisión para tu empresa.</Text>
            </View>
        ) : (
          <FlatList 
            data={reports}
            keyExtractor={item => item.id}
            renderItem={renderReportItem}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}
