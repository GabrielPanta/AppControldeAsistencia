import React, { useState, useEffect, useMemo } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, setDoc, query, where, getDocs, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, LogOut, FileSpreadsheet, CheckCircle, AlertCircle, 
  Loader2, Search, ChevronRight, User, Hash, Clock, X, Save, Lock, Info, ChevronLeft, Trash2
} from 'lucide-react';

const OBSERVACIONES = [
  "Sin observación",
  "Generó marcación",
  "Olvidó marcar",
  "Falta justificada",
  "Tardanza",
  "Permiso"
];

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          alert("Aviso: No se encontró perfil en 'users'.");
        }
      } else {
        setUser(null);
        setUserData(null);
        setCurrentView('dashboard');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, authEmail, authPass);
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col">
       <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
       <p className="mt-4 text-gray-500 font-medium">Cargando sistema...</p>
    </div>
  );

  if (!user) return <LoginView {...{ handleLogin, authEmail, setAuthEmail, authPass, setAuthPass }} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header userData={userData} handleLogout={handleLogout} />
      <main className="flex-1 w-full mx-auto p-4 md:p-10">
        <AnimatePresence mode="wait">
          {currentView === 'dashboard' ? (
            <DashboardView 
              userData={userData} 
              onSelectReport={(report) => {
                setSelectedReport(report);
                setCurrentView('report-detail');
              }} 
            />
          ) : (
            <ReportTableView 
              report={selectedReport} 
              onBack={() => setCurrentView('dashboard')} 
              userData={userData}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- LOGIN VIEW ---
function LoginView({ handleLogin, authEmail, setAuthEmail, authPass, setAuthPass }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-12 rounded-[3.5rem] shadow-2xl w-full max-w-md border border-white/20">
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6">
             <span className="text-5xl">🏢</span>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Asistencia Pro</h1>
          <p className="text-slate-400 mt-3 font-semibold text-sm">GESTIÓN WEB INTEGRADA</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <input 
            type="email" placeholder="Usuario" 
            className="w-full px-6 py-4 rounded-3xl bg-slate-50 border-none focus:ring-4 focus:ring-blue-100 transition-all outline-none text-slate-800 font-medium"
            value={authEmail} onChange={e => setAuthEmail(e.target.value)} required 
          />
          <input 
            type="password" placeholder="Contraseña" 
            className="w-full px-6 py-4 rounded-3xl bg-slate-50 border-none focus:ring-4 focus:ring-blue-100 transition-all outline-none text-slate-800 font-medium"
            value={authPass} onChange={e => setAuthPass(e.target.value)} required 
          />
          <button type="submit" className="w-full bg-blue-600 text-white font-black py-5 rounded-3xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-2xl shadow-blue-500/20 uppercase tracking-widest text-xs">Ingresar</button>
        </form>
      </motion.div>
    </div>
  );
}

// --- HEADER ---
function Header({ userData, handleLogout }) {
  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-8 py-5 flex justify-between items-center sticky top-0 z-50">
      <div className="flex items-center gap-5">
        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl">A</div>
        <div>
          <h2 className="font-extrabold text-slate-900 text-lg">Asistencia Web</h2>
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest">{userData?.role} • EMPRESA {userData?.companyId}</p>
        </div>
      </div>
      <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-500 font-bold transition-colors">
        <LogOut size={18} />
        <span className="hidden sm:inline">Cerrar Sesión</span>
      </button>
    </header>
  );
}

// --- DASHBOARD VIEW (LISTADO EXPORTADO) ---
function DashboardView({ userData, onSelectReport }) {
  const [reports, setReports] = useState([]);
  const [uploading, setUploading] = useState(false);

  const fetchReports = async () => {
    if (!userData?.companyId) return;
    try {
      const q = query(collection(db, 'reports'), where('companyId', '==', userData.companyId));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchReports(); }, [userData]);

  const processFile = async (file) => {
    if (!file || userData.role !== 'ENCARGADO') return;
    try {
      setUploading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rowsRaw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: "dd/mm/yyyy" });
      if (rowsRaw.length < 2) return;

      const headers = rowsRaw[0];
      const dataRows = rowsRaw.slice(1);
      const nameI = headers.findIndex(h => String(h).toUpperCase().includes('NOMBRE'));
      const dniI = headers.findIndex(h => String(h).toUpperCase().includes('DNI'));
      const codI = headers.findIndex(h => String(h).toUpperCase().includes('COD'));
      const obsI = headers.findIndex(h => String(h).toUpperCase().includes('OBSERV') || String(h).toUpperCase().includes('SITUAC'));

      const extraHeaders = headers.filter((h, i) => i !== nameI && i !== dniI && i !== codI);

      const reportRef = await addDoc(collection(db, 'reports'), {
        companyId: userData.companyId,
        date: new Date().toLocaleDateString('es-ES'),
        uploadedBy: auth.currentUser.uid,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        columnOrder: headers // Guardamos el orden original completo
      });

      const promises = dataRows.map(row => {
        if (!row[nameI]) return;
        const datosExtra = {};
        headers.forEach((h, i) => {
          datosExtra[h] = row[i] || ''; // Guardamos TODAS las columnas aquí para fácil acceso por nombre
        });

        const currentObs = (obsI !== -1 && row[obsI]) ? String(row[obsI]) : 'Sin observación';

        return setDoc(doc(collection(db, `reports/${reportRef.id}/people`)), {
          nombreCompleto: String(row[nameI]),
          dni: dniI !== -1 ? String(row[dniI] || '') : '',
          codigo: codI !== -1 ? String(row[codI] || '') : '',
          observacion: currentObs,
          datosExtra,
          respuestaObservacion: ''
        });
      });
      await Promise.all(promises);
      fetchReports();
    } catch (e) { alert(e.message); } finally { setUploading(false); }
  };


  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      {userData?.role === 'ENCARGADO' && (
        <div className="col-span-1">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
             <h3 className="font-bold text-slate-800 mb-6 text-xl">Subida de Excel</h3>
             <label className="block border-2 border-dashed border-slate-200 p-10 rounded-[2rem] text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group">
                <Upload className="mx-auto mb-4 text-slate-300 group-hover:text-blue-500 transition-colors" size={40} />
                <span className="block font-bold text-slate-500 group-hover:text-blue-600">Importar Archivo</span>
                <input type="file" className="hidden" accept=".xlsx" onChange={e => processFile(e.target.files[0])} />
             </label>
             {uploading && <p className="mt-4 text-xs font-black text-blue-600 animate-pulse text-center">CARGANDO...</p>}
          </div>
        </div>
      )}
      <div className={userData?.role === 'ENCARGADO' ? 'col-span-3' : 'col-span-4'}>
         <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <h3 className="font-black text-2xl text-slate-900 mb-8 tracking-tighter">Historial de Reportes</h3>
            <div className="space-y-4">
              {reports.map(r => (
                <div key={r.id} onClick={() => onSelectReport(r)} className="group flex items-center justify-between p-6 rounded-3xl bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 transition-all cursor-pointer border border-transparent hover:border-blue-100">
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${r.status === 'CLOSED' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                       {r.status === 'CLOSED' ? <CheckCircle size={28}/> : <FileSpreadsheet size={28}/>}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-lg">Reporte {r.date}</p>
                      <p className="text-slate-400 text-xs font-semibold">ESTADO: <span className={r.status === 'OPEN' ? 'text-blue-600' : 'text-green-600'}>{r.status}</span></p>
                    </div>
                  </div>
                  <ChevronRight size={24} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
              ))}
            </div>
         </div>
      </div>
    </div>
  );
}

// --- REPORT TABLE VIEW (VERSION EXCEL) ---
function ReportTableView({ report, onBack, userData }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterObs, setFilterObs] = useState('Todas');
  const [filterRuta, setFilterRuta] = useState('Todas');
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    const q = collection(db, `reports/${report.id}/people`);
    const unsub = onSnapshot(q, (snap) => {
       setPeople(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
       setLoading(false);
    });
    return unsub;
  }, [report.id]);

  const tableColumns = useMemo(() => {
    const allCols = [];
    
    // 1. Prioridad: Orden original guardado (Nuevos reportes)
    if (report.columnOrder && report.columnOrder.length > 0) {
      allCols.push(...report.columnOrder);
    } else {
      // 2. Fallback: Orden guardado de extras (Reportes intermedios)
      const extra = report.extraColumnsOrder || [];
      if (extra.length > 0) {
        allCols.push('NOMBRE', 'DNI', 'CODIGO', ...extra, 'OBSERVACION');
      } else {
        // 3. Fallback total: Derivar de los datos de las personas (Reportes antiguos)
        const keys = new Set();
        people.forEach(p => {
          if (p.datosExtra) {
            Object.keys(p.datosExtra).forEach(k => keys.add(k));
          }
        });
        allCols.push('NOMBRE', 'DNI', 'CODIGO', ...Array.from(keys), 'OBSERVACION');
      }
    }
    
    // Eliminar duplicados y valores vacíos para evitar errores de React key
    return Array.from(new Set(allCols.filter(col => col && String(col).trim() !== '')));
  }, [report.columnOrder, report.extraColumnsOrder, people]);

  const columnTypes = useMemo(() => {
    const types = {};
    tableColumns.forEach(col => {
      const up = String(col).toUpperCase();
      if (up.includes('NOMBRE')) types[col] = 'NAME';
      else if (up.includes('DNI')) types[col] = 'DNI';
      else if (up.includes('COD')) types[col] = 'CODE';
      else if (up.includes('OBSERV') || up.includes('SITUAC')) types[col] = 'OBS';
      else types[col] = 'EXTRA';
    });
    return types;
  }, [tableColumns]);

  const rutaColumn = useMemo(() => {
    return tableColumns.find(col => {
      const c = String(col || '').toUpperCase().trim();
      return c === 'RUTA' || c === 'RUTAS' || c.includes('RUTA');
    });
  }, [tableColumns]);

  const filtered = useMemo(() => {
    return people.filter(p => {
      const matchSearch = p.nombreCompleto.toLowerCase().includes(search.toLowerCase()) || 
                          p.dni.includes(search) || 
                          p.codigo?.includes(search);
      const matchObs = filterObs === 'Todas' || String(p.observacion || '').trim() === filterObs;
      
      let matchRuta = true;
      if (rutaColumn && filterRuta !== 'Todas') {
        const val = String(p.datosExtra?.[rutaColumn] || '').trim();
        matchRuta = val === filterRuta;
      }

      return matchSearch && matchObs && matchRuta;
    });
  }, [people, search, filterObs, filterRuta, rutaColumn]);

  const formatHora = (colName, val) => {
    if (!val) return '---';
    const upCol = String(colName).toUpperCase();
    if (upCol.includes('MARC')) {
      if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      } else if (typeof val === 'string' && val.length < 10 && val.includes(':')) {
        return val; // It's likely already formatted time
      } else if (typeof val === 'string' && !isNaN(Number(val))) {
        // Just in case it's a numeric string
         const date = new Date(Math.round((Number(val) - 25569) * 86400 * 1000));
         return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      }
    }
    return val;
  };

  const stickyConfig = useMemo(() => {
    let offset = 48; // El ancho de la columna "#"
    const stickySet = new Set(['#']);
    const offsets = { '#': 0 };
    const widths = { '#': 48 };

    let stopNext = false;
    tableColumns.forEach(pc => {
      if (stopNext) return;
      const up = String(pc || '').toUpperCase();
      
      let w = 110; // ancho default p/sticky
      if (up.includes('NOMBRE')) w = 240;
      else if (up.includes('DNI')) w = 95;
      else if (up.includes('COD')) w = 90;
      else if (up.includes('FECHA') && up.includes('INGRESO')) {
        w = 120;
        stopNext = true;
      }
      
      stickySet.add(pc);
      offsets[pc] = offset;
      widths[pc] = w;
      offset += w;
    });

    const lastCol = Array.from(stickySet).pop();
    return { stickySet, offsets, widths, lastCol };
  }, [tableColumns]);

  const uniqueObservations = useMemo(() => {
    const set = new Set();
    people.forEach(p => {
      if (p.observacion && p.observacion.trim() !== '') {
        set.add(p.observacion.trim());
      }
    });
    return Array.from(set).sort();
  }, [people]);

  const uniqueRutas = useMemo(() => {
    if (!rutaColumn) return [];
    const set = new Set();
    people.forEach(p => {
      const val = p.datosExtra?.[rutaColumn];
      if (val !== undefined && val !== null) {
        const strVal = String(val).trim();
        if (strVal !== '') set.add(strVal);
      }
    });
    return Array.from(set).sort();
  }, [people, rutaColumn]);

  const updateRespuesta = async (pId, val) => {
    if (report.status === 'CLOSED') return;
    try {
      await updateDoc(doc(db, `reports/${report.id}/people`, pId), { respuestaObservacion: val });
    } catch (e) {
      console.error("Error updating response:", e);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Deseas eliminar PERMANENTEMENTE este reporte y todos sus datos? Esta acción no se puede deshacer.")) return;
    try {
      setSaving(true);
      const q = collection(db, `reports/${report.id}/people`);
      const snap = await getDocs(q);
      const delPromises = snap.docs.map(d => deleteDoc(doc(db, `reports/${report.id}/people`, d.id)));
      await Promise.all(delPromises);
      await deleteDoc(doc(db, 'reports', report.id));
      alert("Reporte Eliminado.");
      onBack();
    } catch (e) {
      alert("Error al eliminar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!confirm("¿Deseas cerrar permanentemente este reporte?")) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, 'reports', report.id), { status: 'CLOSED' });
      alert("Reporte Cerrado.");
      onBack();
    } catch (e) {
      alert("Error al cerrar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
         <div>
           <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold hover:text-blue-600 mb-1 transition-all text-xs">
             <ChevronLeft size={16} /> Volver
           </button>
           <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Reporte del {report.date}</h2>
           <p className="text-slate-400 text-[9px] font-semibold uppercase tracking-widest mt-1">EMPRESA: {report.companyId} • ESTADO: {report.status}</p>
         </div>
         <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" placeholder="Buscar trabajador..." 
                className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl border-none outline-none focus:ring-4 focus:ring-blue-100 font-bold text-slate-700 text-xs"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="relative flex-1 sm:w-56">
              <select 
                value={filterObs} 
                onChange={(e) => setFilterObs(e.target.value)}
                className="w-full pl-4 pr-10 py-3 bg-slate-50 rounded-xl border-none outline-none focus:ring-4 focus:ring-blue-100 font-bold text-slate-700 appearance-none cursor-pointer text-xs"
              >
                <option value="Todas">Todas las Obs.</option>
                {uniqueObservations.map(obs => (
                  <option key={obs} value={obs}>{obs}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                <ChevronRight className="rotate-90" size={16} />
              </div>
            </div>

            {rutaColumn && (
              <div className="relative flex-1 sm:w-56">
                <select 
                  value={filterRuta} 
                  onChange={(e) => setFilterRuta(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 bg-slate-50 rounded-xl border-none outline-none focus:ring-4 focus:ring-blue-100 font-bold text-slate-700 appearance-none cursor-pointer text-xs"
                >
                  <option value="Todas">Todas las Rutas</option>
                  {uniqueRutas.map(ruta => (
                    <option key={ruta} value={ruta}>{ruta}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                  <ChevronRight className="rotate-90" size={16} />
                </div>
              </div>
            )}
            
            {report.status === 'OPEN' && userData?.role === 'CONTROL' && (
              <button 
                onClick={handleClose} 
                disabled={saving} 
                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Lock size={14} />}
                Cerrar Reporte
              </button>
            )}

            <button 
              onClick={handleDelete} 
              disabled={saving} 
              className="bg-red-50 text-red-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 border border-red-100"
            >
              {saving ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
              Eliminar Reporte
            </button>
         </div>
      </div>


      <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden relative">
         <div className="overflow-x-auto max-h-[75vh]">
            <table className="w-full text-left border-collapse table-fixed min-w-max">
               <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-40">
                  <tr>
                     <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-10" style={{ width: '48px' }}>#</th>
                     {tableColumns.map(col => {
                        const isSticky = stickyConfig.stickySet.has(col);
                        return (
                          <th 
                            key={col} 
                            className={`px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest ${isSticky ? 'sticky bg-slate-50 z-10' : ''}`}
                            style={{ 
                              width: stickyConfig.widths[col] || '140px',
                              left: isSticky ? `${stickyConfig.offsets[col]}px` : undefined,
                              boxShadow: isSticky && col === stickyConfig.lastCol ? '4px 0 6px -3px rgba(0,0,0,0.05)' : undefined
                            }}
                          >
                            {col === 'NOMBRE' ? 'Trabajador' : col}
                          </th>
                        );
                     })}
                     <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest min-w-[200px] w-[200px]">Respuesta Observacion</th>
                  </tr>
               </thead>

               <tbody className="divide-y divide-slate-50">
                  {filtered.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-4 py-2 text-[10px] font-bold text-slate-300 sticky left-0 bg-white group-hover:bg-blue-50/50 transition-colors z-10">{idx + 1}</td>
                        {tableColumns.map(col => {
                           const type = columnTypes[col];
                           const isSticky = stickyConfig.stickySet.has(col);
                           const val = p.datosExtra?.[col] ?? (
                             type === 'NAME' ? p.nombreCompleto :
                             type === 'DNI' ? p.dni :
                             type === 'CODE' ? p.codigo :
                             type === 'OBS' ? p.observacion : 
                             ''
                           );

                           const baseTdClass = `px-4 py-2 ${isSticky ? 'sticky bg-white group-hover:bg-blue-50/50 z-10 transition-colors' : ''}`;
                           const stickyStyle = isSticky ? { 
                             left: `${stickyConfig.offsets[col]}px`,
                             boxShadow: col === stickyConfig.lastCol ? '4px 0 6px -3px rgba(0,0,0,0.05)' : undefined
                           } : {};

                           if (type === 'NAME') return (
                              <td key={col} className={baseTdClass} style={stickyStyle}>
                                <p className="font-bold text-slate-800 text-[11px] whitespace-nowrap overflow-hidden text-ellipsis">{val}</p>
                              </td>
                           );
                           if (type === 'DNI' || type === 'CODE') return (
                              <td key={col} className={baseTdClass} style={stickyStyle}>
                                <p className="text-[9px] font-black text-slate-400 whitespace-nowrap">{type}: {val || '---'}</p>
                              </td>
                           );
                           if (type === 'OBS') return (
                              <td key={col} className={baseTdClass} style={stickyStyle}>
                                 <p className="text-[9px] font-semibold text-slate-500 whitespace-nowrap italic overflow-hidden text-ellipsis">{val || '---'}</p>
                              </td>
                           );
                           return (
                              <td key={col} className={baseTdClass} style={stickyStyle}>
                                <p className="text-[9px] font-semibold text-slate-600 whitespace-nowrap">{formatHora(col, val)}</p>
                              </td>
                           );
                        })}
                       <td className="px-4 py-2">
                          <div className="relative">
                            <select 
                              value={p.respuestaObservacion || 'Sin observación'} 
                              onChange={(e) => updateRespuesta(p.id, e.target.value)}
                              disabled={report.status === 'CLOSED'}
                              className={`w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-[10px] font-bold text-slate-700 focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all appearance-none cursor-pointer ${report.status === 'CLOSED' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white'}`}
                            >
                              {OBSERVACIONES.map(obs => (
                                <option key={obs} value={obs}>{obs}</option>
                              ))}
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                               <ChevronRight className="rotate-90" size={12} />
                            </div>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
         {loading && <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}
         {!loading && filtered.length === 0 && (
           <div className="py-20 text-center">
             <Search className="mx-auto text-slate-200 mb-4" size={48} />
             <p className="text-slate-300 font-bold">No se encontraron resultados para "{search}"</p>
           </div>
         )}
      </div>
    </motion.div>
  );
}

export default App;
