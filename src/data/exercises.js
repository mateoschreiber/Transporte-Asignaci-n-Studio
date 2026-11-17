function transport(id, title, source, page, difficulty, text, rows, columns, costs, supply, demand, expected, extra = {}) {
  return {
    id, title, source, page, difficulty, text, topic: 'transport',
    methods: ['northwest', 'minimum', 'vogel', 'russell', 'modi'],
    draft: { rows, columns, costs, supply, demand, topic: 'transport' },
    expected, ...extra
  };
}

function assignment(id, title, difficulty, text, rows, columns, costs, optimum, extra = {}) {
  return {
    id, title, difficulty, text, topic: 'assignment', methods: ['hungarian'],
    source: 'Asignación - Ejercicios.pdf', page: '3',
    draft: { rows, columns, costs, objective: 'min', topic: 'assignment' },
    expected: { optimum }, ...extra
  };
}

const products = ['A', 'B', 'C'];
const factories = ['A', 'B', 'C'];
const cities = ['D', 'E', 'F'];
const jobs = ['Puesto 1', 'Puesto 2', 'Puesto 3', 'Puesto 4'];
const workers = ['Trab. 1', 'Trab. 2', 'Trab. 3', 'Trab. 4'];
const jobCosts = [[50, 50, null, 20], [70, 40, 20, 30], [90, 30, 50, null], [70, 20, 60, 70]];
const initialSource = 'Transporte - SBF inicial-Optimalidad.pdf';
const transportSource = 'Transporte - Ejercicios.pdf';

export const exercises = [
  transport('mataderos', 'Mataderos', transportSource, '1', 'Inicial',
    'Dos mataderos abastecen a tres ciudades. Distribuye las 56 toneladas y minimiza el costo semanal de transporte.',
    ['P', 'Q'], ['R', 'S', 'T'], [[1, 3, 1], [2, 1, 1]], [26, 30], [20, 22, 14], { optimum: 56, northwest: 68 }),
  transport('abc', 'Empresa ABC', transportSource, '1', 'Intermedio',
    'Tres plantas despachan piedra molida a tres proyectos viales. La demanda semanal supera la capacidad real. Determina el reparto y el costo óptimo.',
    ['W', 'X', 'Y'], products, [[4, 3, 3], [6, 7, 6], [4, 2, 5]], [45, 60, 40], [50, 75, 50],
    { optimum: 575, northwest: 735, multiple: true },
    { note: 'El enunciado está disponible. El desarrollo se obtiene con el motor a partir de la matriz del ejercicio.' }),
  transport('electricidad', 'Distribución eléctrica', transportSource, '1', 'Intermedio',
    'Tres centrales deben abastecer tres ciudades al menor costo. El balanceo permite distinguir la energía entregada del suministro que queda sin usar.',
    ['I', 'II', 'III'], products, [[8, 6, 10], [9, 12, 13], [14, 9, 16]], [35, 50, 40], [45, 20, 30], { optimum: 870 }),
  transport('pt', 'P&T Company', 'Clase14.pdf', '1–2', 'Intermedio',
    'Distribuye las cargas de chícharos enlatados desde las tres plantas a los cuatro almacenes.',
    ['Bellingham', 'Eugene', 'Albert Lea'], ['Sacramento', 'Salt Lake City', 'Rapid City', 'Albuquerque'],
    [[464, 513, 654, 867], [352, 416, 690, 791], [995, 682, 388, 685]], [75, 125, 100], [80, 65, 70, 85],
    { optimum: 152535 }, { note: 'La tabla de la p. 1 da C₂₄ = 791. La función objetivo de la p. 2 imprime 792. Se usa 791, el valor de la tabla.' }),
  transport('northern', 'Northern Airplane', 'Clase14.pdf', '3–4', 'Avanzado',
    'Programa la fabricación y el almacenaje de motores de cuatro meses. Cada fila limita la producción del mes y cada columna indica las instalaciones programadas.',
    ['Mes 1', 'Mes 2', 'Mes 3', 'Mes 4'], ['Mes 1', 'Mes 2', 'Mes 3', 'Mes 4'],
    [[1.08, 1.095, 1.11, 1.125], [null, 1.11, 1.125, 1.14], [null, null, 1.1, 1.115], [null, null, null, 1.13]],
    [25, 35, 30, 10], [10, 15, 25, 20], { optimum: 77.3 },
    { note: 'La M grande de la guía representa rutas prohibidas. Un mes futuro no puede abastecer una instalación anterior. El destino ficticio mide capacidad ociosa.' }),
  transport('metro', 'Distrito Metro', 'Clase15.pdf · Clase16.pdf', '1–3 · 1–5', 'Avanzado',
    'Distribuye el agua de tres ríos a cuatro ciudades. Berdoo se divide en un mínimo de 30 y hasta 20 adicionales. Los Devils requiere 70 reales y Hollyglass al menos 10.',
    ['Colombo', 'Sacron', 'Calorie', 'Ficticio'], ['Berdoo mín.', 'Berdoo adic.', 'Los Devils', 'San Go', 'Hollyglass'],
    [[16, 16, 13, 22, 17], [14, 14, 13, 19, 15], [19, 19, 20, 23, null], [null, 0, null, 0, 0]],
    [50, 60, 50, 50], [30, 20, 70, 30, 60], { optimum: 2460 },
    { fictitiousRow: 3, note: 'Se usa la tabla transformada de Clase 15. En Clase 16, p. 4, el ciclo de X₂₅ da 10 × (15 − 17 + 13 − 13) = −20. La última resta impresa figura como −17. Para detenerse basta que los costos reducidos sean no negativos (p. 3), aunque la p. 5 diga positivos. Las rutas M están prohibidas.' }),
  transport('fabricas', 'Tres fábricas y tres ciudades', 'Transporte - Guía resolución.pdf', '1–3', 'Intermedio',
    'Reparte el suministro de tres fábricas. Balancea la demanda excedente y compara el costo inicial con el óptimo.',
    factories, cities, [[1, 4, 2], [3, 1, 2], [4, 5, 2]], [1000, 5000, 4000], [3000, 6000, 7000],
    { optimum: 14000, northwest: 27000 },
    { note: 'La guía impresa pospone celdas ficticias en Costo Mínimo. Aquí compiten según su costo. Las restricciones balanceadas suman cantidades Xᵢⱼ.' }),
  transport('sbf-a', 'Comparar SBF · Planteo a', initialSource, '1–3', 'Intermedio',
    'Calcula las soluciones iniciales y explora cómo los empates influyen en el costo. Luego comprueba su optimalidad.',
    factories, cities, [[0, 2, 1], [2, 1, 5], [2, 4, 3]], [6, 7, 7], [5, 5, 10], { optimum: 33, northwest: 42 },
    { note: 'La segunda opción rotulada Costo Mínimo arranca con costo 1 habiendo un 0 elegible. Es un reparto factible, pero ese paso no cumple la selección por mínimo. En la segunda rama de Vogel (p. 3) se imprime X₃₁ = 2 en un paso. El saldo exige X₃₁ = 3, como figura en el resumen.' }),
  transport('sbf-b', 'Comparar SBF · Planteo b', initialSource, '1, 4–5', 'Intermedio',
    'Compara los costos de las soluciones iniciales y usa los potenciales para verificar el resultado.',
    factories, cities, [[1, 2, 6], [0, 4, 2], [3, 1, 5]], [7, 12, 11], [10, 10, 10], { optimum: 40, northwest: 94 }),
  transport('sbf-c', 'Comparar SBF · Planteo c', initialSource, '1, 4–5', 'Intermedio',
    'Calcula una SBF inicial con cada método. Identifica qué soluciones iniciales ya son óptimas.',
    factories, cities, [[5, 1, 8], [2, 4, 0], [3, 6, 7]], [12, 14, 4], [9, 10, 11], { optimum: 38, northwest: 104 }),
  assignment('maquinas', 'Cuatro tareas y cuatro máquinas', 'Inicial',
    'Procesa las cuatro tareas usando una máquina por tarea. Minimiza el desperdicio total, expresado en pesos.',
    ['Tarea A', 'Tarea B', 'Tarea C', 'Tarea D'], ['Máq. 1', 'Máq. 2', 'Máq. 3', 'Máq. 4'],
    [[49, 86, 54, 70], [45, 79, 66, 81], [46, 58, 78, 88], [44, 38, 66, 69]], 219,
    { note: 'La p. 1 describe columnas primero y la p. 2 filas primero. El laboratorio usa el orden de la p. 2.' }),
  assignment('natacion', 'Relevo de natación', 'Intermedio',
    'Elige un nadador distinto para cada uno de los cuatro estilos. Minimiza la suma de tiempos del relevo combinado de 200 metros.',
    ['Dorso', 'Pecho', 'Mariposa', 'Libre'], ['Carlos', 'Jesús', 'David', 'Antonio', 'José'],
    [[37.7, 32.9, 33.8, 37, 35.4], [43.4, 33.1, 42.2, 34.7, 41.8], [33.3, 28.5, 38.9, 30.4, 33.6], [29.2, 26.4, 29.6, 28.5, 31.1]], 126.2),
  assignment('job-a', 'JobShop · Puestos originales', 'Intermedio',
    'Asigna los cuatro trabajadores a los cuatro puestos. Las parejas del trabajador 1 con el puesto 3 y del trabajador 3 con el puesto 4 están prohibidas.',
    workers, jobs, jobCosts, 140),
  assignment('job-b', 'JobShop · Quinto trabajador', 'Avanzado',
    'Compara el modelo original con la incorporación del trabajador 5. Decide si conviene dejar disponible a uno de los trabajadores originales.',
    [...workers, 'Trab. 5'], jobs, [...jobCosts, [60, 45, 30, 80]], 120, { compareWith: 'job-a' }),
  assignment('job-c', 'JobShop · Quinto puesto', 'Avanzado',
    'Con los cuatro trabajadores originales, decide si conviene cubrir el nuevo puesto dejando uno de los anteriores sin cubrir.',
    workers, [...jobs, 'Puesto 5'], jobCosts.map((row, i) => [...row, [20, 10, 20, 80][i]]), 80, { compareWith: 'job-a' })
];

export const demonstrations = [
  {
    id: 'propio-beneficio', title: 'Beneficio por proyecto', topic: 'assignment', difficulty: 'Intermedio',
    source: 'Ejemplo propio', page: '', methods: ['hungarian'], text: 'Asigna una persona a cada proyecto y maximiza el beneficio total.',
    draft: { topic: 'assignment', objective: 'max', rows: ['Ana', 'José', 'Luis'], columns: ['A', 'B', 'C'], costs: [[8, 5, 4], [5, 8, null], [4, 4, 7]] },
    expected: { optimum: 23 }
  },
  {
    id: 'propio-infactible', title: 'Turnos sin cobertura', topic: 'assignment', difficulty: 'Intermedio',
    source: 'Ejemplo propio', page: '', methods: ['hungarian'], text: 'Cada persona puede cubrir ciertos turnos. Determina si existe una asignación que cubra los tres turnos.',
    draft: { topic: 'assignment', objective: 'min', rows: ['A', 'B', 'C'], columns: ['Mañana', 'Tarde', 'Noche'], costs: [[3, null, null], [2, null, null], [null, 1, 1]] },
    expected: { infeasible: true }
  }
];

export const allExercises = [...exercises, ...demonstrations];
export const getExercise = (id) => allExercises.find((exercise) => exercise.id === id);
export function exerciseDraft(exercise) {
  const draft = structuredClone(exercise.draft);
  draft.exerciseId = exercise.id;
  if (exercise.fictitiousRow !== undefined) draft.fictitiousRow = exercise.fictitiousRow;
  return draft;
}

export const methodNames = {
  northwest: 'Esquina Noroeste', minimum: 'Costo Mínimo', vogel: 'Vogel',
  russell: 'Russell', modi: 'MODI', hungarian: 'Método Húngaro'
};

export const modules = [
  { id: 'fundamentos', title: 'Fundamentos de Transporte', minutes: 20, exercise: 'mataderos', method: 'northwest', formula: 'Min Z = Σᵢ Σⱼ Cᵢⱼ Xᵢⱼ. Cada fila suma Sᵢ y cada columna suma Dⱼ en el modelo balanceado. Xᵢⱼ ≥ 0.' },
  { id: 'balanceo', title: 'Balanceo', minutes: 25, exercise: 'abc', method: 'northwest', formula: 'Δ = Σ Sᵢ − Σ Dⱼ. Si Δ > 0, agregar destino ficticio. Si Δ < 0, agregar origen ficticio.' },
  { id: 'sbf', title: 'Esquina Noroeste y Costo Mínimo', minutes: 30, exercise: 'sbf-a', method: 'minimum', formula: 'Xᵢⱼ = mín(oferta pendiente, demanda pendiente). En Esquina Noroeste se avanza por posición. En Costo Mínimo se elige el menor Cᵢⱼ elegible.' },
  { id: 'vogel', title: 'Vogel', minutes: 40, exercise: 'sbf-b', method: 'vogel', formula: 'Penalización = segundo costo menor − costo menor. Elegir una línea de mayor penalización y su celda de menor costo.' },
  { id: 'modi', title: 'MODI', minutes: 70, exercise: 'abc', method: 'modi', formula: 'V.B. → Uᵢ + Vⱼ = Cᵢⱼ. V.N.B. → rᵢⱼ = Cᵢⱼ − Uᵢ − Vⱼ. Si todos rᵢⱼ ≥ 0, hay optimalidad. θ = mín(Xᵢⱼ en celdas −).' },
  { id: 'hungaro', title: 'Método Húngaro', minutes: 60, exercise: 'maquinas', method: 'hungarian', formula: 'Restar mínimos de filas y luego de columnas. Encontrar ceros independientes. Si faltan parejas, restar el menor valor no cubierto y sumarlo en las intersecciones.' },
  { id: 'especiales', title: 'Casos especiales', minutes: 35, exercise: 'job-b', method: 'hungarian', formula: 'En maximización, Cᵢⱼ = Bmáx − Bᵢⱼ. Los ficticios completan el orden de la matriz. Las prohibiciones quedan fuera del emparejamiento.' },
  { id: 'examen', title: 'Examen simulado', minutes: 20, formula: 'Comprueba sumas, prohibiciones, unicidad de parejas y Z con la tabla original antes de entregar.' }
];
