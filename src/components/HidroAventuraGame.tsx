import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Droplet, Check, Award } from "lucide-react";
import { BANCO_RETOS } from "../data";
import { UserSession } from "../types";

interface HidroAventuraGameProps {
  session: UserSession;
}

interface SanctuaryDecoration {
  id: string;
  name: string;
  emoji: string;
  cost: number;
}

const DECORATIONS: SanctuaryDecoration[] = [
  { id: "vicuna", name: "Vicuña Andina 🦙", emoji: "🦙", cost: 30 },
  { id: "rana", name: "Rana del Titicaca 🐸", emoji: "🐸", cost: 20 },
  { id: "condor", name: "Cóndor de los Andes 🦅", emoji: "🦅", cost: 40 },
  { id: "flor", name: "Flor de Amancay 🌼", emoji: "🌼", cost: 10 },
  { id: "quena", name: "Árbol de Queñua 🌳", emoji: "🌳", cost: 15 },
  { id: "filtro", name: "Filtro Purificador 🌀", emoji: "🌀", cost: 25 },
  { id: "canal", name: "Canal Inkaico 🧱", emoji: "🧱", cost: 35 }
];

function getOpenDirections(type: string, rotation: number): boolean[] {
  // [Up, Right, Down, Left]
  if (type === "straight") {
    return (rotation % 2 === 0) ? [false, true, false, true] : [true, false, true, false];
  }
  if (type === "curved") {
    if (rotation === 0) return [true, true, false, false];  // Up, Right
    if (rotation === 1) return [false, true, true, false];  // Right, Down
    if (rotation === 2) return [false, false, true, true];  // Down, Left
    if (rotation === 3) return [true, false, false, true];  // Left, Up
  }
  if (type === "cross") {
    return [true, true, true, true];
  }
  return [false, false, false, false];
}

function generatePuzzle(stageNum: number) {
  const grid: { type: "straight" | "curved" | "cross" | "blank"; rotation: number; isConnected: boolean }[][] = [];
  const typeGrid: ("straight" | "curved" | "cross" | "blank")[][] = [
    ["blank", "blank", "blank"],
    ["blank", "blank", "blank"],
    ["blank", "blank", "blank"]
  ];
  
  const tmpl = stageNum % 4;
  if (tmpl === 0) {
    typeGrid[0][0] = "straight";
    typeGrid[0][1] = "curved";
    typeGrid[1][1] = "curved";
    typeGrid[1][2] = "curved";
    typeGrid[2][2] = "curved";
    typeGrid[1][0] = "straight";
    typeGrid[2][0] = "curved";
    typeGrid[2][1] = "straight";
  } else if (tmpl === 1) {
    typeGrid[0][0] = "curved";
    typeGrid[1][0] = "curved";
    typeGrid[1][1] = "straight";
    typeGrid[1][2] = "curved";
    typeGrid[2][2] = "curved";
    typeGrid[0][1] = "straight";
    typeGrid[0][2] = "curved";
    typeGrid[2][0] = "straight";
  } else if (tmpl === 2) {
    typeGrid[0][0] = "straight";
    typeGrid[0][1] = "straight";
    typeGrid[0][2] = "curved";
    typeGrid[1][2] = "straight";
    typeGrid[2][2] = "curved";
    typeGrid[1][0] = "curved";
    typeGrid[2][0] = "straight";
    typeGrid[2][1] = "straight";
  } else {
    typeGrid[0][0] = "curved";
    typeGrid[1][0] = "straight";
    typeGrid[2][0] = "curved";
    typeGrid[2][1] = "straight";
    typeGrid[2][2] = "straight";
    typeGrid[0][1] = "curved";
    typeGrid[0][2] = "straight";
    typeGrid[1][1] = "curved";
  }

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (typeGrid[r][c] === "blank") {
        typeGrid[r][c] = (r + c) % 2 === 0 ? "straight" : "curved";
      }
    }
  }

  for (let r = 0; r < 3; r++) {
    const row: any[] = [];
    for (let c = 0; c < 3; c++) {
      const initialRotation = (stageNum * 7 + r * 13 + c * 17) % 4;
      row.push({
        type: typeGrid[r][c],
        rotation: initialRotation,
        isConnected: false
      });
    }
    grid.push(row);
  }

  return grid;
}

function checkConnections(grid: any[][]) {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell, isConnected: false })));
  const queue: [number, number][] = [];
  const visited = new Set<string>();

  const startCell = newGrid[0][0];
  const startOpen = getOpenDirections(startCell.type, startCell.rotation);
  
  if (startOpen[3]) {
    queue.push([0, 0]);
    visited.add("0,0");
    newGrid[0][0].isConnected = true;
  }

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const cell = newGrid[r][c];
    const open = getOpenDirections(cell.type, cell.rotation);

    if (r > 0 && open[0]) {
      const neighbor = newGrid[r - 1][c];
      const nOpen = getOpenDirections(neighbor.type, neighbor.rotation);
      if (nOpen[2] && !visited.has(`${r - 1},${c}`)) {
        visited.add(`${r - 1},${c}`);
        newGrid[r - 1][c].isConnected = true;
        queue.push([r - 1, c]);
      }
    }
    if (c < 2 && open[1]) {
      const neighbor = newGrid[r][c + 1];
      const nOpen = getOpenDirections(neighbor.type, neighbor.rotation);
      if (nOpen[3] && !visited.has(`${r},${c + 1}`)) {
        visited.add(`${r},${c + 1}`);
        newGrid[r][c + 1].isConnected = true;
        queue.push([r, c + 1]);
      }
    }
    if (r < 2 && open[2]) {
      const neighbor = newGrid[r + 1][c];
      const nOpen = getOpenDirections(neighbor.type, neighbor.rotation);
      if (nOpen[0] && !visited.has(`${r + 1},${c}`)) {
        visited.add(`${r + 1},${c}`);
        newGrid[r + 1][c].isConnected = true;
        queue.push([r + 1, c]);
      }
    }
    if (c > 0 && open[3]) {
      const neighbor = newGrid[r][c - 1];
      const nOpen = getOpenDirections(neighbor.type, neighbor.rotation);
      if (nOpen[1] && !visited.has(`${r},${c - 1}`)) {
        visited.add(`${r},${c - 1}`);
        newGrid[r][c - 1].isConnected = true;
        queue.push([r, c - 1]);
      }
    }
  }

  const endCell = newGrid[2][2];
  const endOpen = getOpenDirections(endCell.type, endCell.rotation);
  const solved = visited.has("2,2") && endOpen[1];

  return { grid: newGrid, solved };
}

export default function HidroAventuraGame({ session }: HidroAventuraGameProps) {
  const [extraDrops, setExtraDrops] = useState<number>(0);
  const [purchasedItems, setPurchasedItems] = useState<any[]>([]);
  const [solvedStages, setSolvedStages] = useState<number[]>([]);
  const [selectedStageForPuzzle, setSelectedStageForPuzzle] = useState<number | null>(null);
  const [puzzleGrid, setPuzzleGrid] = useState<any[][]>([]);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [sanctuaryTab, setSanctuaryTab] = useState<"sanctuario" | "reto_puzzle">("sanctuario");
  const [gameMessage, setGameMessage] = useState<string>("");
  const [selectedPlacedItem, setSelectedPlacedItem] = useState<any | null>(null);

  useEffect(() => {
    if (session?.id) {
      const storedExtraDrops = localStorage.getItem(`yaku_extra_drops_${session.id}`);
      const storedItems = localStorage.getItem(`yaku_purchased_items_${session.id}`);
      const storedSolved = localStorage.getItem(`yaku_solved_stages_${session.id}`);

      setExtraDrops(storedExtraDrops ? parseInt(storedExtraDrops, 10) : 0);
      setPurchasedItems(storedItems ? JSON.parse(storedItems) : []);
      setSolvedStages(storedSolved ? JSON.parse(storedSolved) : []);
      setSelectedStageForPuzzle(null);
      setPuzzleGrid([]);
      setPuzzleSolved(false);
      setSanctuaryTab("sanctuario");
      setGameMessage("");
      setSelectedPlacedItem(null);
    }
  }, [session?.id]);

  const saveExtraDropsLocal = (val: number) => {
    if (session?.id) {
      localStorage.setItem(`yaku_extra_drops_${session.id}`, val.toString());
      setExtraDrops(val);
    }
  };

  const savePurchasedItemsLocal = (items: any[]) => {
    if (session?.id) {
      localStorage.setItem(`yaku_purchased_items_${session.id}`, JSON.stringify(items));
      setPurchasedItems(items);
    }
  };

  const saveSolvedStagesLocal = (stages: number[]) => {
    if (session?.id) {
      localStorage.setItem(`yaku_solved_stages_${session.id}`, JSON.stringify(stages));
      setSolvedStages(stages);
    }
  };

  const totalDrops = (session?.ultimoRetoValido || 0) * 15 + extraDrops;

  return (
    <div className="space-y-6">
      {/* Header del Juego */}
      <div className="geom-glass-card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-3 py-1 rounded-full uppercase tracking-wider">
            🎮 HIDRO-AVENTURA VIRTUAL
          </span>
          <h2 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
            SANTUARIO DEL GUARDIÁN DEL AGUA
          </h2>
          <p className="text-xs text-slate-500 max-w-xl">
            ¡Tu ahorro real se convierte en vida virtual! Con cada reto validado en el colegio o tu casa ganas gotas de agua para poblar tu propio ecosistema altoandino y jugar divertidos rompecabezas.
          </p>
        </div>

        {/* Contador de Gotas */}
        <div className="flex items-center gap-4 bg-teal-50 border border-teal-100 p-4 rounded-2xl shrink-0 shadow-sm">
          <div className="p-3 bg-teal-500 rounded-xl text-white">
            <Droplet className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-teal-600 tracking-wider">Tus Gotas de Agua</p>
            <p className="text-2xl font-black text-teal-800">
              {totalDrops} <span className="text-lg font-bold">💧</span>
            </p>
          </div>
        </div>
      </div>

      {/* Fila Principal de Bento Boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LADO IZQUIERDO: El Escenario del Santuario */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div className="geom-glass-card p-5 space-y-4 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 font-bold text-xs border border-emerald-100">🌿</span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 uppercase">
                    Tu Ecosistema: {
                      (session?.ultimoRetoValido || 0) <= 10 ? "Lomas de Amancay ⛰️" :
                      (session?.ultimoRetoValido || 0) <= 20 ? "Manantial Espejo 💎" :
                      (session?.ultimoRetoValido || 0) <= 30 ? "Andenes del Sol 🌾" :
                      (session?.ultimoRetoValido || 0) <= 40 ? "Bosque de Neblina 🌳" :
                      "Gran Cuenca Protectora 👑"
                    }
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">
                    NIVEL DE PROTECTOR: {(session?.ultimoRetoValido || 0) <= 10 ? "Guardián Iniciado" : (session?.ultimoRetoValido || 0) <= 20 ? "Defensor de Lagunas" : (session?.ultimoRetoValido || 0) <= 30 ? "Canalizador Inka" : (session?.ultimoRetoValido || 0) <= 40 ? "Patrullero del Bosque" : "Gran Sabio de la Cuenca"}
                  </p>
                </div>
              </div>

              {/* Botón reset items */}
              {purchasedItems.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm("¿Estás seguro de que deseas limpiar tu santuario? Recuperarás tus criaturas para volverlas a colocar.")) {
                      savePurchasedItemsLocal([]);
                      setSelectedPlacedItem(null);
                    }
                  }}
                  className="text-[10px] text-rose-600 font-bold hover:underline transition cursor-pointer bg-transparent border-none"
                >
                  🧹 Limpiar Santuario
                </button>
              )}
            </div>

            {/* Escenario de fondo interactivo */}
            <div 
              className={`relative h-80 rounded-2xl overflow-hidden border border-slate-200/80 shadow-inner flex flex-col justify-between p-4 transition duration-300 ${
                (session?.ultimoRetoValido || 0) <= 10 ? "bg-gradient-to-b from-sky-100 via-amber-50 to-orange-100/50" :
                (session?.ultimoRetoValido || 0) <= 20 ? "bg-gradient-to-b from-cyan-100 via-sky-50 to-teal-50" :
                (session?.ultimoRetoValido || 0) <= 30 ? "bg-gradient-to-b from-emerald-100 via-green-50 to-amber-50" :
                (session?.ultimoRetoValido || 0) <= 40 ? "bg-gradient-to-b from-teal-100 via-emerald-50 to-green-100" :
                "bg-gradient-to-b from-blue-100 via-cyan-50 to-emerald-50"
              }`}
            >
              {/* Decorativos de fondo según nivel */}
              <div className="absolute inset-0 pointer-events-none opacity-40 select-none">
                <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-slate-200/80 to-transparent rounded-t-full"></div>
                <div className="absolute -bottom-6 -left-12 w-48 h-48 bg-teal-600/10 rounded-full blur-xl"></div>
                <div className="absolute -bottom-6 -right-12 w-48 h-48 bg-emerald-600/10 rounded-full blur-xl"></div>
                {(session?.ultimoRetoValido || 0) > 0 && (
                  <div className="absolute bottom-4 left-0 right-0 h-2 bg-sky-400/50 animate-pulse"></div>
                )}
              </div>

              {/* Leyenda del nivel actual */}
              <div className="bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-slate-200/50 max-w-sm shadow-sm relative z-10">
                <p className="text-[10px] font-bold text-slate-800 leading-relaxed">
                  {
                    (session?.ultimoRetoValido || 0) <= 10 ? "🏜️ Paisaje Inicial: El suelo está algo árido. ¡Completa tu primer reto y juega el rompecabezas para humedecer la tierra y empezar a sembrar flores de Amancay!" :
                    (session?.ultimoRetoValido || 0) <= 20 ? "💧 Manantial Limpio: ¡El agua comienza a brotar! El aire se siente más fresco. Es el lugar perfecto para colocar ranitas del Titicaca." :
                    (session?.ultimoRetoValido || 0) <= 30 ? "🌾 Andenes del Sol: Las terrazas prehispánicas se activan. Cultiva árboles de Queñua y construye canales Inkaicos para expandir el riego." :
                    (session?.ultimoRetoValido || 0) <= 40 ? "🌲 Bosque de Neblina: Un microclima húmedo y fértil ha tomado forma. El musgo protege las cuencas. Atrae vicuñas y cóndores andinos." :
                    "👑 Gran Cuenca Protectora: ¡Has completado toda la ruta! El ciclo del agua está perfectamente restaurado en tu comunidad escolar. ¡Felicidades, Maestro Guardián!"
                  }
                </p>
              </div>

              {/* Contenedor de criaturas colocadas */}
              <div className="absolute inset-0 z-20">
                {purchasedItems.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <span className="text-4xl animate-bounce">🌱</span>
                    <p className="text-xs font-bold mt-2 text-slate-600">¡Tu santuario está vacío!</p>
                    <p className="text-[10px] max-w-xs mt-1 leading-snug">
                      Usa tus gotas de agua en la tienda (columna derecha) para comprar y colocar plantas y hermosos animales altoandinos.
                    </p>
                  </div>
                ) : (
                  purchasedItems.map((item) => (
                    <motion.button
                      key={item.id}
                      onClick={() => setSelectedPlacedItem(item)}
                      style={{ left: `${item.x}%`, top: `${item.y}%` }}
                      whileHover={{ scale: 1.2, y: -4 }}
                      animate={{ 
                        y: [0, -4, 0],
                      }}
                      transition={{
                        y: {
                          duration: 2 + (parseInt(item.id.slice(-1)) || 0) % 3,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer focus:outline-none text-3xl border-none bg-transparent"
                      title={`Haz clic para hablar con este ${item.name}`}
                    >
                      {item.emoji}
                    </motion.button>
                  ))
                )}

                {/* Diálogo del item seleccionado */}
                <AnimatePresence>
                  {selectedPlacedItem && (
                    <div className="absolute bottom-4 right-4 left-4 bg-teal-900/95 backdrop-blur-md text-white p-3 rounded-xl border border-teal-500/30 shadow-lg z-30 flex items-start gap-2.5">
                      <span className="text-2xl mt-0.5">{selectedPlacedItem.emoji}</span>
                      <div className="flex-1 space-y-0.5">
                        <p className="text-[10px] font-bold text-teal-300 uppercase tracking-wider">{selectedPlacedItem.name}</p>
                        <p className="text-xs font-medium leading-relaxed italic text-teal-50">
                          {
                            selectedPlacedItem.id.startsWith("vicuna") ? "«¡Hola! Gracias por cuidar mis ríos altoandinos. ¡Eres un gran guardián!»" :
                            selectedPlacedItem.id.startsWith("rana") ? "«¡Crac! El agua pura es mi hogar favorito. ¡Sigue cerrando el caño para evitar fugas!»" :
                            selectedPlacedItem.id.startsWith("condor") ? "«¡Fiuuu! Desde lo más alto vigilo tu esfuerzo ecológico. ¡Me encanta tu escuela limpia!»" :
                            selectedPlacedItem.id.startsWith("flor") ? "«¡Qué rico aroma! He florecido gracias a que reutilizaste el agua de lavado en tus plantas.»" :
                            selectedPlacedItem.id.startsWith("quena") ? "«Mis raíces absorben el agua limpia que proteges. ¡Gracias por sembrarme en los andenes!»" :
                            selectedPlacedItem.id.startsWith("filtro") ? "«Purificando y reciclando gotas de vida para alimentar a las especies del manantial.»" :
                            "«Canalizando el agua de manera inteligente, tal como hacían los sabios arquitectos Inkas.»"
                          }
                        </p>
                      </div>
                      <button 
                        onClick={() => setSelectedPlacedItem(null)}
                        className="text-white hover:text-red-400 font-bold text-xs p-1 cursor-pointer bg-transparent border-none"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Indicador de retos completados */}
              <div className="text-right z-10 self-end">
                <span className="bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-black tracking-widest uppercase px-2.5 py-1 rounded-full">
                  Retos Completados: {session?.ultimoRetoValido || 0} / 48
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: Controles (Tienda o Mini-Juego de Puzzles) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="geom-glass-card p-4 space-y-4 flex-1 flex flex-col">
            {/* Selector de sub-pestañas */}
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => {
                  setSanctuaryTab("sanctuario");
                  setSelectedStageForPuzzle(null);
                  setGameMessage("");
                }}
                className={`flex-1 pb-2.5 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition cursor-pointer ${
                  sanctuaryTab === "sanctuario" && selectedStageForPuzzle === null
                    ? "text-teal-700 border-teal-600 font-extrabold"
                    : "text-slate-400 border-transparent hover:text-slate-600"
                } bg-transparent`}
              >
                🌱 Tienda Ecológica
              </button>
              <button
                onClick={() => {
                  setSanctuaryTab("reto_puzzle");
                  setGameMessage("");
                }}
                className={`flex-1 pb-2.5 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition cursor-pointer ${
                  sanctuaryTab === "reto_puzzle" || selectedStageForPuzzle !== null
                    ? "text-teal-700 border-teal-600 font-extrabold"
                    : "text-slate-400 border-transparent hover:text-slate-600"
                } bg-transparent`}
              >
                🧩 Rompecabezas Tubería
              </button>
            </div>

            {/* CONTENIDO SUB-PESTAÑA 1: TIENDA */}
            {sanctuaryTab === "sanctuario" && selectedStageForPuzzle === null && (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                    Criaturas y Elementos Disponibles
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Intercambia tus gotas acumuladas por estas decoraciones vivas y sembrarlas en tu ecosistema.
                  </p>

                  {gameMessage && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-lg font-bold">
                      {gameMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {DECORATIONS.map((dec) => {
                      const canAfford = totalDrops >= dec.cost;

                      return (
                        <div
                          key={dec.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50/70 border border-slate-150 rounded-xl hover:bg-white transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{dec.emoji}</span>
                            <div>
                              <p className="text-xs font-bold text-slate-800">{dec.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold">Costo: {dec.cost} gotas 💧</p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              if (totalDrops < dec.cost) return;
                              const newExtra = extraDrops - dec.cost;
                              saveExtraDropsLocal(newExtra);
                              
                              const newItem = {
                                id: `${dec.id}_${Date.now()}`,
                                name: dec.name.split(" ")[0] || dec.name,
                                emoji: dec.emoji,
                                x: 15 + Math.floor(Math.random() * 70),
                                y: 20 + Math.floor(Math.random() * 60)
                              };
                              const newItems = [...purchasedItems, newItem];
                              savePurchasedItemsLocal(newItems);
                              setGameMessage(`¡Colocaste un ${newItem.name} en tu Santuario! 🌟 Clickéalo para hablar.`);
                              setTimeout(() => setGameMessage(""), 5000);
                            }}
                            disabled={!canAfford}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                              canAfford
                                ? "bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                                : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                            }`}
                          >
                            Colocar 💧
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl text-[10px] text-slate-500 font-bold leading-relaxed text-center">
                  💡 Completa más misiones semanales o juega los rompecabezas de tuberías para ganar más gotas de agua y expandir tu santuario.
                </div>
              </div>
            )}

            {/* CONTENIDO SUB-PESTAÑA 2: LISTA DE 48 PUZZLES */}
            {sanctuaryTab === "reto_puzzle" && selectedStageForPuzzle === null && (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Elegir Nivel de Tubería</span>
                    <span className="text-[10px] font-normal text-slate-400 lowercase">
                      ({solvedStages.length} completados)
                    </span>
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Cada nivel corresponde a una etapa de tu ruta. ¡Cura el caudal de la tubería para ganar gotas!
                  </p>

                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-5 gap-2 max-h-[300px] overflow-y-auto pr-1 pt-1">
                    {Array.from({ length: 48 }).map((_, idx) => {
                      const stepNum = idx + 1;
                      const unlocked = stepNum <= (session?.ultimoRetoValido || 0) + 1;
                      const isCurrent = stepNum === session?.siguienteRetoNum;
                      const isSolved = solvedStages.includes(stepNum);

                      let bgStyle = "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed";
                      if (isSolved) {
                        bgStyle = "bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-pointer hover:bg-emerald-100/50";
                      } else if (isCurrent) {
                        bgStyle = "bg-white text-teal-600 border border-teal-500 font-black shadow-sm ring-2 ring-teal-100 cursor-pointer hover:bg-teal-50/50 animate-pulse";
                      } else if (unlocked) {
                        bgStyle = "bg-white text-slate-700 border border-slate-200 cursor-pointer hover:bg-slate-50";
                      }

                      return (
                        <button
                          key={stepNum}
                          disabled={!unlocked}
                          onClick={() => {
                            setSelectedStageForPuzzle(stepNum);
                            const initialGrid = generatePuzzle(stepNum);
                            const res = checkConnections(initialGrid);
                            setPuzzleGrid(res.grid);
                            setPuzzleSolved(res.solved);
                          }}
                          title={BANCO_RETOS[stepNum]?.titulo || `Etapa ${stepNum}`}
                          className={`aspect-square rounded-lg flex flex-col justify-center items-center p-1 text-center transition duration-150 relative ${bgStyle}`}
                        >
                          <span className="text-[8px] font-bold opacity-75">NIVEL</span>
                          <span className="text-sm font-extrabold">{stepNum}</span>
                          {isSolved && (
                            <span className="absolute bottom-1 right-1 text-[10px]">💧</span>
                          )}
                          {!unlocked && (
                            <span className="absolute top-0.5 right-0.5 text-[8px] text-slate-400">🔒</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* MINI-JUEGO PUZZLE ACTIVO */}
            {selectedStageForPuzzle !== null && (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setSelectedStageForPuzzle(null)}
                      className="text-[10px] font-extrabold text-teal-700 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none"
                    >
                      ← Volver al mapa
                    </button>
                    <button
                      onClick={() => {
                        const fresh = generatePuzzle(selectedStageForPuzzle);
                        const res = checkConnections(fresh);
                        setPuzzleGrid(res.grid);
                        setPuzzleSolved(res.solved);
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-600 font-bold transition cursor-pointer bg-transparent border-none"
                    >
                      🔄 Reiniciar rotaciones
                    </button>
                  </div>

                  <div className="border-t border-slate-100 pt-2.5">
                    <span className="text-[9px] font-black tracking-widest text-teal-600 uppercase bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                      ETAPA {selectedStageForPuzzle}
                    </span>
                    <h5 className="font-bold text-xs text-slate-800 mt-1">
                      Conectar: {BANCO_RETOS[selectedStageForPuzzle]?.titulo}
                    </h5>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-semibold mt-0.5">
                      ¡Gira los tubos haciendo clic en ellos para que el agua corra hacia el brote!
                    </p>
                  </div>

                  {/* TABLERO DE PUZZLE 3x3 */}
                  <div className="flex items-center justify-center py-2 bg-slate-50/50 rounded-2xl border border-slate-150/80 relative">
                    <span className="absolute left-1.5 top-[28%] text-xs font-bold animate-pulse text-teal-600">
                      ➡️💧 (In)
                    </span>
                    <span className="absolute right-1.5 bottom-[28%] text-xs font-bold text-emerald-600">
                      (Out) 🌳
                    </span>

                    <div className="grid grid-cols-3 gap-3 w-48">
                      {puzzleGrid.map((row, r) =>
                        row.map((cell, c) => {
                          return (
                            <button
                              key={`${r}-${c}`}
                              disabled={puzzleSolved}
                              onClick={() => {
                                const updatedGrid = puzzleGrid.map((currRow, currR) =>
                                  currRow.map((currCell, currC) => {
                                    if (currR === r && currC === c) {
                                      return {
                                        ...currCell,
                                        rotation: (currCell.rotation + 1) % 4
                                      };
                                    }
                                    return currCell;
                                  })
                                );
                                const res = checkConnections(updatedGrid);
                                setPuzzleGrid(res.grid);
                                setPuzzleSolved(res.solved);
                              }}
                              className={`w-full aspect-square relative rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-center overflow-hidden bg-white hover:border-teal-400 ${
                                cell.isConnected
                                  ? "border-teal-200 shadow-sm ring-1 ring-teal-100"
                                  : "border-slate-200"
                              }`}
                            >
                              {cell.type === "straight" && (
                                <div 
                                  className={`transition duration-150 ${
                                    cell.rotation % 2 === 0
                                      ? "w-full h-3.5"
                                      : "h-full w-3.5"
                                  } ${
                                    cell.isConnected 
                                      ? "bg-gradient-to-r from-teal-400 to-cyan-400 shadow-inner" 
                                      : "bg-slate-300"
                                  }`}
                                />
                              )}

                              {cell.type === "curved" && (
                                <div className="w-full h-full relative">
                                  {cell.rotation === 0 && (
                                    <>
                                      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3.5 h-1/2 ${cell.isConnected ? "bg-teal-400" : "bg-slate-300"}`} />
                                      <div className={`absolute left-1/2 top-1/2 -translate-y-1/2 w-1/2 h-3.5 ${cell.isConnected ? "bg-teal-400" : "bg-slate-300"}`} />
                                    </>
                                  )}
                                  {cell.rotation === 1 && (
                                    <>
                                      <div className={`absolute left-1/2 top-1/2 -translate-y-1/2 w-1/2 h-3.5 ${cell.isConnected ? "bg-teal-400" : "bg-slate-300"}`} />
                                      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-3.5 h-1/2 ${cell.isConnected ? "bg-teal-400" : "bg-slate-300"}`} />
                                    </>
                                  )}
                                  {cell.rotation === 2 && (
                                    <>
                                      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-3.5 h-1/2 ${cell.isConnected ? "bg-teal-400" : "bg-slate-300"}`} />
                                      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-3.5 ${cell.isConnected ? "bg-teal-400" : "bg-slate-300"}`} />
                                    </>
                                  )}
                                  {cell.rotation === 3 && (
                                    <>
                                      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-3.5 ${cell.isConnected ? "bg-teal-400" : "bg-slate-300"}`} />
                                      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-3.5 h-1/2 ${cell.isConnected ? "bg-teal-400" : "bg-slate-300"}`} />
                                    </>
                                  )}
                                </div>
                              )}

                              {cell.type === "cross" && (
                                <div className="w-full h-full relative">
                                  <div className={`absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-3.5 ${cell.isConnected ? "bg-teal-400" : "bg-slate-300"}`} />
                                  <div className={`absolute left-0 right-0 top-1/2 -translate-y-1/2 h-3.5 ${cell.isConnected ? "bg-teal-400" : "bg-slate-300"}`} />
                                </div>
                              )}

                              {cell.isConnected && (
                                <span className="absolute w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* RESULTADO DEL PUZZLE */}
                <div className="space-y-2">
                  {puzzleSolved ? (
                    <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-center space-y-2">
                      <h6 className="font-extrabold text-emerald-800 text-xs">
                        🎉 ¡AGUA CONECTADA CON ÉXITO!
                      </h6>
                      <p className="text-[10px] text-emerald-700 font-bold leading-snug">
                        ¡El caudal corre limpio hacia el biohuerto! {solvedStages.includes(selectedStageForPuzzle) ? "Ya reclamaste este nivel, pero ganaste un extra de +3 Gotas por diversión. 💧" : "Ganaste +15 Gotas de Agua 💧 para tu santuario."}
                      </p>
                      <button
                        onClick={() => {
                          const isReplay = solvedStages.includes(selectedStageForPuzzle);
                          const reward = isReplay ? 3 : 15;
                          saveExtraDropsLocal(extraDrops + reward);
                          if (!isReplay) {
                            saveSolvedStagesLocal([...solvedStages, selectedStageForPuzzle]);
                          }
                          setSelectedStageForPuzzle(null);
                        }}
                        className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-lg cursor-pointer transition shadow-sm border border-emerald-700"
                      >
                        Reclamar Gotas y Volver 💧
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-center text-[10px] text-slate-500 font-bold">
                      💧 El caudal está obstruido. Haz clic en las tuberías para alinearlas.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
