import express from "express";
import path from "path";
import fs from "fs";


const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

// Default initial data
const defaultDb = {
  alumnos: [
    { id: "1001", pin: "1111", nombre: "Mateo Huamán", salon: "Primero", puntos: 45, ultimoRetoValido: 3 },
    { id: "1002", pin: "2222", nombre: "Camila Quispe", salon: "Primero", puntos: 30, ultimoRetoValido: 2 },
    { id: "2001", pin: "1234", nombre: "Liam Flores", salon: "Segundo", puntos: 60, ultimoRetoValido: 4 },
    { id: "2002", pin: "5678", nombre: "Sofia Condori", salon: "Segundo", puntos: 45, ultimoRetoValido: 3 },
    { id: "3001", pin: "1111", nombre: "Lucas Mamani", salon: "Tercero", puntos: 15, ultimoRetoValido: 1 },
    { id: "3002", pin: "2222", nombre: "Valentina Mendoza", salon: "Tercero", puntos: 30, ultimoRetoValido: 2 },
    { id: "4001", pin: "1234", nombre: "Thiago Ramos", salon: "Cuarto", puntos: 75, ultimoRetoValido: 5 },
    { id: "5001", pin: "1111", nombre: "Emma Castelo", salon: "Quinto", puntos: 90, ultimoRetoValido: 6 }
  ],
  retos: [
    {
      id: "r1",
      fecha: new Date().toISOString(),
      idAlumno: "1002",
      nombreAlumno: "Camila Quispe",
      retoNombre: "Reto 3: Inspección de fugas en casa",
      semanaNum: 3,
      comentario: "Revisé los caños del baño y la cocina con mi papá. Encontramos que el caño de la lavandería goteaba un poco, así que le cambiamos el empaque para que ya no gotee.",
      img: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400",
      estado: "Pendiente de Validación"
    },
    {
      id: "r2",
      fecha: new Date().toISOString(),
      idAlumno: "3001",
      nombreAlumno: "Lucas Mamani",
      retoNombre: "Reto 2: Guardián de los caños del colegio",
      semanaNum: 2,
      comentario: "Hoy revisé los caños del patio de primaria durante el recreo y me aseguré de cerrar uno que un compañero había dejado goteando.",
      img: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400",
      estado: "Pendiente de Validación"
    }
  ],
  alertas: [
    {
      id: "a1",
      fecha: new Date().toISOString(),
      idAnonimo: "1001",
      estado: "Pendiente de Validación",
      descripcion: "Fuga severa de agua en el caño exterior del biohuerto de primaria. Está goteando constantemente y formando un charco grande.",
      img: "https://images.unsplash.com/photo-1508138221679-760a23a2285b?w=400"
    }
  ],
  director: {
    urlMedia: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800"
  },
  video: "https://www.youtube.com/embed/gAnMco8LhK4"
};

// Database utility functions
function loadDb() {
  return defaultDb;
}

function saveDb(data: any) {
  return;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" })); // allow large base64 uploads

  // 1. Verify User credentials and compute active week
  app.post("/api/verificar-usuario", (req, res) => {
    const { id, pin } = req.body;
    if (!id || !pin) {
      return res.status(400).json({ exito: false, mensaje: "ID y PIN requeridos" });
    }

    const trimmedId = id.toString().trim().toUpperCase();
    const trimmedPin = pin.toString().trim();

    if (trimmedId === "DOCENTE" && trimmedPin === "01234") {
      return res.json({ exito: true, esDocente: true, nombre: "Profesor Supervisor" });
    }

    const db = loadDb();
    const alumno = db.alumnos.find(
      (a: any) => a.id.toString().trim() === id.toString().trim() && a.pin.toString().trim() === trimmedPin
    );

    if (!alumno) {
      return res.json({ exito: false, mensaje: "ID o PIN incorrectos." });
    }

    // Determine cooperative bottleneck
    const bloqueoColectivoHabilitado = db.bloqueoColectivo !== false;

    let limiteAlumno = alumno.ultimoRetoValido + 1;
    let bloqueadoPorEquipo = false;

    if (bloqueoColectivoHabilitado) {
      const grade = alumno.salon;
      const gradeStudents = db.alumnos.filter((a: any) => a.salon === grade);
      
      // Filter to active students who have points or have completed at least one challenge,
      // preventing new/inactive accounts from locking the entire grade.
      const activeStudents = gradeStudents.filter((a: any) => (Number(a.puntos) > 0 || Number(a.ultimoRetoValido) > 0));
      const totalAlumnosGrado = activeStudents.length || 1;

      // Count how many validated tasks each week has for this grade
      const completedByGradeAndChallenge: Record<number, number> = {};
      gradeStudents.forEach((stud: any) => {
        const maxVal = stud.ultimoRetoValido || 0;
        for (let w = 1; w <= maxVal; w++) {
          completedByGradeAndChallenge[w] = (completedByGradeAndChallenge[w] || 0) + 1;
        }
      });

      let semanaCooperativaActiva = 1;
      for (let s = 1; s <= 48; s++) {
        const readyCount = completedByGradeAndChallenge[s] || 0;
        if (readyCount >= totalAlumnosGrado) {
          semanaCooperativaActiva = s + 1;
        } else {
          break;
        }
      }

      limiteAlumno = Math.min(alumno.ultimoRetoValido + 1, semanaCooperativaActiva);
      bloqueadoPorEquipo = alumno.ultimoRetoValido >= semanaCooperativaActiva;
    }

    return res.json({
      exito: true,
      esDocente: false,
      id: alumno.id,
      nombre: alumno.nombre,
      salon: alumno.salon,
      puntos: alumno.puntos,
      ultimoRetoValido: alumno.ultimoRetoValido,
      siguienteRetoNum: limiteAlumno,
      bloqueadoPorEquipo
    });
  });

  // 2. Submit Challenge Evidence
  app.post("/api/enviar-evidencia", (req, res) => {
    const { idAlumno, nombreAlumno, semanaNum, retoNombre, comentario, img } = req.body;
    if (!idAlumno || !nombreAlumno || !semanaNum || !retoNombre || !comentario || !img) {
      return res.status(400).json({ exito: false, mensaje: "Campos incompletos para subir la evidencia" });
    }

    const db = loadDb();
    const newChallenge = {
      id: "r" + (db.retos.length + 1) + "_" + Date.now(),
      fecha: new Date().toISOString(),
      idAlumno,
      nombreAlumno,
      retoNombre: `Reto ${semanaNum}: ${retoNombre}`,
      semanaNum: Number(semanaNum),
      comentario,
      img,
      estado: "Pendiente de Validación"
    };

    db.retos.push(newChallenge);
    saveDb(db);

    return res.json({ exito: true, mensaje: "¡Evidencia enviada! El manantial ha recibido tu aporte." });
  });

  // 3. Get Global Dashboard Data
  app.get("/api/datos-globales", (req, res) => {
    const db = loadDb();

    // Accumulate points and student counts by grade
    const acumuladorGrados: Record<string, number> = {
      "Primero": 0, "Segundo": 0, "Tercero": 0, "Cuarto": 0, "Quinto": 0
    };
    const contadorGrados: Record<string, number> = {
      "Primero": 0, "Segundo": 0, "Tercero": 0, "Cuarto": 0, "Quinto": 0
    };

    const listaAlumnos = db.alumnos.map((a: any) => {
      const pts = Number(a.puntos) || 0;
      if (acumuladorGrados.hasOwnProperty(a.salon)) {
        acumuladorGrados[a.salon] += pts;
        contadorGrados[a.salon] += 1;
      }
      return { nombre: a.nombre, salon: a.salon, puntos: pts };
    });

    // Sort individuals
    listaAlumnos.sort((a: any, b: any) => b.puntos - a.puntos);

    // Build grades list using average points per student for a fair competition
    const listaGrados = Object.keys(acumuladorGrados).map((key) => {
      const alumnosCount = contadorGrados[key] || 0;
      const puntosTotales = acumuladorGrados[key];
      const promedio = alumnosCount > 0 ? Math.round((puntosTotales / alumnosCount) * 10) / 10 : 0;
      return { 
        aula: key, 
        puntos: promedio, 
        medalla: "", 
        totalAlumnos: alumnosCount, 
        totalPuntos: puntosTotales 
      };
    });

    listaGrados.sort((a: any, b: any) => b.puntos - a.puntos);
    if (listaGrados[0] && listaGrados[0].puntos > 0) listaGrados[0].medalla = "🥇";
    if (listaGrados[1] && listaGrados[1].puntos > 0) listaGrados[1].medalla = "🥈";
    if (listaGrados[2] && listaGrados[2].puntos > 0) listaGrados[2].medalla = "🥉";

    // Get 6 most recent validated challenges for "el manantial" log
    const validados = db.retos
      .filter((r: any) => r.estado === "Validado")
      .sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 6)
      .map((r: any) => ({
        alumno: r.nombreAlumno,
        mision: r.retoNombre
      }));

    return res.json({
      salones: listaGrados,
      alumnos: listaAlumnos,
      historial: validados,
      director: db.director || { urlMedia: "" },
      video: db.video || "",
      bloqueoColectivo: db.bloqueoColectivo !== false
    });
  });

  // 4. Get Pending Challenges for Teacher
  app.get("/api/docente/retos-pendientes", (req, res) => {
    const db = loadDb();
    const pendientes = db.retos
      .filter((r: any) => r.estado === "Pendiente de Validación")
      .map((r: any) => ({
        id: r.id,
        idAlumno: r.idAlumno,
        nombreAlumno: r.nombreAlumno,
        retoNombre: r.retoNombre,
        semanaNum: r.semanaNum,
        comentario: r.comentario,
        img: r.img,
        fecha: r.fecha
      }));
    return res.json(pendientes);
  });

  // 5. Validate Individual Challenge
  app.post("/api/docente/validar-reto", (req, res) => {
    const { idReto, idAlumno, semanaNum } = req.body;
    if (!idReto || !idAlumno || !semanaNum) {
      return res.status(400).json({ exito: false, mensaje: "Parámetros incompletos para validar" });
    }

    const db = loadDb();
    const challengeIndex = db.retos.findIndex((r: any) => r.id === idReto);
    if (challengeIndex !== -1) {
      db.retos[challengeIndex].estado = "Validado";
    }

    const alumno = db.alumnos.find((a: any) => a.id.toString().trim() === idAlumno.toString().trim());
    if (alumno) {
      alumno.puntos = (alumno.puntos || 0) + 15;
      const semanaPrevia = Number(alumno.ultimoRetoValido) || 0;
      if (Number(semanaNum) > semanaPrevia) {
        alumno.ultimoRetoValido = Number(semanaNum);
      }
      saveDb(db);
      return res.json({ exito: true });
    }

    return res.json({ exito: false, mensaje: "Alumno no encontrado" });
  });

  // 6. Validate all pending challenges
  app.post("/api/docente/validar-todos", (req, res) => {
    const db = loadDb();
    let valificadosContador = 0;

    db.retos.forEach((r: any) => {
      if (r.estado === "Pendiente de Validación") {
        r.estado = "Validado";
        valificadosContador++;

        const alumno = db.alumnos.find((a: any) => a.id.toString().trim() === r.idAlumno.toString().trim());
        if (alumno) {
          alumno.puntos = (alumno.puntos || 0) + 15;
          const semanaPrevia = Number(alumno.ultimoRetoValido) || 0;
          if (r.semanaNum > semanaPrevia) {
            alumno.ultimoRetoValido = r.semanaNum;
          }
        }
      }
    });

    saveDb(db);
    return res.json({ exito: true, mensaje: `Se han validado ${valificadosContador} evidencias con éxito.` });
  });

  // 7. Register Anonymous Alert
  app.post("/api/registrar-alerta", (req, res) => {
    const { idAlumno, descripcion, img } = req.body;
    if (!descripcion || !img) {
      return res.status(400).json({ exito: false, mensaje: "Descripción y fotografía requeridas." });
    }

    const db = loadDb();
    const idIdentificador = idAlumno && idAlumno.toString().trim() !== "" ? idAlumno.toString().trim() : "Anónimo";

    const newAlert = {
      id: "al_" + Date.now(),
      fecha: new Date().toISOString(),
      idAnonimo: idIdentificador,
      estado: "Pendiente de Validación",
      descripcion,
      img
    };

    if (!db.alertas) db.alertas = [];
    db.alertas.push(newAlert);
    saveDb(db);

    return res.json({ exito: true, mensaje: "🚨 ¡Alerta hídrica reportada con éxito de forma anónima!" });
  });

  // 8. Get Pending Alerts for Teacher
  app.get("/api/docente/alertas-pendientes", (req, res) => {
    const db = loadDb();
    const alertas = (db.alertas || [])
      .filter((a: any) => a.estado === "Pendiente de Validación")
      .map((a: any) => ({
        id: a.id,
        idAnonimo: a.idAnonimo,
        estado: a.estado,
        descripcion: a.descripcion || "Sin descripción.",
        fecha: new Date(a.fecha).toLocaleString("es-PE", { hour12: false }),
        img: a.img
      }));
    return res.json(alertas);
  });

  // 9. Validate/Archive Alert
  app.post("/api/docente/validar-alerta", (req, res) => {
    const { idAlerta } = req.body;
    if (!idAlerta) {
      return res.status(400).json({ exito: false, mensaje: "Id de alerta requerido" });
    }

    const db = loadDb();
    const alertIndex = db.alertas.findIndex((a: any) => a.id === idAlerta);
    if (alertIndex !== -1) {
      db.alertas[alertIndex].estado = "Validado";
      saveDb(db);
      return res.json({ exito: true });
    }

    return res.json({ exito: false, mensaje: "Alerta no encontrada" });
  });

  // 10. Update Configurations (Director image, Weekly video, and custom resets)
  app.post("/api/docente/actualizar-config", (req, res) => {
    const { urlMedia, videoUrl, bloqueoColectivo } = req.body;
    const db = loadDb();

    if (urlMedia !== undefined) {
      db.director = { urlMedia };
    }
    if (videoUrl !== undefined) {
      let finalVideo = videoUrl;
      if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
        const ytID = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        if (ytID && ytID[1]) finalVideo = "https://www.youtube.com/embed/" + ytID[1];
      } else if (videoUrl.includes("tiktok.com")) {
        const tkID = videoUrl.match(/video\/(\d+)/);
        if (tkID && tkID[1]) finalVideo = "https://www.tiktok.com/embed/v2/" + tkID[1];
      }
      db.video = finalVideo;
    }
    if (bloqueoColectivo !== undefined) {
      db.bloqueoColectivo = bloqueoColectivo;
    }

    saveDb(db);
    return res.json({ exito: true, mensaje: "Configuraciones actualizadas con éxito" });
  });

  // 11. Get Full Alumnos List (with PINs and levels for Teacher management)
  app.get("/api/docente/alumnos", (req, res) => {
    const db = loadDb();
    return res.json(db.alumnos || []);
  });

  // 12. Create New Student
  app.post("/api/docente/crear-alumno", (req, res) => {
    const { nombre, salon, pin, puntos, ultimoRetoValido } = req.body;
    if (!nombre || !salon || !pin) {
      return res.status(400).json({ exito: false, mensaje: "Nombre, salón y PIN son requeridos." });
    }

    const db = loadDb();
    
    // Generate new unique ID
    let maxId = 1000;
    db.alumnos.forEach((a: any) => {
      const parsed = parseInt(a.id, 10);
      if (!isNaN(parsed) && parsed > maxId) {
        maxId = parsed;
      }
    });
    const nextId = (maxId + 1).toString();

    const nuevoAlumno = {
      id: nextId,
      pin: pin.toString().trim(),
      nombre: nombre.trim(),
      salon,
      puntos: Number(puntos) || 0,
      ultimoRetoValido: Number(ultimoRetoValido) || 0
    };

    db.alumnos.push(nuevoAlumno);
    saveDb(db);

    return res.json({ exito: true, mensaje: "Alumno creado con éxito.", alumno: nuevoAlumno });
  });

  // 13. Edit Existing Student
  app.post("/api/docente/editar-alumno", (req, res) => {
    const { id, nombre, salon, pin, puntos, ultimoRetoValido } = req.body;
    if (!id || !nombre || !salon || !pin) {
      return res.status(400).json({ exito: false, mensaje: "Campos requeridos incompletos." });
    }

    const db = loadDb();
    const alumno = db.alumnos.find((a: any) => a.id.toString().trim() === id.toString().trim());
    if (!alumno) {
      return res.status(404).json({ exito: false, mensaje: "Alumno no encontrado." });
    }

    alumno.nombre = nombre.trim();
    alumno.salon = salon;
    alumno.pin = pin.toString().trim();
    alumno.puntos = Number(puntos) || 0;
    alumno.ultimoRetoValido = Number(ultimoRetoValido) || 0;

    saveDb(db);
    return res.json({ exito: true, mensaje: "Alumno actualizado con éxito.", alumno });
  });

  // 14. Delete Student
  app.post("/api/docente/eliminar-alumno", (req, res) => {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ exito: false, mensaje: "ID del alumno es requerido." });
    }

    const db = loadDb();
    const index = db.alumnos.findIndex((a: any) => a.id.toString().trim() === id.toString().trim());
    if (index === -1) {
      return res.status(404).json({ exito: false, mensaje: "Alumno no encontrado." });
    }

    db.alumnos.splice(index, 1);
    saveDb(db);

    return res.json({ exito: true, mensaje: "Alumno eliminado con éxito." });
  });

  // 14.5. Delete All Students (Bulk Clear)
  app.post("/api/docente/eliminar-todos-alumnos", (req, res) => {
    const db = loadDb();
    db.alumnos = [];
    saveDb(db);
    return res.json({ exito: true, mensaje: "Se han eliminado todos los alumnos de la base de datos." });
  });

  // 15. Bulk Import / Overwrite Students List
  app.post("/api/docente/importar-alumnos-lote", (req, res) => {
    const { alumnos, modo } = req.body; // modo: "reemplazar" o "actualizar"
    if (!Array.isArray(alumnos)) {
      return res.status(400).json({ exito: false, mensaje: "Se requiere un arreglo de alumnos." });
    }

    const db = loadDb();
    
    if (modo === "reemplazar") {
      db.alumnos = alumnos.map((al: any, index: number) => {
        const id = al.id ? al.id.toString().trim() : (1001 + index).toString();
        return {
          id,
          pin: al.pin ? al.pin.toString().trim() : "1234",
          nombre: al.nombre ? al.nombre.trim() : `Alumno ${id}`,
          salon: al.salon ? al.salon.trim() : "Primero",
          puntos: Number(al.puntos) || 0,
          ultimoRetoValido: Number(al.ultimoRetoValido) || 0
        };
      });
    } else {
      // "actualizar" (upsert mode)
      alumnos.forEach((al: any) => {
        if (!al.nombre) return; // skip rows without name
        
        let alumnoExistente = null;
        if (al.id) {
          alumnoExistente = db.alumnos.find((a: any) => a.id.toString().trim() === al.id.toString().trim());
        } else {
          alumnoExistente = db.alumnos.find((a: any) => a.nombre.toLowerCase().trim() === al.nombre.toLowerCase().trim());
        }

        if (alumnoExistente) {
          if (al.pin) alumnoExistente.pin = al.pin.toString().trim();
          if (al.salon) alumnoExistente.salon = al.salon.trim();
          if (al.puntos !== undefined) alumnoExistente.puntos = Number(al.puntos) || 0;
          if (al.ultimoRetoValido !== undefined) alumnoExistente.ultimoRetoValido = Number(al.ultimoRetoValido) || 0;
          if (al.nombre) alumnoExistente.nombre = al.nombre.trim();
        } else {
          // generate new ID
          let maxId = 1000;
          db.alumnos.forEach((a: any) => {
            const parsed = parseInt(a.id, 10);
            if (!isNaN(parsed) && parsed > maxId) {
              maxId = parsed;
            }
          });
          const nextId = (maxId + 1).toString();
          
          db.alumnos.push({
            id: al.id ? al.id.toString().trim() : nextId,
            pin: al.pin ? al.pin.toString().trim() : "1234",
            nombre: al.nombre.trim(),
            salon: al.salon ? al.salon.trim() : "Primero",
            puntos: Number(al.puntos) || 0,
            ultimoRetoValido: Number(al.ultimoRetoValido) || 0
          });
        }
      });
    }

    saveDb(db);
    return res.json({ exito: true, mensaje: "Importación masiva completada con éxito.", alumnosCount: db.alumnos.length });
  });

  // Vite middleware setup for development, or serving compiled static build files in production
  if (process.env.NODE_ENV !== "production") {
    //const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    //app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
