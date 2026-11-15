# POS Llantera

Punto de venta local para una llantera. Proyecto de portafolio v0.3 en desarrollo, con inventario propio e intermediación, cotizaciones, cobranza y comisiones. Incluye vista previa y salida a PDF en Carta vertical desde el diálogo de impresión.

## Ejecutar

Requiere Node.js 24. Desde la carpeta del repositorio, en PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abre [http://127.0.0.1:5180/](http://127.0.0.1:5180/). La base del portafolio se guarda en el navegador. Para compilar y probar la PWA, detén el servidor de desarrollo y ejecuta `npm.cmd run build` y `npm.cmd run preview`.

## Demo

Ejecuta `npm.cmd run demo`. En el POS de portafolio, abre **Configuración → Seleccionar respaldo**, elige `demo/datos-ficticios.json` y confirma la carga. La importación reemplaza el contenido de la base del portafolio. El archivo se genera localmente con registros ficticios.

**Cotización → Pedido → Venta → Abonos.** Crea una cotización para un cliente, convierte la opción elegida en pedido, confirma el origen de las llantas al registrar la venta y captura y confirma los abonos. La demo incluye una venta liquidada para revisar **Comisiones → Generar reporte → Imprimir / guardar PDF**.

**Tecnologías** · React, TypeScript, Vite y Dexie sobre IndexedDB, con PWA para uso sin conexión tras la carga inicial. Pruebas con `npm.cmd test`.

**Pendientes** · Recorrido guiado interactivo y chat de dudas.
