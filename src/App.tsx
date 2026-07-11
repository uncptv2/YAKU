import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Droplet,
  Users,
  Award,
  AlertTriangle,
  Tv,
  LogOut,
  Upload,
  Camera,
  CheckCircle,
  Clock,
  Lock,
  Settings,
  User,
  Check,
  ChevronRight,
  Eye,
  BookOpen,
  Send,
  AlertCircle,
  PlusCircle,
  FileText,
  FileSpreadsheet,
  Trash2
} from "lucide-react";
import { BANCO_RETOS } from "./data";
import { Alumno, RetoEvidencia, Alerta, DashboardData, UserSession } from "./types";
import HidroAventuraGame from "./components/HidroAventuraGame";
import { googleSignIn, initAuth, googleLogout } from "./lib/googleAuth";

// Helper to convert Google Drive viewing URLs into direct-image CDN URLs
const getDirectImageUrl = (url: string | undefined | null): string => {
  if (!url) return "";
  
  // Detect Google Drive sharing urls and extract file ID
  let fileId = "";
  
  const fileDMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (fileDMatch && fileDMatch[1]) {
    fileId = fileDMatch[1];
  } else {
    const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (idParamMatch && idParamMatch[1]) {
      fileId = idParamMatch[1];
    }
  }
  
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  
  return url;
};

export default function App() {
  // Authentication & session state
  const [userId, setUserId] = useState("");
  const [userPin, setUserPin] = useState("");
  const [session, setSession] = useState<UserSession | null>(null);
  const [loginError, setLoginError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);

  // Dashboards states
  const [activeTab, setActiveTab] = useState<"home" | "ruta" | "juego">("home");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [showMedalsPanel, setShowMedalsPanel] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Student form submissions
  const [evidenceComment, setEvidenceComment] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceBase64, setEvidenceBase64] = useState("");
  const [submittingEvidence, setSubmittingEvidence] = useState(false);

  // Anonymous Alert Floating Form
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertDesc, setAlertDesc] = useState("");
  const [alertFile, setAlertFile] = useState<File | null>(null);
  const [alertBase64, setAlertBase64] = useState("");
  const [submittingAlert, setSubmittingAlert] = useState(false);

  // Teacher dashboard lists
  const [pendingRetos, setPendingRetos] = useState<any[]>([]);
  const [pendingAlertas, setPendingAlertas] = useState<any[]>([]);
  const [loadingTeacherLists, setLoadingTeacherLists] = useState(false);

  // Teacher configuration edit form
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [configDirectorUrl, setConfigDirectorUrl] = useState("");
  const [configVideoUrl, setConfigVideoUrl] = useState("");
  const [configBloqueoColectivo, setConfigBloqueoColectivo] = useState(true);
  const [updatingConfig, setUpdatingConfig] = useState(false);

  // Student CRUD states
  const [alumnosList, setAlumnosList] = useState<any[]>([]);
  const [editingAlumno, setEditingAlumno] = useState<any | null>(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentFormName, setStudentFormName] = useState("");
  const [studentFormGrade, setStudentFormGrade] = useState("Primero");
  const [studentFormPin, setStudentFormPin] = useState("");
  const [studentFormPoints, setStudentFormPoints] = useState(0);
  const [studentFormWeek, setStudentFormWeek] = useState(0);
  const [savingStudent, setSavingStudent] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  // Google Sheets integration state
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("https://docs.google.com/spreadsheets/d/1m4swht0NLOWGXdsN3NjPr9SJXDfn63aQKwM7qyzEesU/edit?gid=1940618361#gid=1940618361");
  const [sheetOperationLoading, setSheetOperationLoading] = useState(false);
  const [sheetStatusMsg, setSheetStatusMsg] = useState("");
  const [isInIframe, setIsInIframe] = useState(false);

  // Custom Confirm & Alert Dialog States
  const [confirmPromise, setConfirmPromise] = useState<{
    resolve: (value: boolean) => void;
    title: string;
    message: string;
  } | null>(null);

  const [notification, setNotification] = useState<{
    show: boolean;
    type: "success" | "error" | "info" | "warning";
    title: string;
    message: string;
  } | null>(null);

  const showAlert = (message: string, type: "success" | "error" | "info" | "warning" = "info", title?: string) => {
    const defaultTitle = type === "success" ? "¡Éxito!" : type === "error" ? "Error" : type === "warning" ? "Advertencia" : "Mensaje";
    setNotification({
      show: true,
      type,
      title: title || defaultTitle,
      message
    });
    setTimeout(() => {
      setNotification(prev => prev?.message === message ? { ...prev, show: false } : prev);
    }, 7000);
  };

  const askConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmPromise({
        resolve,
        title,
        message
      });
    });
  };

  // Fetch initial dashboard and teacher queues
  const fetchGlobalData = async () => {
    try {
      setLoadingDashboard(true);
      const res = await fetch("/api/datos-globales");
      const data = await res.json();
      setDashboardData(data);
      if (data.director?.urlMedia) {
        setConfigDirectorUrl(data.director.urlMedia);
      }
      if (data.video) {
        setConfigVideoUrl(data.video);
      }
      if (data.bloqueoColectivo !== undefined) {
        setConfigBloqueoColectivo(data.bloqueoColectivo);
      }
    } catch (err) {
      console.error("Error fetching global data:", err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const fetchTeacherData = async () => {
    try {
      setLoadingTeacherLists(true);
      const [resRetos, resAlerts, resAlumnos] = await Promise.all([
        fetch("/api/docente/retos-pendientes"),
        fetch("/api/docente/alertas-pendientes"),
        fetch("/api/docente/alumnos")
      ]);
      const retos = await resRetos.json();
      const alerts = await resAlerts.json();
      const alumnos = await resAlumnos.json();
      setPendingRetos(retos);
      setPendingAlertas(alerts);
      setAlumnosList(alumnos);
    } catch (err) {
      console.error("Error fetching teacher dashboard queues:", err);
    } finally {
      setLoadingTeacherLists(false);
    }
  };

  // Re-verify student state to sync points, levels, and blocking
  const reloadStudentSession = async () => {
    if (!session || session.esDocente || !session.id) return;
    try {
      const res = await fetch("/api/verificar-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: session.id, pin: userPin })
      });
      const data = await res.json();
      if (data.exito) {
        setSession(data);
      }
    } catch (err) {
      console.error("Error updating student session:", err);
    }
  };

  // Run on load
  useEffect(() => {
    fetchGlobalData();
    setIsInIframe(window.self !== window.top);
  }, []);

  // Listen to Google Auth changes for the teacher
  useEffect(() => {
    if (session?.esDocente) {
      const unsubscribe = initAuth(
        (user, token) => {
          setGoogleUser(user);
          setGoogleToken(token);
        },
        () => {
          setGoogleUser(null);
          setGoogleToken(null);
        }
      );
      return () => unsubscribe();
    }
  }, [session]);

  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !userPin.trim()) {
      setLoginError("Por favor, ingresa tu ID y PIN");
      return;
    }

    setAuthenticating(true);
    setLoginError("");

    try {
      const res = await fetch("/api/verificar-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, pin: userPin })
      });
      const data = await res.json();
      if (data.exito) {
        setSession(data);
        if (data.esDocente) {
          fetchTeacherData();
        } else {
          reloadStudentSession();
          fetchGlobalData();
        }
      } else {
        setLoginError(data.mensaje || "ID o PIN incorrectos.");
      }
    } catch (err) {
      setLoginError("Error de comunicación con el servidor.");
      console.error(err);
    } finally {
      setAuthenticating(false);
    }
  };

  // Logout
  const handleLogout = () => {
    setSession(null);
    setUserId("");
    setUserPin("");
    setActiveTab("home");
    setShowMedalsPanel(false);
    setEvidenceComment("");
    setEvidenceFile(null);
    setEvidenceBase64("");
  };

  // Challenge File uploads to Base64
  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEvidenceFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setEvidenceBase64(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Alert File uploads to Base64
  const handleAlertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAlertFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAlertBase64(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit challenge evidence
  const submitEvidence = async () => {
    if (!session || !session.siguienteRetoNum) return;
    if (!evidenceComment.trim() || !evidenceBase64) {
      showAlert("Por favor completa el comentario y selecciona una foto de tu acción.", "warning");
      return;
    }

    setSubmittingEvidence(true);
    const currentChallenge = BANCO_RETOS[session.siguienteRetoNum];
    const retoNombre = currentChallenge ? currentChallenge.titulo : "Reto Semanal";

    try {
      const res = await fetch("/api/enviar-evidencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idAlumno: session.id,
          nombreAlumno: session.nombre,
          semanaNum: session.siguienteRetoNum,
          retoNombre,
          comentario: evidenceComment,
          img: evidenceBase64
        })
      });
      const data = await res.json();
      if (data.exito) {
        showAlert(data.mensaje, "success");
        setEvidenceComment("");
        setEvidenceFile(null);
        setEvidenceBase64("");
        reloadStudentSession();
        fetchGlobalData();
        setActiveTab("home");
      } else {
        showAlert(data.mensaje || "Error al enviar evidencia.", "error");
      }
    } catch (err) {
      showAlert("Error al enviar evidencia.", "error");
      console.error(err);
    } finally {
      setSubmittingEvidence(false);
    }
  };

  // Submit anonymous water alert
  const submitWaterAlert = async () => {
    if (!alertDesc.trim() || !alertBase64) {
      showAlert("Por favor, ingresa una descripción del problema y adjunta una fotografía.", "warning");
      return;
    }

    setSubmittingAlert(true);
    const studentId = session?.esDocente ? "Supervisor" : session?.id || "Anonimo";

    try {
      const res = await fetch("/api/registrar-alerta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idAlumno: studentId,
          descripcion: alertDesc,
          img: alertBase64
        })
      });
      const data = await res.json();
      if (data.exito) {
        showAlert(data.mensaje, "success");
        setAlertDesc("");
        setAlertFile(null);
        setAlertBase64("");
        setShowAlertModal(false);
        if (session?.esDocente) {
          fetchTeacherData();
        }
      } else {
        showAlert(data.mensaje || "Error al registrar reporte hídrico.", "error");
      }
    } catch (err) {
      showAlert("Error al enviar reporte hídrico.", "error");
      console.error(err);
    } finally {
      setSubmittingAlert(false);
    }
  };

  // Approve challenge as Teacher
  const approveChallenge = async (idReto: string, idAlumno: string, semanaNum: number) => {
    const confirmed = await askConfirm(
      "✅ Validar Evidencia",
      "¿Aprobar evidencia y asentar cambios de puntaje en el alumno?"
    );
    if (!confirmed) return;
    try {
      const res = await fetch("/api/docente/validar-reto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idReto, idAlumno, semanaNum })
      });
      const data = await res.json();
      if (data.exito) {
        showAlert("Acción procesada y aprobada con éxito. Se otorgaron +15 puntos al líder.", "success");
        fetchTeacherData();
        fetchGlobalData();
      } else {
        showAlert(data.mensaje || "Error al validar.", "error");
      }
    } catch (err) {
      showAlert("Error al procesar validación.", "error");
      console.error(err);
    }
  };

  // Validate all pending challenges
  const approveAllChallenges = async () => {
    const confirmed = await askConfirm(
      "⚡ Validar Todo",
      "¿Estás seguro de validar TODAS las evidencias estudiantiles pendientes?"
    );
    if (!confirmed) return;
    try {
      const res = await fetch("/api/docente/validar-todos", {
        method: "POST"
      });
      const data = await res.json();
      showAlert(data.mensaje, data.exito ? "success" : "info");
      fetchTeacherData();
      fetchGlobalData();
    } catch (err) {
      showAlert("Error al validar todo.", "error");
      console.error(err);
    }
  };

  // Validate / archive alert as Teacher
  const resolveAlert = async (idAlerta: string) => {
    const confirmed = await askConfirm(
      "🛠 Resolver Alerta",
      "¿Confirmas que la alerta de desperdicio hídrico ha sido debidamente atendida y resuelta?"
    );
    if (!confirmed) return;
    try {
      const res = await fetch("/api/docente/validar-alerta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idAlerta })
      });
      const data = await res.json();
      if (data.exito) {
        showAlert("Alerta archivada con éxito.", "success");
        fetchTeacherData();
      } else {
        showAlert("No se pudo archivar.", "error");
      }
    } catch (err) {
      showAlert("Error de conexión.", "error");
      console.error(err);
    }
  };

  // Save Config parameters as Teacher
  const saveMediaConfig = async () => {
    setUpdatingConfig(true);
    try {
      const res = await fetch("/api/docente/actualizar-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urlMedia: configDirectorUrl,
          videoUrl: configVideoUrl,
          bloqueoColectivo: configBloqueoColectivo
        })
      });
      const data = await res.json();
      showAlert(data.mensaje, data.exito ? "success" : "error");
      if (data.exito) {
        setShowConfigPanel(false);
        fetchGlobalData();
      }
    } catch (err) {
      showAlert("Error al actualizar configuración.", "error");
      console.error(err);
    } finally {
      setUpdatingConfig(false);
    }
  };

  // Student list CRUD functions
  const openAddStudentModal = () => {
    setEditingAlumno(null);
    setStudentFormName("");
    setStudentFormGrade("Primero");
    setStudentFormPin("");
    setStudentFormPoints(0);
    setStudentFormWeek(0);
    setShowStudentModal(true);
  };

  const openEditStudentModal = (al: any) => {
    setEditingAlumno(al);
    setStudentFormName(al.nombre);
    setStudentFormGrade(al.salon);
    setStudentFormPin(al.pin);
    setStudentFormPoints(al.puntos || 0);
    setStudentFormWeek(al.ultimoRetoValido || 0);
    setShowStudentModal(true);
  };

  const saveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFormName.trim() || !studentFormGrade || !studentFormPin.trim()) {
      showAlert("Por favor completa el nombre, grado y PIN.", "warning");
      return;
    }

    setSavingStudent(true);
    const isEdit = !!editingAlumno;
    const url = isEdit ? "/api/docente/editar-alumno" : "/api/docente/crear-alumno";
    const payload = {
      id: editingAlumno?.id,
      nombre: studentFormName,
      salon: studentFormGrade,
      pin: studentFormPin,
      puntos: studentFormPoints,
      ultimoRetoValido: studentFormWeek
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.exito) {
        showAlert(data.mensaje, "success");
        setShowStudentModal(false);
        fetchTeacherData();
        fetchGlobalData();
      } else {
        showAlert(data.mensaje || "Error al guardar el alumno.", "error");
      }
    } catch (err) {
      showAlert("Error de conexión al guardar alumno.", "error");
      console.error(err);
    } finally {
      setSavingStudent(false);
    }
  };

  const deleteStudent = async (id: string, nombre: string) => {
    const confirmed = await askConfirm(
      "❌ Eliminar Alumno",
      `¿Estás completamente seguro de eliminar al alumno ${nombre} (ID: ${id})?\nEsto borrará permanentemente sus puntos e historial.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch("/api/docente/eliminar-alumno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.exito) {
        showAlert(data.mensaje, "success");
        fetchTeacherData();
        fetchGlobalData();
      } else {
        showAlert(data.mensaje || "No se pudo eliminar al alumno.", "error");
      }
    } catch (err) {
      showAlert("Error de conexión al eliminar alumno.", "error");
      console.error(err);
    }
  };

  const deleteAllStudents = async () => {
    const confirmed = await askConfirm(
      "🚨 Vaciar Base de Datos",
      "¿Estás seguro de eliminar a TODOS los alumnos registrados en el sistema?\nEsta acción es irreversible y borrará permanentemente todos sus puntos e historiales de juego."
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/docente/eliminar-todos-alumnos", {
        method: "POST"
      });
      const data = await res.json();
      if (data.exito) {
        showAlert(data.mensaje, "success");
        fetchTeacherData();
        fetchGlobalData();
      } else {
        showAlert(data.mensaje || "No se pudo vaciar la lista de alumnos.", "error");
      }
    } catch (err) {
      showAlert("Error de conexión al vaciar la lista de alumnos.", "error");
      console.error(err);
    }
  };

  // Google Sheets Helpers & Operations
  const handleGoogleSignIn = async () => {
    try {
      setSheetOperationLoading(true);
      setSheetStatusMsg("Iniciando sesión con Google...");
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        showAlert(`¡Sesión de Google iniciada con éxito! Conectado como ${res.user.email}`, "success");
      }
    } catch (err: any) {
      showAlert(`Error al iniciar sesión con Google: ${err.message || err}`, "error");
    } finally {
      setSheetOperationLoading(false);
      setSheetStatusMsg("");
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await googleLogout();
      setGoogleUser(null);
      setGoogleToken(null);
      showAlert("Sesión de Google cerrada con éxito.", "success");
    } catch (err: any) {
      console.error("Error al cerrar sesión de Google:", err);
      showAlert("Ocurrió un error al cerrar sesión de Google.", "error");
    }
  };

  const extractSpreadsheetId = (urlOrId: string) => {
    const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : urlOrId.trim();
  };

  const parseCSV = (csvText: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentValue = "";

    const normalizedText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Detect separator (comma vs semicolon, common in Spanish region Excel/Sheets exports)
    let separator = ",";
    const firstLine = normalizedText.split("\n")[0] || "";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    if (semiCount > commaCount) {
      separator = ";";
    }

    for (let i = 0; i < normalizedText.length; i++) {
      const char = normalizedText[i];
      const nextChar = normalizedText[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentValue += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          currentValue += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === separator) {
          row.push(currentValue);
          currentValue = "";
        } else if (char === "\n") {
          row.push(currentValue);
          lines.push(row);
          row = [];
          currentValue = "";
        } else {
          currentValue += char;
        }
      }
    }
    if (row.length > 0 || currentValue) {
      row.push(currentValue);
      lines.push(row);
    }
    return lines.filter(r => r.length > 0 && r.some(cell => cell.trim() !== ""));
  };

  const handleImportFromSheets = async (modo: "reemplazar" | "actualizar") => {
    const url = spreadsheetUrl.trim();
    if (!url) {
      showAlert("Por favor ingresa un enlace de Google Sheets.", "warning");
      return;
    }

    const isPublicLink = url.includes("/d/e/2PACX-") || url.includes("/pubhtml") || url.includes("/pub") || url.includes("export?format=csv");
    
    // Attempt a public CSV fetch if the link looks public or the user isn't logged in with Google
    const tryPublicFetch = isPublicLink || !googleToken;

    const confirmMsg = modo === "reemplazar"
      ? "¿Estás completamente seguro de REEMPLAZAR toda la lista de alumnos actuales con los datos de Google Sheets?\n¡Esto sobreescribirá los registros locales del sistema!"
      : "¿Estás seguro de ACTUALIZAR la lista de alumnos actuales?\nLos alumnos existentes con el mismo nombre o ID se actualizarán, y los nuevos alumnos se añadirán.";

    const confirmed = await askConfirm(
      modo === "reemplazar" ? "🚨 Confirmar Reemplazo Total" : "🔄 Confirmar Fusión de Alumnos",
      confirmMsg
    );
    if (!confirmed) return;

    setSheetOperationLoading(true);
    setSheetStatusMsg("Obteniendo información del documento...");

    let rows: any[] = [];
    let methodUsed = "";

    try {
      if (tryPublicFetch) {
        // Formatear el enlace para obtener la descarga directa en formato CSV
        let csvUrl = url;
        if (csvUrl.includes("/pubhtml")) {
          csvUrl = csvUrl.replace(/\/pubhtml([#?].*)?$/, "/pub?output=csv");
        } else if (csvUrl.includes("/pub") && !csvUrl.includes("output=csv") && !csvUrl.includes("output=tsv")) {
          csvUrl += (csvUrl.includes("?") ? "&" : "?") + "output=csv";
        } else if (!csvUrl.includes("/pub") && csvUrl.includes("docs.google.com/spreadsheets/d/")) {
          // Intentar exportar una hoja compartida como "Cualquier persona con el enlace puede ver"
          const docIdMatch = csvUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
          if (docIdMatch && docIdMatch[1]) {
            csvUrl = `https://docs.google.com/spreadsheets/d/${docIdMatch[1]}/export?format=csv`;
          }
        }

        setSheetStatusMsg("Conectando con la planilla de Google Sheets pública...");
        const response = await fetch(csvUrl);
        if (!response.ok) {
          throw new Error(`No se pudo acceder a la planilla pública (Status ${response.status}). Asegúrate de que el archivo esté publicado en la web o configurado con el permiso de 'Cualquier persona con el enlace puede ver'.`);
        }
        
        const csvText = await response.text();
        rows = parseCSV(csvText);
        methodUsed = "Pública (Sin Login)";
      } else {
        // Authenticated Google Sheets API fetch
        const idShed = extractSpreadsheetId(spreadsheetUrl);
        if (!idShed) {
          throw new Error("ID de Google Sheets inválido o vacío.");
        }

        // 1. Obtener metadatos de la hoja para saber qué pestaña corresponde a gid o usar la primera
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${idShed}`, {
          headers: { Authorization: `Bearer ${googleToken}` }
        });
        if (!metaRes.ok) {
          throw new Error(`Error al leer metadatos de la hoja (Código: ${metaRes.status}). Posiblemente el token de Google expiró.`);
        }
        const meta = await metaRes.json();
        
        let targetGid = "1940618361";
        const gidMatch = spreadsheetUrl.match(/[#&?]gid=(\d+)/);
        if (gidMatch && gidMatch[1]) {
          targetGid = gidMatch[1];
        }

        const targetSheet = meta.sheets?.find((s: any) => s.properties.sheetId.toString() === targetGid) 
                             || meta.sheets?.[0];
        const sheetTitle = targetSheet?.properties?.title || "Sheet1";

        setSheetStatusMsg(`Leyendo pestaña privada "${sheetTitle}"...`);

        // 2. Leer los valores de la hoja de cálculo
        const valuesRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${idShed}/values/'${encodeURIComponent(sheetTitle)}'!A1:F1000`, {
          headers: { Authorization: `Bearer ${googleToken}` }
        });
        if (!valuesRes.ok) {
          throw new Error(`Error al leer los valores de la hoja (Código: ${valuesRes.status})`);
        }
        const valuesData = await valuesRes.json();
        rows = valuesData.values;
        methodUsed = "Privada (Autenticado con Google)";
      }

      if (!rows || rows.length === 0) {
        throw new Error("La planilla de Google Sheets está vacía o no tiene filas válidas.");
      }

      setSheetStatusMsg("Procesando filas y validando estructura...");

      // 3. Procesar las filas. Detectar e identificar índices de columnas dinámicamente con alta precisión
      let colIdxId = 0;
      let colIdxPin = 1;
      let colIdxNombre = 2;
      let colIdxSalon = 3;
      let colIdxPuntos = 4;
      let colIdxSemana = 5;

      let hasHeader = false;
      if (rows && rows.length > 0) {
        const firstRow = rows[0].map((c: any) => c?.toString().toLowerCase().trim() || "");
        
        // Determinar si es una fila de encabezados
        const containsKeywords = firstRow.some((c: string) => 
          c.includes("id") || c.includes("nombre") || c.includes("pin") || c.includes("grado") || 
          c.includes("salon") || c.includes("salón") || c.includes("punto") || c.includes("semana") ||
          c.includes("reto") || c.includes("nivel") || c.includes("completo") || c.includes("acceso") ||
          c.includes("código") || c.includes("codigo") || c.includes("clave")
        );

        if (containsKeywords) {
          hasHeader = true;
          
          let foundId = false;
          let foundPin = false;
          let foundNombre = false;
          let foundSalon = false;
          let foundPuntos = false;
          let foundSemana = false;

          // Paso 1: Emparejar con alta prioridad y especificidad
          firstRow.forEach((val: string, idx: number) => {
            // El nivel o semana del reto tiene la máxima prioridad para evitar que se confunda con el ID de acceso
            if (val.includes("semana") || val.includes("reto") || val.includes("nivel") || val.includes("último") || val.includes("ultimo")) {
              colIdxSemana = idx;
              foundSemana = true;
            }
            // ID de acceso específico
            else if (val === "id" || val === "id de acceso" || val === "id_acceso" || val === "código de acceso" || val === "codigo de acceso" || (val.includes("acceso") && val.includes("id"))) {
              colIdxId = idx;
              foundId = true;
            }
            // Pin de acceso
            else if (val.includes("pin") || val.includes("clave") || val.includes("contraseña") || val.includes("contrasena")) {
              colIdxPin = idx;
              foundPin = true;
            }
            // Nombre de alumno específico
            else if (val.includes("nombre completo") || val.includes("nombres") || val.includes("alumno") || val.includes("estudiante")) {
              colIdxNombre = idx;
              foundNombre = true;
            }
            // Grado / Salón
            else if (val.includes("grado") || val.includes("salon") || val.includes("salón") || val.includes("sección") || val.includes("seccion") || val.includes("aula")) {
              colIdxSalon = idx;
              foundSalon = true;
            }
            // Puntos / Puntaje
            else if (val.includes("punto") || val.includes("puntaje")) {
              colIdxPuntos = idx;
              foundPuntos = true;
            }
          });

          // Paso 2: Coincidencias de respaldo para las columnas que no fueron asignadas
          firstRow.forEach((val: string, idx: number) => {
            const isAssigned = idx === colIdxSemana || idx === colIdxId || idx === colIdxPin || idx === colIdxNombre || idx === colIdxSalon || idx === colIdxPuntos;
            
            if (!isAssigned) {
              if (!foundId && (val.includes("id") || val.includes("acceso") || val.includes("código") || val.includes("codigo") || val.includes("n°") || val.includes("nro"))) {
                colIdxId = idx;
                foundId = true;
              }
              else if (!foundNombre && (val.includes("nombre") || val.includes("completo"))) {
                colIdxNombre = idx;
                foundNombre = true;
              }
            }
          });
        }
      }

      const startIndex = hasHeader ? 1 : 0;
      const alumnosLeidos: any[] = [];
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const id = row[colIdxId]?.toString().trim() || "";
        const pin = row[colIdxPin]?.toString().trim() || "";
        const nombre = row[colIdxNombre]?.toString().trim() || "";
        const salon = row[colIdxSalon]?.toString().trim() || "Primero";
        const puntos = parseInt(row[colIdxPuntos], 10) || 0;
        const ultimoRetoValido = parseInt(row[colIdxSemana], 10) || 0;

        if (!nombre) continue; // Salta filas sin nombre

        alumnosLeidos.push({
          id,
          pin: pin || "1234",
          nombre,
          salon,
          puntos,
          ultimoRetoValido
        });
      }

      if (alumnosLeidos.length === 0) {
        throw new Error("No se encontraron alumnos válidos en la planilla.");
      }

      setSheetStatusMsg(`Sincronizando ${alumnosLeidos.length} alumnos con la base de datos...`);

      // 4. Enviar al Express backend para guardar en db.json
      const importRes = await fetch("/api/docente/importar-alumnos-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumnos: alumnosLeidos, modo })
      });
      const importData = await importRes.json();
      
      if (importData.exito) {
        showAlert(`¡Carga masiva completada! Se sincronizaron exitosamente ${alumnosLeidos.length} alumnos en modo "${modo === "reemplazar" ? "Reemplazar Todo" : "Actualizar/Fusión"}". Método utilizado: ${methodUsed}`, "success");
        fetchTeacherData();
        fetchGlobalData();
      } else {
        throw new Error(importData.mensaje || "Error en el servidor al guardar la importación.");
      }

    } catch (err: any) {
      showAlert(`Error durante la importación: ${err.message || err}\n\nRecomendación: Si usas una planilla privada, inicia sesión con Google. Si usas el visor, cámbiala a "Cualquier persona con el enlace puede ver" para importar al instante sin restricciones.`, "error");
      console.error(err);
    } finally {
      setSheetOperationLoading(false);
      setSheetStatusMsg("");
    }
  };

  const handleExportToSheets = async () => {
    if (!googleToken) {
      showAlert("Por favor conecta primero tu cuenta de Google.", "warning");
      return;
    }
    const idShed = extractSpreadsheetId(spreadsheetUrl);
    if (!idShed) {
      showAlert("ID de Google Sheets inválido o vacío.", "warning");
      return;
    }

    const confirmed = await askConfirm(
      "📤 Exportar a Google Sheets",
      "Esto sobrescribirá la lista de alumnos en tu Google Sheet con la información actual de la plataforma web. ¿Deseas continuar?"
    );
    if (!confirmed) return;

    setSheetOperationLoading(true);
    setSheetStatusMsg("Obteniendo información del documento...");

    try {
      // 1. Obtener metadatos de la hoja para saber qué pestaña corresponde a gid o usar la primera
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${idShed}`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (!metaRes.ok) {
        throw new Error(`Error al leer metadatos (Código: ${metaRes.status})`);
      }
      const meta = await metaRes.json();
      
      let targetGid = "1940618361";
      const gidMatch = spreadsheetUrl.match(/[#&?]gid=(\d+)/);
      if (gidMatch && gidMatch[1]) {
        targetGid = gidMatch[1];
      }

      const targetSheet = meta.sheets?.find((s: any) => s.properties.sheetId.toString() === targetGid) 
                           || meta.sheets?.[0];
      const sheetTitle = targetSheet?.properties?.title || "Sheet1";

      setSheetStatusMsg(`Exportando datos a la pestaña "${sheetTitle}"...`);

      // 2. Preparar los datos
      const header = ["ID de Acceso", "PIN", "Nombre Completo", "Grado / Salón", "Puntaje", "Nivel Actual (Semana)"];
      const rows = alumnosList.map((al: any) => [
        al.id || "",
        al.pin || "1234",
        al.nombre || "",
        al.salon || "Primero",
        al.puntos || 0,
        al.ultimoRetoValido || 0
      ]);

      const dataToWrite = [header, ...rows];

      // 3. Escribir mediante la API de Google Sheets
      const range = `'${sheetTitle}'!A1:F1000`;
      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${idShed}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${googleToken}`
          },
          body: JSON.stringify({
            range,
            majorDimension: "ROWS",
            values: dataToWrite
          })
        }
      );

      if (!writeRes.ok) {
        const errorDetails = await writeRes.json().catch(() => ({}));
        throw new Error(`Error de escritura (Código: ${writeRes.status}). ${JSON.stringify(errorDetails)}`);
      }

      showAlert("¡Sincronización masiva de exportación completada con éxito!", "success");

    } catch (err: any) {
      showAlert(`Error durante la exportación: ${err.message || err}`, "error");
      console.error(err);
    } finally {
      setSheetOperationLoading(false);
      setSheetStatusMsg("");
    }
  };



  const getActiveChallenge = () => {
    if (!session?.siguienteRetoNum) return null;
    return BANCO_RETOS[session.siguienteRetoNum] || null;
  };

  const activeChallenge = getActiveChallenge();

  return (
    <div className="min-h-screen flex flex-col font-sans antialiased text-slate-900 pb-16 geom-grid-pattern">
      {/* HEADER DE LA PLATAFORMA */}
      <header className="geom-header-gradient text-white border-b border-slate-950 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-xl">
              <Droplet className="w-7 h-7 text-teal-400 fill-teal-400" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight font-display flex items-center gap-2 uppercase">
                YAKU LÍDERES
              </h1>
              <p className="text-[11px] text-slate-300 font-medium">
                Cuidando cada gota, liderando con el ejemplo
              </p>
            </div>
          </div>

          {session ? (
            <div className="flex items-center gap-3.5 bg-slate-950/40 px-4 py-1.5 rounded-xl border border-slate-800/80">
              <div className="text-right">
                <span className="block text-[10px] text-teal-400 font-extrabold uppercase tracking-wider">
                  {session.esDocente ? "Supervisor" : `${session.salon} Grado`}
                </span>
                <span className="block text-xs font-bold text-slate-100">
                  {session.nombre}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <button
                id="btn-cerrar-sesion"
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs bg-rose-600/90 hover:bg-rose-700 font-bold px-3 py-1.5 rounded-lg transition duration-150 cursor-pointer text-white shadow-sm border border-rose-700/50"
              >
                <LogOut className="w-3.5 h-3.5" />
                Salir
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-teal-400 font-bold bg-teal-950/20 px-3 py-1.5 rounded-xl border border-teal-500/10">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              <span>Plataforma Activa</span>
            </div>
          )}
        </div>
      </header>

      {/* RENDER PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 py-8 w-full flex-grow">
        <AnimatePresence mode="wait">
          {!session ? (
            /* VISTA LOGIN DE ACCESO */
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="max-w-md mx-auto my-12"
            >
              <div id="card-acceso-yaku" className="geom-glass-card overflow-hidden">
                {/* Cabecera del login */}
                <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-8 text-center text-white overflow-hidden border-b border-slate-800">
                  <div className="absolute -right-12 -bottom-12 w-44 h-44 rounded-full bg-teal-500/5 blur-xl pointer-events-none" />
                  <div className="absolute -left-12 -top-12 w-32 h-32 rounded-full bg-teal-500/5 blur-xl pointer-events-none" />
                  
                  <span className="text-5xl inline-block drop-shadow-md mb-2">💧👨‍💻</span>
                  <h2 className="text-2xl font-bold font-display tracking-tight uppercase">
                    ¡Sé Parte del Cambio!
                  </h2>
                  <p className="text-xs text-slate-300 font-medium mt-1.5 max-w-xs mx-auto">
                    Ingresa tus credenciales escolares para reportar misiones y ganar medallas hídricas.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="p-8 space-y-5">
                  {loginError && (
                    <motion.div
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-rose-50 border border-rose-200/50 p-3 text-rose-700 text-xs font-semibold rounded-xl flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </motion.div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Código del Estudiante (ID)
                    </label>
                    <div className="relative">
                      <input
                        id="yaku-id"
                        type="text"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="Ej. 1001 o DOCENTE"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-sm font-medium transition"
                      />
                      <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Contraseña Escolar (PIN)
                    </label>
                    <div className="relative">
                      <input
                        id="yaku-pin"
                        type="password"
                        value={userPin}
                        onChange={(e) => setUserPin(e.target.value)}
                        placeholder="••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-sm font-medium tracking-widest transition"
                      />
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  <button
                    id="btn-login-yaku"
                    type="submit"
                    disabled={authenticating}
                    className="w-full py-3 px-6 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm border border-teal-700 shadow-sm transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {authenticating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        <Droplet className="w-4 h-4 fill-white text-white" />
                        Ingresar al Manantial
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          ) : session.esDocente ? (
            /* VISTA DASHBOARD DOCENTE */
            <motion.div
              key="docente-dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Header de Docente */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/85 shadow-sm">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-3 py-1 rounded-full uppercase tracking-wider w-fit mb-2">
                    <Settings className="w-3.5 h-3.5 animate-spin" />
                    Panel del Administrador
                  </div>
                  <h2 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
                    👨‍🏫 PANEL DE CONTROL DOCENTE
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Supervisa misiones estudiantiles, revisa alertas de fugas y actualiza la multimedia semanal de la institución.
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowConfigPanel(!showConfigPanel)}
                    className="flex items-center gap-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer border border-slate-200"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Configurar Medios
                  </button>
                  <button
                    onClick={fetchTeacherData}
                    className="text-xs bg-teal-50 hover:bg-teal-100/60 text-teal-700 font-bold px-4 py-2.5 rounded-xl transition border border-teal-200/60 cursor-pointer shadow-sm"
                  >
                    🔄 Recargar Colas
                  </button>
                </div>
              </div>

              {/* Panel Configuración Medios Desplegable */}
              <AnimatePresence>
                {showConfigPanel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden bg-slate-50 border border-slate-250/80 rounded-2xl p-6 space-y-4 shadow-inner"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-slate-700" />
                      <h3 className="text-base font-bold text-slate-900 font-display">
                        📢 CONFIGURACIÓN DEL ESPACIO DE DIRECCIÓN Y VIDEO SEMANAL
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Define los enlaces multimedia para personalizar lo que los alumnos ven en su tablero de competencia.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                          URL de Imagen del Director
                        </label>
                        <input
                          type="text"
                          value={configDirectorUrl}
                          onChange={(e) => setConfigDirectorUrl(e.target.value)}
                          placeholder="Ej. https://images.unsplash.com/..."
                          className="w-full p-2.5 bg-white border border-slate-250 rounded-xl focus:outline-none text-xs font-medium focus:ring-1 focus:ring-teal-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                          URL de Video de YouTube / TikTok
                        </label>
                        <input
                          type="text"
                          value={configVideoUrl}
                          onChange={(e) => setConfigVideoUrl(e.target.value)}
                          placeholder="Ej. https://www.youtube.com/watch?v=..."
                          className="w-full p-2.5 bg-white border border-slate-250 rounded-xl focus:outline-none text-xs font-medium focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    <div className="bg-white/60 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between gap-4 mt-2">
                      <div className="space-y-0.5">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          🔒 Restricción de Avance Colectivo (Cuello de Botella)
                        </label>
                        <p className="text-[11px] text-slate-500 leading-normal">
                          Si está activado, los alumnos destacados no podrán avanzar de semana hasta que todo su salón complete y valide el reto previo. Desactívalo para permitir que cada alumno avance de forma individual sin bloqueos.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfigBloqueoColectivo(!configBloqueoColectivo)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          configBloqueoColectivo ? "bg-teal-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            configBloqueoColectivo ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/50">
                      <button
                        onClick={() => setShowConfigPanel(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg cursor-pointer transition border border-slate-200"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={saveMediaConfig}
                        disabled={updatingConfig}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg cursor-pointer transition shadow border border-teal-700 flex items-center gap-1"
                      >
                        {updatingConfig ? "Actualizando..." : "Guardar Cambios"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Colas de Trabajo: Evidencias y Alertas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* COLA IZQUIERDA: VALIDACIONES DE EVIDENCIAS */}
                <div id="cola-evidencias-docente" className="geom-glass-card p-6 space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg border border-teal-100">
                        <Award className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 font-display">
                          📥 EVIDENCIAS ESTUDIANTILES PENDIENTES
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                          Revisa las fotos de los retos subidos y otorga medallas.
                        </p>
                      </div>
                    </div>

                    {pendingRetos.length > 0 && (
                      <button
                        onClick={approveAllChallenges}
                        className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1.5 rounded-lg border border-teal-700 cursor-pointer transition shadow-sm"
                      >
                        ✔ Validar Todo ({pendingRetos.length})
                      </button>
                    )}
                  </div>

                  {loadingTeacherLists ? (
                    <div className="py-12 text-center text-slate-400 font-semibold space-y-2">
                      <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs">Cargando evidencias estudiantiles...</p>
                    </div>
                  ) : pendingRetos.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                      <CheckCircle className="w-10 h-10 text-teal-500 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-600">No hay misiones por validar</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Los estudiantes verán sus medallas al día.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                      {pendingRetos.map((ret: any) => (
                        <div
                          key={ret.id}
                          className="bg-slate-50/50 border border-slate-200/60 p-4 rounded-xl space-y-3 shadow-sm hover:border-teal-200 transition duration-150"
                        >
                          <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                            <div>
                              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                {ret.retoNombre}
                              </span>
                              <p className="text-xs text-slate-400 font-semibold mt-1">
                                Alumno: <span className="text-slate-700 font-bold">{ret.nombreAlumno}</span> (ID: {ret.idAlumno})
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(ret.fecha).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs text-slate-600 font-medium italic leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200/60">
                              "{ret.comentario}"
                            </p>
                            {ret.img && (
                              <img
                                src={getDirectImageUrl(ret.img)}
                                alt="Evidencia estudiante"
                                className="w-full max-h-48 object-cover rounded-lg border border-slate-200 shadow-sm"
                              />
                            )}
                          </div>

                          <button
                            onClick={() => approveChallenge(ret.id, ret.idAlumno, ret.semanaNum)}
                            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg border border-teal-700 shadow-sm cursor-pointer transition duration-150 flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Aprobar Acción y Otorgar Medalla (+15 pts)
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* COLA DERECHA: ALERTAS CRÍTICAS */}
                <div id="cola-alertas-docente" className="geom-glass-card p-6 space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-rose-50 text-rose-700 rounded-lg border border-rose-100">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 font-display flex items-center gap-1.5">
                          🚨 ALERTAS DE DESPERDICIO COLECTIVO
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                          Reportes enviados de forma anónima por los estudiantes.
                        </p>
                      </div>
                    </div>
                  </div>

                  {loadingTeacherLists ? (
                    <div className="py-12 text-center text-slate-400 font-semibold space-y-2">
                      <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs">Cargando alertas críticas...</p>
                    </div>
                  ) : pendingAlertas.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                      <CheckCircle className="w-10 h-10 text-teal-500 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-600">Todo en perfecto orden</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">No hay reportes de fugas ni desperdicio.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                      {pendingAlertas.map((al: any) => (
                        <div
                          key={al.id}
                          className="bg-rose-50/30 border border-rose-100/80 p-4 rounded-xl space-y-3 shadow-sm hover:border-rose-200/80 transition duration-150"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] bg-rose-100/80 text-rose-800 border border-rose-200/50 font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                                ALERTA ACTIVA
                              </span>
                              <p className="text-xs text-slate-500 font-semibold mt-1">
                                Reportado por: <span className="text-slate-700 font-bold">Anónimo (ID: {al.idAnonimo})</span>
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {al.fecha}
                            </span>
                          </div>

                          <div className="space-y-2 text-left">
                            <p className="text-xs text-slate-700 font-bold bg-white p-3 rounded-lg border border-rose-100/50 leading-relaxed border-l-4 border-l-rose-500 shadow-sm">
                              <span className="text-rose-600 font-semibold">Detalle:</span> {al.descripcion}
                            </p>
                            {al.img && (
                              <img
                                src={getDirectImageUrl(al.img)}
                                alt="Evidencia alerta"
                                className="w-full max-h-48 object-cover rounded-lg border border-rose-100/50 shadow-sm bg-white"
                              />
                            )}
                          </div>

                          <button
                            onClick={() => resolveAlert(al.id)}
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg border border-rose-700 shadow-sm cursor-pointer transition duration-150 flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            Marcar Reporte de Alerta como Solucionado
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Centro de estadísticas de competencia */}
              <div className="geom-glass-card p-6">
                <h3 className="font-bold text-lg text-slate-900 border-b border-slate-100 pb-3 font-display">
                  📊 VISTA DE CONTROL EN TIEMPO REAL DE LA ESCUELA
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                  {/* Ranking individual */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-teal-600" />
                      Líderes Escolares Individuales
                    </h4>
                    {dashboardData ? (
                      <div className="space-y-2">
                        {dashboardData.alumnos.slice(0, 8).map((al, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-200/50 rounded-xl hover:bg-white/80 transition duration-150"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-slate-400 font-mono w-5">
                                #{idx + 1}
                              </span>
                              <div>
                                <p className="text-xs font-bold text-slate-800">{al.nombre}</p>
                                <span className="text-[10px] text-slate-400 font-semibold">{al.salon} Grado</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-teal-700 bg-teal-50 border border-teal-100/60 px-2.5 py-1 rounded-lg">
                              {al.puntos} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Obteniendo información...</p>
                    )}
                  </div>

                  {/* Ranking salones */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-teal-600" />
                        Competencia de Grados Colectivos
                      </h4>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        Promedio por alumno (Igualitario)
                      </span>
                    </div>
                    {dashboardData ? (
                      <div className="space-y-2">
                        {dashboardData.salones.map((g: any, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-200/50 rounded-xl"
                          >
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <span className="text-sm">{g.medalla || "💧"}</span>
                                Grado {g.aula}
                              </span>
                              {g.totalAlumnos !== undefined && (
                                <p className="text-[10px] text-slate-400 font-medium pl-6">
                                  Total: {g.totalPuntos} pts / {g.totalAlumnos} alum.
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg">
                              {g.puntos} pts <span className="text-[9px] text-slate-400 font-normal">prom.</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Obteniendo información...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Sección de Sincronización Masiva con Google Sheets */}
              <div className="geom-glass-card p-6 mt-6 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 font-display uppercase tracking-wide">
                        📊 Control Global y Carga Masiva (Google Sheets)
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        Sincroniza alumnos de manera masiva importando desde una hoja pública o privada en Google Sheets.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Input Enlace Spreadsheet (SIEMPRE VISIBLE) */}
                <div className="space-y-3 bg-white/50 p-4 rounded-xl border border-slate-200/60">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      Enlace o ID de la Planilla Google Sheets:
                    </label>
                    <input
                      type="text"
                      value={spreadsheetUrl}
                      onChange={(e) => setSpreadsheetUrl(e.target.value)}
                      placeholder="Ej: https://docs.google.com/spreadsheets/d/e/2PACX-.../pubhtml o enlace normal..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono text-slate-700 shadow-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-500 leading-normal border-t border-slate-100 pt-3">
                    <div className="space-y-1 bg-emerald-50/45 p-2.5 rounded-lg border border-emerald-100/60 text-[10px]">
                      <span className="font-bold text-emerald-800 uppercase tracking-wider block">🔓 MÉTODO 1: CARGA PÚBLICA (RECOMENDADO EN EL VISOR)</span>
                      <p>
                        Si tu planilla está <strong>"Publicada en la Web"</strong> o tiene permisos de <strong>"Cualquier persona con el enlace puede ver"</strong>, puedes hacer clic en importar directamente sin iniciar sesión. ¡Funciona al instante dentro del visor!
                      </p>
                    </div>
                    <div className="space-y-1 bg-slate-100/60 p-2.5 rounded-lg border border-slate-200/60 text-[10px]">
                      <span className="font-bold text-slate-700 uppercase tracking-wider block">🔒 MÉTODO 2: CARGA PRIVADA / EXPORTACIÓN (REQUIERE LOGIN)</span>
                      <p>
                        Si tu planilla es privada, inicia sesión con Google abajo. Ten en cuenta que para iniciar sesión debes abrir la app en una pestaña nueva para evitar bloqueos del navegador.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sección de Autenticación de Google (Opcional pero visible para exportar o planillas privadas) */}
                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-200/60 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        Sesión de Cuenta de Google
                      </h4>
                      <p className="text-[10px] text-slate-400">Requerido solo para escribir en Excel (exportar) o leer planillas restringidas.</p>
                    </div>

                    {!googleToken ? (
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={sheetOperationLoading}
                        className="inline-flex items-center gap-1.5 text-[11px] bg-white hover:bg-slate-50 text-slate-700 font-bold px-3 py-1.5 rounded-lg border border-slate-250 shadow-sm transition active:scale-95 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.59 5.59 0 0 1 8.4 12.926a5.59 5.59 0 0 1 5.591-5.59c1.47 0 2.81.56 3.82 1.48l3.123-3.123C19.032 3.89 16.69 2.926 14 2.926 7.925 2.926 3 7.85 3 13.926S7.925 24.926 14 24.926c6.26 0 10.38-4.4 10.38-10.56 0-.61-.06-1.19-.17-1.74H12.24Z"/>
                        </svg>
                        Conectar Google
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                          🟢 {googleUser?.email}
                        </span>
                        <button
                          onClick={handleGoogleLogout}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-800 border border-rose-200 hover:border-rose-300 bg-white px-2 py-1 rounded cursor-pointer transition"
                        >
                          Salir ✕
                        </button>
                      </div>
                    )}
                  </div>

                  {isInIframe && !googleToken && (
                    <div className="p-3 bg-amber-50 border border-amber-200/50 rounded-lg text-amber-900 text-[10px] font-medium leading-relaxed">
                      ⚠️ <strong>Nota sobre el Visor (iFrame):</strong> Los navegadores modernos bloquean por seguridad los popups de Google dentro de iFrames. Para iniciar sesión y usar métodos privados, abre la plataforma en una pestaña nueva usando el icono de la esquina superior derecha del panel.
                    </div>
                  )}
                </div>

                {/* Botones de Operación (SIEMPRE DISPONIBLES) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <button
                    onClick={() => handleImportFromSheets("actualizar")}
                    disabled={sheetOperationLoading}
                    className="flex items-center justify-center gap-2 text-xs bg-white hover:bg-slate-50 text-emerald-700 font-bold p-3.5 rounded-xl border border-emerald-200 hover:border-emerald-400 transition shadow-sm cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-bold text-left">Fusionar Alumnos</div>
                      <div className="text-[9px] text-slate-400 font-normal">Suma nuevos y actualiza existentes</div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleImportFromSheets("reemplazar")}
                    disabled={sheetOperationLoading}
                    className="flex items-center justify-center gap-2 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold p-3.5 rounded-xl border border-emerald-200/60 transition shadow-sm cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <div>
                      <div className="font-bold text-left">Reemplazo Total</div>
                      <div className="text-[9px] text-emerald-600 font-normal">Sobrescribe la web con el Excel</div>
                    </div>
                  </button>

                  <button
                    onClick={handleExportToSheets}
                    disabled={sheetOperationLoading}
                    className="flex items-center justify-center gap-2 text-xs bg-teal-600 hover:bg-teal-700 text-white font-bold p-3.5 rounded-xl border border-teal-700 transition shadow-md cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-teal-100" />
                    <div>
                      <div className="font-bold text-left">Exportar a Excel</div>
                      <div className="text-[9px] text-teal-100 font-normal">Escribe la web en Google Sheets</div>
                    </div>
                  </button>
                </div>

                {/* Loading state message overlay */}
                {sheetOperationLoading && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 animate-pulse">
                    <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></div>
                    <span className="text-xs font-bold text-slate-600 font-mono">
                      {sheetStatusMsg || "Procesando operación en Google Sheets..."}
                    </span>
                  </div>
                )}
              </div>

              {/* Sección de Gestión y Registro de Alumnos */}
              <div className="geom-glass-card p-6 mt-6 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-sky-50 text-sky-700 rounded-lg border border-sky-100">
                      <Users className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 font-display">
                        👥 GESTIÓN Y REGISTRO DE LÍDERES YAKU
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        Agrega nuevos estudiantes, edita sus datos (ID, PIN, grado, puntos) o elimina cuentas.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={deleteAllStudents}
                      className="flex items-center gap-2 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-4 py-2.5 rounded-xl transition border border-rose-200 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      Vaciar Lista (Eliminar Todo)
                    </button>
                    <button
                      onClick={openAddStudentModal}
                      className="flex items-center gap-2 text-xs bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2.5 rounded-xl transition shadow border border-teal-700 cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Registrar Alumno Nuevo
                    </button>
                  </div>
                </div>

                {/* Filtro de búsqueda */}
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                  <span className="text-xs font-bold text-slate-500 shrink-0">Buscar Alumno:</span>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Escribe el nombre del alumno para filtrar..."
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  {studentSearch && (
                    <button
                      onClick={() => setStudentSearch("")}
                      className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer px-2"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {/* Tabla/Lista de alumnos */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        <th className="p-4">ID de Acceso</th>
                        <th className="p-4">PIN</th>
                        <th className="p-4">Nombre Completo</th>
                        <th className="p-4">Grado / Salón</th>
                        <th className="p-4">Puntaje</th>
                        <th className="p-4">Nivel Actual (Semana)</th>
                        <th className="p-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-xs font-medium text-slate-700">
                      {alumnosList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-400 font-semibold">
                            Cargando lista de alumnos o no hay registros...
                          </td>
                        </tr>
                      ) : (
                        alumnosList
                          .filter((al: any) =>
                            al.nombre.toLowerCase().includes(studentSearch.toLowerCase())
                          )
                          .map((al: any) => (
                            <tr key={al.id} className="hover:bg-slate-50/50 transition duration-100">
                              <td className="p-4 font-mono font-bold text-teal-700">{al.id}</td>
                              <td className="p-4 font-mono text-slate-500">{al.pin}</td>
                              <td className="p-4 font-bold text-slate-950">{al.nombre}</td>
                              <td className="p-4">
                                <span className="px-2 py-0.5 text-[10px] font-extrabold text-purple-700 bg-purple-50 border border-purple-100 rounded-full uppercase">
                                  {al.salon}
                                </span>
                              </td>
                              <td className="p-4 font-extrabold text-slate-800">{al.puntos} pts</td>
                              <td className="p-4 font-bold text-sky-700">
                                Semana {al.ultimoRetoValido || 0}
                              </td>
                              <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => openEditStudentModal(al)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:text-white hover:bg-teal-600 rounded-md border border-teal-200 hover:border-teal-700 transition cursor-pointer"
                                >
                                  Editar ✍
                                </button>
                                <button
                                  onClick={() => deleteStudent(al.id, al.nombre)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 rounded-md border border-rose-200 hover:border-rose-700 transition cursor-pointer"
                                >
                                  Eliminar 🗑
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : (
            /* VISTA DASHBOARD ALUMNO */
            <motion.div
              key="alumno-dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Bloqueo o Alerta Colectiva de Bottleneck */}
              {session.bloqueadoPorEquipo && (
                <div className="bg-rose-50/30 border border-rose-200/70 p-5 rounded-2xl flex items-start gap-4 shadow-sm animate-pulse">
                  <div className="p-3 bg-rose-100/80 text-rose-600 rounded-xl border border-rose-200/40 shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-rose-900 font-display text-sm uppercase tracking-wider">
                      🛑 Progreso Colectivo Pausado (Cuello de Botella)
                    </h4>
                    <p className="text-xs text-rose-700 leading-relaxed mt-1 font-medium">
                      ¡Felicidades, cumpliste tu misión! Para habilitar tu siguiente nivel hídrico, <strong>todos los compañeros de tu mismo grado ({session.salon})</strong> deben completar y validar el reto actual. ¡Motiva a tus amigos a subir sus fotos!
                    </p>
                  </div>
                </div>
              )}

              {/* Resumen del Perfil e Interfaz de Medallas */}
              <div className="geom-glass-card p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1 rounded-full uppercase tracking-wider">
                    Líder Guardián
                  </span>
                  <h3 className="text-xl font-bold font-display text-slate-900 mt-2">
                    {session.nombre}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-semibold">
                    <span>Grado: <span className="text-slate-700 font-bold">{session.salon}</span></span>
                    <span className="h-3 w-px bg-slate-200 hidden sm:inline" />
                    <span>Puntaje Acumulado: <span className="text-teal-600 font-bold">{session.puntos} pts</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowMedalsPanel(!showMedalsPanel)}
                    className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-amber-800 font-bold text-xs px-4 py-2.5 rounded-xl border border-amber-200 shadow-sm transition duration-150 cursor-pointer"
                  >
                    <Award className="w-4 h-4 text-amber-600" />
                    <span>{session.ultimoRetoValido || 0} Medallas Yaku</span>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showMedalsPanel ? "rotate-90" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Panel Desplegable de Medallas Reclamadas */}
              <AnimatePresence>
                {showMedalsPanel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden bg-slate-50 border border-amber-200 rounded-2xl p-6 shadow-inner"
                  >
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-4 font-display">
                      🎖️ Tus Medallas de Retos Concurridos ({session.ultimoRetoValido || 0})
                    </h4>
                    
                    {!session.ultimoRetoValido || session.ultimoRetoValido === 0 ? (
                      <p className="text-xs text-amber-800 font-semibold italic">
                        Aún no posees medallas validadas. ¡Envía tu primer reto y espera que tu supervisor lo apruebe!
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {Array.from({ length: session.ultimoRetoValido }).map((_, i) => {
                          const weekNum = i + 1;
                          const challenge = BANCO_RETOS[weekNum];
                          return (
                            <div
                              key={weekNum}
                              className="bg-white/80 border border-amber-200/60 p-3 rounded-xl shadow-sm flex items-start gap-2.5"
                            >
                              <div className="p-1 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
                                <Award className="w-3.5 h-3.5 text-amber-600" />
                              </div>
                              <div>
                                <span className="block text-[9px] text-amber-700 font-bold">Semana {weekNum}</span>
                                <span className="block text-xs font-bold text-slate-800 leading-tight mt-0.5">
                                  {challenge ? challenge.titulo : `Reto Semanal ${weekNum}`}
                                </span>
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-green-600 mt-1.5">
                                  <Check className="w-2.5 h-2.5" />
                                  Aprobado y Sumado
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navegación por Pestañas */}
              <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
                <button
                  id="tab-btn-home"
                  onClick={() => setActiveTab("home")}
                  className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider rounded-t-xl border-b-2 transition cursor-pointer shrink-0 ${
                    activeTab === "home"
                      ? "text-teal-700 border-teal-600 bg-white/70 backdrop-blur-md"
                      : "text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-200"
                  }`}
                >
                  Panel General
                </button>
                <button
                  id="tab-btn-ruta"
                  onClick={() => setActiveTab("ruta")}
                  className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider rounded-t-xl border-b-2 transition cursor-pointer shrink-0 ${
                    activeTab === "ruta"
                      ? "text-teal-700 border-teal-600 bg-white/70 backdrop-blur-md"
                      : "text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-200"
                  }`}
                >
                  🎯 Ruta Cooperativa (48 Retos)
                </button>
                <button
                  id="tab-btn-juego"
                  onClick={() => setActiveTab("juego")}
                  className={`px-5 py-3.5 text-xs font-bold uppercase tracking-wider rounded-t-xl border-b-2 transition cursor-pointer shrink-0 ${
                    activeTab === "juego"
                      ? "text-teal-700 border-teal-600 bg-white/70 backdrop-blur-md"
                      : "text-slate-400 border-transparent hover:text-slate-600 hover:border-slate-200"
                  }`}
                >
                  🎮 Hidro-Aventura
                </button>
              </div>

              {/* CONTENIDO DE PESTAÑAS */}
              <div className="min-h-[400px]">
                {activeTab === "home" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* COLUMNA CENTRAL + ACCIONES */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Widget Misión Asignada */}
                      <div className="bg-slate-950 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest bg-teal-500/20 text-teal-300 border border-teal-700/50 px-2.5 py-1 rounded-full">
                            Misión Activa de la Semana
                          </span>
                        </div>
                        
                        {activeChallenge ? (
                          <div className="space-y-4">
                            <div>
                              <h3 className="text-xl md:text-2xl font-bold font-display text-sky-200 tracking-tight leading-snug">
                                Reto {session.siguienteRetoNum}: {activeChallenge.titulo}
                              </h3>
                              <p className="text-xs text-slate-300 font-semibold mt-1">
                                Ubicación de la acción: <span className="text-teal-400 font-bold bg-teal-950/60 border border-teal-900/50 px-2.5 py-1 rounded-lg ml-1">{activeChallenge.lugar}</span>
                              </p>
                            </div>
                            
                            <p className="text-xs md:text-sm text-slate-200 leading-relaxed font-medium bg-white/5 p-4 rounded-xl border border-slate-800/80">
                              {activeChallenge.desc}
                            </p>

                            <button
                              onClick={() => {
                                if (!session.bloqueadoPorEquipo) {
                                  setActiveTab("ruta");
                                } else {
                                  showAlert("Tu nivel está bloqueado hasta que tus compañeros validen.", "warning");
                                }
                              }}
                              disabled={session.bloqueadoPorEquipo}
                              className={`w-full py-3 px-6 font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                session.bloqueadoPorEquipo
                                  ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                                  : "bg-teal-600 hover:bg-teal-700 text-white border border-teal-700"
                              }`}
                            >
                              {session.bloqueadoPorEquipo ? "🔒 Misión en Pausa" : "Enviar Evidencia de Hoy"}
                            </button>
                          </div>
                        ) : (
                          <div className="text-center py-6 space-y-2">
                            <span className="text-4xl">🏆</span>
                            <h3 className="text-xl font-bold font-display text-sky-200">
                              ¡Felicidades Yaku Líder Máximo!
                            </h3>
                            <p className="text-xs text-slate-300">
                              Completaste exitosamente las 48 semanas del juego o el banco está siendo actualizado. ¡Increíble!
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Competencia colectiva de grados */}
                      <div className="geom-glass-card p-6 space-y-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-teal-600" />
                          <h3 className="font-bold text-base text-slate-900 font-display">
                            🏫 COMPETENCIA COLECTIVA DE GRADOS (1° AL 5°)
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                          Puntaje promedio por alumno. Así la competencia es 100% justa e igualitaria, sin importar si un grado tiene más o menos integrantes. ¡Apoya a tu aula!
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                          {dashboardData?.salones.map((g: any, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-50/50 border border-slate-200/55 p-4 rounded-xl text-center space-y-1 hover:border-purple-200 hover:bg-white transition duration-150"
                            >
                              <span className="text-2xl block">{g.medalla || "💧"}</span>
                              <span className="block text-xs font-black text-slate-700">Grado {g.aula}</span>
                              <span className="block text-xs font-extrabold text-purple-700">
                                {g.puntos} pts <span className="text-[9px] text-slate-400 font-normal">prom.</span>
                              </span>
                              {g.totalAlumnos !== undefined && (
                                <span className="block text-[9px] text-slate-400 font-semibold bg-slate-100/50 py-0.5 px-1.5 rounded-md mt-1">
                                  Total: {g.totalPuntos} pts / {g.totalAlumnos} alum.
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recientes del manantial log */}
                      <div className="geom-glass-card p-6 space-y-4">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-teal-600" />
                          <h3 className="font-bold text-base text-slate-900 font-display">
                            📜 HISTORIAS DEL MANANTIAL
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 font-medium">
                          Acciones colectivas recientes aprobadas por los profesores.
                        </p>

                        <div className="space-y-2 pt-2">
                          {dashboardData && dashboardData.historial.length > 0 ? (
                            dashboardData.historial.map((h, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2.5 p-3 bg-teal-50/30 border border-teal-100/40 rounded-xl"
                              >
                                <span className="text-xs mt-0.5">🏅</span>
                                <p className="text-xs text-slate-700 font-medium">
                                  <strong>{h.alumno}</strong> completó con éxito la misión: <span className="italic text-slate-500 font-bold">"{h.mision}"</span>.
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 bg-slate-50/50 rounded-xl text-center text-xs text-slate-400 font-bold border border-slate-100">
                              💧 "Cuidar el agua es cuidar la vida" — Envía tu reto para comenzar el historial.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* COLUMNA DERECHA DEL TABLERO */}
                    <div className="space-y-6">
                      {/* Espacio del director */}
                      <div className="geom-glass-card p-5 text-center space-y-3 border-amber-200/50 bg-amber-50/20">
                        <h4 className="font-bold text-xs text-amber-800 uppercase tracking-widest font-display flex items-center justify-center gap-1">
                          📢 Espacio del Director
                        </h4>
                        
                        {dashboardData?.director?.urlMedia ? (
                          <img
                            src={getDirectImageUrl(dashboardData.director.urlMedia)}
                            className="w-full h-auto max-h-48 object-cover rounded-xl border border-amber-200/60 shadow-sm"
                            alt="Espacio del Director"
                          />
                        ) : (
                          <img
                            src="https://images.unsplash.com/photo-1548705085-101177834f47?w=500"
                            className="w-full h-auto max-h-48 object-cover rounded-xl border border-amber-200/60 shadow-sm"
                            alt="Espacio del Director default"
                          />
                        )}

                        <p className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-250/60 py-1.5 px-3 rounded-lg inline-block">
                          🎉 ¡Felicidades al salón ganador de esta semana!
                        </p>
                      </div>

                      {/* Video de la semana */}
                      <div className="geom-glass-card p-5 space-y-3">
                        <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Tv className="w-3.5 h-3.5 text-teal-600" />
                          🎬 Video de la Semana
                        </h4>

                        {dashboardData?.video ? (
                          <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-inner bg-slate-100 border border-slate-150">
                            <iframe
                              src={dashboardData.video}
                              className="absolute inset-0 w-full h-full border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl font-semibold border border-slate-150">
                            No hay video configurado esta semana.
                          </div>
                        )}
                      </div>

                      {/* Líderes Top Individual */}
                      <div className="geom-glass-card p-5 space-y-3">
                        <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-teal-600" />
                          🏆 Líderes Top Individual
                        </h4>

                        <div className="space-y-2">
                          {dashboardData ? (
                            dashboardData.alumnos.slice(0, 5).map((al, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-xs p-2.5 bg-slate-50/50 border border-slate-200/55 rounded-xl hover:bg-white transition"
                              >
                                <span className="font-bold text-slate-600">
                                  #{i + 1} {al.nombre} ({al.salon})
                                </span>
                                <span className="font-extrabold text-teal-700 bg-teal-50 border border-teal-100/50 px-2 py-0.5 rounded-lg text-[11px]">
                                  {al.puntos} pts
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400">Cargando ranking...</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "ruta" && (
                  <div className="max-w-2xl mx-auto">
                    {activeChallenge ? (
                      <div className="geom-glass-card p-6 md:p-8 space-y-6">
                        <div>
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1 rounded-full uppercase tracking-wider">
                            Formulario de Validación
                          </span>
                          <h2 className="text-xl font-bold font-display text-slate-900 tracking-tight mt-2.5">
                            RETO SEMANAL {session.siguienteRetoNum}: {activeChallenge.titulo}
                          </h2>
                          <p className="text-xs text-slate-400 font-bold mt-1">
                            Ubicación de la acción: <span className="text-teal-700 font-extrabold">{activeChallenge.lugar}</span>
                          </p>
                        </div>

                        <p className="text-xs md:text-sm text-slate-600 leading-relaxed font-medium bg-teal-50/30 border border-teal-100/40 p-4 rounded-xl">
                          {activeChallenge.desc}
                        </p>

                        <div className="space-y-4 pt-2 border-t border-slate-100">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                              📝 Tu Reseña o Bitácora (¿Qué aprendiste hoy?):
                            </label>
                            <textarea
                              value={evidenceComment}
                              onChange={(e) => setEvidenceComment(e.target.value)}
                              placeholder="Ej. Hoy cerré el caño mientras me enjuagaba los dientes, ahorré casi un vaso entero de agua!"
                              rows={3}
                              className="w-full p-3.5 bg-slate-50 border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-xs font-medium transition"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                              📸 Fotografía Obligatoria de tu Acción:
                            </label>
                            <div className="flex flex-col items-center justify-center border border-dashed border-slate-250 bg-slate-50/50 rounded-xl p-6 text-center hover:bg-slate-100/30 transition">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleEvidenceFileChange}
                                className="hidden"
                                id="evidence-file-uploader"
                              />
                              <label
                                htmlFor="evidence-file-uploader"
                                className="cursor-pointer flex flex-col items-center space-y-2"
                              >
                                <div className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-500 hover:text-teal-600">
                                  <Camera className="w-5 h-5 text-teal-600" />
                                </div>
                                <span className="text-xs font-bold text-slate-600">
                                  {evidenceFile ? evidenceFile.name : "Subir o Capturar Fotografía"}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  Formatos JPG, PNG. Máximo 10MB.
                                </span>
                              </label>
                            </div>
                            
                            {evidenceBase64 && (
                              <div className="pt-2">
                                <span className="text-[10px] font-bold text-slate-400 block mb-1">Vista Previa de Imagen:</span>
                                <img
                                  src={evidenceBase64}
                                  alt="Preview evidencia"
                                  className="w-full max-h-48 object-cover rounded-xl border border-slate-200 shadow-sm"
                                />
                              </div>
                            )}
                          </div>

                          <button
                            onClick={submitEvidence}
                            disabled={submittingEvidence || session.bloqueadoPorEquipo}
                            className={`w-full py-3 text-white font-bold text-xs rounded-xl shadow-md border border-teal-700 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              submittingEvidence || session.bloqueadoPorEquipo
                                ? "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed"
                                : "bg-teal-600 hover:bg-teal-700"
                            }`}
                          >
                            {submittingEvidence ? "Subiendo..." : "Subir Evidencia Oficial"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="geom-glass-card p-8 text-center space-y-4">
                        <span className="text-4xl">👑</span>
                        <h2 className="text-xl font-bold text-slate-900 font-display">
                          ¡COMPLETaste toda la ruta de retos!
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                          Tu supervisor docente validará tus últimas medallas muy pronto. ¡Gracias por liderar el ahorro de agua!
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "juego" && (
                  <HidroAventuraGame session={session} />
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* BOTÓN FLOTANTE ALERTA HÍDRICA (SIEMPRE DISPONIBLE PARA USUARIOS AUTENTICADOS) */}
      {session && (
        <button
          onClick={() => setShowAlertModal(true)}
          title="Reportar desperdicio o fuga de agua"
          className="fixed bottom-6 right-6 w-14 h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg border border-rose-700 hover:scale-[1.03] active:scale-95 transition duration-150 cursor-pointer z-40 flex items-center justify-center"
        >
          <AlertCircle className="w-6 h-6 text-white" />
        </button>
      )}

      {/* OVERLAY MODAL ALERTA HÍDRICA ANÓNIMA */}
      <AnimatePresence>
        {showAlertModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200/80"
            >
              <div className="bg-rose-600 text-white p-6 text-center space-y-1 relative border-b border-rose-700/30">
                <span className="text-3xl">🚨</span>
                <h3 className="text-lg font-bold font-display uppercase tracking-wide">
                  Reportar Alerta Hídrica
                </h3>
                <p className="text-[11px] text-rose-100">
                  ¿Detectaste una fuga o desperdicio de agua? Envía un reporte anónimo con descripción física y foto de evidencia.
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    ¿Qué sucede? (Descripción):
                  </label>
                  <textarea
                    value={alertDesc}
                    onChange={(e) => setAlertDesc(e.target.value)}
                    placeholder="Ej. Caño roto goteando en el baño del segundo piso..."
                    rows={3}
                    className="w-full p-3 bg-slate-50 border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 focus:bg-white text-xs font-medium transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Capturar / Subir Foto:
                  </label>
                  <div className="flex flex-col items-center justify-center border border-dashed border-slate-250 bg-slate-50/50 rounded-xl p-4 text-center hover:bg-slate-100/30 transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAlertFileChange}
                      className="hidden"
                      id="alert-file-uploader"
                    />
                    <label
                      htmlFor="alert-file-uploader"
                      className="cursor-pointer flex flex-col items-center space-y-1.5"
                    >
                      <Camera className="w-5 h-5 text-slate-500 hover:text-rose-600" />
                      <span className="text-[11px] font-bold text-slate-600">
                        {alertFile ? alertFile.name : "Seleccionar Fotografía"}
                      </span>
                    </label>
                  </div>
                  
                  {alertBase64 && (
                    <div className="pt-1.5">
                      <img
                        src={alertBase64}
                        alt="Preview Alerta"
                        className="w-full max-h-32 object-cover rounded-xl border border-slate-200 shadow-inner"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowAlertModal(false);
                      setAlertDesc("");
                      setAlertFile(null);
                      setAlertBase64("");
                    }}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer transition border border-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={submitWaterAlert}
                    disabled={submittingAlert}
                    className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer transition flex items-center justify-center gap-1 shadow-sm border border-rose-700"
                  >
                    {submittingAlert ? "Enviando..." : "Enviar Reporte"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OVERLAY MODAL REGISTRO/EDICIÓN DE ALUMNO */}
      <AnimatePresence>
        {showStudentModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200/80"
            >
              <div className="bg-teal-600 text-white p-6 text-center space-y-1 relative border-b border-teal-700/30">
                <span className="text-3xl">👥</span>
                <h3 className="text-lg font-bold font-display uppercase tracking-wide">
                  {editingAlumno ? "Editar Alumno / Líder" : "Registrar Alumno Nuevo"}
                </h3>
                <p className="text-[11px] text-teal-100">
                  {editingAlumno ? `Editando credenciales y estado del alumno ID: ${editingAlumno.id}` : "Crea una nueva cuenta estudiantil para el acceso autónomo."}
                </p>
              </div>

              <form onSubmit={saveStudent} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Nombre Completo:
                  </label>
                  <input
                    type="text"
                    required
                    value={studentFormName}
                    onChange={(e) => setStudentFormName(e.target.value)}
                    placeholder="Ej. Camila Quispe Flores"
                    className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-xs font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Grado / Salón:
                    </label>
                    <select
                      value={studentFormGrade}
                      onChange={(e) => setStudentFormGrade(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-xs font-semibold text-slate-750"
                    >
                      <option value="Primero">Primero</option>
                      <option value="Segundo">Segundo</option>
                      <option value="Tercero">Tercero</option>
                      <option value="Cuarto">Cuarto</option>
                      <option value="Quinto">Quinto</option>
                      <option value="Sexto">Sexto</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      PIN de Acceso (4 dígitos):
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={studentFormPin}
                      onChange={(e) => setStudentFormPin(e.target.value)}
                      placeholder="Ej. 1234"
                      className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Puntaje Acumulado:
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={studentFormPoints}
                      onChange={(e) => setStudentFormPoints(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Último Reto Validado (Semana):
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={48}
                      value={studentFormWeek}
                      onChange={(e) => setStudentFormWeek(parseInt(e.target.value, 10) || 0)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowStudentModal(false)}
                    className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer transition border border-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingStudent}
                    className="w-1/2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer transition flex items-center justify-center gap-1 shadow-sm border border-teal-700"
                  >
                    {savingStudent ? "Guardando..." : "Guardar Alumno"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CONFIRMACIÓN CUSTOMIZADO */}
      <AnimatePresence>
        {confirmPromise && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
            >
              <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-amber-600">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">
                    {confirmPromise.title}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Requiere confirmación del sistema</p>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <p className="text-xs text-slate-600 font-semibold leading-relaxed whitespace-pre-line bg-slate-50/50 p-4 rounded-xl border border-slate-100 shadow-inner">
                  {confirmPromise.message}
                </p>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => {
                      confirmPromise.resolve(false);
                      setConfirmPromise(null);
                    }}
                    className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer transition border border-slate-200"
                  >
                    No, Cancelar
                  </button>
                  <button
                    onClick={() => {
                      confirmPromise.resolve(true);
                      setConfirmPromise(null);
                    }}
                    className="w-1/2 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer transition shadow-md border border-teal-700 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Sí, Continuar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST DE NOTIFICACIÓN CUSTOMIZADO */}
      <AnimatePresence>
        {notification && notification.show && (
          <div className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full p-4 md:p-0 font-sans">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3.5 backdrop-blur-md ${
                notification.type === "success"
                  ? "bg-emerald-50/95 border-emerald-200 text-emerald-950"
                  : notification.type === "error"
                  ? "bg-rose-50/95 border-rose-200 text-rose-950"
                  : notification.type === "warning"
                  ? "bg-amber-50/95 border-amber-200 text-amber-950"
                  : "bg-slate-50/95 border-slate-200 text-slate-950"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {notification.type === "success" && (
                  <div className="w-7 h-7 bg-emerald-100 border border-emerald-200 rounded-lg flex items-center justify-center text-emerald-600 text-xs font-bold shadow-sm">
                    ✓
                  </div>
                )}
                {notification.type === "error" && (
                  <div className="w-7 h-7 bg-rose-100 border border-rose-200 rounded-lg flex items-center justify-center text-rose-600 text-xs font-bold shadow-sm">
                    ✕
                  </div>
                )}
                {notification.type === "warning" && (
                  <div className="w-7 h-7 bg-amber-100 border border-amber-200 rounded-lg flex items-center justify-center text-amber-600 text-xs font-bold shadow-sm">
                    ⚠
                  </div>
                )}
                {notification.type === "info" && (
                  <div className="w-7 h-7 bg-sky-100 border border-sky-200 rounded-lg flex items-center justify-center text-sky-600 text-xs font-bold shadow-sm">
                    ℹ
                  </div>
                )}
              </div>
              <div className="space-y-0.5 flex-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">{notification.title}</h4>
                <p className="text-[11px] font-medium leading-relaxed opacity-95 whitespace-pre-line text-slate-600">{notification.message}</p>
              </div>
              <button
                onClick={() => setNotification(prev => prev ? { ...prev, show: false } : null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer bg-slate-100/50 hover:bg-slate-100 rounded-lg"
              >
                ✕
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
