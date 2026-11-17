const graphic = 'Método Gráfico - Ejercicios.pdf';
const simplex = 'Método Simplex - Ejercicios.pdf';
const formulations = 'Método Simplex - Ejercicios - planteos.pdf';
const combined = 'Simplex, planteos. Máx-Mín-Dual.pdf';
const practice = 'Simplex, planteos. Máx practica.pdf';
const common = [[10, 40, '>=', 20], [50, 20, '>=', 30]];

export function model(name, sense, objective, rows, domains = ['positive', 'positive']) {
  return {
    name, sense, objective: objective.map(String),
    variables: domains.map((domain, i) => ({ name: 'X' + (i + 1), domain })),
    constraints: rows.map(([x, y, operator, bound], i) => ({
      id: 'R' + (i + 1), coefficients: [String(x), String(y)], operator, bound: String(bound)
    }))
  };
}

function exercise(id, title, source, page, level, statement, rows, objectives, options = {}) {
  return {
    id, title, source, page, level, statement,
    prerequisites: [source === graphic ? 'Inecuaciones lineales' : 'Sistemas de ecuaciones',
      ...(id === 'alimentos' || id === 'alimentos-kg' || id === 'agricultor' ? ['Dualidad'] : [])],
    ...options,
    variants: objectives.map(([sense, x, y, label]) => ({
      label: label ?? (sense === 'max' ? 'Máx' : 'Mín') + ' · (' + x + ', ' + y + ')',
      draft: model(title, sense, [x, y], rows, options.domains)
    }))
  };
}

const free = ['free', 'free'];
const graphIntro = (inequalities, objectives) => [
  'a) Representar gráficamente el conjunto de puntos que satisfacen las siguientes inecuaciones lineales:',
  inequalities,
  'b) Hallar gráficamente el punto óptimo de cada una de las siguientes funciones objetivo, sujetas a las inecuaciones previas, informando el valor que alcanza Z:',
  ...objectives
].join('\n');
const dietText = 'Se plantea el problema de tener que hacer una mezcla de mínimo costo entre dos alimentos: A y B, con una composición que debe contener más del 20% de vitaminas y más del 30% de proteínas. El producto A posee el 10% de vitaminas y el 50% de proteínas, y el producto B contiene el 40% de vitaminas y el 20% de proteínas. El alimento tipo A cuesta $80 por Kg., y el B cuesta $100 por Kg.';
export const lpExercises = [
  exercise('g1', 'Inecuaciones · Problema 1', graphic, 1, 'Avanzado',
    graphIntro('2x₁ − x₂ ≥ −2; x₁ + x₂ ≤ 8.', [
      'I) z = máx (3x₁ + 2x₂)', 'II) z = máx (x₂) − z = mín (x₂); z = máx (x₁) − z = mín (x₁)',
      'III) z = mín (2x₁ − 2x₂)', 'IV) z = máx (2x₁ + 4x₂)', 'V) z = mín (−3x₁ − 2x₂)'
    ]),
    [[2,-1,'>=',-2],[1,1,'<=',8]], [
      ['max',3,2,'I · Máx 3X₁ + 2X₂'], ['max',0,1,'II · Máx X₂'], ['min',0,1,'II · Mín X₂'],
      ['max',1,0,'II · Máx X₁'], ['min',1,0,'II · Mín X₁'], ['min',2,-2,'III · Mín 2X₁ − 2X₂'],
      ['max',2,4,'IV · Máx 2X₁ + 4X₂'], ['min',-3,-2,'V · Mín −3X₁ − 2X₂']
    ], { domains: free }),
  exercise('g2', 'Inecuaciones · Problema 2', graphic, 1, 'Avanzado',
    graphIntro('x₁ − 3x₂ ≤ 6; 2x₁ + 4x₂ ≥ 8; x₁ − 3x₂ ≥ −6.', [
      'I) z = máx (2x₁ + 3x₂)', 'II) z = mín (x₁ + 2x₂)', 'III) z = máx (x₁ − 6x₂)', 'IV) z = mín (x₁ − 2x₂)'
    ]),
    [[1,-3,'<=',6],[2,4,'>=',8],[1,-3,'>=',-6]], [
      ['max',2,3,'I · Máx 2X₁ + 3X₂'], ['min',1,2,'II · Mín X₁ + 2X₂'],
      ['max',1,-6,'III · Máx X₁ − 6X₂'], ['min',1,-2,'IV · Mín X₁ − 2X₂']
    ], { domains: free }),
  exercise('g3','Región del plano · Problema 3',graphic,1,'Básico',
    'Dada la región del plano definida por las inecuaciones:\nx + y − 1 ≥ 0; 0 ≤ x ≤ 3; 0 ≤ y ≤ 2.\n¿Para qué valores de la región es máxima la función Z = 5x + 2y?',
    [[1,1,'>=',1],[1,0,'<=',3],[0,1,'<=',2]], [['max',5,2]]),
  exercise('g4','Recinto triangular · Problema 4',graphic,1,'Intermedio',
    'Se considera el recinto plano de la figura en el que están incluidos los tres lados y los tres vértices de las rectas asociadas a las desigualdades. a) Hallar las inecuaciones que definen el recinto. b) Maximizar la función Z = 3x − 6y sujeta a las restricciones del recinto.',
    [[-1,1,'>=',0],[-3,1,'<=',0],[0,1,'<=',3]], [['max',3,-6]],
    { note: 'Los puntos O (0, 0), A (1, 3) y B (3, 3) se leyeron de las marcas de la figura.' }),
  exercise('g5','Primer cuadrante · Problema 5',graphic,2,'Intermedio',
    'Se considera la región del primer cuadrante determinada por las inecuaciones:\nx + y ≤ 8; x + y ≥ 4; x + 2y ≥ 6.\na) Dibujar la región del plano que definen, y calcular sus vértices.\nb) Hallar el punto de esa región en el que la función F(x,y) = 3x + 2y alcanza el valor mínimo y calcular dicho valor.',
    [[1,1,'<=',8],[1,1,'>=',4],[1,2,'>=',6]], [['min',3,2]]),
  exercise('g6','Máximo y mínimo · Problema 6',graphic,2,'Intermedio',
    'a) Representar gráficamente el conjunto de puntos que satisfacen las siguientes inecuaciones lineales:\nx + 2y ≤ 10; x + y ≥ 2; x ≤ 8; x ≥ 0; y ≥ 0.\nb) Hallar el máximo y el mínimo de F(x,y) = x − 3y, sujeto a las restricciones representadas por las inecuaciones del apartado anterior.',
    [[1,2,'<=',10],[1,1,'>=',2],[1,0,'<=',8]], [['max',1,-3],['min',1,-3]]),
  exercise('sony','SONY',simplex,1,'Básico',
    'SONY fabrica dos productos: (1) un Walkman y (2) el Shader TV, un televisor del tamaño de un reloj de pulsera. El proceso de producción de ambos productos se asemeja en que los dos necesitan un número de horas de trabajo en el departamento de electrónica, y un cierto número de horas de mano de obra en el departamento de montaje. Cada Walkman necesita cuatro horas de trabajo de electrónica y dos en el taller de montaje. Cada televisor necesita tres horas de electrónica y una en montaje. Durante el actual período de producción se dispone de doscientas cuarenta horas en el departamento de electrónica y de cien horas en el de montaje. Cada Walkman vendido supone un beneficio de 7 dólares, mientras que para un televisor el beneficio unitario es de cinco dólares. El problema de SONY es determinar la mejor combinación posible de Walkman y televisores que debe producir para alcanzar el máximo beneficio.',
    [[4,3,'<=',240],[2,1,'<=',100]], [['max',7,5]], { other: formulations + ', p. 1' }),
  exercise('agricultor','Agricultor',simplex,1,'Intermedio',
    'Un agricultor posee 100 has. de campo; una parte del mismo sembrará con papas, otra con cereales y una tercera se dejará eventualmente sin plantar. El costo del cultivo es de $10 x ha para las papas y de $20 x ha para los cereales. En jornales pagará $1 x ha para las papas y $4 x ha para los cereales. Dispone de $1100 para el cultivo y $160 para los jornales.\nCómo debe organizar la plantación para obtener un beneficio máximo, siendo la ganancia a obtener de $40 x ha y de $120 x ha, respectivamente?\nSe trata de:\na) plantear el problema en PL (programación lineal)\nb) calcular la solución óptima aplicando el método Simplex\nc) explicar los resultados alcanzados\nd) plantear el problema Dual asociado al método Simplex\ne) calcular la solución óptima del Dual',
    [[10,20,'<=',1100],[1,4,'<=',160],[1,1,'<=',100]], [['max',40,120]],
    { other: formulations + ', p. 1', note: 'Se utiliza 1100 según el enunciado y la tabla. La fórmula de planteos imprime 1.1000.' }),
  exercise('mcdonalds','McDonald’s',simplex,1,'Básico',
    'La empresa McDonald’s vende hamburguesas de un cuarto de libra y hamburguesas con queso. La hamburguesa de un cuarto de libra obviamente utiliza ¼ de libra de carne y la hamburguesa con queso sólo utiliza 0,2 libras. El restaurante empieza cada día con 200 libras de carne. La utilidad neta es la siguiente: 0,20$ por cada hamburguesa de cuarto de libra y $0,15 por cada hamburguesa con queso. El gerente estima además que no venderá más de 900 hamburguesas en total. Determine la máxima utilidad que puede obtener McDonald’s.',
    [['1/4','1/5','<=',200],[1,1,'<=',900]], [['max','1/5','3/20']], { other: formulations + ', p. 1' }),
  exercise('camiones','Camiones',simplex,1,'Intermedio',
    'Una compañía de transportes posee 2 tipos de camiones. El camión tipo A tiene 20 m3 de espacio refrigerado y 40 m3 no refrigerado. El camión tipo B tiene 30 m3 refrigerados y 30 m3 no refrigerados. Una fábrica de productos alimenticios debe embarcar 900 m3 de productos refrigerados y 1200 no refrigerados. ¿Cuántos camiones de cada tipo debe alquilar la fábrica para minimizar costos si el tipo A se alquila a 30 $/Km y el B a 40 $/Km?',
    [[20,30,'>=',900],[40,30,'>=',1200]], [['min',30,40]], { other: formulations + ', p. 2' }),
  exercise('industria','Industria',combined,2,'Intermedio',
    "Una industria fabrica 2 productos diferentes: P1 y P2. En la elaboración intervienen:\na) mano de obra, b) materia prima, c) amortización de los equipos, según el sgte detalle:\nQué cantidad de unidades X₁ y X₂ de los productos se deben fabricar p'q los beneficios sean máximos",
    [[20,10,'<=',100000],[10,30,'<=',180000],[5,1,'<=',40000]], [['max',8,5]],
    { other: combined + ', p. 1', sourceTable: [['', 'P1 (X₁)', 'P1 (X₂)', 'Restricciones'], ['a', '20', '10', '100,000'], ['b', '10', '30', '180,000'], ['c', '5', '1', '40,000'], ['Beneficio', '8', '5', 'máx']],
      note: 'La tabla de la p. 2 repite P1 en el encabezado. Se descarta el cociente −10000 porque su denominador es negativo.' }),
  exercise('practica-max','Práctica Máx',practice,1,'Intermedio',
    'Simplex-2: ejemplo para practicar Máx\n2X₁ + X₂ ≤ 10.000\nX₁ + 3X₂ ≤ 15.000\nX₁ + X₂ ≤ 10.000\n2X₁ + 2X₂ ≤ 12.000\nX₁ ≥ 0; X₂ ≥ 0\nZ = máx (4X₁ + 3X₂)',
    [[2,1,'<=',10000],[1,3,'<=',15000],[1,1,'<=',10000],[2,2,'<=',12000]], [['max',4,3]],
    { other: combined + ', p. 5', note: 'Se conserva la tercera restricción tal como aparece en la tabla impresa.' }),
  exercise('alimentos','Alimentos · Modelo impreso',combined,3,'Avanzado',
    'Se plantea el problema de tener que hacer una mezcla de mínimo costo entre 2 alimentos A y B, sabiendo que la misma debe tener más del 20% de vitamina y más del 30% de proteína. La composición de los alimentos es: A posee 10% de vitamina y 50% de proteína, B posee 40% y 20% respectivamente.\nEl alimento A cuesta $80 el kg. y el B, $100 el kg.\nEn qué proporción se deben mezclar los alimentos para lograr un costo mínimo.',
    common, [['min',80,100]], { other: combined + ', pp. 1 y 4',
      sourceTable: [['', 'A (X₁)', 'B (X₂)', 'Restricciones'], ['Vitamina', '10', '40', '20'], ['Proteína', '50', '20', '30'], ['Costo', '80', '100', 'mín']],
      note: 'El modelo algebraico usa ≥ y no fija un kilogramo. La solución tiene masa 5/6 kg. La guía imprime 74,442, 74,444 y 76. El resultado exacto es 670/9.' }),
  exercise('alimentos-kg','Alimentos · Un kilogramo',graphic,2,'Avanzado',
    dietText + '\n¿Con qué proporción de cada alimento conviene componer cada Kg del nuevo producto para minimizar su costo?\na) Expresar: las condiciones de no negatividad, las condiciones de ligadura, la función objetivo.\nb) Representar gráficamente las inecuaciones.\nc) Resolver gráficamente.\nd) Explicar los resultados obtenidos.',
    [...common,[1,1,'=',1]], [['min',80,100]],
    { note: 'Esta variante fija un kilogramo y usa cotas inclusivas. Con la lectura estricta de «más del», 260/3 es un ínfimo que no se alcanza.' })
];
