# Validación 65 × 140 mm / A4

Cambios de esta tarea (se conservaron las modificaciones previas del usuario):
- backend/src/config/app.js: corte 65 × 140 mm, sangrado 2 mm, separación 1 mm, margen de hoja 0 mm, A4 210 × 297 mm; QR predeterminado de 30 mm en X=13, Y=74, referido al PNG ajustado.
- backend/src/utils/printConfig.js: mismos valores de respaldo.
- backend/src/utils/printLayout.js: conserva comparación automática de ambas orientaciones, expone orientación ganadora, valida dimensiones y rechaza piezas que no caben (antes forzaba al menos una).
- backend/src/services/pdfService.js: respeta el slot recibido, separa corte/sangrado, reutiliza resolveTemplateDrawRect para contain centrado y mantiene el QR cuadrado dentro del PNG ajustado. Sin rotaciones.
- frontend/src/services/calibrationStore.js: nuevas medidas y posición QR predeterminada.
- frontend/src/components/CalibrationPanel.jsx: conversión uniforme e inversa entre píxeles/mm; QR cuadrado al arrastrar, redimensionar y editar medidas.
- backend/tests/print-regression.cjs: prueba reproducible con PDFs reales, repositorios simulados, CSV, generación/reintento de códigos, geometría y calibración.

Diagnóstico reproducido antes de editar: PNG frontal 798 × 1971 y reverso 800 × 1967 enviados a un rectángulo horizontal de 166 × 71 mm. Escalas distintas por eje; la función proporcional existente no se utilizaba. BEFORE_1.pdf conserva la evidencia.

Layout matemático: vertical 3 columnas × 2 filas = 6; horizontal 1 columna × 4 filas = 4. Gana vertical. Slot 69 × 144 mm = 195.59055123 × 408.18897648 puntos. Ocupación 209 × 289 mm. X de slots: 0, 70, 140 mm; Y: 0, 145 mm. Corte desplazado 2 mm dentro de cada slot. No se codifica una capacidad fija en producción.

Pruebas: 1 pieza → 1 frente + 1 reverso; 6 → 1 + 1; 7 → 2 + 2, repartidas 6/1; 12 → 2 + 2, repartidas 6/6. Orden frente/reverso intercalado, mismos códigos y posiciones. PDF preview de dos páginas, desplazamiento y proporciones comprobados. CSV y códigos pasan, incluida colisión simulada. Compilación frontend pasa. Ejecutar desde raíz: node backend/tests/print-regression.cjs.

Revisión visual: páginas renderizadas con Windows.Data.Pdf y comparadas con ambos PNG activos. Logo, textos, círculos, marco QR, proporciones, orientación, separación y posiciones correctos en los cuatro lotes y preview. Las plantillas conservan sus hashes originales.

Límites reales:
- El corte nominal es 65 × 140 mm. Por contain, el PNG frontal ocupa aproximadamente 56.68 × 140 mm y el reverso 56.94 × 140 mm, centrados. Quedan blancos laterales; el contorno negro del PNG no define el corte de 65 mm.
- Los 2 mm de bleed están reservados geométricamente y quedan blancos. No se inventó/extiendió arte ni se añadieron marcas de corte. No se presenta este resultado como arte con fondo a sangre listo para guillotina.
- Se conservan las calibraciones guardadas en el navegador; las antiguas requieren reajuste/guardado para las nuevas medidas. Restablecer carga la nueva posición predeterminada verificada visualmente.
- Se comprobó el flujo de lotes con repositorios simulados; no se ejecutaron operaciones sobre una DB real ni una impresión física dúplex.

Sin modificaciones a Prisma, DB, node_modules, qrService, rutas, controladores ni PNG activos. Artefactos de prueba en esta carpeta; validation.json contiene posiciones y tamaños completos.
