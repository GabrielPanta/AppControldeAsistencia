import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { auth, db, firebaseConfig } from './firebase';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, setDoc, query, where, getDocs, updateDoc, onSnapshot, deleteDoc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, LogOut, FileSpreadsheet, CheckCircle, AlertCircle, Shield,
  Loader2, Search, ChevronRight, User, Hash, Clock, X, Save, Lock, Info, ChevronLeft, Trash2, MousePointerClick, BarChart3, PieChart as PieIcon, LineChart as LineIcon, TrendingUp, Users, Map, UploadCloud, Bus, RotateCcw, Fingerprint, MapPin,
  Timer, FileText, AlertTriangle, RefreshCw, MoreHorizontal, UserX
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
export const OBSERVACIONES_CONFIG = {
  "Indicó Generar Marcación": { icon: Fingerprint, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100", hover: "hover:bg-indigo-600" },
  "Olvidó marcar": { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", hover: "hover:bg-amber-600" },
  "Ausente": { icon: UserX, color: "text-red-600", bg: "bg-red-50", border: "border-red-100", hover: "hover:bg-red-600" },
  "Tardanza": { icon: Timer, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100", hover: "hover:bg-orange-600" },
  "Permiso": { icon: FileText, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", hover: "hover:bg-blue-600" },
  "Trabajador no reportado en Planilla": { icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100", hover: "hover:bg-rose-600" },
  "Canje": { icon: RefreshCw, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", hover: "hover:bg-emerald-600" },
  "Otro": { icon: MoreHorizontal, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-100", hover: "hover:bg-slate-600" },
  "default": { icon: Info, color: "text-slate-400", bg: "bg-slate-50", border: "border-slate-100", hover: "hover:bg-slate-600" }
};

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

  const selectedLabel = selectedOption
    ? (typeof selectedOption === 'string' ? selectedOption : selectedOption.label)
    : placeholder;

  const shouldAddPrefix = placeholder &&
    !selectedLabel.includes(placeholder) &&
    !placeholder.includes('---') &&
    !placeholder.toLowerCase().includes('seleccionar');

  const displayValue = shouldAddPrefix
    ? `${placeholder}: ${selectedLabel}`
    : selectedLabel;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between transition-all outline-none ${isCompact ? 'px-3 py-0.5 rounded-lg text-[9px]' : 'px-5 py-2.5 rounded-xl text-[10px]'} font-bold uppercase tracking-widest ${isOpen ? 'ring-2 ring-blue-100 bg-white border-blue-200' : 'bg-slate-50 border-transparent'} border text-slate-700 ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 text-slate-400' : 'hover:bg-white hover:border-slate-200'}`}
      >
        <span className="whitespace-normal leading-tight text-left flex-1 pr-2">{displayValue}</span>
        <ChevronRight className={`transition-transform duration-300 ${isOpen ? '-rotate-90' : 'rotate-90 text-slate-300'}`} size={12} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.98 }}
            className={`absolute z-[110] mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden py-2 ${isCompact
              ? 'right-0 min-w-[220px] w-max max-w-[320px]'
              : 'left-0 min-w-full w-max max-w-[400px]'
              } shadow-indigo-500/10`}
            style={{ top: '100%' }}
          >
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar px-1.5">
              {options.map((opt, i) => {
                const optVal = typeof opt === 'string' ? opt : opt.value;
                const optLabel = typeof opt === 'string' ? opt : opt.label;
                const isActive = optVal === value;

                return (
                  <button
                    key={i}
                    type="button"
                    title={optLabel}
                    onClick={() => {
                      onChange(optVal);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all rounded-xl mb-1 last:mb-0 ${isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex-1 leading-relaxed whitespace-normal break-words">{optLabel}</span>
                      {isActive && <CheckCircle className="mt-0.5 flex-shrink-0" size={10} />}
                    </div>
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

const QuickObservationPicker = ({ value, onChange, disabled = false, onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, isUp: true });
  const dropdownRef = useRef(null);

  const updatePosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Un menú de 8 items en 2 columnas mide aprox 250-300px
      const isUp = spaceBelow < 320 && spaceAbove > 320;

      setCoords({
        top: isUp ? rect.top : rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        isUp
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', () => setIsOpen(false), true);
      window.addEventListener('resize', () => setIsOpen(false));
    }
    return () => {
      window.removeEventListener('scroll', () => setIsOpen(false), true);
      window.removeEventListener('resize', () => setIsOpen(false));
    };
  }, [isOpen]);

  useEffect(() => {
    if (onOpenChange) onOpenChange(isOpen);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        // También ignorar si el clic es dentro del portal (usando un id o clase especial)
        if (!event.target.closest('.observation-picker-portal')) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const config = OBSERVACIONES_CONFIG[value] || OBSERVACIONES_CONFIG["default"];
  const Icon = config.icon;

  return (
    <div className="relative inline-block w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center gap-1.5 transition-all outline-none px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${isOpen ? 'ring-2 ring-blue-100 bg-white border-blue-200' : `${config.bg} ${config.border} ${config.color}`} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-md hover:scale-[1.02] active:scale-95'}`}
      >
        <Icon size={10} className="flex-shrink-0" />
        <span className="truncate flex-1 text-left">{value || '---'}</span>
        <ChevronRight className={`flex-shrink-0 transition-transform duration-300 ${isOpen ? '-rotate-90' : 'rotate-90 opacity-40'}`} size={10} />
      </button>

      {isOpen && createPortal(
        <div className="observation-picker-portal fixed inset-0 z-[9999] pointer-events-none">
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: coords.isUp ? 10 : -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: coords.isUp ? 10 : -10 }}
              className={`absolute pointer-events-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-3 min-w-[280px] shadow-indigo-500/10 ${coords.isUp ? 'origin-bottom-right' : 'origin-top-right'
                }`}
              style={{
                top: coords.isUp ? 'auto' : `${coords.top + 8}px`,
                bottom: coords.isUp ? `${window.innerHeight - coords.top + 8}px` : 'auto',
                left: `${coords.right - 280}px`
              }}
            >
              <div className="grid grid-cols-2 gap-2">
                {OBSERVACIONES.map((obs, i) => {
                  const obsCfg = OBSERVACIONES_CONFIG[obs] || OBSERVACIONES_CONFIG["default"];
                  const ObsIcon = obsCfg.icon;
                  const isActive = value === obs;

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onChange(obs === value ? "" : obs);
                        setIsOpen(false);
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl text-[9px] font-bold text-left transition-all border ${isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100'
                        : 'bg-slate-50 text-slate-600 border-transparent hover:bg-white hover:border-slate-200 hover:text-indigo-600'
                        }`}
                    >
                      <div className={`p-1 rounded-lg ${isActive ? 'bg-white/20' : obsCfg.bg}`}>
                        <ObsIcon size={12} className={isActive ? 'text-white' : obsCfg.color} />
                      </div>
                      <span className="leading-none">{obs}</span>
                    </button>
                  );
                })}
              </div>

              {value && (
                <button
                  onClick={() => { onChange(""); setIsOpen(false); }}
                  className="w-full mt-3 p-2 bg-slate-50 rounded-xl text-[8px] font-bold text-slate-400 uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all border border-dashed border-slate-200"
                >
                  Limpiar Selección
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>,
        document.body
      )}
    </div>
  );
};

const WorkerEditModal = ({ person, reportId, reportStatus, tableColumns, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    nombreCompleto: person.nombreCompleto || '',
    dni: person.dni || '',
    datosExtra: { ...(person.datosExtra || {}) }
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      if (['CLOSED', 'CERRADO'].includes(reportStatus)) {
        alert("No se puede editar un trabajador en un reporte cerrado.");
        return;
      }
      setSaving(true);

      // Calcular qué campos fueron modificados realmente
      const modifiedFields = { ...(person.modifiedFields || {}) };

      // Comparar datos principales
      if (formData.nombreCompleto !== person.nombreCompleto) modifiedFields['NOMBRE'] = true;
      if (formData.dni !== person.dni) modifiedFields['DNI'] = true;

      // Comparar datos extra
      Object.keys(formData.datosExtra).forEach(key => {
        const newVal = String(formData.datosExtra[key] || '').trim();
        const oldVal = String(person.datosExtra?.[key] || '').trim();
        if (newVal !== oldVal) {
          modifiedFields[key] = true;
        }
      });

      const pRef = doc(db, `reports/${reportId}/people`, person.id);
      const updatedData = {
        ...formData,
        modifiedFields,
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
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
      >
        <div className="p-8 pb-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              <p className="text-blue-600 text-[10px] font-bold uppercase tracking-widest">Edición Profesional</p>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 tracking-tighter">Ficha del Trabajador</h3>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white text-slate-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all border border-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
          {/* DATOS PRINCIPALES: 2 COLUMNAS */}
          <div className="space-y-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <User size={14} /> Información Personal
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                <div className={`w-full border rounded-xl px-4 py-2.5 font-bold text-[11px] cursor-not-allowed ${person.modifiedFields?.['NOMBRE'] ? 'bg-amber-100/30 text-amber-900 border-amber-200' : 'bg-slate-50 text-slate-400 border-transparent'}`}>
                  {formData.nombreCompleto}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Documento DNI</label>
                <div className={`w-full border rounded-xl px-4 py-2.5 font-bold text-[11px] cursor-not-allowed ${person.modifiedFields?.['DNI'] ? 'bg-amber-100/30 text-amber-900 border-amber-200' : 'bg-slate-50 text-slate-400'}`}>
                  {formData.dni || '---'}
                </div>
              </div>
            </div>
          </div>

          {/* DATOS EXTRA: 3 COLUMNAS */}
          <div className="space-y-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Map size={14} /> Datos de Gestión e Identificación
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-5">
              {tableColumns.filter(key => {
                const k = key.toUpperCase().trim();
                return !k.includes('NOMBRE') && !k.includes('TRABAJADOR') && !k.includes('PERSONAL') && !k.includes('DNI') && !k.includes('IDENTIFICACION');
              }).map((key, idx) => {
                const isEditable = ["ZONA", "CUARTEL", "PLACA", "RUTA", "C-BUS", "CUADRILLA"].includes(key.toUpperCase().trim());
                const originalValue = person.datosExtra?.[key];
                const value = formData.datosExtra?.[key];
                const isModifiedInCurrentSession = String(value || '').trim() !== String(originalValue || '').trim();
                const isPersistedAsModified = !!person.modifiedFields?.[key];
                const isHighlighted = isModifiedInCurrentSession || isPersistedAsModified;

                return (
                  <div key={`${key}-${idx}`} className="space-y-1.5">
                    <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest ml-1 truncate block">
                      {key} {isHighlighted && <span className="text-amber-500 ml-1">★</span>}
                    </label>
                    {isEditable ? (
                      <input
                        type="text"
                        className={`w-full border rounded-xl px-4 py-2.5 font-semibold text-[11px] transition-all outline-none 
                          ${isHighlighted
                            ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-100 text-amber-900'
                            : 'bg-white border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-slate-800'
                          }`}
                        value={value || ''}
                        onChange={e => setFormData({
                          ...formData,
                          datosExtra: { ...formData.datosExtra, [key]: e.target.value }
                        })}
                      />
                    ) : (
                      <div className="w-full bg-slate-50 border border-transparent rounded-xl px-4 py-2.5 font-bold text-[11px] text-slate-400 cursor-not-allowed truncate">
                        {value || '---'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            className="px-8 bg-white text-slate-400 py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all border border-slate-200"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-10 bg-indigo-600 hover:bg-blue-600 text-white py-3.5 rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Guardar Cambios
          </button>
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
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7ff] flex-col">
      <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      <p className="mt-4 text-gray-500 font-medium">Cargando sistema...</p>
    </div>
  );

  if (!user) return <LoginView {...{ handleLogin, authEmail, setAuthEmail, authPass, setAuthPass }} />;

  return (
    <div className="min-h-screen mesh-bg flex flex-col font-sans">
      <Header
        userData={userData}
        handleLogout={handleLogout}
        setView={setCurrentView}
        currentView={currentView}
      />
      <main className="flex-1 w-full mx-auto p-4 md:px-10 pt-20 pb-8 transition-all duration-500">
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
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Asistencia <span className="text-blue-600">Web</span></h1>
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
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/30 uppercase tracking-widest text-xs border border-blue-500"
          >
            Ingresar Sistema
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// --- COMPONENTS ---
const NavButton = ({ active, onClick, icon: Icon, label, activeColor = 'indigo' }) => {
  const colors = {
    indigo: { icon: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100/50' },
    emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100/50' },
    orange: { icon: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100/50' },
    slate: { icon: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200/50' }
  };
  
  const currentColor = colors[activeColor] || colors.indigo;

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-6 py-2 transition-all duration-300 rounded-xl group overflow-hidden`}
    >
      <Icon
        size={16}
        className={`relative z-10 transition-colors duration-300 ${active ? currentColor.icon : 'text-slate-400 group-hover:text-slate-600'}`}
      />
      <span className={`relative z-10 font-bold text-[10px] uppercase tracking-wider transition-colors duration-300 ${active ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
        {label}
      </span>
      {active && (
        <motion.div
          layoutId="navCapsule"
          className={`absolute inset-0 ${currentColor.bg} border ${currentColor.border} rounded-xl`}
          initial={false}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </button>
  );
};

// --- HEADER ---
function Header({ userData, handleLogout, setView, currentView }) {
  const isAdmin = (auth.currentUser?.email || userData?.email || '')?.trim().toLowerCase() === 'gpanta@verfrut.pe';

  return (
    <header className="fixed top-0 left-0 right-0 z-[100]">
      <div className="bg-white/80 backdrop-blur-3xl border-b border-slate-100 shadow-sm">
        <div className="max-w-[1600px] mx-auto h-16 flex justify-between items-center px-6">
          <div className="flex items-center gap-6">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setView('dashboard')}
            >
              <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-100 group-hover:scale-105 transition-transform">
                <BarChart3 size={20} />
              </div>
              <div className="hidden lg:block">
                <h2 className="font-bold text-slate-800 text-[15px] leading-none tracking-tight text-slate-900">Sistema de <span className="text-slate-500">Gestión Asistencia</span></h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-slate-400 text-[8px] font-bold uppercase tracking-widest">{userData?.name || 'Usuario'}</p>
                </div>
              </div>
            </div>
            
            <div className="hidden xl:flex items-center gap-2 border-l border-slate-100 pl-6 text-[9px] uppercase tracking-widest font-bold text-slate-300">
              <span className="hover:text-slate-600 transition-colors cursor-pointer" onClick={() => setView('dashboard')}>DASHBOARD</span>
              <ChevronRight size={10} className="text-slate-200" />
              <span className="text-slate-500">
                {currentView === 'dashboard' ? 'Reportes' : 
                 currentView === 'analytics' ? 'Analytics' : 
                 currentView === 'register-user' ? 'Administración' : 
                 'Detalle'}
              </span>
            </div>
          </div>

          <div className="flex-1"></div>

          <nav className="hidden md:flex items-center gap-1 bg-white/40 p-1 rounded-xl border border-white/60 mr-4">
            <NavButton
              active={currentView === 'dashboard' || currentView === 'report-detail'}
              onClick={() => setView('dashboard')}
              icon={FileSpreadsheet}
              label="Reportes"
              activeColor="indigo"
            />
            <NavButton
              active={currentView === 'analytics'}
              onClick={() => setView('analytics')}
              icon={BarChart3}
              label="Analytics"
              activeColor="emerald"
            />
            {isAdmin && (
              <NavButton
                active={currentView === 'register-user'}
                onClick={() => setView('register-user')}
                icon={User}
                label="Usuarios"
                activeColor="orange"
              />
            )}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden lg:block text-right pr-4 border-r border-slate-100">
              <p className="text-[9px] font-bold text-slate-900 uppercase tracking-widest leading-none mb-1">Empresa {userData?.companyId}</p>
              <div className="flex items-center justify-end gap-1.5 text-[8px] font-semibold text-slate-500 tracking-wide uppercase">
                <Shield size={10} />
                <span>{userData?.role}</span>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-10 h-10 bg-white/40 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl border border-white/60 transition-all group flex items-center justify-center relative overflow-hidden active:scale-95"
              title="Cerrar Sesión"
            >
              <LogOut size={18} className="relative z-10 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
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
    <div className="max-w-5xl mx-auto pt-2 pb-6 px-6">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold transition-colors">
          <ChevronLeft size={20} />
          Volver al Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Registration Form */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-indigo-500/5">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl">👤</div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tighter">Registrar Usuario</h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Nuevo acceso administrativo</p>
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
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
              <input
                type="text" placeholder="Ej. Juan Pérez"
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 transition-all outline-none text-slate-800 font-medium"
                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
              <input
                type="email" placeholder="email@verfrut.pe"
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 transition-all outline-none text-slate-800 font-medium"
                value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
              <input
                type="password" placeholder="Mínimo 6 caracteres"
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none focus:ring-4 focus:ring-indigo-100 transition-all outline-none text-slate-800 font-medium"
                value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Rol</label>
                <select
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-slate-700 appearance-none"
                  value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="CONTROL">CONTROL</option>
                  <option value="ENCARGADO">ENCARGADO</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest ml-1">Empresa</label>
                <select
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none font-bold text-slate-700 appearance-none"
                  value={formData.companyId} onChange={e => setFormData({ ...formData, companyId: e.target.value })}
                >
                  <option value="9">RAPEL (9)</option>
                  <option value="14">VERFRUT (14)</option>
                  <option value="23">AVANTI (23)</option>
                </select>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-slate-900 text-white font-bold py-5 rounded-[2rem] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 uppercase tracking-widest text-[10px] mt-4 flex items-center justify-center gap-3 disabled:bg-slate-300"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Registrar Nuevo Acceso'}
            </button>
          </form>
        </div>

        {/* User List */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-indigo-500/5 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-slate-900 tracking-tighter">Usuarios Registrados</h3>
            <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-bold">{users.length} TOTAL</span>
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

  // Filtros
  const [dashSearch, setDashSearch] = useState('');
  const [dashMonth, setDashMonth] = useState('Todos');
  const [dashYear, setDashYear] = useState('Todos');

  const MONTHS = [
    'Todos', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

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

  const availableYears = useMemo(() => {
    const years = new Set(['Todos']);
    reports.forEach(r => {
      if (r.date) {
        const parts = String(r.date).split('/');
        if (parts.length === 3) years.add(parts[2]);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const dateStr = String(r.date || '');
      const parts = dateStr.split('/');

      const matchSearch = dateStr.toLowerCase().includes(dashSearch.toLowerCase());

      let matchMonth = true;
      if (dashMonth !== 'Todos' && parts.length === 3) {
        const mIdx = parseInt(parts[1], 10);
        matchMonth = MONTHS[mIdx] === dashMonth;
      }

      let matchYear = true;
      if (dashYear !== 'Todos' && parts.length === 3) {
        matchYear = parts[2] === dashYear;
      }

      return matchSearch && matchMonth && matchYear;
    });
  }, [reports, dashSearch, dashMonth, dashYear]);

  const globalStats = useMemo(() => {
    let totalW = 0;
    let reviewedW = 0;
    const obsMap = {};

    filteredReports.forEach(r => {
      totalW += (r.totalWorkers || 0);
      reviewedW += (r.reviewedWorkers || 0);
      if (r.responseBreakdown) {
        Object.entries(r.responseBreakdown).forEach(([key, val]) => {
          obsMap[key] = (obsMap[key] || 0) + val;
        });
      }
    });

    const topObs = Object.entries(obsMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      totalWorkers: totalW,
      reviewedWorkers: reviewedW,
      topObs,
      percent: totalW > 0 ? Math.round((reviewedW / totalW) * 100) : 0
    };
  }, [filteredReports]);


  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 lg:grid-cols-4 gap-8"
    >
      <div className={String(userData?.role || '').toUpperCase() === 'ENCARGADO' ? 'lg:col-span-1' : 'hidden'}>
        <div className="space-y-6 lg:sticky lg:top-8">
          {/* Dashboard Summary Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white shadow-2xl shadow-slate-200/20"
          >
            <div className="flex items-center gap-3 mb-8">
               <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <BarChart3 size={20} />
               </div>
               <div>
                  <h3 className="font-bold text-slate-900 text-lg tracking-tighter leading-none">Resumen Global</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Empresa {userData?.companyId}</p>
               </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">{globalStats.percent}%</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Progreso Total</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                  <p className="text-lg font-bold text-slate-900">{globalStats.reviewedWorkers}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Revisados</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                   <p className="text-lg font-bold text-slate-900">{globalStats.totalWorkers}</p>
                   <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Personal</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Clean Upload Button Section */}
          <div className="bg-slate-950 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-950/20 relative overflow-hidden group">
             <div className="relative z-10">
                <h4 className="font-bold text-lg tracking-tighter mb-2">Nuevo Reporte</h4>
                <p className="text-xs text-indigo-200 mb-6 opacity-80">Sube el Excel diario para actualizar el control de asistencia.</p>
                
                <label className="block w-full">
                  <input type="file" className="hidden" accept=".xlsx" onChange={e => processFile(e.target.files[0])} disabled={uploading} />
                  <div className={`
                    w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all cursor-pointer font-bold text-xs uppercase tracking-widest
                    ${uploading ? 'bg-indigo-600/50 text-indigo-300' : 'bg-indigo-600 hover:bg-white hover:text-indigo-600 hover:scale-[1.02] shadow-lg shadow-indigo-500/30'}
                  `}>
                    {uploading ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <>
                        <Upload size={16} />
                        Importar Excel
                      </>
                    )}
                  </div>
                </label>
             </div>
             {/* Decorative Background Element */}
             <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/40 transition-colors"></div>
          </div>
        </div>
      </div>

      {/* PANEL DERECHO: HISTORIAL */}
      <div className={String(userData?.role || '').toUpperCase() === 'ENCARGADO' ? 'lg:col-span-3' : 'lg:col-span-4'}>
        <div className="bg-white p-6 sm:p-10 rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/10 overflow-hidden">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 mb-8 pb-8 border-b border-slate-50">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-3xl text-slate-900 tracking-tighter">Reportes</h3>
                <div className="px-2.5 py-1 bg-indigo-50 rounded-lg border border-indigo-100/50 flex items-center gap-2">
                  <FileSpreadsheet size={12} className="text-indigo-600" />
                  <span className="text-[10px] font-black text-indigo-700 tracking-widest">{filteredReports.length}</span>
                </div>
              </div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                 Empresa {userData?.companyId || '---'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              {/* Unified Action Bar Container */}
              <div className="flex items-center gap-2 bg-slate-50/50 p-1 rounded-2xl border border-slate-100 overflow-hidden">
                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="text"
                    placeholder="BUSCAR..."
                    value={dashSearch}
                    onChange={e => setDashSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-transparent border-none rounded-xl text-[9px] font-black uppercase tracking-[0.15em] outline-none transition-all placeholder:text-slate-300 w-full sm:w-48"
                  />
                </div>

                <div className="w-px h-6 bg-slate-200/50 mx-1"></div>

                {/* Filtro Mes */}
                <CustomDropdown
                  value={dashMonth}
                  options={MONTHS}
                  onChange={setDashMonth}
                  placeholder="MES"
                  isCompact={true}
                  className="!bg-transparent !border-none !shadow-none min-w-[110px]"
                />

                <div className="w-px h-4 bg-slate-200/50 mx-1"></div>

                {/* Filtro Año */}
                <CustomDropdown
                  value={dashYear}
                  options={availableYears}
                  onChange={setDashYear}
                  placeholder="AÑO"
                  isCompact={true}
                  className="!bg-transparent !border-none !shadow-none min-w-[90px]"
                />
              </div>
            </div>
          </div>
                onChange={setDashYear}
                placeholder="Año"
                isCompact={true}
                className="min-w-[100px]"
              />
            </div>

            <div className="hidden xl:flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
              <FileSpreadsheet size={16} className="text-blue-500" />
              <span className="text-[11px] font-bold text-slate-600">{filteredReports.length}</span>
            </div>
          </div>

          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.05 } }
            }}
            className="flex flex-col gap-3"
          >
            {/* Logic for Month Grouping Rendering */}
            {(() => {
              let lastMonth = '';
              return filteredReports.map((r, i) => {
                const total = r.totalWorkers || 0;
                const reviewed = r.reviewedWorkers || 0;
                const percent = total > 0 ? Math.round((reviewed / total) * 100) : 0;
                const isClosed = ['CLOSED', 'CERRADO'].includes(r.status);
                
                const dateParts = String(r.date || '').split('/');
                const currentMonth = dateParts.length === 3 ? `${MONTHS[parseInt(dateParts[1],10)]} ${dateParts[2]}` : '';
                const showHeader = currentMonth !== lastMonth;
                lastMonth = currentMonth;

                return (
                  <React.Fragment key={r.id}>
                    {showHeader && (
                      <div className="mt-8 mb-4 flex items-center gap-4">
                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] bg-slate-100 px-3 py-1 rounded-lg">
                          {currentMonth}
                        </span>
                        <div className="h-px bg-slate-100 flex-1"></div>
                      </div>
                    )}
                    
                    <motion.div
                      variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                      whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.7)' }}
                      onClick={() => onSelectReport(r)}
                      className={`
                        group relative flex items-center justify-between p-4 px-6 rounded-2xl transition-all cursor-pointer border
                        ${isClosed ? 'bg-emerald-50/20 border-emerald-50/50' : 'bg-white border-white/60 hover:border-slate-200 shadow-sm'}
                      `}
                    >
                      {/* Left Status Bar Indicator */}
                      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-r-full transition-all duration-500 ${isClosed ? 'bg-emerald-500' : 'bg-indigo-300 group-hover:bg-indigo-600'}`}></div>

                      <div className="flex items-center gap-12 flex-1 ml-4">
                        <div className="min-w-[120px]">
                          <p className="font-bold text-slate-900 text-base tracking-tighter leading-none">Día {formatDisplayDate(r.date)}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={`text-[8px] font-bold uppercase tracking-widest ${isClosed ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {isClosed ? 'Finalizado' : 'En Proceso'}
                            </span>
                            <span className="text-slate-200">|</span>
                            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">
                               Subido {new Date(r.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="hidden md:flex items-center gap-16 flex-1">
                          {/* Progress Micro-Widget */}
                          <div className="flex flex-col gap-1.5 w-full max-w-[200px]">
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Revisión de Personal</span>
                              <span className="text-[10px] font-black text-slate-900">{percent}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percent}%` }}
                                className={`h-full rounded-full ${isClosed ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-12">
                            <div className="flex flex-col">
                              <p className="text-sm font-bold text-slate-900">{total}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Trabajadores</p>
                            </div>
                            <div className="flex flex-col">
                              <p className="text-sm font-bold text-slate-900">{reviewed}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Procesados</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                        <ChevronRight size={16} />
                      </div>
                    </motion.div>
                  </React.Fragment>
                );
              });
            })()}
          </motion.div>

          {reports.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
                <FileSpreadsheet size={32} className="text-slate-200" />
              </div>
              <h4 className="text-slate-400 font-bold text-sm uppercase tracking-widest">No hay reportes disponibles</h4>
              <p className="text-slate-300 text-xs mt-2 font-medium">Sube tu primer archivo Excel para comenzar</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
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
      <p className="text-slate-400 font-semibold text-xs uppercase tracking-widest">Calculando Métricas...</p>
    </div>
  );

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-[10px] uppercase tracking-widest transition-all">
          <ChevronLeft size={16} /> Volver al Inicio
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Promedio Personal', val: Math.round(stats.totalWorkers), icon: <Users size={24} />, color: 'bg-blue-500' },
          { title: 'Generar Marcación', val: Math.round(stats.noMarking), icon: <Map size={24} />, color: 'bg-amber-500' },
          { title: 'Problemas Planilla', val: Math.round(stats.payrollIssue), icon: <AlertCircle size={24} />, color: 'bg-red-500' },
          { title: '% Cumplimiento', val: stats.attendanceRate + '%', icon: <TrendingUp size={24} />, color: 'bg-green-500' },
        ].map((kpi, i) => (
          <motion.div
            key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20 flex items-center justify-between"
          >
            <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{kpi.title}</p>
               <h4 className="text-3xl font-bold text-slate-800 tracking-tighter">{kpi.val}</h4>
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
            <h3 className="font-bold text-xl text-slate-900 tracking-tighter">Tendencia de Asistencia</h3>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
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

        {/* Observation Analysis */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-1 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/20 flex flex-col"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <BarChart3 size={20} />
            </div>
            <h3 className="font-bold text-xl text-slate-900 tracking-tighter">Ranking de Respuestas</h3>
          </div>

          <div className="flex-1 space-y-4">
            {stats.obsData.length > 0 ? stats.obsData.map((obs, idx) => {
              const totalCompleted = stats.trendData.reduce((acc, curr) => acc + curr.completed, 0);
              const perc = totalCompleted > 0 ? Math.round((obs.value / totalCompleted) * 100) : 0;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-600 truncate max-w-[150px]">{obs.name}</span>
                    <span className="text-indigo-600 font-bold">{obs.value.toLocaleString()} <span className="text-slate-300 ml-1 text-[8px]">({perc}%)</span></span>
                  </div>
                  <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${perc}%` }}
                      transition={{ duration: 1, delay: 0.2 + (idx * 0.1) }}
                      className="h-full bg-indigo-500 rounded-full"
                    ></motion.div>
                  </div>
                </div>
              );
            }) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <PieChart size={32} className="opacity-20 mb-2" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Sin datos</p>
              </div>
            )}
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
          <h3 className="font-bold text-xl text-slate-900 tracking-tighter">Análisis por Fundo (Top 8)</h3>
        </div>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.zoneData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
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
  const [currentReport, setCurrentReport] = useState(report);


  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'reports', report.id), (snap) => {
      if (snap.exists()) {
        setCurrentReport({ id: snap.id, ...snap.data() });
      }
    });
    return unsub;
  }, [report.id]);


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
    if (currentReport.columnOrder && currentReport.columnOrder.length > 0) {
      allCols.push(...currentReport.columnOrder);
    } else {
      // 2. Fallback: Orden guardado de extras (Reportes intermedios)
      const extra = currentReport.extraColumnsOrder || [];
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

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!currentReport.id) return;

      const responseBreakdown = {};
      people.forEach(p => {
        if (p.respuestaObservacion) {
          responseBreakdown[p.respuestaObservacion] = (responseBreakdown[p.respuestaObservacion] || 0) + 1;
        }
      });

      const needsUpdate =
        currentReport.reviewedWorkers !== progress.completed ||
        currentReport.totalWorkers !== progress.total ||
        JSON.stringify(currentReport.responseBreakdown || {}) !== JSON.stringify(responseBreakdown);

      if (needsUpdate) {
        try {
          await updateDoc(doc(db, 'reports', currentReport.id), {
            reviewedWorkers: progress.completed,
            totalWorkers: progress.total,
            responseBreakdown
          });
        } catch (e) {
          console.error("Error syncing report metadata:", e);
        }
      }
    }, 1000); // 1 segundo de debounce

    return () => clearTimeout(timer);
  }, [currentReport.id, progress.completed, progress.total]);

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
    'CHECK': 30,
    '#': 34,
    'NOMBRE': 190,
    'DNI': 75,
    'CODIGO': 65,
    'NOMBRE COMPLETO': 190,
    'DEFAULT': 95
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
    if (['CLOSED', 'CERRADO'].includes(currentReport.status)) return;
    try {
      await updateDoc(doc(db, `reports/${currentReport.id}/people`, pId), { respuestaObservacion: val });
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


  const handleDownloadExcel = async () => {
    try {
      // 1. Definir columnas base (usando el orden original si existe)
      const baseColumns = (currentReport.columnOrder && currentReport.columnOrder.length > 0)
        ? currentReport.columnOrder
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

    if (['CLOSED', 'CERRADO'].includes(currentReport.status)) {
      alert("No se pueden realizar cambios masivos en un reporte cerrado.");
      return;
    }

    if (!confirm(`¿Estás seguro de asignar "${val}" a los ${idsToUpdate.length} trabajadores seleccionados?`)) return;

    try {
      setSaving(true);
      const batch = writeBatch(db);
      idsToUpdate.forEach(id => {
        batch.update(doc(db, `reports/${currentReport.id}/people`, id), { respuestaObservacion: val });
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

  const handleClose = async () => {
    if (!progress.isAllDone) return;
    if (!confirm("¿Deseas FINALIZAR este reporte? Ya no se podrán realizar más cambios.")) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, 'reports', currentReport.id), { status: 'CLOSED' });
      alert("Reporte Cerrado Correctamente.");
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!confirm("¿Deseas REABRIR este reporte para permitir nuevas ediciones?")) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, 'reports', currentReport.id), { status: 'OPEN' });
      alert("Reporte Reabierto.");
    } catch (e) {
      alert("Error al reabrir: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2 pb-4 text-slate-800">
      <div className="bg-white p-4 sm:p-6 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-col gap-4">
        {/* FILA 1: INFORMACIÓN Y ACCIONES PRINCIPALES */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-semibold hover:text-blue-600 transition-all text-[9px] uppercase tracking-widest group">
              <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Volver al listado
            </button>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tighter leading-none">Reporte {formatDisplayDate(currentReport?.date)}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest ${['OPEN', 'ABIERTO'].includes(currentReport.status) ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                <div className={`w-1 h-1 rounded-full ${['OPEN', 'ABIERTO'].includes(currentReport.status) ? 'bg-blue-600 animate-pulse' : 'bg-green-600'}`}></div>
                {['OPEN', 'ABIERTO'].includes(currentReport.status) ? 'En Proceso' : 'Cerrado'}
              </div>
              <span className="text-slate-200 text-[10px]">•</span>
              <div className="flex items-center gap-2 text-slate-400">
                <Users size={12} />
                <p className="text-[9px] font-bold uppercase tracking-widest">{currentReport.totalWorkers || 0} Registros</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Borrado de Reporte (Solo Encargados) */}
            {String(userData?.role || '').toUpperCase() === 'ENCARGADO' && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-white hover:bg-red-500 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all border border-red-50 hover:border-red-500"
              >
                {saving ? <Loader2 className="animate-spin" size={12} /> : <Trash2 size={12} />}
                Eliminar
              </button>
            )}

            {['CLOSED', 'CERRADO'].includes(currentReport.status) && (
              <button
                onClick={handleReopen}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all border border-amber-100"
              >
                <RotateCcw size={12} /> Reabrir
              </button>
            )}

            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white hover:bg-blue-600 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all shadow-lg shadow-slate-200 active:scale-95"
            >
              <FileSpreadsheet size={14} /> Exportar Excel
            </button>
          </div>
        </div>

        <div className="h-px bg-slate-100 w-full rounded-full opacity-50"></div>

        {/* FILA 2: CONTROLES DE FILTRO Y ACCIONES MASIVAS */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input
                type="text" placeholder="BUSCAR TRABAJADOR..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl border border-transparent outline-none focus:bg-white focus:border-blue-100 focus:ring-4 focus:ring-blue-100/30 font-bold uppercase tracking-widest text-slate-700 text-[10px] placeholder:text-slate-300 transition-all"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            {zonaColumn && (
              <CustomDropdown
                value={filterZona}
                options={['Todas', ...uniqueZonas]}
                onChange={setFilterZona}
                placeholder="Zona"
                className="w-full sm:w-44"
              />
            )}

            {rutaColumn && (
              <CustomDropdown
                value={filterRuta}
                options={['Todas', ...uniqueRutas]}
                onChange={setFilterRuta}
                placeholder="Ruta"
                className="w-full sm:w-44"
              />
            )}

            <CustomDropdown
              value={filterDigitacion}
              options={['Todas', 'SI', 'NO']}
              onChange={setFilterDigitacion}
              placeholder="Dig"
              className="w-full sm:w-28"
            />

            <CustomDropdown
              value={filterObs}
              options={['Todas', ...uniqueObservations]}
              onChange={setFilterObs}
              placeholder="Obs."
              className="w-full sm:w-48"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-l-0 xl:border-l xl:pl-4 border-slate-100">
            {/* Acciones de Edición (Solo si está abierto) */}
            {['OPEN', 'ABIERTO'].includes(currentReport.status) && (
              <>
                {(filtered.length > 0) && (
                  <button
                    onClick={() => setIsBulkModalOpen(true)}
                    disabled={saving}
                    className={`px-5 py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border shadow-sm w-full sm:w-auto ${selectedIds.size > 0 ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-slate-50'}`}
                  >
                    <MousePointerClick size={14} />
                    {selectedIds.size > 0 ? `Asignar (${selectedIds.size})` : `Asignar Todos (${filtered.length})`}
                  </button>
                )}

                {['CONTROL', 'ENCARGADO'].includes(String(userData?.role || '').toUpperCase()) && (
                  <button
                    onClick={handleClose}
                    disabled={saving || !progress.isAllDone}
                    className={`px-5 py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border shadow-sm w-full sm:w-auto ${progress.isAllDone ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-blue-600 hover:shadow-blue-200' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'}`}
                  >
                    {progress.isAllDone ? <CheckCircle size={14} /> : <Loader2 className="animate-spin" size={14} />}
                    Finalizar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden relative">
        <div className="overflow-auto max-h-[70vh] custom-scrollbar">
          <table className="w-full text-left border-collapse table-fixed min-w-max">
            <thead className="bg-[#f8fafc] border-b border-slate-200 sticky top-0 z-40">
              <tr>
                <th className="px-2 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest sticky left-0 bg-[#f8fafc] z-50 border-b border-r border-slate-100 flex items-center justify-center" style={{ width: `${COL_WIDTHS['CHECK']}px`, left: 0 }}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={filtered.length > 0 && selectedIds.size >= filtered.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-2 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest sticky bg-[#f8fafc] z-50 border-b border-r border-slate-100 text-center" style={{ width: `${COL_WIDTHS['#']}px`, left: `${COL_WIDTHS['CHECK']}px` }}>#</th>
                {tableColumns.map(col => {
                  const isSticky = stickyConfig.stickySet.has(col);
                  const isLast = col === stickyConfig.lastCol;
                  const w = getColWidth(col);
                  return (
                    <th
                      key={col}
                      className={`px-2 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest ${isSticky ? 'sticky bg-[#f8fafc] z-50 border-b border-slate-100' : ''} ${isLast ? 'border-r-2 border-slate-200' : 'border-r border-slate-100'}`}
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
                <th className="px-2 py-1.5 text-[9px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 sticky right-0 z-40 border-l border-blue-100" style={{ width: '180px' }}>Respuesta Observación</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filtered.map((p, idx) => {
                const isEdited = !!p.edited;
                return (
                  <tr key={p.id} className={`hover:bg-blue-50 transition-colors group ${selectedIds.has(p.id) ? 'bg-indigo-50/50' : (isEdited ? 'bg-amber-50/40' : '')}`}>
                    <td className={`px-2 py-0 sticky left-0 z-20 border-b border-r border-slate-100 text-center transition-colors ${selectedIds.has(p.id) ? 'bg-indigo-50 group-hover:bg-blue-50' : (isEdited ? 'bg-amber-50 group-hover:bg-blue-50' : 'bg-slate-50 group-hover:bg-blue-50')}`} style={{ width: `${COL_WIDTHS['CHECK']}px`, left: 0 }}>
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleSelectOne(p.id)}
                      />
                    </td>
                    <td className={`px-2 py-0 text-[9px] font-bold text-slate-400 sticky z-20 border-b border-r border-slate-100 text-center transition-colors ${selectedIds.has(p.id) ? 'bg-indigo-50 group-hover:bg-blue-50' : (isEdited ? 'bg-amber-50 group-hover:bg-blue-50' : 'bg-slate-50 group-hover:bg-blue-50')}`} style={{ width: `${COL_WIDTHS['#']}px`, left: `${COL_WIDTHS['CHECK']}px` }}>{idx + 1}</td>
                    {tableColumns.map(col => {
                      const isSticky = stickyConfig.stickySet.has(col);
                      const isLast = col === stickyConfig.lastCol;
                      const w = getColWidth(col);
                      const isModified = col === 'NOMBRE' ? p.modifiedFields?.['NOMBRE'] : (col === 'DNI' ? p.modifiedFields?.['DNI'] : !!p.modifiedFields?.[col]);
                      const val = p.datosExtra?.[col] !== undefined ? p.datosExtra[col] :
                        (col === 'NOMBRE' ? p.nombreCompleto :
                          (col === 'DNI' ? p.dni :
                            (col === 'CODIGO' ? p.codigo :
                              (col === 'OBSERVACION' ? p.observacion : ''))));

                      return (
                        <td
                          key={col}
                          onDoubleClick={() => { setEditingPerson(p); setIsEditModalOpen(true); }}
                          className={`px-2 py-0 text-[9px] font-medium border-b cursor-pointer leading-tight ${isSticky ? 'sticky group-hover:bg-blue-50 z-20 ' : ''} ${isModified ? 'bg-amber-100/30 text-amber-900 border-amber-200' : (isSticky ? (isEdited ? 'bg-amber-50/10' : 'bg-white') : 'text-slate-700')} ${isLast ? 'border-r-2 border-slate-200' : 'border-r border-slate-100'}`}
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
                      className={`px-2 py-0 bg-white group-hover:bg-blue-50 sticky right-0 border-b border-l border-blue-100 transition-all ${activeDropdown === p.id ? 'z-[100]' : 'z-30'}`}
                      style={{ width: '150px' }}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 min-w-0">
                          <QuickObservationPicker
                            value={p.respuestaObservacion || ''}
                            onChange={(val) => updateRespuesta(p.id, val)}
                            onOpenChange={(open) => setActiveDropdown(open ? p.id : null)}
                            disabled={['CLOSED', 'CERRADO'].includes(currentReport.status)}
                          />
                        </div>
                        <button
                          onClick={() => { setEditingPerson(p); setIsEditModalOpen(true); }}
                          className="flex-shrink-0 p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                          title="Editar"
                        >
                          <User size={12} />
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
            <p className="text-slate-300 font-semibold">No se encontraron resultados para "{search}"</p>
          </div>
        )}
      </div>
      {/* Modal de Acción Masiva */}
      <AnimatePresence>
        {isEditModalOpen && editingPerson && (
          <WorkerEditModal
            person={editingPerson}
            reportId={currentReport.id}
            reportStatus={currentReport.status}
            tableColumns={tableColumns}
            onClose={() => { setIsEditModalOpen(false); setEditingPerson(null); }}
            onSave={(updatedPerson) => {
              setPeople(prev => prev.map(p => p.id === updatedPerson.id ? updatedPerson : p));
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
                    <h3 className="text-3xl font-bold text-slate-900 tracking-tighter">Acción Masiva</h3>
                    <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mt-2">Aplicar a {selectedIds.size > 0 ? selectedIds.size : filtered.length} trabajadores</p>
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
