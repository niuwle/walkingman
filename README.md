# 🚶‍♂️ Fog of Walk - Explora tu Barrio

Una aplicación web gamificada que convierte tus caminatas en una aventura de exploración usando el concepto de "niebla de guerra" aplicado a tu barrio.

## 🎯 Características del MVP

### ✅ Funcionalidades Implementadas

1. **📍 Geolocalización**
   - Acceso al GPS del dispositivo
   - Ubicación en tiempo real del usuario
   - Permisos de geolocalización seguros

2. **🗺️ Mapa Interactivo**
   - Integración con OpenStreetMap y Leaflet.js
   - Visualización de rutas generadas
   - Marcadores de inicio y fin
   - Mapa responsivo y centrado en la ubicación del usuario

3. **🎲 Generación de Rutas**
   - Rutas circulares de aproximadamente 10 minutos
   - Algoritmo que evita rutas previamente completadas
   - Rutas adaptadas a la ubicación actual del usuario

4. **🚶‍♂️ Seguimiento de Progreso**
   - Tracking en tiempo real de la posición del usuario
   - Verificación automática si el usuario sigue la ruta
   - Barra de progreso visual
   - Detección automática de finalización (90% de la ruta)

5. **💾 Sistema de Memoria**
   - Almacenamiento local de rutas completadas
   - Persistencia del progreso del juego
   - Historial de logros y estadísticas

6. **🎮 Gamificación**
   - Sistema de XP (100 XP por ruta completada)
   - Sistema de niveles dinámico
   - Contador de rutas completadas
   - Sistema de logros y achievements
   - Interfaz visual atractiva con gradientes y animaciones

## 🚀 Cómo Usar la Aplicación

### Paso 1: Obtener Ubicación
1. Abre `index.html` en tu navegador móvil
2. Presiona "📍 Obtener Ubicación"
3. Permite el acceso a la ubicación cuando el navegador lo solicite

### Paso 2: Generar Ruta
1. Una vez obtenida la ubicación, presiona "🗺️ Generar Ruta"
2. La app creará una ruta circular de ~10 minutos alrededor de tu ubicación
3. Verás la ruta dibujada en azul en el mapa

### Paso 3: Comenzar Caminata
1. Presiona "🚶‍♂️ Comenzar Caminata"
2. La app comenzará a rastrear tu ubicación en tiempo real
3. Sigue la ruta azul mostrada en el mapa
4. La barra de progreso se actualizará automáticamente

### Paso 4: Completar Ruta
1. Cuando hayas caminado el 90% de la ruta, podrás completarla
2. Presiona "✅ Completar Ruta"
3. ¡Ganarás 100 XP y posiblemente subas de nivel!

## 🛠️ Tecnologías Utilizadas

- **HTML5**: Estructura de la aplicación
- **CSS3**: Diseño responsivo con gradientes y animaciones
- **JavaScript ES6+**: Lógica de la aplicación y gamificación
- **Leaflet.js**: Mapas interactivos
- **OpenStreetMap**: Datos de mapas gratuitos
- **Geolocation API**: Acceso al GPS del dispositivo
- **LocalStorage**: Persistencia de datos del juego

## 📱 Compatibilidad

- ✅ Navegadores móviles modernos (Chrome, Safari, Firefox)
- ✅ Dispositivos con GPS
- ✅ Conexión a internet requerida para cargar mapas
- ✅ Diseño responsivo para móviles y tablets

## 🎯 Características del Sistema de Juego

### Sistema de Niveles
- **Nivel 1**: 0 XP
- **Nivel 2**: 400 XP
- **Nivel 3**: 900 XP
- **Nivel N**: (N²) × 100 XP

### Sistema de XP
- **Ruta Completada**: +100 XP
- **Subida de Nivel**: Logro especial

### Logros
- Rutas completadas numeradas
- Notificaciones de subida de nivel
- Historial de los últimos 5 logros

## 🔧 Instalación y Uso

1. **Descarga los archivos**:
   - `index.html`
   - `style.css`
   - `script.js`

2. **Abre en un servidor web**:
   ```bash
   # Opción 1: Servidor simple con Python
   python -m http.server 8000
   
   # Opción 2: Servidor simple con Node.js
   npx serve .
   
   # Opción 3: Abrir directamente index.html (puede tener limitaciones de geolocalización)
   ```

3. **Accede desde tu móvil**:
   - Ve a `http://localhost:8000` en tu navegador móvil
   - O usa la IP de tu computadora para acceder desde otro dispositivo

## 🔒 Privacidad y Seguridad

- ✅ Los datos de ubicación se procesan localmente
- ✅ No se envían datos a servidores externos
- ✅ El progreso se guarda solo en tu dispositivo
- ✅ Solicita permisos de geolocalización de forma segura

## 🚀 Próximas Mejoras (Fuera del MVP)

- 🗺️ Integración con APIs de rutas reales (OSRM, GraphHopper)
- 🏆 Más tipos de logros y desafíos
- 📊 Estadísticas detalladas de caminatas
- 🌍 Mapas offline para áreas sin conexión
- 👥 Funciones sociales y competencias
- 🎨 Personalización de avatares y temas

## 📞 Soporte

Esta es una aplicación web progresiva (PWA) que funciona mejor en dispositivos móviles con GPS. Para mejores resultados:

- Usa en exteriores para mejor precisión de GPS
- Permite permisos de ubicación cuando se soliciten
- Mantén la aplicación abierta durante la caminata
- Asegúrate de tener conexión a internet para cargar los mapas

¡Disfruta explorando tu barrio de una manera completamente nueva! 🎉