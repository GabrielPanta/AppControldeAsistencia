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
  "Indicó Generar Marcación",
  "Olvidó marcar",
  "Ausente",
  "Tardanza",
  "Permiso",
  "Trabajador no reportado en Planilla",
  "Canje",
  "Otro"
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
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-12 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100">
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">🏢</span>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Asistencia <span className="text-blue-600">Web</span></h1>
          <p className="text-slate-400 mt-3 font-semibold text-xs tracking-widest uppercase">Gestión Administrativa</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <input
            type="email" placeholder="Email"
            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-blue-100 transition-all outline-none text-slate-800 font-medium"
            value={authEmail} onChange={e => setAuthEmail(e.target.value)} required
          />
          <input
            type="password" placeholder="Contraseña"
            className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-blue-100 transition-all outline-none text-slate-800 font-medium"
            value={authPass} onChange={e => setAuthPass(e.target.value)} required
          />
          <button type="submit" className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-500/20 uppercase tracking-widest text-xs">Ingresar</button>
        </form>
      </motion.div>
    </div>
  );
}

// --- HEADER ---
function Header({ userData, handleLogout }) {
  return (
    <header className="bg-white border-b border-slate-100 px-8 py-5 flex justify-between items-center sticky top-0 z-50">
      <div className="flex items-center gap-5">
        <div className="relative w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl">A</div>
        <div>
          <h2 className="font-extrabold text-slate-900 text-lg">Reporte de Control de Asistencia</h2>
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest">{userData?.name} / {userData?.role} • EMPRESA {userData?.companyId}</p>
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
    if (!file || String(userData?.role || '').toUpperCase() !== 'ENCARGADO') return;
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
      const fechaI = headers.findIndex(h => String(h).toUpperCase().includes('FECHA'));

      let reportDate = new Date().toLocaleDateString('es-ES');
      if (fechaI !== -1) {
        const firstValidRow = dataRows.find(row => row[nameI] && row[fechaI]);
        if (firstValidRow) {
          reportDate = String(firstValidRow[fechaI]).trim();
        }
      }

      const extraHeaders = headers.filter((h, i) => i !== nameI && i !== dniI && i !== codI);

      const reportRef = await addDoc(collection(db, 'reports'), {
        companyId: userData.companyId,
        date: reportDate,
        uploadedBy: auth.currentUser.uid,
        status: 'ABIERTO',
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
      {String(userData?.role || '').toUpperCase() === 'ENCARGADO' && (
        <div className="col-span-1">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6 text-xl tracking-tight">Subida de Excel</h3>
            <label className="block border-2 border-dashed border-slate-200 p-10 rounded-[2rem] text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group">
              <Upload className="mx-auto mb-4 text-slate-300 group-hover:text-blue-500 transition-colors" size={40} />
              <span className="block font-bold text-slate-500 group-hover:text-blue-600 text-sm">Importar Archivo</span>
              <input type="file" className="hidden" accept=".xlsx" onChange={e => processFile(e.target.files[0])} />
            </label>
            {uploading && <p className="mt-4 text-xs font-black text-blue-600 animate-pulse text-center">CARGANDO...</p>}
          </div>
        </div>
      )}
      <div className={String(userData?.role || '').toUpperCase() === 'ENCARGADO' ? 'col-span-3' : 'col-span-4'}>
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <h3 className="font-black text-2xl text-slate-900 mb-8 tracking-tighter">Historial de Reportes</h3>
          <div className="space-y-4">
            {reports.map(r => (
              <div key={r.id} onClick={() => onSelectReport(r)} className="group flex items-center justify-between p-6 rounded-3xl bg-slate-50 hover:bg-white hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 transition-all cursor-pointer border border-transparent hover:border-blue-100">
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${['CLOSED', 'CERRADO'].includes(r.status) ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                    {['CLOSED', 'CERRADO'].includes(r.status) ? <CheckCircle size={28} /> : <FileSpreadsheet size={28} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-lg">Reporte {r.date}</p>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">ESTADO: <span className={['OPEN', 'ABIERTO'].includes(r.status) ? 'text-blue-600' : 'text-green-600'}>{r.status === 'OPEN' ? 'ABIERTO' : r.status === 'CLOSED' ? 'CERRADO' : r.status}</span></p>
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
  const [filterZona, setFilterZona] = useState('Todas');
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

  const zonaColumn = useMemo(() => {
    return tableColumns.find(col => {
      const c = String(col || '').toUpperCase().trim();
      return c === 'ZONA' || c === 'ZONAS' || c.includes('ZONA');
    });
  }, [tableColumns]);

  const progress = useMemo(() => {
    const total = people.length;
    const completed = people.filter(p => !!p.respuestaObservacion).length;
    return { total, completed, isAllDone: total > 0 && completed === total };
  }, [people]);

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

      let matchZona = true;
      if (zonaColumn && filterZona !== 'Todas') {
        const val = String(p.datosExtra?.[zonaColumn] || '').trim();
        matchZona = val === filterZona;
      }

      return matchSearch && matchObs && matchRuta && matchZona;
    });
  }, [people, search, filterObs, filterRuta, filterZona, rutaColumn, zonaColumn]);

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

  const COL_WIDTHS = {
    '#': 48,
    'NOMBRE': 280,
    'DNI': 100,
    'CODIGO': 90,
    'NOMBRE COMPLETO': 280,
    'DEFAULT': 140
  };

  const getColWidth = (col) => {
    const up = String(col || '').toUpperCase();
    if (COL_WIDTHS[up]) return COL_WIDTHS[up];
    if (up.includes('NOMBRE')) return COL_WIDTHS['NOMBRE'];
    if (up.includes('DNI')) return COL_WIDTHS['DNI'];
    if (up.includes('COD')) return COL_WIDTHS['CODIGO'];
    return COL_WIDTHS['DEFAULT'];
  };

  const stickyConfig = useMemo(() => {
    let offset = COL_WIDTHS['#'];
    const stickySet = new Set(['#']);
    const offsets = { '#': 0 };
    const widths = { '#': COL_WIDTHS['#'] };

    let stopNext = false;
    tableColumns.forEach(pc => {
      if (stopNext) return;
      const up = String(pc || '').trim().toUpperCase();
      const w = getColWidth(pc);

      // Hacemos sticky solo a los identificadores principales.
      // Si la columna NO es Nombre, ni DNI, ni Código, detenemos el sticky para que el resto pueda deslizarse.
      if (!up.includes('NOMBRE') && !up.includes('DNI') && !up.includes('COD')) {
        stopNext = true;
      }

      if (!stopNext || (up.includes('NOMBRE') || up.includes('DNI') || up.includes('COD'))) {
        stickySet.add(pc);
        offsets[pc] = offset;
        widths[pc] = w;
        offset += w;
      }
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

  const uniqueZonas = useMemo(() => {
    if (!zonaColumn) return [];
    const set = new Set();
    people.forEach(p => {
      const val = p.datosExtra?.[zonaColumn];
      if (val !== undefined && val !== null) {
        const strVal = String(val).trim();
        if (strVal !== '') set.add(strVal);
      }
    });
    return Array.from(set).sort();
  }, [people, zonaColumn]);


  const updateRespuesta = async (pId, val) => {
    if (['CLOSED', 'CERRADO'].includes(report.status)) return;
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
      await updateDoc(doc(db, 'reports', report.id), { status: 'CERRADO' });
      alert("Reporte Cerrado.");
      onBack();
    } catch (e) {
      alert("Error al cerrar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadExcel = () => {
    try {
      const exportHeaders = [...tableColumns, 'RESPUESTA OBSERVACIÓN'];

      const dataToExport = filtered.map(p => {
        const row = {};

        // 1. Llenamos la fila respetando EXACTAMENTE el orden visual de tableColumns
        tableColumns.forEach(col => {
          row[col] = p.datosExtra?.[col] !== undefined ? p.datosExtra[col] : (col === 'OBSERVACION' ? p.observacion : '');
        });

        // 2. Añadimos la columna final
        row['RESPUESTA OBSERVACIÓN'] = p.respuestaObservacion || 'PENDIENTE';
        return row;
      });

      // 3. Forzamos a XLSX a respetar el orden de las columnas con la propiedad 'header'
      const ws = XLSX.utils.json_to_sheet(dataToExport, { header: exportHeaders });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
      XLSX.writeFile(wb, `Reporte_Asistencia_${report.date.replace(/\//g, '_')}.xlsx`);
    } catch (e) {
      alert("Error al generar Excel: " + e.message);
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
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-[9px] font-semibold uppercase tracking-widest">EMPRESA: {report.companyId} • ESTADO: {report.status === 'OPEN' ? 'ABIERTO' : report.status === 'CLOSED' ? 'CERRADO' : report.status}</p>
            <div className="h-1 w-1 rounded-full bg-slate-200"></div>
            <p className="text-blue-500 text-[9px] font-black uppercase tracking-widest">ROL: {userData?.role || '---'}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 w-full lg:w-auto">
          {/* Grupo de Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input
                type="text" placeholder="Buscar..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-xl border-none outline-none focus:ring-4 focus:ring-blue-100 font-bold text-slate-700 text-[10px]"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="relative w-40">
              <select
                value={filterObs}
                onChange={(e) => setFilterObs(e.target.value)}
                className="w-full pl-4 pr-10 py-3 bg-slate-50 rounded-xl border-none outline-none focus:ring-4 focus:ring-blue-100 font-bold text-slate-700 appearance-none cursor-pointer text-[10px]"
              >
                <option value="Todas">Todas Obs.</option>
                {uniqueObservations.map(obs => (
                  <option key={obs} value={obs}>{obs}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                <ChevronRight className="rotate-90" size={14} />
              </div>
            </div>

            {rutaColumn && (
              <div className="relative w-40">
                <select
                  value={filterRuta}
                  onChange={(e) => setFilterRuta(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 bg-slate-50 rounded-xl border-none outline-none focus:ring-4 focus:ring-blue-100 font-bold text-slate-700 appearance-none cursor-pointer text-[10px]"
                >
                  <option value="Todas">Ruta</option>
                  {uniqueRutas.map(ruta => (
                    <option key={ruta} value={ruta}>{ruta}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                  <ChevronRight className="rotate-90" size={14} />
                </div>
              </div>
            )}

            {zonaColumn && (
              <div className="relative w-40">
                <select
                  value={filterZona}
                  onChange={(e) => setFilterZona(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 bg-slate-50 rounded-xl border-none outline-none focus:ring-4 focus:ring-blue-100 font-bold text-slate-700 appearance-none cursor-pointer text-[10px]"
                >
                  <option value="Todas">Zona</option>
                  {uniqueZonas.map(zona => (
                    <option key={zona} value={zona}>{zona}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                  <ChevronRight className="rotate-90" size={14} />
                </div>
              </div>
            )}
          </div>

          {/* Grupo de Acciones */}
          <div className="flex items-center gap-3">
            {['OPEN', 'ABIERTO'].includes(report.status) && (['CONTROL', 'ENCARGADO'].includes(String(userData?.role || '').toUpperCase())) && (
              <button
                onClick={handleClose}
                disabled={saving || !progress.isAllDone}
                className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border shadow-sm flex-1 sm:flex-none ${progress.isAllDone ? 'bg-slate-900 text-white border-slate-900 hover:bg-blue-600' : 'bg-white text-slate-400 border-slate-200 cursor-not-allowed'}`}
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : (progress.isAllDone ? <Lock size={14} /> : <Clock size={14} />)}
                {progress.isAllDone ? 'Cerrar Reporte' : `Respuestas: ${progress.completed}/${progress.total}`}
              </button>
            )}

            <button
              onClick={handleDownloadExcel}
              className="bg-white text-slate-700 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2 border border-slate-200 shadow-sm flex-1 sm:flex-none"
            >
              <FileSpreadsheet size={14} />
              Descargar Excel
            </button>

            {String(userData?.role || '').toUpperCase() === 'ENCARGADO' && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="bg-white text-red-500 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 border border-red-100 shadow-sm flex-1 sm:flex-none"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden relative">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left border-collapse table-fixed min-w-max">
            <thead className="bg-[#f8fafc] border-b border-slate-100 sticky top-0 z-40">
              <tr>
                <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-[#f8fafc] z-50 border-b border-r border-slate-100" style={{ width: `${COL_WIDTHS['#']}px` }}>#</th>
                {tableColumns.map(col => {
                  const isSticky = stickyConfig.stickySet.has(col);
                  const isLast = col === stickyConfig.lastCol;
                  const w = getColWidth(col);
                  return (
                    <th
                      key={col}
                      className={`px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest ${isSticky ? 'sticky bg-[#f8fafc] z-50 border-b border-slate-100' : ''} ${isLast ? 'border-r-2 border-slate-200' : 'border-r border-slate-100'}`}
                      style={{
                        left: isSticky ? `${stickyConfig.offsets[col]}px` : 'auto',
                        width: `${w}px`,
                        minWidth: `${w}px`
                      }}
                    >
                      {col}
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 sticky right-0 z-40 border-l border-blue-100" style={{ width: '220px' }}>Respuesta Observación</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filtered.map((p, idx) => (
                <tr key={p.id} className="hover:bg-blue-50 transition-colors group">
                  <td className="px-3 py-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 group-hover:bg-blue-50 sticky left-0 z-20 border-b border-r border-slate-100" style={{ width: `${COL_WIDTHS['#']}px` }}>{idx + 1}</td>
                  {tableColumns.map(col => {
                    const isSticky = stickyConfig.stickySet.has(col);
                    const isLast = col === stickyConfig.lastCol;
                    const w = getColWidth(col);
                    const val = p.datosExtra?.[col] !== undefined ? p.datosExtra[col] : (col === 'OBSERVACION' ? p.observacion : '');

                    return (
                      <td
                        key={col}
                        className={`px-3 py-1.5 text-[10px] font-medium text-slate-700 border-b ${isSticky ? 'sticky bg-white group-hover:bg-blue-50 z-20' : ''} ${isLast ? 'border-r-2 border-slate-200' : 'border-r border-slate-100'}`}
                        style={{
                          left: isSticky ? `${stickyConfig.offsets[col]}px` : 'auto',
                          width: `${w}px`,
                          minWidth: `${w}px`
                        }}
                      >
                        <span className="truncate block">{formatHora(col, val)}</span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 bg-white group-hover:bg-blue-50 sticky right-0 z-30 border-b border-l border-blue-100" style={{ width: '220px' }}>
                    <div className="relative">
                      <select
                        value={p.respuestaObservacion || ''}
                        onChange={(e) => updateRespuesta(p.id, e.target.value)}
                        disabled={['CLOSED', 'CERRADO'].includes(report.status)}
                        className={`w-full border rounded-md px-2 py-1 text-[10px] font-bold outline-none transition-all appearance-none cursor-pointer ${['CLOSED', 'CERRADO'].includes(report.status) ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-100 text-slate-500' : (!p.respuestaObservacion ? 'bg-red-50/30 border-red-100 text-red-500 hover:bg-red-50' : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-white')}`}
                      >
                        <option value="" disabled>--- Seleccione ---</option>
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
