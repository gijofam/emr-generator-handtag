# Plan de implementación: módulo profesional de PDF para Handtags

## 1. Objetivo

Implementar un módulo de generación de PDF para handtags sobre la arquitectura actual, sin modificar la base de datos, los modelos Prisma, la API, las rutas, los controladores ni la estructura general del proyecto.

El objetivo es soportar:

- Handtags individuales.
- Imposición automática sobre hojas de impresión.
- Uso de plantillas PNG oficiales para frente y reverso.
- Inserción dinámica del QR en una posición configurable.
- La posición del QR se definirá mediante parámetros configurables: X, Y, ancho y alto.
- Estas coordenadas no quedarán codificadas en el código fuente; estarán disponibles desde la configuración del módulo.
- Cálculo automático de filas, columnas, hojas y aprovechamiento del papel.

---

## 2. Arquitectura del módulo

La arquitectura actual ya tiene un flujo claro y válido:

1. El controlador recibe la solicitud.
2. El servicio de handtags coordina la operación.
3. El servicio de lotes gestiona la generación del lote.
4. El repositorio persiste los datos en Prisma.
5. Se escriben archivos en la carpeta de salida del lote.

### Estructura que se conservará

- [backend/src/controllers/handtagController.js](backend/src/controllers/handtagController.js)
- [backend/src/routes/handtagRoutes.js](backend/src/routes/handtagRoutes.js)
- [backend/src/services/handtagService.js](backend/src/services/handtagService.js)
- [backend/src/services/batchService.js](backend/src/services/batchService.js)
- [backend/src/repositories/handtagRepository.js](backend/src/repositories/handtagRepository.js)
- [backend/src/repositories/productRepository.js](backend/src/repositories/productRepository.js)
- [backend/src/config/app.js](backend/src/config/app.js)

### Principio de integración

La implementación se añadirá dentro de esta base existente, manteniendo:

- El mismo contrato de entrada del endpoint actual.
- El mismo flujo de generación de lotes.
- El mismo almacenamiento de archivos en la carpeta del lote.
- El mismo modelo de respuesta JSON.

No se introducirán nuevas capas de arquitectura ni nuevos patrones de diseño complejos.

---

## 3. Archivos nuevos que será necesario crear

Se prevé crear archivos pequeños y focalizados para encapsular la lógica de impresión, sin afectar la arquitectura general.

### Archivos nuevos recomendados

1. [backend/src/utils/printLayout.js](backend/src/utils/printLayout.js)
   - Encargado de calcular:
     - tamaño real del handtag
     - sangrado
     - tamaño efectivo
     - cantidad máxima de handtags por hoja
     - filas
     - columnas
     - hojas necesarias
     - porcentaje de aprovechamiento

2. [backend/src/utils/printConfig.js](backend/src/utils/printConfig.js)
   - Contendrá la lógica de conversión entre unidades del sistema y unidades de PDF.
   - Será útil para traducir mm a puntos PDF y para normalizar tamaños personalizados.

3. [backend/src/utils/templateRenderer.js](backend/src/utils/templateRenderer.js)
   - Encargado de componer cada handtag con:
     - plantilla frontal
     - QR
     - plantilla reversa
   - Deja la lógica de render de imagen en un solo sitio.

4. [backend/src/utils/printTemplates.js](backend/src/utils/printTemplates.js)
   - Definirá la estructura de configuración de plantillas, por ejemplo:
     - ruta frontal
     - ruta reversa
     - posición del QR definida por X, Y, ancho y alto
     - opciones de impresión

### Nota importante

Aunque se prevén archivos nuevos, su función será estrictamente utilitaria y no alterará la arquitectura existente.

---

## 4. Archivos existentes que será necesario modificar

### Modificaciones principales

1. [backend/src/services/batchService.js](backend/src/services/batchService.js)
   - Será el punto central del flujo de generación profesional.
   - Se encargará de:
     - validar configuración
     - coordinar generación de QR
     - invocar la composición del PDF
     - escribir los archivos de salida
     - devolver la respuesta esperada

2. [backend/src/services/handtagService.js](backend/src/services/handtagService.js)
   - Se mantendrá como capa de entrada para el endpoint actual.
   - Delegará en el servicio de lotes la generación completa.

3. [backend/src/config/app.js](backend/src/config/app.js)
   - Se ampliará con valores por defecto de impresión, por ejemplo:
     - tamaño base del handtag
     - sangrado por defecto
     - márgenes por defecto
     - separación por defecto
     - formatos de papel soportados

### Archivos que no se modificarán

- [backend/prisma/schema.prisma](backend/prisma/schema.prisma)
- [backend/src/controllers/handtagController.js](backend/src/controllers/handtagController.js)
- [backend/src/routes/handtagRoutes.js](backend/src/routes/handtagRoutes.js)
- [backend/src/repositories/handtagRepository.js](backend/src/repositories/handtagRepository.js)
- [backend/src/repositories/productRepository.js](backend/src/repositories/productRepository.js)

---

## 5. Flujo completo desde la generación del código hasta el PDF final

### Fase 1: creación del lote

1. El endpoint recibe el request con el producto, cantidad y notas.
2. El servicio de handtags delega en el servicio de lotes.
3. Se crea el batch en base de datos y se actualiza su estado a GENERATING.

### Fase 2: generación de códigos y QR

4. Por cada código del lote:
   - se genera un código único
   - se arma la URL del QR
   - se genera el QR en buffer o archivo
   - se guarda la información en memoria del lote

### Fase 3: configuración de impresión

5. Se leen las opciones de impresión:
   - modo individual o imposición
   - papel seleccionado
   - sangrado
   - márgenes
   - separación
   - plantillas frontal y reversa
   - posición del QR configurada por X, Y, ancho y alto

### Fase 4: renderizado del handtag

6. Para cada código:
   - se carga la plantilla frontal PNG
   - se inserta el QR en la posición configurada
   - se conserva intacto el diseño de la plantilla
   - se carga la plantilla reversa PNG
   - se compone el resultado para el PDF

### Fase 5: generación del PDF

7. Si el modo es individual:
   - se genera un PDF con una página por cada frente y reverso del handtag.

8. Si el modo es imposición automática:
   - se calcula el número máximo de handtags por hoja
   - se distribuyen en filas y columnas
   - se compone una página con la grilla de handtags
   - se generan las páginas necesarias hasta completar todos los códigos

### Fase 6: cierre del proceso

9. Se escriben los archivos en la carpeta del lote.
10. Se actualiza el batch a COMPLETED.
11. Se devuelve la respuesta JSON con los enlaces de descarga.

---

## 6. Responsabilidades de cada servicio

### [backend/src/services/handtagService.js](backend/src/services/handtagService.js)

Responsabilidades:

- recibir la solicitud del endpoint
- validar entrada mínima del negocio
- delegar en batchService
- mantener el contrato de la API estable

### [backend/src/services/batchService.js](backend/src/services/batchService.js)

Responsabilidades:

- orquestar todo el proceso de generación del lote
- mantener el flujo de creación de códigos
- coordinar la generación del PDF final
- gestionar los archivos de salida
- devolver la respuesta final

### Utilidades nuevas

#### [backend/src/utils/printLayout.js](backend/src/utils/printLayout.js)

Responsabilidades:

- convertir medidas a puntos PDF
- calcular columnas y filas máximas
- calcular hojas necesarias
- calcular porcentaje de aprovechamiento

#### [backend/src/utils/templateRenderer.js](backend/src/utils/templateRenderer.js)

Responsabilidades:

- cargar plantillas PNG
- insertar QR en la ubicación configurada mediante X, Y, ancho y alto
- componer el frente y el reverso
- preparar la imagen final para el PDF

#### [backend/src/utils/printConfig.js](backend/src/utils/printConfig.js)

Responsabilidades:

- centralizar la configuración de tamaños, márgenes, sangrados y posición del QR
- facilitar la configuración futura sin tocar la lógica de negocio

---

## 7. Algoritmo para el cálculo automático de imposición

### Datos base

- Tamaño real del handtag: 160 mm × 65 mm
- Sangrado por lado: 3 mm
- Tamaño efectivo para cálculo: 166 mm × 71 mm

### Fórmula base

- Ancho efectivo = 160 + 2 × 3 = 166 mm
- Alto efectivo = 65 + 2 × 3 = 71 mm

### Pasos del algoritmo

1. Convertir el tamaño efectivo del handtag a puntos PDF.
2. Convertir el tamaño del papel seleccionado a puntos PDF.
3. Restar márgenes laterales y superiores/inferiores para obtener el área útil del papel.
4. Restar la separación entre handtags en el eje X e Y.
5. Calcular el número máximo de columnas posible:
   - mientras que el ancho acumulado de la grilla no supere el ancho útil.
6. Calcular el número máximo de filas posible:
   - mientras que el alto acumulado de la grilla no supere el alto útil.
7. Determinar el máximo de handtags por hoja como:
   - columnas × filas
8. Calcular el número total de hojas necesarias:
   - ceil(totalDeHandtags / handtagsPorHoja)
9. Calcular el porcentaje de aprovechamiento del papel:
   - (handtagsPorHoja real × área del handtag) / área útil del papel × 100

### Consideraciones importantes

- El cálculo debe ser dinámico y no depender de valores hardcodeados.
- Debe aplicarse para cada tipo de papel y para cada configuración de márgenes y separación.
- En caso de un tamaño personalizado, el algoritmo debe adaptarse al ancho y alto ingresados por el usuario.
- La lógica deberá ser determinista y reutilizable para cualquiera de los modos de salida.

### Resultado esperado

El sistema deberá mostrar o usar automáticamente:

- máximo de handtags por hoja
- número de filas
- número de columnas
- número total de hojas
- porcentaje de aprovechamiento

---

## 8. Librerías que se utilizarán y justificación

### Librerías existentes

1. [pdfkit](backend/package.json)
   - Se utilizará para generar el PDF final.
   - Permite insertar imágenes PNG, dibujar texto, componer páginas y controlar márgenes.
   - Es la base idónea para la generación de documentos profesionales.

2. [qrcode](backend/package.json)
   - Se utilizará para generar el QR para cada código.
   - Permite producir un buffer o un archivo PNG de forma sencilla.

### Librerías recomendadas para evaluación

3. [image-size](https://www.npmjs.com/package/image-size)
   - Útil para leer dimensiones reales de una plantilla PNG si se requiere adaptar el layout automáticamente.
   - Ayuda a evitar estimaciones manuales cuando las plantillas no tengan un tamaño estandarizado.

### Justificación general

- No se requiere introducir una arquitectura nueva.
- Se aprovechan las librerías ya presentes.
- La solución se mantiene ligera y alineada con el stack actual.
- Para el caso de plantillas PNG y cálculos de imposición, `pdfkit` + `qrcode` son suficientes; `image-size` solo se considerará si se detecta que la lectura automática de tamaños mejora la robustez del módulo.

---

## 9. Riesgos técnicos identificados

1. Diferencias de tamaño entre las plantillas PNG y las medidas reales del handtag.
   - Riesgo: el diseño no encaja correctamente si la imagen no está en el tamaño esperado.

2. Posiciones del QR no alineadas con el diseño oficial.
   - Riesgo: el QR puede quedar fuera del área visual o alterar el diseño.

3. Variación entre tipos de papel y márgenes.
   - Riesgo: la imposición automática puede generar hojas con espacio perdido o superposición.

4. Compatibilidad con plantillas de diferente resolución.
   - Riesgo: las imágenes pueden verse pixeladas o deformadas si no se escalan correctamente.

5. Complejidad de la imposición en modo duplex.
   - Riesgo: la distribución de frentes y reversos debe ser consistente para que la impresión sea correcta.

### Mitigación propuesta

- Mantener la lógica de layout en utilidades pequeñas y testeables.
- Permitir configuración explícita de posición del QR por plantilla.
- Mantener los cálculos basados en medidas reales y no en valores fijos.
- Documentar los formatos de papel soportados y la forma en que se traducen a PDF.

---

## 10. Posibles mejoras futuras

1. Permitir subir nuevas plantillas desde la interfaz.
2. Añadir una vista previa del layout antes de generar el PDF.
3. Soportar impresión a doble cara con control más fino.
4. Permitir guardar configuraciones de impresión por producto.
5. Añadir marcas de corte y sangrado visibles en el PDF para producción.
6. Soportar más tamaños de papel o formatos industriales.

---

## 11. Fase de implementación propuesta

### Fase 1

- Integrar la lógica de layout y cálculo de imposición.
- Mantener el flujo actual de generación de lotes.

### Fase 2

- Integrar composición de plantilla frontal y reversa con QR.
- Probar modo individual.

### Fase 3

- Implementar imposición automática.
- Probar con distintos tamaños de papel y márgenes.

### Fase 4

- Ajustar detalles visuales y métricas de aprovechamiento.
- Validar el PDF generado de forma práctica.

---

## 12. Decisión de diseño

La implementación se realizará de forma incremental, conservando la arquitectura aprobada y minimizando el riesgo.

No se tocará:

- la base de datos
- los modelos Prisma
- la API
- las rutas
- los controladores
- la arquitectura general

La generación profesional de PDF se integrará dentro del flujo actual del backend, utilizando las capas ya existentes y agregando lógica utilitaria pequeña y específica.
