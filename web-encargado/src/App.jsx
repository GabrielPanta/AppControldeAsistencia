import React, { useState, useEffect, useMemo, useRef } from 'react';
import { auth, db, firebaseConfig } from './firebase';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, setDoc, query, where, getDocs, updateDoc, onSnapshot, deleteDoc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, LogOut, FileSpreadsheet, CheckCircle, AlertCircle,
  Loader2, Search, ChevronRight, User, Hash, Clock, X, Save, Lock, Info, ChevronLeft, Trash2, MousePointerClick, BarChart3, PieChart as PieIcon, LineChart as LineIcon, TrendingUp, Users, Map
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';

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

const getCompanyName = (id) => {
  switch (String(id)) {
    case '9': return 'Rapel';
    case '14': return 'Verfrut';
    case '23': return 'Avanti';
    default: return 'Desconocida';
  }
};

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

const CustomDropdown = ({ value, options, onChange, placeholder, className, isCompact = false, disabled = false, onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (onOpenChange) onOpenChange(isOpen);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => 
    (typeof o === 'string' ? o : o.value) === value
  );
  
  const displayValue = selectedOption 
    ? (typeof selectedOption === 'string' ? selectedOption : selectedOption.label) 
    : placeholder;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between transition-all outline-none ${isCompact ? 'px-3 py-2 rounded-xl text-[10px]' : 'px-4 py-3 rounded-xl text-[10px]'} font-bold ${isOpen ? 'ring-4 ring-blue-100 bg-white border-blue-200 shadow-sm' : 'bg-slate-50 border-transparent'} border text-slate-700 ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 text-slate-400' : 'hover:bg-white hover:border-slate-200'}`}
      >
        <span className="truncate pr-2">{displayValue}</span>
        <ChevronRight className={`transition-transform duration-300 ${isOpen ? '-rotate-90' : 'rotate-90 text-slate-300'}`} size={14} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`absolute z-[100] w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden py-2 ${isCompact ? 'left-auto right-0 min-w-[200px]' : 'left-0'}`}
            style={{ top: '100%' }}
          >
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {options.map((opt, i) => {
                const optVal = typeof opt === 'string' ? opt : opt.value;
                const optLabel = typeof opt === 'string' ? opt : opt.label;
                const isActive = optVal === value;

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onChange(optVal);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-5 py-3 text-[10px] font-bold transition-all ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50 hover:pl-6'}`}
                  >
                    {optLabel}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const WorkerEditModal = ({ person, reportId, tableColumns, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    nombreCompleto: person.nombreCompleto || '',
    dni: person.dni || '',
    datosExtra: { ...(person.datosExtra || {}) }
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const pRef = doc(db, `reports/${reportId}/people`, person.id);
      const updatedData = {
        ...formData,
        edited: true
      };
      await updateDoc(pRef, updatedData);
      onSave({ ...person, ...updatedData });
      onClose();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100"
      >
        <div className="p-10">
          <div className="flex justify-between items-start mb-10">
            <div>
              <p className="text-blue-500 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center text-[8px]">✏️</span> Editando Trabajador
              </p>
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Ficha de Datos</h3>
            </div>
            <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-all">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-h-[50vh] overflow-y-auto px-2">
            <div className="space-y-4">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Datos Principales</p>
              <div className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nombre Completo</label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-400 cursor-not-allowed">
                    {formData.nombreCompleto}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">DNI</label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-400 cursor-not-allowed">
                    {formData.dni || '---'}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Datos Extra</p>
              <div className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                {tableColumns.filter(key => {
                  const k = key.toUpperCase().trim();
                  return !k.includes('NOMBRE') && !k.includes('TRABAJADOR') && !k.includes('PERSONAL') && !k.includes('DNI') && !k.includes('IDENTIFICACION');
                }).map((key, idx) => {
                  const isEditable = ["ZONA", "CUARTEL", "PLACA", "RUTA", "C-BUS", "CUADRILLA"].includes(key.toUpperCase().trim());
                  const value = formData.datosExtra[key];
                  return (
                    <div key={`${key}-${idx}`}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">{key}</label>
                      {isEditable ? (
                        <input 
                          type="text" 
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                          value={value || ''} 
                          onChange={e => setFormData({ 
                            ...formData, 
                            datosExtra: { ...formData.datosExtra, [key]: e.target.value } 
                          })}
                        />
                      ) : (
                        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-400 cursor-not-allowed">
                          {value || '---'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-50 flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-blue-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all shadow-xl shadow-indigo-100"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              Guardar Cambios
            </button>
            <button
              onClick={onClose}
              className="px-10 bg-slate-50 text-slate-400 py-5 rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all border border-slate-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

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

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            userData={userData}
            onSelectReport={(report) => {
              setSelectedReport(report);
              setCurrentView('report-detail');
            }}
          />
        );
      case 'report-detail':
        return (
          <ReportTableView
            report={selectedReport}
            onBack={() => setCurrentView('dashboard')}
            userData={userData}
          />
        );
      case 'register-user':
        return (
          <RegisterUserView 
            onBack={() => setCurrentView('dashboard')} 
          />
        );
      case 'analytics':
        return (
          <AnalyticsDashboard 
            userData={userData} 
            onBack={() => setCurrentView('dashboard')}
          />
        );
      default:
        return null;
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      <p className="mt-4 text-gray-500 font-medium">Cargando sistema...</p>
    </div>
  );

  if (!user) return <LoginView {...{ handleLogin, authEmail, setAuthEmail, authPass, setAuthPass }} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header userData={userData} handleLogout={handleLogout} setView={setCurrentView} />
      <main className="flex-1 w-full mx-auto p-4 md:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderCurrentView()}
          </motion.div>
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
          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/30 uppercase tracking-widest text-xs border border-blue-500"
          >
            Ingresar Sistema
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// --- HEADER ---
function Header({ userData, handleLogout, setView }) {
  const isAdmin = (auth.currentUser?.email || userData?.email || '')?.trim().toLowerCase() === 'gpanta@verfrut.pe';

  return (
    <header className="bg-white border-b border-slate-100 px-8 py-5 flex justify-between items-center sticky top-0 z-50 shadow-sm">
      <div 
        className="flex items-center gap-5 cursor-pointer" 
        onClick={() => setView('dashboard')}
      >
        <div className="relative w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl">A</div>
        <div>
          <h2 className="font-extrabold text-slate-900 text-lg">Reporte de Control de Asistencia</h2>
          <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest leading-none mt-1">{userData?.name} / {userData?.role} • Empresa {userData?.companyId}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setView('analytics')}
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-black text-[10px] uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-xl transition-all border border-indigo-100"
        >
          <BarChart3 size={14} />
          Análisis Dashboard
        </button>

        {isAdmin && (
           <button 
             onClick={() => setView('register-user')}
             className="flex items-center gap-2 text-slate-600 hover:text-slate-700 font-black text-[10px] uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl transition-all border border-slate-100"
           >
             <User size={14} />
             Gestión Usuarios
           </button>
        )}
         <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-500 font-bold transition-colors">
           <LogOut size={18} />
           <span className="hidden sm:inline">Cerrar Sesión</span>
         </button>
      </div>
    </header>
  );
}
function RegisterUserView({ onBack }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CONTROL',
    companyId: '14'
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'));
        const snap = await getDocs(q);
        setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error("Error fetching users:", e);
      } finally {
        setFetching(false);
      }
    };
    fetchUsers();
  }, [success]);

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`¿Seguro que deseas eliminar a ${userName}?`)) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers(users.filter(u => u.id !== userId));
    } catch (e) {
      alert("Error al eliminar: " + e.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setSuccess(false);

      // Usamos una instancia secundaria para registrar sin cerrar la sesión actual
      let secondaryApp = getApps().find(a => a.name === "SecondaryApp");
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
      
      secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        formData.email.trim(), 
        formData.password
      );
      
      const uid = userCredential.user.uid;
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: formData.email.trim(),
        name: formData.name.trim(),
        role: formData.role,
        companyId: formData.companyId,
        createdAt: new Date().toISOString()
      });

      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
      
      setSuccess(true);
      setFormData({ name: '', email: '', password: '', role: 'CONTROL', companyId: '14' });
      setTimeout(() => setSuccess(false), 3000);

    } catch (error) {
      alert("Error al crear usuario: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <div className="flex justify-between items-center mb-10">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold transition-colors">
          <ChevronLeft size={20} />
          Volver al Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Registration Form */}
        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-indigo-500/5">
          <div className="flex items-center gap-6 mb-10">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl">👤</div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Registrar Usuario</h2>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Nuevo acceso administrativo</p>
            </div>
          </div>

          {success && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 bg-green-50 p-4 rounded-2xl border border-green-100 flex items-center gap-3">
              <CheckCircle className="text-green-500" size={20} />
              <p className="text-green-700 font-bold text-sm">¡Usuario registrado con éxito!</p>
            </motion.div>
          )}

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
              <input
                type="text" placeholder="Ej. Juan Pérez"
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 transition-all outline-none text-slate-800 font-medium"
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
              <input
                type="email" placeholder="email@verfrut.pe"
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 transition-all outline-none text-slate-800 font-medium"
                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
              <input
                type="password" placeholder="Mínimo 6 caracteres"
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 transition-all outline-none text-slate-800 font-medium"
                value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rol</label>
                <select 
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-slate-700 appearance-none"
                  value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                >
                  <option value="CONTROL">CONTROL</option>
                  <option value="ENCARGADO">ENCARGADO</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Empresa</label>
                <select 
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-slate-700 appearance-none"
                  value={formData.companyId} onChange={e => setFormData({...formData, companyId: e.target.value})}
                >
                  <option value="9">RAPEL (9)</option>
                  <option value="14">VERFRUT (14)</option>
                  <option value="23">AVANTI (23)</option>
                </select>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 uppercase tracking-widest text-[10px] mt-4 flex items-center justify-center gap-3 disabled:bg-slate-300"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Registrar Nuevo Acceso'}
            </button>
          </form>
        </div>

        {/* User List */}
        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-2xl shadow-indigo-500/5 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tighter">Usuarios Registrados</h3>
            <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black">{users.length} TOTAL</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {fetching ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" /></div>
            ) : users.length === 0 ? (
              <p className="text-center py-10 text-slate-400 font-medium">No hay usuarios registrados</p>
            ) : (
              users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-5 rounded-3xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs ${u.role === 'ENCARGADO' ? 'bg-indigo-500' : 'bg-slate-800'}`}>
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm leading-none mb-1">{u.name}</p>
                      <p className="text-slate-400 text-[10px]">{u.email} • <span className="text-indigo-600 font-bold">{u.role}</span></p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteUser(u.id, u.name)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
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
      const nameI = headers.findIndex(h => {
        const up = String(h).toUpperCase();
        return up.includes('NOMBRE') || up.includes('TRABAJADOR') || up.includes('PERSONAL') || up.includes('EMPLEADO');
      });
      const dniI = headers.findIndex(h => String(h).toUpperCase().includes('DNI') || String(h).toUpperCase().includes('IDENTIFICACION'));
      const codI = headers.findIndex(h => String(h).toUpperCase().includes('COD'));
      const obsI = headers.findIndex(h => String(h).toUpperCase().includes('OBSERV') || String(h).toUpperCase().includes('SITUAC'));
      const fechaI = headers.findIndex(h => String(h).toUpperCase().includes('FECHA'));

      if (nameI === -1) {
        alert("Error: No se encontró la columna de NOMBRE o TRABAJADOR en el Excel. Por favor verifica los encabezados.");
        setUploading(false);
        return;
      }

      const formatDateToES = (date) => {
        if (!(date instanceof Date) || isNaN(date)) {
          const s = String(date);
          // Si parece una fecha ISO (YYYY-MM-DD), la formateamos
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
             const parts = s.split('T')[0].split('-');
             return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
          return s;
        }
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };

      let reportDate = formatDateToES(new Date());
      if (fechaI !== -1) {
        const firstValidRow = dataRows.find(row => row[nameI] && row[fechaI]);
        if (firstValidRow) {
          const val = firstValidRow[fechaI];
          reportDate = (val instanceof Date) ? formatDateToES(val) : String(val).trim();
        }
      }

      const extraHeaders = headers.filter((h, i) => i !== nameI && i !== dniI && i !== codI);

      const reportRef = await addDoc(collection(db, 'reports'), {
        companyId: userData.companyId,
        date: reportDate,
        uploadedBy: auth.currentUser.uid,
        status: 'OPEN',
        createdAt: new Date().toISOString(),
        columnOrder: headers,
        totalWorkers: dataRows.filter(row => row[nameI]).length,
        reviewedWorkers: 0
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
                    <p className="font-bold text-slate-900 text-lg">Día {formatDisplayDate(r.date)}</p>
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
// --- ANALYTICS DASHBOARD COMPONENT ---
function AnalyticsDashboard({ userData, onBack }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWorkers: 0,
    noMarking: 0,
    payrollIssue: 0,
    attendanceRate: 0,
    zoneData: [],
    obsData: [],
    trendData: []
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        // Traer los últimos 15 reportes
        const reportsQ = query(
          collection(db, 'reports'), 
          where('companyId', '==', userData.companyId)
        );
        const reportsSnap = await getDocs(reportsQ);
        const reports = reportsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 15);

        if (reports.length === 0) {
          setLoading(false);
          return;
        }

        const allPeoplePromises = reports.map(r => getDocs(collection(db, `reports/${r.id}/people`)));
        const allPeopleSnaps = await Promise.all(allPeoplePromises);

        let totalWorkers = 0;
        let noMarking = 0;
        let payrollIssue = 0;
        const zoneMap = {};
        const obsMap = {};
        const trend = [];

        allPeopleSnaps.forEach((snap, idx) => {
          const report = reports[idx];
          const people = snap.docs.map(d => d.data());
          
          let reportPresent = 0;
          people.forEach(p => {
            totalWorkers++;
            const resp = String(p.respuestaObservacion || '').toUpperCase();
            
            // Métricas basadas en la RESPUESTA oficial del encargado
            if (resp.includes('GENERAR MARCACION') || resp.includes('OLVIDO')) noMarking++;
            if (resp.includes('PLANILLA')) payrollIssue++;
            if (p.respuestaObservacion) reportPresent++;

            // Agrupar por Fundo (Zona) - solo los últimos 5 reportes para el gráfico de barras actual
            if (idx < 5) {
              const zona = p.datosExtra?.ZONA || p.datosExtra?.FUNDO || 'SIN ZONA';
              if (!zoneMap[zona]) zoneMap[zona] = { name: zona, count: 0, marking: 0 };
              zoneMap[zona].count++;
              if (resp.includes('GENERAR MARCACION')) zoneMap[zona].marking++;
            }

            // Agrupar Respuestas para el Pie Chart
            const cleanResp = String(p.respuestaObservacion || 'Asistió').trim();
            obsMap[cleanResp] = (obsMap[cleanResp] || 0) + 1;
          });

          trend.push({
            date: formatDisplayDate(report.date),
            total: people.length,
            completed: people.filter(p => !!p.respuestaObservacion).length
          });
        });

        const zoneData = Object.values(zoneMap).slice(0, 8).sort((a, b) => b.count - a.count);
        const obsData = Object.entries(obsMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        setStats({
          totalWorkers: totalWorkers / reports.length, // Promedio por reporte
          noMarking: noMarking / reports.length,
          payrollIssue: payrollIssue / reports.length,
          attendanceRate: ((totalWorkers - noMarking) / totalWorkers * 100).toFixed(1),
          zoneData,
          obsData,
          trendData: trend.reverse()
        });

      } catch (e) {
        console.error("Analytics error:", e);
      } finally {
        setLoading(false);
      }
    };

    if (userData?.companyId) fetchAnalytics();
  }, [userData]);

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Calculando Métricas...</p>
    </div>
  );

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-black text-[10px] uppercase tracking-widest transition-all">
          <ChevronLeft size={16} /> Volver al Inicio
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Promedio Personal', val: Math.round(stats.totalWorkers), icon: <Users size={24}/>, color: 'bg-blue-500' },
          { title: 'Generar Marcación', val: Math.round(stats.noMarking), icon: <Map size={24}/>, color: 'bg-amber-500' },
          { title: 'Problemas Planilla', val: Math.round(stats.payrollIssue), icon: <AlertCircle size={24}/>, color: 'bg-red-500' },
          { title: '% Cumplimiento', val: stats.attendanceRate + '%', icon: <TrendingUp size={24}/>, color: 'bg-green-500' },
        ].map((kpi, i) => (
          <motion.div 
            key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.title}</p>
              <h4 className="text-3xl font-black text-slate-800 tracking-tighter">{kpi.val}</h4>
            </div>
            <div className={`w-12 h-12 ${kpi.color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
              {kpi.icon}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trend Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/20"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-black text-xl text-slate-900 tracking-tighter">Tendencia de Asistencia</h3>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="total" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" name="Total" />
                <Area type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={3} fillOpacity={0} name="Real" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Observation Pie */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/20"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <PieIcon size={20} />
            </div>
            <h3 className="font-black text-xl text-slate-900 tracking-tighter">Observaciones Frecuentes</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.obsData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.obsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Fundo / Zone Bar Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/20"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <Map size={20} />
          </div>
          <h3 className="font-black text-xl text-slate-900 tracking-tighter">Análisis por Fundo (Top 8)</h3>
        </div>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.zoneData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '20px', border: 'none', shadow: 'none' }} />
              <Bar dataKey="count" fill="#4F46E5" radius={[10, 10, 0, 0]} name="Total Trabajadores" />
              <Bar dataKey="marking" fill="#F59E0B" radius={[10, 10, 0, 0]} name="Generar Marcación" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
function ReportTableView({ report, onBack, userData }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterObs, setFilterObs] = useState('Todas');
  const [filterRuta, setFilterRuta] = useState('Todas');
  const [filterZona, setFilterZona] = useState('Todas');
  const [filterDigitacion, setFilterDigitacion] = useState('Todas');
  const [saving, setSaving] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());


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
      return (c === 'RUTA' || c === 'RUTAS' || c.includes('RUTA')) && !c.includes('BUS');
    });
  }, [tableColumns]);

  const zonaColumn = useMemo(() => {
    return tableColumns.find(col => {
      const c = String(col || '').toUpperCase().trim();
      return c === 'ZONA' || c === 'ZONAS' || c.includes('ZONA') || c.includes('FUNDO');
    });
  }, [tableColumns]);

  const digitacionColumn = useMemo(() => {
    return tableColumns.find(col => {
      const c = String(col || '').toUpperCase().trim();
      return c.includes('DIGITACION');
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

      const matchDigitacion = filterDigitacion === 'Todas' || (() => {
        const val = digitacionColumn
          ? String(p.datosExtra?.[digitacionColumn] || '').toUpperCase().trim()
          : String(p.observacion || '').toUpperCase();

        if (filterDigitacion === 'SI') {
          return val.startsWith('S') || val.includes('DIGITACION');
        } else {
          return val.startsWith('N') || (val === '' && !digitacionColumn) || (digitacionColumn && !val.startsWith('S'));
        }
      })();

      return matchSearch && matchObs && matchRuta && matchZona && matchDigitacion;
    });
  }, [people, search, filterObs, filterRuta, filterZona, filterDigitacion, rutaColumn, zonaColumn, digitacionColumn]);

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
    'CHECK': 34,
    '#': 38,
    'NOMBRE': 220,
    'DNI': 85,
    'CODIGO': 75,
    'NOMBRE COMPLETO': 220,
    'DEFAULT': 110
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
    let offset = COL_WIDTHS['CHECK'] + COL_WIDTHS['#'];
    const stickySet = new Set(['CHECK', '#']);
    const offsets = { 'CHECK': 0, '#': COL_WIDTHS['CHECK'] };
    const widths = { 'CHECK': COL_WIDTHS['CHECK'], '#': COL_WIDTHS['#'] };

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


  const [activeDropdown, setActiveDropdown] = useState(null);

  const updateRespuesta = async (pId, val) => {
    if (['CLOSED', 'CERRADO'].includes(report.status)) return;
    try {
      await updateDoc(doc(db, `reports/${report.id}/people`, pId), { respuestaObservacion: val });
    } catch (e) {
      console.error("Error updating response:", e);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
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

  const handleDownloadExcel = async () => {
    try {
      // 1. Definir columnas base (usando el orden original si existe)
      const baseColumns = (report.columnOrder && report.columnOrder.length > 0) 
        ? report.columnOrder 
        : tableColumns;
      
      const exportHeaders = [...baseColumns, 'RESPUESTA OBSERVACIÓN'];

      // 2. Crear Libro y Hoja con ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Asistencia');

      // 3. Estilizar Cabecera
      const headerRow = worksheet.addRow(exportHeaders);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4F46E5' } // Indigo 600
        };
        cell.font = {
          name: 'Arial',
          family: 2,
          size: 10,
          bold: true,
          color: { argb: 'FFFFFFFF' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFC7D2FE' } }
        };
      });

      // 4. Agregar Datos
      filtered.forEach(p => {
        const rowValues = baseColumns.map(col => {
          let val = p.datosExtra?.[col] !== undefined ? p.datosExtra[col] : (col === 'OBSERVACION' ? p.observacion : '');
          return formatHora(col, val);
        });
        rowValues.push(p.respuestaObservacion || 'PENDIENTE');
        
        const row = worksheet.addRow(rowValues);
        row.height = 20;
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle' };
          cell.font = { size: 9 };
        });
      });

      // 5. Ajustar anchos automáticos
      worksheet.columns = exportHeaders.map(colName => {
        let maxLen = colName.length;
        filtered.forEach(p => {
          const val = p.datosExtra?.[colName] || (colName === 'OBSERVACION' ? p.observacion : '');
          const str = String(formatHora(colName, val));
          if (str.length > maxLen) maxLen = str.length;
        });
        return { width: Math.min(maxLen + 5, 50) }; // Cap a 50 de ancho
      });

      // 6. Generar y Descargar
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const safeDate = String(report.date || 'Reporte').replace(/\//g, '-');
      anchor.download = `Reporte_Final_${safeDate}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);

    } catch (e) {
      alert("Error al generar Excel: " + e.message);
    }
  };

  const handleBulkUpdateWeb = async (val) => {
    const idsToUpdate = selectedIds.size > 0 ? Array.from(selectedIds) : filtered.map(p => p.id);
    if (idsToUpdate.length === 0 || !val) return;
    
    if (!confirm(`¿Estás seguro de asignar "${val}" a los ${idsToUpdate.length} trabajadores seleccionados?`)) return;

    try {
      setSaving(true);
      const batch = writeBatch(db);
      idsToUpdate.forEach(id => {
        batch.update(doc(db, `reports/${report.id}/people`, id), { respuestaObservacion: val });
      });
      await batch.commit();
      setIsBulkModalOpen(false);
      setSelectedIds(new Set());
      alert("Se actualizaron " + idsToUpdate.length + " trabajadores.");
    } catch (e) {
      alert("Error: " + e.message);
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
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Reporte del {formatDisplayDate(report?.date)}</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-[9px] font-semibold uppercase tracking-widest">EMPRESA: {getCompanyName(report?.companyId)} • ESTADO: {report?.status === 'OPEN' ? 'ABIERTO' : report?.status === 'CLOSED' ? 'CERRADO' : report?.status || '---'}</p>
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

            {zonaColumn && (
              <CustomDropdown
                value={filterZona}
                options={['Todas', ...uniqueZonas]}
                onChange={setFilterZona}
                placeholder="Zona"
                className="w-40"
              />
            )}

            {rutaColumn && (
              <CustomDropdown
                value={filterRuta}
                options={['Todas', ...uniqueRutas]}
                onChange={setFilterRuta}
                placeholder="Ruta"
                className="w-40"
              />
            )}

            <CustomDropdown
              value={filterDigitacion}
              options={[
                { label: 'Digitación: Todas', value: 'Todas' },
                { label: 'Digitación: SI', value: 'SI' },
                { label: 'Digitación: NO', value: 'NO' }
              ]}
              onChange={setFilterDigitacion}
              placeholder="Digitación"
              className="w-40"
            />

            <CustomDropdown
              value={filterObs}
              options={['Todas', ...uniqueObservations]}
              onChange={setFilterObs}
              placeholder="Todas Obs."
              className="w-40"
            />
          </div>

          {/* Grupo de Acciones */}
          <div className="flex items-center gap-3">
            {['OPEN', 'ABIERTO'].includes(report.status) && (['CONTROL', 'ENCARGADO'].includes(String(userData?.role || '').toUpperCase())) && (
              <button
                onClick={handleClose}
                disabled={saving || !progress.isAllDone}
                className={`px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border shadow-sm flex-1 sm:flex-none ${progress.isAllDone ? 'bg-slate-900 text-white border-slate-900 hover:bg-blue-600 hover:border-blue-600 hover:shadow-blue-200' : 'bg-white text-slate-300 border-slate-100 cursor-not-allowed'}`}
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : (progress.isAllDone ? <Lock size={16} /> : <Clock size={16} />)}
                {progress.isAllDone ? 'Finalizar Reporte' : `Pendientes: ${progress.total - progress.completed}`}
              </button>
            )}

            {(filtered.length > 0) && (
              <button
                onClick={() => setIsBulkModalOpen(true)}
                disabled={saving}
                className={`px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border shadow-sm flex-1 sm:flex-none ${selectedIds.size > 0 ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-200' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-slate-100'}`}
              >
                <MousePointerClick size={16} />
                {selectedIds.size > 0 ? `Asignar a ${selectedIds.size} seleccionados` : `Asignar a ${filtered.length} filtrados`}
              </button>
            )}

            <button
              onClick={handleDownloadExcel}
              className="bg-white text-slate-700 px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 hover:text-blue-600 hover:border-blue-100 transition-all flex items-center justify-center gap-2 border border-slate-200 shadow-sm flex-1 sm:flex-none"
            >
              <FileSpreadsheet size={16} className="text-blue-600" />
              Exportar a Excel
            </button>

            {String(userData?.role || '').toUpperCase() === 'ENCARGADO' && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="bg-white text-red-500 px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center justify-center gap-2 border border-red-100 shadow-sm flex-1 sm:flex-none"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
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
                <th className="px-2 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-[#f8fafc] z-50 border-b border-r border-slate-100 flex items-center justify-center" style={{ width: `${COL_WIDTHS['CHECK']}px`, left: 0 }}>
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={filtered.length > 0 && selectedIds.size >= filtered.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-2 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest sticky bg-[#f8fafc] z-50 border-b border-r border-slate-100 text-center" style={{ width: `${COL_WIDTHS['#']}px`, left: `${COL_WIDTHS['CHECK']}px` }}>#</th>
                {tableColumns.map(col => {
                  const isSticky = stickyConfig.stickySet.has(col);
                  const isLast = col === stickyConfig.lastCol;
                  const w = getColWidth(col);
                  return (
                    <th
                      key={col}
                      className={`px-2 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest ${isSticky ? 'sticky bg-[#f8fafc] z-50 border-b border-slate-100' : ''} ${isLast ? 'border-r-2 border-slate-200' : 'border-r border-slate-100'}`}
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
                <th className="px-2 py-1.5 text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 sticky right-0 z-40 border-l border-blue-100" style={{ width: '180px' }}>Respuesta Observación</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filtered.map((p, idx) => {
                const isEdited = !!p.edited;
                return (
                  <tr key={p.id} className={`hover:bg-blue-50 transition-colors group ${selectedIds.has(p.id) ? 'bg-indigo-50/50' : (isEdited ? 'bg-amber-50/40' : '')}`}>
                    <td className={`px-2 py-1 sticky left-0 z-20 border-b border-r border-slate-100 text-center transition-colors ${selectedIds.has(p.id) ? 'bg-indigo-50 group-hover:bg-blue-50' : (isEdited ? 'bg-amber-50 group-hover:bg-blue-50' : 'bg-slate-50 group-hover:bg-blue-50')}`} style={{ width: `${COL_WIDTHS['CHECK']}px`, left: 0 }}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelectOne(p.id)}
                      />
                    </td>
                    <td className={`px-2 py-1 text-[10px] font-bold text-slate-400 sticky z-20 border-b border-r border-slate-100 text-center transition-colors ${selectedIds.has(p.id) ? 'bg-indigo-50 group-hover:bg-blue-50' : (isEdited ? 'bg-amber-50 group-hover:bg-blue-50' : 'bg-slate-50 group-hover:bg-blue-50')}`} style={{ width: `${COL_WIDTHS['#']}px`, left: `${COL_WIDTHS['CHECK']}px` }}>{idx + 1}</td>
                    {tableColumns.map(col => {
                      const isSticky = stickyConfig.stickySet.has(col);
                      const isLast = col === stickyConfig.lastCol;
                      const w = getColWidth(col);
                      const val = p.datosExtra?.[col] !== undefined ? p.datosExtra[col] : (col === 'OBSERVACION' ? p.observacion : '');

                      return (
                          <td
                            key={col}
                            onDoubleClick={() => { setEditingPerson(p); setIsEditModalOpen(true); }}
                            className={`px-2 py-1 text-[10px] font-medium text-slate-700 border-b cursor-pointer ${isSticky ? 'sticky group-hover:bg-blue-50 z-20 ' + (isEdited ? 'bg-amber-50/10' : 'bg-white') : ''} ${isLast ? 'border-r-2 border-slate-200' : 'border-r border-slate-100'}`}
                          style={{
                            left: isSticky ? `${stickyConfig.offsets[col]}px` : 'auto',
                            width: `${w}px`,
                            minWidth: `${w}px`
                          }}
                        >
                          <div className="flex items-center justify-between group/cell">
                            <span className="truncate block flex-1">{formatHora(col, val)}</span>
                            {col === 'TRABAJADOR' && isEdited && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 ml-2 shadow-sm" title="Editado"></div>}
                          </div>
                        </td>
                      );
                    })}
                    <td 
                      className={`px-2 py-1 bg-white group-hover:bg-blue-50 sticky right-0 border-b border-l border-blue-100 transition-all ${activeDropdown === p.id ? 'z-[100]' : 'z-30'}`} 
                      style={{ width: '180px' }}
                    >
                      <div className="flex items-center gap-2">
                        <CustomDropdown
                          value={p.respuestaObservacion || ''}
                          options={['', ...OBSERVACIONES]}
                          onChange={(val) => updateRespuesta(p.id, val)}
                          onOpenChange={(open) => setActiveDropdown(open ? p.id : null)}
                          placeholder="--- Seleccione ---"
                          className="flex-1"
                          isCompact={true}
                          disabled={['CLOSED', 'CERRADO'].includes(report.status)}
                        />
                        <button 
                          onClick={() => { setEditingPerson(p); setIsEditModalOpen(true); }}
                          className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          title="Editar todos los datos"
                        >
                          <User size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
      {/* Modal de Acción Masiva */}
      <AnimatePresence>
        {isEditModalOpen && editingPerson && (
          <WorkerEditModal
            person={editingPerson}
            reportId={report.id}
            tableColumns={tableColumns}
            onClose={() => { setIsEditModalOpen(false); setEditingPerson(null); }}
            onSave={(updatedPerson) => {
              setPeople(prev => prev.map(p => p.id === updatedPerson.id ? updatedPerson : p));
              setFiltered(prev => prev.map(p => p.id === updatedPerson.id ? updatedPerson : p));
            }}
          />
        )}

        {isBulkModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsBulkModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-10">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Acción Masiva</h3>
                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mt-2">Aplicar a {selectedIds.size > 0 ? selectedIds.size : filtered.length} trabajadores</p>
                  </div>
                  <button onClick={() => setIsBulkModalOpen(false)} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-slate-100 hover:text-slate-600 transition-all">
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {OBSERVACIONES.map((obs) => (
                    <button
                      key={obs}
                      onClick={() => handleBulkUpdateWeb(obs)}
                      disabled={saving}
                      className="group flex items-center justify-between p-5 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-indigo-600 hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/20 transition-all text-left"
                    >
                      <span className="font-bold text-slate-700 group-hover:text-white text-sm tracking-tight">{obs}</span>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-white/50 transition-colors" />
                    </button>
                  ))}
                </div>

                <div className="mt-10 pt-8 border-t border-slate-50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                    <AlertCircle size={20} />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                    Esta acción actualizará de forma permanente la observación de todos los trabajadores actualmente visibles por los filtros aplicados.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default App;
