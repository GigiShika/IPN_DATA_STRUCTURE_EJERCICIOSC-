/* Partes del cuaderno (mismo orden que el PDF y el polilibro). */
const PARTS = [
  { id: 1, color: "#3fb950", dark: "#2c8a3e", name: "Lógica de programación", short: "Parte I", from: 1, to: 30,
    desc: "Operadores, condicionales, ciclos for y while, acumuladores y funciones sencillas." },
  { id: 2, color: "#58a6ff", dark: "#3b82d6", name: "Arreglos unidimensionales", short: "Parte II", from: 31, to: 60,
    desc: "Vectores: recorrido, búsqueda, inserción, eliminación y ordenamiento." },
  { id: 3, color: "#bc8cff", dark: "#8957e5", name: "Arreglos bidimensionales", short: "Parte III", from: 61, to: 82,
    desc: "Matrices y manejo de índices [i][j]: diagonales, transpuesta, espiral, mágicos." },
  { id: 4, color: "#e3b341", dark: "#bb8009", name: "Apuntadores", short: "Parte IV", from: 83, to: 90,
    desc: "Direcciones, aritmética de punteros, memoria dinámica y listas enlazadas." },
];
const LEVELS = { B: "Básico", I: "Intermedio", E: "Experto" };
const MODES = {
  U: { label: "Pedir valor al usuario", cls: "chip-u" },
  A: { label: "Llenado automático", cls: "chip-a" },
  D: { label: "Asignar al declarar", cls: "chip-d" },
};
