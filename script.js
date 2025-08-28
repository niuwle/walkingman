// Fog of Walk - Main Application Script
class FogOfWalk {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.currentRoute = null;
        this.routeLayer = null;
        this.userMarker = null;
        this.isWalking = false;
        this.routePoints = [];
        this.visitedPoints = [];
        this.watchId = null;
        
        // Game state
        this.gameState = this.loadGameState();
        
        this.initializeApp();
    }

    initializeApp() {
        this.updateUI();
        this.bindEvents();
        this.initializeMap();
    }

    bindEvents() {
        document.getElementById('get-location').addEventListener('click', () => this.getUserLocation());
        document.getElementById('generate-route').addEventListener('click', () => this.generateRoute());
        document.getElementById('start-walk').addEventListener('click', () => this.startWalk());
        document.getElementById('complete-route').addEventListener('click', () => this.completeRoute());
        document.getElementById('test-mode').addEventListener('click', () => this.startTestMode());
        document.getElementById('toggle-debug').addEventListener('click', () => this.toggleDebugPanel());
        document.getElementById('clear-debug').addEventListener('click', () => this.clearDebugInfo());
        
        // Distance slider
        const distanceSlider = document.getElementById('distance-slider');
        const distanceValue = document.getElementById('distance-value');
        distanceSlider.addEventListener('input', (e) => {
            distanceValue.textContent = e.target.value;
        });
    }

    initializeMap() {
        // Initialize map centered on Madrid (will be updated when location is obtained)
        this.map = L.map('map').setView([40.4168, -3.7038], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    async getUserLocation() {
        const button = document.getElementById('get-location');
        const status = document.getElementById('status');
        
        button.innerHTML = '<span class="loading"></span> Obteniendo ubicación...';
        button.disabled = true;
        
        // Add debug info
        this.addDebugInfo('🔍 Iniciando proceso de geolocalización...');
        this.addDebugInfo(`📱 User Agent: ${navigator.userAgent}`);
        this.addDebugInfo(`🔒 Protocol: ${window.location.protocol}`);
        this.addDebugInfo(`🌐 Host: ${window.location.host}`);
        
        if (!navigator.geolocation) {
            const errorMsg = 'La geolocalización no está soportada en este navegador';
            status.textContent = errorMsg;
            this.addDebugInfo(`❌ ${errorMsg}`);
            button.innerHTML = '📍 Obtener Ubicación';
            button.disabled = false;
            return;
        }

        this.addDebugInfo('✅ Geolocation API disponible');
        
        // Check permissions API if available
        if ('permissions' in navigator) {
            try {
                const permission = await navigator.permissions.query({name: 'geolocation'});
                this.addDebugInfo(`🔐 Permission status: ${permission.state}`);
            } catch (permError) {
                this.addDebugInfo(`⚠️ No se pudo verificar permisos: ${permError.message}`);
            }
        }

        try {
            this.addDebugInfo('📍 Solicitando posición...');
            const position = await this.getCurrentPosition();
            
            this.addDebugInfo(`✅ Posición obtenida!`);
            this.addDebugInfo(`📍 Lat: ${position.coords.latitude}`);
            this.addDebugInfo(`📍 Lng: ${position.coords.longitude}`);
            this.addDebugInfo(`🎯 Accuracy: ${position.coords.accuracy}m`);
            this.addDebugInfo(`⏰ Timestamp: ${new Date(position.timestamp).toLocaleString()}`);
            
            this.userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            // Update map view
            this.map.setView([this.userLocation.lat, this.userLocation.lng], 16);
            
            // Add user marker
            if (this.userMarker) {
                this.map.removeLayer(this.userMarker);
            }
            
            this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lng])
                .addTo(this.map)
                .bindPopup('Tu ubicación actual')
                .openPopup();

            status.textContent = '¡Ubicación obtenida! Ahora puedes generar una ruta.';
            button.innerHTML = '✅ Ubicación Obtenida';
            document.getElementById('generate-route').disabled = false;
            
        } catch (error) {
            console.error('Error getting location:', error);
            
            let errorMsg = 'Error desconocido';
            let debugMsg = '';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = 'Permiso denegado. Por favor, permite el acceso a la ubicación.';
                    debugMsg = '❌ PERMISSION_DENIED: El usuario denegó el acceso a la geolocalización';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = 'Ubicación no disponible. Verifica tu conexión GPS.';
                    debugMsg = '❌ POSITION_UNAVAILABLE: La ubicación no está disponible';
                    break;
                case error.TIMEOUT:
                    errorMsg = 'Tiempo de espera agotado. Inténtalo de nuevo.';
                    debugMsg = '❌ TIMEOUT: Se agotó el tiempo de espera para obtener la ubicación';
                    break;
                default:
                    errorMsg = `Error: ${error.message}`;
                    debugMsg = `❌ Error code ${error.code}: ${error.message}`;
                    break;
            }
            
            this.addDebugInfo(debugMsg);
            this.addDebugInfo(`🔧 Sugerencias de solución:`);
            
            if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                this.addDebugInfo(`⚠️ PROBLEMA DETECTADO: Estás usando HTTP en lugar de HTTPS`);
                this.addDebugInfo(`💡 SOLUCIÓN: Accede a la página usando HTTPS o localhost`);
            }
            
            this.addDebugInfo(`💡 1. Verifica que hayas dado permisos de ubicación`);
            this.addDebugInfo(`💡 2. Asegúrate de estar en exteriores o cerca de una ventana`);
            this.addDebugInfo(`💡 3. Verifica que el GPS esté activado en tu dispositivo`);
            this.addDebugInfo(`💡 4. Intenta recargar la página`);
            
            status.textContent = errorMsg;
            button.innerHTML = '📍 Obtener Ubicación';
            button.disabled = false;
        }
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            });
        });
    }

    async generateRoute() {
        const button = document.getElementById('generate-route');
        const status = document.getElementById('status');
        
        button.innerHTML = '<span class="loading"></span> Generando ruta...';
        button.disabled = true;
        
        try {
            const distance = parseFloat(document.getElementById('distance-slider').value);
            this.addDebugInfo(`🎯 Generando ruta de ${distance} km`);
            
            // Try to generate a street-based route, fallback to circular if needed
            let route;
            try {
                route = await this.createStreetBasedRoute(this.userLocation, distance);
                this.addDebugInfo('✅ Ruta basada en calles generada exitosamente');
            } catch (error) {
                this.addDebugInfo('⚠️ Error con rutas de calles, usando ruta circular');
                route = this.createCircularRoute(this.userLocation, distance / 6.28); // Convert km to radius
            }
            
            this.currentRoute = route;
            this.routePoints = route.map(point => ({
                lat: point[0],
                lng: point[1],
                visited: false
            }));
            
            // Clear previous route and markers
            this.clearMapLayers();
            
            // Draw route on map with enhanced styling
            this.routeLayer = L.polyline(route, {
                color: '#ff6b6b',
                weight: 8,
                opacity: 0.9,
                dashArray: '10, 5',
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(this.map);
            
            // Add glow effect
            L.polyline(route, {
                color: '#ff6b6b',
                weight: 12,
                opacity: 0.3
            }).addTo(this.map);
            
            // Add start and end markers
            this.startMarker = L.marker(route[0], {
                icon: L.divIcon({
                    className: 'custom-marker start-marker',
                    html: '🚀',
                    iconSize: [30, 30]
                })
            }).addTo(this.map).bindPopup('Inicio de la ruta');
            
            this.endMarker = L.marker(route[route.length - 1], {
                icon: L.divIcon({
                    className: 'custom-marker end-marker',
                    html: '🏁',
                    iconSize: [30, 30]
                })
            }).addTo(this.map).bindPopup('Final de la ruta');
            
            // Fit map to route
            this.map.fitBounds(this.routeLayer.getBounds(), { padding: [20, 20] });
            
            status.textContent = `¡Ruta de ${distance} km generada! Presiona "Comenzar Caminata" para empezar a explorar.`;
            button.innerHTML = '🗺️ Generar Nueva Ruta';
            button.disabled = false;
            document.getElementById('start-walk').disabled = false;
            document.getElementById('test-mode').disabled = false;
            
        } catch (error) {
            console.error('Error generating route:', error);
            this.addDebugInfo(`❌ Error generando ruta: ${error.message}`);
            status.textContent = 'Error al generar la ruta. Inténtalo de nuevo.';
            button.innerHTML = '🗺️ Generar Ruta';
            button.disabled = false;
        }
    }

    async createStreetBasedRoute(center, distanceKm) {
        // Try to create a route using OpenRouteService API
        // This creates a circular walking route that follows actual streets
        
        const apiKey = '5b3ce3597851110001cf6248a1b8c4c8f8b84c4e8b8f4c4c4c4c4c4c'; // Free tier key
        
        // Calculate waypoints in a rough circle to encourage a loop
        const numWaypoints = 4;
        const radius = distanceKm / 6.28; // Approximate radius for desired distance
        const waypoints = [];
        
        for (let i = 0; i < numWaypoints; i++) {
            const angle = (i / numWaypoints) * 2 * Math.PI;
            const lat = center.lat + radius * Math.cos(angle);
            const lng = center.lng + radius * Math.sin(angle);
            waypoints.push([lng, lat]); // ORS uses lng,lat format
        }
        
        // Add start point at the end to create a loop
        waypoints.push([center.lng, center.lat]);
        
        const url = `https://api.openrouteservice.org/v2/directions/foot-walking/geojson`;
        
        const requestBody = {
            coordinates: waypoints,
            format: "geojson",
            instructions: false
        };
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.features && data.features[0] && data.features[0].geometry) {
                // Convert coordinates from [lng, lat] to [lat, lng] for Leaflet
                const coordinates = data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
                this.addDebugInfo(`📍 Ruta con ${coordinates.length} puntos generada`);
                return coordinates;
            } else {
                throw new Error('No route data received');
            }
        } catch (error) {
            this.addDebugInfo(`⚠️ Error con API de rutas: ${error.message}`);
            throw error;
        }
    }

    createCircularRoute(center, radius) {
        const points = [];
        const numPoints = Math.max(20, Math.floor(radius * 1000)); // More points for longer routes
        
        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            const lat = center.lat + radius * Math.cos(angle);
            const lng = center.lng + radius * Math.sin(angle);
            points.push([lat, lng]);
        }
        
        this.addDebugInfo(`🔄 Ruta circular con ${points.length} puntos generada`);
        return points;
    }

    clearMapLayers() {
        // Clear previous route and markers
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }
        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
        }
        if (this.endMarker) {
            this.map.removeLayer(this.endMarker);
        }
        
        // Clear any other polylines (glow effects)
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Polyline && layer !== this.routeLayer) {
                this.map.removeLayer(layer);
            }
        });
    }

    startTestMode() {
        if (!this.currentRoute) {
            alert('Primero genera una ruta');
            return;
        }
        
        const button = document.getElementById('test-mode');
        const status = document.getElementById('status');
        
        button.innerHTML = '🧪 Simulando...';
        button.disabled = true;
        
        this.isWalking = true;
        this.visitedPoints = [];
        
        status.textContent = '🧪 Modo de prueba activado - Simulando caminata...';
        document.getElementById('progress-container').style.display = 'block';
        document.getElementById('complete-route').disabled = false;
        
        // Simulate walking the route
        this.simulateWalk();
    }

    simulateWalk() {
        let currentIndex = 0;
        const totalPoints = this.routePoints.length;
        const interval = 200; // 200ms between points
        
        const simulationInterval = setInterval(() => {
            if (currentIndex >= totalPoints || !this.isWalking) {
                clearInterval(simulationInterval);
                document.getElementById('test-mode').innerHTML = '🧪 Modo Prueba';
                document.getElementById('test-mode').disabled = false;
                return;
            }
            
            // Mark current point as visited
            if (currentIndex < totalPoints) {
                this.routePoints[currentIndex].visited = true;
                this.visitedPoints.push(currentIndex);
                
                // Update user marker position
                const currentPoint = this.routePoints[currentIndex];
                if (this.userMarker) {
                    this.userMarker.setLatLng([currentPoint.lat, currentPoint.lng]);
                }
                
                // Update progress
                const progress = (this.visitedPoints.length / totalPoints) * 100;
                document.getElementById('progress-fill').style.width = `${progress}%`;
                document.getElementById('progress-percentage').textContent = Math.round(progress);
                
                // Check if route is mostly completed (90%)
                if (progress >= 90) {
                    this.showRouteCompletionOption();
                    clearInterval(simulationInterval);
                    document.getElementById('test-mode').innerHTML = '✅ Simulación Completa';
                }
            }
            
            currentIndex++;
        }, interval);
        
        this.addDebugInfo('🧪 Iniciando simulación de caminata');
    }

    startWalk() {
        const button = document.getElementById('start-walk');
        const status = document.getElementById('status');
        const progressContainer = document.getElementById('progress-container');
        
        this.isWalking = true;
        this.visitedPoints = [];
        
        button.innerHTML = '🚶‍♂️ Caminando...';
        button.disabled = true;
        status.textContent = '¡Caminata iniciada! Sigue la ruta azul en el mapa.';
        progressContainer.style.display = 'block';
        document.getElementById('complete-route').disabled = false;
        
        // Start tracking user location
        this.startLocationTracking();
    }

    startLocationTracking() {
        if (navigator.geolocation) {
            this.watchId = navigator.geolocation.watchPosition(
                (position) => this.updateUserPosition(position),
                (error) => console.error('Error tracking location:', error),
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 1000
                }
            );
        }
    }

    updateUserPosition(position) {
        if (!this.isWalking) return;
        
        const currentPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        
        // Update user marker
        if (this.userMarker) {
            this.userMarker.setLatLng([currentPos.lat, currentPos.lng]);
        }
        
        // Check if user is near any route points
        this.checkRouteProgress(currentPos);
    }

    checkRouteProgress(currentPos) {
        const threshold = 0.0001; // ~10 meters
        let newVisits = 0;
        
        this.routePoints.forEach((point, index) => {
            if (!point.visited) {
                const distance = this.calculateDistance(currentPos, point);
                if (distance < threshold) {
                    point.visited = true;
                    this.visitedPoints.push(index);
                    newVisits++;
                }
            }
        });
        
        // Update progress
        const progress = (this.visitedPoints.length / this.routePoints.length) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
        document.getElementById('progress-percentage').textContent = Math.round(progress);
        
        // Check if route is mostly completed (90%)
        if (progress >= 90) {
            this.showRouteCompletionOption();
        }
    }

    calculateDistance(pos1, pos2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = pos1.lat * Math.PI/180;
        const φ2 = pos2.lat * Math.PI/180;
        const Δφ = (pos2.lat-pos1.lat) * Math.PI/180;
        const Δλ = (pos2.lng-pos1.lng) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c / 1000; // Convert to km, then compare with threshold
    }

    showRouteCompletionOption() {
        const status = document.getElementById('status');
        status.textContent = '¡Excelente! Has completado la mayor parte de la ruta. ¡Puedes marcarla como completada!';
        document.getElementById('complete-route').style.background = 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)';
    }

    completeRoute() {
        if (!this.isWalking) return;
        
        this.isWalking = false;
        
        // Stop location tracking
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        // Update game state
        this.gameState.xp += 100;
        this.gameState.routesCompleted += 1;
        this.gameState.completedRoutes.push({
            date: new Date().toISOString(),
            points: this.routePoints.filter(p => p.visited).length,
            totalPoints: this.routePoints.length
        });
        
        // Check for level up
        const newLevel = this.calculateLevel(this.gameState.xp);
        const oldLevel = this.gameState.level;
        this.gameState.level = newLevel;
        
        // Save game state
        this.saveGameState();
        
        // Update UI
        this.updateUI();
        
        // Show completion message
        const status = document.getElementById('status');
        let message = '¡Ruta completada! +100 XP ganados.';
        
        if (newLevel > oldLevel) {
            message += ` ¡Subiste al nivel ${newLevel}!`;
            this.addAchievement(`¡Nivel ${newLevel} alcanzado!`);
        }
        
        status.textContent = message;
        
        // Reset buttons
        document.getElementById('start-walk').innerHTML = '🚶‍♂️ Comenzar Caminata';
        document.getElementById('start-walk').disabled = true;
        document.getElementById('complete-route').disabled = true;
        document.getElementById('progress-container').style.display = 'none';
        document.getElementById('generate-route').disabled = false;
        
        // Add achievement
        this.addAchievement(`Ruta #${this.gameState.routesCompleted} completada`);
    }

    calculateLevel(xp) {
        // Level formula: Level = floor(sqrt(XP / 100)) + 1
        return Math.floor(Math.sqrt(xp / 100)) + 1;
    }

    calculateXPNeeded(level) {
        // XP needed for level = (level - 1)^2 * 100
        return Math.pow(level, 2) * 100;
    }

    updateUI() {
        document.getElementById('level').textContent = this.gameState.level;
        document.getElementById('xp').textContent = this.gameState.xp;
        document.getElementById('xp-needed').textContent = this.calculateXPNeeded(this.gameState.level + 1);
        document.getElementById('routes-completed').textContent = this.gameState.routesCompleted;
    }

    addAchievement(text) {
        const achievementsList = document.getElementById('achievements-list');
        
        // Clear placeholder text
        if (achievementsList.textContent.includes('Comienza tu primera')) {
            achievementsList.innerHTML = '';
        }
        
        const achievement = document.createElement('div');
        achievement.className = 'achievement';
        achievement.textContent = `🏆 ${text}`;
        
        achievementsList.insertBefore(achievement, achievementsList.firstChild);
        
        // Keep only last 5 achievements
        while (achievementsList.children.length > 5) {
            achievementsList.removeChild(achievementsList.lastChild);
        }
    }

    loadGameState() {
        const saved = localStorage.getItem('fogOfWalkGameState');
        if (saved) {
            return JSON.parse(saved);
        }
        
        return {
            level: 1,
            xp: 0,
            routesCompleted: 0,
            completedRoutes: [],
            visitedStreets: []
        };
    }

    saveGameState() {
        localStorage.setItem('fogOfWalkGameState', JSON.stringify(this.gameState));
    }

    addDebugInfo(message) {
        console.log(message);
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            const debugEntry = document.createElement('div');
            debugEntry.className = 'debug-entry';
            debugEntry.innerHTML = `<span class="debug-time">${new Date().toLocaleTimeString()}</span> ${message}`;
            debugPanel.appendChild(debugEntry);
            
            // Keep only last 20 debug entries
            while (debugPanel.children.length > 20) {
                debugPanel.removeChild(debugPanel.firstChild);
            }
            
            // Auto-scroll to bottom
            debugPanel.scrollTop = debugPanel.scrollHeight;
        }
    }

    clearDebugInfo() {
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            debugPanel.innerHTML = '';
        }
    }

    toggleDebugPanel() {
        const debugContainer = document.getElementById('debug-container');
        if (debugContainer) {
            debugContainer.style.display = debugContainer.style.display === 'none' ? 'block' : 'none';
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FogOfWalk();
});