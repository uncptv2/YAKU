export interface Alumno {
  id: string;
  pin: string;
  nombre: string;
  salon: "Primero" | "Segundo" | "Tercero" | "Cuarto" | "Quinto";
  puntos: number;
  ultimoRetoValido: number;
}

export interface RetoEvidencia {
  id: string;
  fecha: string;
  idAlumno: string;
  nombreAlumno: string;
  retoNombre: string;
  semanaNum: number;
  comentario: string;
  img: string;
  estado: "Pendiente de Validación" | "Validado";
}

export interface Alerta {
  id: string;
  fecha: string;
  idAnonimo: string;
  estado: "Pendiente de Validación" | "Validado";
  descripcion: string;
  img: string;
}

export interface DashboardData {
  salones: {
    aula: string;
    puntos: number;
    medalla: string;
  }[];
  alumnos: {
    nombre: string;
    salon: string;
    puntos: number;
  }[];
  historial: {
    alumno: string;
    mision: string;
  }[];
  director: {
    urlMedia: string;
  };
  video: string;
}

export interface UserSession {
  exito: boolean;
  esDocente: boolean;
  id?: string;
  nombre?: string;
  salon?: "Primero" | "Segundo" | "Tercero" | "Cuarto" | "Quinto";
  puntos?: number;
  ultimoRetoValido?: number;
  siguienteRetoNum?: number;
  bloqueadoPorEquipo?: boolean;
}
