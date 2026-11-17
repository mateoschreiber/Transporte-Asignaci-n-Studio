const compare = 'Compare las soluciones de inicio obtenidas con los métodos de Esquina NO, de Costo Mínimo y de Vogel, en cada uno de los planteos siguientes:';
const jobShop = 'La empresa JobShop debe asignar 4 tareas a 4 trabajadores. El costo de realizar un trabajo es función de los conocimientos de los trabajadores. La siguiente tabla resume el costo de las asignaciones. El trabajador 1 no puede hacer el trabajo 3, y el trabajador 3 no puede hacer el trabajo 4. Determine la asignación óptima con el método Húngaro.';

export const originalStatements = {
  mataderos: {
    reference: 'Problema 1',
    before: ['Dos mataderos, P y Q, se encargan de suministrar la carne consumida semanalmente en tres ciudades, R, S y T: 20, 22 y 14 toneladas, respectivamente. El matadero P produce cada semana 26 toneladas de carne, y el Q, 30. Sabiendo que los costes de transporte, por tonelada de carne, desde cada matadero a cada ciudad, son los reflejados en la siguiente tabla:'],
    after: ['Utilizando el método SIMPLEX de Transporte, determinar cuál es la distribución que supone un costo mínimo.']
  },
  abc: {
    reference: 'Problema 2',
    before: [
      'La empresa transportista ABC posee varios camiones para acarrear piedra molida para proyectos de carreteras en el municipio. El contratista de carreteras para quien trabaja le ha dado el programa de la semana siguiente.',
      'Utilizando el método SIMPLEX de Transporte, calcule el costo óptimo del transporte'
    ]
  },
  electricidad: {
    reference: 'Problema 3',
    before: ['Tres centrales de distribución tienen que dar electricidad a tres ciudades.', 'La tabla de costos de transporte de electricidad es la siguiente:'],
    after: ['Determine las variables de decisión y plantee el problema de minimización, estableciendola distribución eléctrica para cada ciudad, utilizando el método SIMPLEX de Transporte.']
  },
  pt: {
    reference: 'Diapositivas 14-3 y 14-4',
    before: [
      'Uno de los productos más importantes de la P & T Company son los chícharos enlatados. Los chícharos se preparan en 3 enlatadoras:',
      ['Bellingham (Washington).', 'Eugene (Oregon).', 'Albert Lea (Minessota).'],
      'Luego se mandan por camión a 4 almacenes de distribución:',
      ['Sacramento (California).', 'Salt Lake City (Utah).', 'Rapid City (South Dakota).', 'Alburqueque (Nuevo México).'],
      'Los costos de embarque constituyen un gasto importante. Veamos estos en la siguiente tabla:'
    ]
  },
  northern: {
    reference: 'Diapositivas 14-15 y 14-16',
    before: [
      'La Northern Airplane CO. construye aviones comerciales para varias líneas en todo el mundo. La última etapa del proceso de producción consiste en fabricar los motores de turbina e instalarlos.',
      'Se debe programar la producción para los próximos 4 meses. En cada mes, teniendo en cuenta que las instalaciones disponibles limitan el número de motores que se pueden fabricar, debe cumplirse con unas demandas.',
      'Veamos la tabla'
    ],
    table: {
      caption: 'Producción, instalaciones y costos unitarios',
      rowPrefix: 'Mes',
      rows: ['1', '2', '3', '4'],
      columns: ['Instalaciones programadas', 'Producción máxima', 'Costo unitario producción', 'Costo unitario almacenaje'],
      values: [[10, 25, '1.08', '0.015'], [15, 35, '1.11', '0.015'], [25, 30, '1.10', '0.015'], [20, 10, '1.13', '']]
    },
    after: ['El gerente de producción quiere calcular la programación del número de motores, que se deben fabricar en cada uno de los 4 meses, de manera que se minimicen los costos totales de producción y almacenaje']
  },
  metro: {
    reference: 'Clase 15, pág. 1, diapositivas 15-3 a 15-6',
    before: [
      'El Distrito Metro es una dependencia que administra la distribución de agua en cierta región geográfica grande. El distrito debe comprar y traer agua desde fuera de ella.',
      'Las fuentes de agua son 3 ríos y se debe proveer de agua a 4 ciudades. Los costos varían entre ciudades y ríos.',
      'Nota: No hay forma de abastecer HollyGlass con agua del río Calorie.',
      'La administración tiene que resolver el problema de cómo asignar el agua disponible durante el próximo verano.',
      'Los ríos tienen cierta cantidad disponible, y el distrito se compromete a distribuir unas cantidades mínimas.',
      'Además las ciudades pueden solicitar agua por encima de los requerimientos mínimos.',
      'Se desea minimizar el costo total. Veamos la tabla'
    ],
    table: {
      caption: 'Costo por acre pie. Recursos y demandas en millones de acres-pie.',
      rowPrefix: 'Destino',
      rows: ['Río Colombo', 'Río Sacron', 'Río Calorie', 'Mín necesario', 'Solicitado'],
      columns: ['Berdoo', 'Los Devils', 'San Go', 'Hollyglass', 'Recursos'],
      values: [[16, 13, 22, 17, 50], [14, 13, 19, 15, 60], [19, 20, 23, '–', 50], [30, 70, 0, 10, ''], [50, 70, 30, '∞', '']]
    },
    after: ['Nota: Por ejemplo Berdoo aceptaría hasta 20 millones de acres-pie por encima del mínimo requerido.']
  },
  fabricas: {
    before: ['3 fábricas - 3 ciudades - satisfacer la demanda distribuyendo con costo mínimo']
  },
  'sbf-a': { reference: 'Planteo a)', before: [compare] },
  'sbf-b': { reference: 'Planteo b)', before: [compare] },
  'sbf-c': { reference: 'Planteo c)', before: [compare] },
  maquinas: {
    reference: 'Problema 1',
    before: ['Se necesita procesar 4 diferentes tareas para lo cual se cuenta con 4 máquinas. Por diferencias tecnológicas el desperdicio que se produce depende del tipo de tarea y la máquina en la cual se ejecuta. Dada la matriz de desperdicios expresada en pesos, definir la asignación óptima para minimizarlos utilizando el método Húngaro.']
  },
  natacion: {
    reference: 'Problema 2',
    before: ['El entrenador de un equipo de natación debe asignar competidores para la prueba de 200 metros de relevo combinado que irán a las Olimpíadas Juveniles. Como muchos de sus nadadores son rápidos en más de un estilo, debe decidir qué nadador asignas a cada uno de los 4 estilos. Los 5 mejores nadadores y sus mejores tiempos (en segundos) en cada estilo son los siguientes:']
  },
  'job-a': { reference: 'Problema 3, inciso a)', before: [jobShop] },
  'job-b': {
    reference: 'Problema 3, inciso b)',
    before: [jobShop],
    tableExercise: 'job-a',
    after: ['b) Suponga que queda disponible un quinto trabajador para desempeñar los 4 puestos, con los costos respectivos de 60, 45, 30 y 80. ¿Será económico reemplazar a uno de los 4 trabajadores actuales con el nuevo?']
  },
  'job-c': {
    reference: 'Problema 3, inciso c)',
    before: [jobShop],
    tableExercise: 'job-a',
    after: ['c) Suponga que JobShop abre un quinto puesto (trabajo) y que los costos respectivos por hacerlo con los 4 trabajadores actuales son 20, 10, 20 y 80. ¿Debe tener prioridad el puesto nuevo sobre cualesquiera de los 4 que ya tiene JobShop?']
  }
};
