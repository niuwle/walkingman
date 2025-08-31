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
        
        // Zone exploration system
        this.explorationZone = null;
        this.zoneRadius = 0.25; // 0.5km square = 0.25km radius
        this.allStreets = [];
        this.exploredStreets = [];
        this.currentRouteStreets = [];
        this.streetsLayer = null;
        
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
        
        // Force map to recalculate size after a short delay
        setTimeout(() => {
            if (this.map) {
                this.map.invalidateSize();
            }
        }, 100);
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

            status.textContent = 'GPS LOCK ACQUIRED! INITIALIZING TACTICAL ZONE...';
            button.innerHTML = '✅ GPS LOCKED';
            
            // Create exploration zone and fetch streets
            await this.createExplorationZone();
            
            status.textContent = 'TACTICAL ZONE ESTABLISHED! READY TO GENERATE MISSION.';
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
            this.addDebugInfo(`🎯 Generando ruta de ${distance} km dentro de la zona`);
            
            if (!this.allStreets || this.allStreets.length === 0) {
                throw new Error('No hay calles cargadas en la zona');
            }
            
            // Generate route using zone streets
            const route = this.createZoneBasedRoute(distance);
            
            this.currentRoute = route;
            this.routePoints = route.map(point => ({
                lat: point[0],
                lng: point[1],
                visited: false
            }));
            
            // Update street colors (mark current route streets as yellow)
            this.updateStreetColors();
            
            // Clear previous route markers only
            this.clearRouteMarkers();
            
            // Draw route on map with enhanced styling
            this.routeLayer = L.polyline(route, {
                color: '#ffeb3b',
                weight: 6,
                opacity: 1,
                dashArray: '15, 10',
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(this.map);
            
            // Add glow effect for route
            L.polyline(route, {
                color: '#ffeb3b',
                weight: 10,
                opacity: 0.4
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
            
            // Calculate explored percentage
            const exploredCount = this.allStreets.filter(s => s.explored).length;
            const exploredPercentage = Math.round((exploredCount / this.allStreets.length) * 100);
            
            status.textContent = `MISSION ${distance}KM GENERATED! EST. TIME: ${this.currentRouteEstimatedTime}MIN | ZONE: ${exploredPercentage}%`;
            button.innerHTML = '⚡ GENERATE MISSION';
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

    createZoneBasedRoute(targetDistanceKm) {
        this.addDebugInfo(`🧭 Creando ruta laberíntica de ${targetDistanceKm}km`);
        
        // Filter unexplored streets near user location
        const nearbyStreets = this.allStreets.filter(street => {
            if (street.explored) return false;
            
            // Check if street is within reasonable distance from user
            const streetCenter = this.getStreetCenter(street);
            const distanceToUser = this.calculateDistance(this.userLocation, streetCenter);
            return distanceToUser < this.zoneRadius; // Within zone
        });
        
        if (nearbyStreets.length === 0) {
            this.addDebugInfo('⚠️ No hay calles sin explorar, usando todas las calles');
            nearbyStreets.push(...this.allStreets);
        }
        
        // Select streets to create a route of approximately the target distance
        const selectedStreets = this.selectStreetsForRoute(nearbyStreets, targetDistanceKm);
        this.currentRouteStreets = selectedStreets.map(s => s.id);
        
        // Create a connected route from selected streets that starts and ends at user location
        const route = this.createWalkableRoute(selectedStreets);
        
        this.addDebugInfo(`✅ Ruta creada con ${selectedStreets.length} calles`);
        return route;
    }

    getStreetCenter(street) {
        const coords = street.coordinates;
        const centerIndex = Math.floor(coords.length / 2);
        return {
            lat: coords[centerIndex][0],
            lng: coords[centerIndex][1]
        };
    }

    selectStreetsForRoute(availableStreets, targetDistanceKm) {
        const selectedStreets = [];
        let totalDistance = 0;
        const targetDistanceM = targetDistanceKm * 1000;
        const usedStreetIds = new Set();
        
        // Start with a street near the user
        let currentStreet = this.findNearestStreet(availableStreets, this.userLocation);
        if (!currentStreet) return [];
        
        selectedStreets.push(currentStreet);
        usedStreetIds.add(currentStreet.id);
        totalDistance += this.calculateStreetLength(currentStreet);
        
        // Use nearest neighbor algorithm for optimal walking order
        let currentPosition = this.getStreetCenter(currentStreet);
        
        // Build route using nearest neighbor approach for minimal walking distance
        while (totalDistance < targetDistanceM && selectedStreets.length < availableStreets.length) {
            // Find the nearest unvisited street
            const nextStreet = this.findNearestUnvisitedStreet(
                availableStreets, 
                currentPosition, 
                usedStreetIds
            );
            
            if (!nextStreet) break;
            
            // Add walking distance between streets to total
            const walkingDistance = this.calculateDistance(currentPosition, this.getStreetCenter(nextStreet)) * 1000;
            const streetLength = this.calculateStreetLength(nextStreet);
            
            // Check if adding this street would exceed our target by too much
            if (totalDistance + streetLength + walkingDistance > targetDistanceM * 1.2) {
                // Try to find a shorter street nearby
                const shorterStreet = this.findShorterNearbyStreet(
                    availableStreets, 
                    currentPosition, 
                    usedStreetIds,
                    targetDistanceM - totalDistance
                );
                
                if (shorterStreet) {
                    selectedStreets.push(shorterStreet);
                    usedStreetIds.add(shorterStreet.id);
                    totalDistance += this.calculateStreetLength(shorterStreet);
                    currentPosition = this.getStreetCenter(shorterStreet);
                }
                break;
            }
            
            selectedStreets.push(nextStreet);
            usedStreetIds.add(nextStreet.id);
            totalDistance += streetLength + walkingDistance;
            currentPosition = this.getStreetCenter(nextStreet);
            
            // Stop if we're close to target distance
            if (totalDistance >= targetDistanceM * 0.9) break;
        }
        
        // Calculate estimated completion time
        const estimatedTimeMinutes = this.calculateEstimatedTime(totalDistance);
        
        this.addDebugInfo(`📏 TOTAL DISTANCE: ${(totalDistance / 1000).toFixed(2)}KM`);
        this.addDebugInfo(`⏱️ ESTIMATED TIME: ${estimatedTimeMinutes} MINUTES`);
        this.addDebugInfo(`🎯 OPTIMIZED ROUTE WITH ${selectedStreets.length} STREETS`);
        
        // Store estimated time for UI display
        this.currentRouteEstimatedTime = estimatedTimeMinutes;
        
        return selectedStreets;
    }

    findNearestUnvisitedStreet(availableStreets, currentPosition, usedStreetIds) {
        let nearestStreet = null;
        let minDistance = Infinity;
        
        availableStreets.forEach(street => {
            if (usedStreetIds.has(street.id)) return;
            
            const streetCenter = this.getStreetCenter(street);
            const distance = this.calculateDistance(currentPosition, streetCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestStreet = street;
            }
        });
        
        return nearestStreet;
    }

    findShorterNearbyStreet(availableStreets, currentPosition, usedStreetIds, remainingDistance) {
        let bestStreet = null;
        let bestScore = Infinity;
        
        availableStreets.forEach(street => {
            if (usedStreetIds.has(street.id)) return;
            
            const streetCenter = this.getStreetCenter(street);
            const distance = this.calculateDistance(currentPosition, streetCenter);
            const streetLength = this.calculateStreetLength(street);
            
            // Only consider streets that fit in remaining distance
            if (streetLength <= remainingDistance) {
                // Score based on distance to street (prefer closer streets)
                const score = distance;
                
                if (score < bestScore) {
                    bestScore = score;
                    bestStreet = street;
                }
            }
        });
        
        return bestStreet;
    }

    findNextStreetInSpiral(availableStreets, currentPosition, angle, usedStreetIds) {
        const spiralRadius = 0.1; // 100m radius for spiral search
        const targetLat = currentPosition.lat + (spiralRadius / 111) * Math.cos(angle);
        const targetLng = currentPosition.lng + (spiralRadius / (111 * Math.cos(currentPosition.lat * Math.PI / 180))) * Math.sin(angle);
        
        let bestStreet = null;
        let minDistance = Infinity;
        
        availableStreets.forEach(street => {
            if (usedStreetIds.has(street.id)) return;
            
            const streetCenter = this.getStreetCenter(street);
            const distance = this.calculateDistance(
                { lat: targetLat, lng: targetLng },
                streetCenter
            );
            
            if (distance < minDistance && distance < 0.2) { // Within 200m
                minDistance = distance;
                bestStreet = street;
            }
        });
        
        return bestStreet;
    }

    findClosestUnusedStreet(availableStreets, currentPosition, usedStreetIds) {
        let bestStreet = null;
        let minDistance = Infinity;
        
        availableStreets.forEach(street => {
            if (usedStreetIds.has(street.id)) return;
            
            const streetCenter = this.getStreetCenter(street);
            const distance = this.calculateDistance(currentPosition, streetCenter);
            
            if (distance < minDistance) {
                minDistance = distance;
                bestStreet = street;
            }
        });
        
        return bestStreet;
    }

    calculateEstimatedTime(distanceMeters) {
        // Average walking speed: 5 km/h = 83.33 m/min
        // Add extra time for turns, intersections, and navigation
        const baseWalkingSpeed = 83.33; // meters per minute
        const navigationOverhead = 1.2; // 20% extra time for navigation
        
        const estimatedMinutes = Math.round((distanceMeters / baseWalkingSpeed) * navigationOverhead);
        return Math.max(estimatedMinutes, 1); // Minimum 1 minute
    }

    findNearestStreet(streets, location) {
        let nearest = null;
        let minDistance = Infinity;
        
        streets.forEach(street => {
            const streetCenter = this.getStreetCenter(street);
            const distance = this.calculateDistance(location, streetCenter);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = street;
            }
        });
        
        return nearest;
    }

    findConnectedStreet(availableStreets, currentStreet, usedStreets) {
        const usedIds = usedStreets.map(s => s.id);
        const currentEnd = currentStreet.coordinates[currentStreet.coordinates.length - 1];
        
        let nearest = null;
        let minDistance = Infinity;
        
        availableStreets.forEach(street => {
            if (usedIds.includes(street.id)) return;
            
            // Find closest point on this street to current street end
            street.coordinates.forEach(coord => {
                const distance = this.calculateDistance(
                    { lat: currentEnd[0], lng: currentEnd[1] },
                    { lat: coord[0], lng: coord[1] }
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = street;
                }
            });
        });
        
        return nearest;
    }

    calculateStreetLength(street) {
        let length = 0;
        for (let i = 1; i < street.coordinates.length; i++) {
            const prev = { lat: street.coordinates[i-1][0], lng: street.coordinates[i-1][1] };
            const curr = { lat: street.coordinates[i][0], lng: street.coordinates[i][1] };
            length += this.calculateDistance(prev, curr) * 1000; // Convert to meters
        }
        return length;
    }

    createWalkableRoute(streets) {
        if (streets.length === 0) return [];
        
        const route = [];
        
        // Always start at user's current location
        route.push([this.userLocation.lat, this.userLocation.lng]);
        
        // Find the closest point on the first street to user location
        const firstStreet = streets[0];
        const closestPointOnFirstStreet = this.findClosestPointOnStreet(firstStreet, this.userLocation);
        
        // Add path from user location to first street (if not already there)
        if (this.calculateDistance(this.userLocation, closestPointOnFirstStreet) > 0.001) {
            route.push([closestPointOnFirstStreet.lat, closestPointOnFirstStreet.lng]);
        }
        
        // Walk along each street following the actual street coordinates
        for (let i = 0; i < streets.length; i++) {
            const street = streets[i];
            const streetRoute = this.getOptimalStreetPath(street, route[route.length - 1]);
            
            // Add all points along this street
            streetRoute.forEach(point => {
                route.push(point);
            });
            
            // If there's a next street, find the best connection
            if (i < streets.length - 1) {
                const nextStreet = streets[i + 1];
                const connectionPath = this.findStreetConnection(street, nextStreet);
                
                // Add connection path (following streets, not diagonal)
                connectionPath.forEach(point => {
                    route.push(point);
                });
            }
        }
        
        // Always end back at user's current location
        const lastPoint = route[route.length - 1];
        if (this.calculateDistance(
            { lat: lastPoint[0], lng: lastPoint[1] }, 
            this.userLocation
        ) > 0.001) {
            route.push([this.userLocation.lat, this.userLocation.lng]);
        }
        
        this.addDebugInfo(`🛣️ Ruta creada con ${route.length} puntos siguiendo calles`);
        return route;
    }

    findClosestPointOnStreet(street, location) {
        let closestPoint = null;
        let minDistance = Infinity;
        
        street.coordinates.forEach(coord => {
            const point = { lat: coord[0], lng: coord[1] };
            const distance = this.calculateDistance(location, point);
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        });
        
        return closestPoint;
    }

    getOptimalStreetPath(street, startPoint) {
        const streetCoords = street.coordinates;
        const start = { lat: startPoint[0], lng: startPoint[1] };
        
        // Find which end of the street is closer to our current position
        const distToStart = this.calculateDistance(start, { lat: streetCoords[0][0], lng: streetCoords[0][1] });
        const distToEnd = this.calculateDistance(start, { 
            lat: streetCoords[streetCoords.length - 1][0], 
            lng: streetCoords[streetCoords.length - 1][1] 
        });
        
        // Return coordinates in the optimal walking order
        if (distToStart <= distToEnd) {
            return streetCoords; // Walk from start to end
        } else {
            return [...streetCoords].reverse(); // Walk from end to start
        }
    }

    findStreetConnection(fromStreet, toStreet) {
        // Find the best connection between two streets following street network
        const fromEnd = fromStreet.coordinates[fromStreet.coordinates.length - 1];
        const toStart = this.findClosestPointOnStreet(toStreet, { lat: fromEnd[0], lng: fromEnd[1] });
        
        const fromPoint = { lat: fromEnd[0], lng: fromEnd[1] };
        const toPoint = { lat: toStart.lat, lng: toStart.lng };
        
        // Check if the streets are very close (within 50m) - direct connection
        const directDistance = this.calculateDistance(fromPoint, toPoint);
        if (directDistance < 0.05) { // 50 meters
            return [[toStart.lat, toStart.lng]];
        }
        
        // Try to find intermediate streets that connect these two points
        const connectionPath = this.findStreetBasedPath(fromPoint, toPoint);
        
        return connectionPath;
    }

    findStreetBasedPath(fromPoint, toPoint) {
        // Find a path that follows streets between two points
        const maxSearchDistance = 0.2; // 200m max search radius
        const intermediateStreets = [];
        
        // Find streets that could serve as connections
        this.allStreets.forEach(street => {
            const streetCenter = this.getStreetCenter(street);
            const distFromStart = this.calculateDistance(fromPoint, streetCenter);
            const distFromEnd = this.calculateDistance(toPoint, streetCenter);
            
            // Street is potentially useful if it's reasonably close to both points
            if (distFromStart < maxSearchDistance && distFromEnd < maxSearchDistance) {
                intermediateStreets.push({
                    street: street,
                    distFromStart: distFromStart,
                    distFromEnd: distFromEnd,
                    totalDist: distFromStart + distFromEnd
                });
            }
        });
        
        // Sort by total distance to find best intermediate street
        intermediateStreets.sort((a, b) => a.totalDist - b.totalDist);
        
        if (intermediateStreets.length > 0) {
            // Use the best intermediate street
            const bestIntermediate = intermediateStreets[0];
            const streetStart = this.findClosestPointOnStreet(bestIntermediate.street, fromPoint);
            const streetEnd = this.findClosestPointOnStreet(bestIntermediate.street, toPoint);
            
            return [
                [streetStart.lat, streetStart.lng],
                [streetEnd.lat, streetEnd.lng],
                [toPoint.lat, toPoint.lng]
            ];
        }
        
        // If no good intermediate street found, create a path that follows a grid-like pattern
        // This simulates following city blocks instead of cutting diagonally
        const midLat = (fromPoint.lat + toPoint.lat) / 2;
        const midLng = (fromPoint.lng + toPoint.lng) / 2;
        
        // Create an L-shaped path (more realistic than diagonal)
        if (Math.abs(fromPoint.lat - toPoint.lat) > Math.abs(fromPoint.lng - toPoint.lng)) {
            // Go vertically first, then horizontally
            return [
                [toPoint.lat, fromPoint.lng], // Vertical movement
                [toPoint.lat, toPoint.lng]    // Horizontal movement
            ];
        } else {
            // Go horizontally first, then vertically
            return [
                [fromPoint.lat, toPoint.lng], // Horizontal movement
                [toPoint.lat, toPoint.lng]    // Vertical movement
            ];
        }
    }

    updateStreetColors() {
        if (!this.streetsLayer) return;
        
        // Update colors of all streets
        this.streetsLayer.eachLayer(layer => {
            if (layer.options.streetId) {
                const street = this.allStreets.find(s => s.id === layer.options.streetId);
                if (street) {
                    const newColor = this.getStreetColor(street);
                    layer.setStyle({ color: newColor });
                }
            }
        });
    }

    clearRouteMarkers() {
        // Clear only route-related elements, keep streets
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }
        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
        }
        if (this.endMarker) {
            this.map.removeLayer(this.endMarker);
        }
        
        // Clear route glow effects
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Polyline && 
                layer !== this.routeLayer && 
                layer.options.streetId === undefined &&
                !this.streetsLayer.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });
    }

    async createStreetBasedRoute(center, distanceKm) {
        // Use Leaflet Routing Machine with OSRM (free routing service)
        // This creates a route that follows actual streets
        
        this.addDebugInfo(`🔍 Intentando crear ruta basada en calles de ${distanceKm}km`);
        
        try {
            // Method 1: Try with OSRM API directly
            const route = await this.tryOSRMRouting(center, distanceKm);
            if (route && route.length > 10) {
                this.addDebugInfo(`✅ Ruta OSRM generada con ${route.length} puntos`);
                return route;
            }
        } catch (error) {
            this.addDebugInfo(`⚠️ OSRM falló: ${error.message}`);
        }
        
        try {
            // Method 2: Try with GraphHopper (free tier)
            const route = await this.tryGraphHopperRouting(center, distanceKm);
            if (route && route.length > 10) {
                this.addDebugInfo(`✅ Ruta GraphHopper generada con ${route.length} puntos`);
                return route;
            }
        } catch (error) {
            this.addDebugInfo(`⚠️ GraphHopper falló: ${error.message}`);
        }
        
        // Method 3: Create a smart street-following route using Overpass API
        try {
            const route = await this.createSmartStreetRoute(center, distanceKm);
            if (route && route.length > 10) {
                this.addDebugInfo(`✅ Ruta inteligente generada con ${route.length} puntos`);
                return route;
            }
        } catch (error) {
            this.addDebugInfo(`⚠️ Ruta inteligente falló: ${error.message}`);
        }
        
        // If all methods fail, throw error to use circular fallback
        throw new Error('No se pudo generar ruta basada en calles');
    }

    async tryOSRMRouting(center, distanceKm) {
        // Create waypoints in a square pattern to encourage street following
        const radius = distanceKm / 8; // Smaller radius for more realistic routes
        const waypoints = [
            [center.lng, center.lat], // Start
            [center.lng + radius, center.lat], // East
            [center.lng + radius, center.lat + radius], // Northeast
            [center.lng, center.lat + radius], // North
            [center.lng - radius, center.lat + radius], // Northwest
            [center.lng - radius, center.lat], // West
            [center.lng - radius, center.lat - radius], // Southwest
            [center.lng, center.lat - radius], // South
            [center.lng + radius, center.lat - radius], // Southeast
            [center.lng, center.lat] // Back to start
        ];
        
        const coordinatesString = waypoints.map(w => `${w[0]},${w[1]}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/walking/${coordinatesString}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`OSRM HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.routes && data.routes[0] && data.routes[0].geometry) {
            // Convert from [lng, lat] to [lat, lng]
            return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        }
        
        throw new Error('No OSRM route data');
    }

    async tryGraphHopperRouting(center, distanceKm) {
        // GraphHopper free API (no key needed for basic usage)
        const radius = distanceKm / 6;
        const points = [
            `${center.lat},${center.lng}`,
            `${center.lat + radius},${center.lng + radius}`,
            `${center.lat + radius},${center.lng - radius}`,
            `${center.lat - radius},${center.lng - radius}`,
            `${center.lat - radius},${center.lng + radius}`,
            `${center.lat},${center.lng}`
        ];
        
        const url = `https://graphhopper.com/api/1/route?point=${points.join('&point=')}&vehicle=foot&locale=es&calc_points=true&debug=true&elevation=false&points_encoded=false`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`GraphHopper HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.paths && data.paths[0] && data.paths[0].points && data.paths[0].points.coordinates) {
            // Convert from [lng, lat] to [lat, lng]
            return data.paths[0].points.coordinates.map(coord => [coord[1], coord[0]]);
        }
        
        throw new Error('No GraphHopper route data');
    }

    async createSmartStreetRoute(center, distanceKm) {
        // Create a route that tries to follow a more realistic street pattern
        // This uses a combination of random walk and street-like patterns
        
        const points = [];
        const numSegments = Math.max(20, Math.floor(distanceKm * 10)); // More segments for longer routes
        const segmentLength = distanceKm / numSegments;
        
        let currentLat = center.lat;
        let currentLng = center.lng;
        let currentDirection = 0; // Starting direction in radians
        
        points.push([currentLat, currentLng]);
        
        for (let i = 0; i < numSegments; i++) {
            // Add some randomness but prefer straight lines (like streets)
            const directionChange = (Math.random() - 0.5) * Math.PI / 4; // Max 45 degree turn
            currentDirection += directionChange;
            
            // Prefer cardinal directions (like street grids)
            const cardinalDirections = [0, Math.PI/2, Math.PI, 3*Math.PI/2];
            const nearestCardinal = cardinalDirections.reduce((prev, curr) => 
                Math.abs(curr - currentDirection) < Math.abs(prev - currentDirection) ? curr : prev
            );
            
            // 30% chance to snap to cardinal direction (simulate street grid)
            if (Math.random() < 0.3) {
                currentDirection = nearestCardinal;
            }
            
            // Calculate next point
            const stepSize = segmentLength / 111; // Rough conversion to degrees
            const deltaLat = stepSize * Math.cos(currentDirection);
            const deltaLng = stepSize * Math.sin(currentDirection) / Math.cos(currentLat * Math.PI / 180);
            
            currentLat += deltaLat;
            currentLng += deltaLng;
            
            points.push([currentLat, currentLng]);
        }
        
        // Add a final segment back towards the start to create a loop
        const finalSegments = 5;
        for (let i = 0; i < finalSegments; i++) {
            const progress = (i + 1) / finalSegments;
            const targetLat = center.lat * progress + currentLat * (1 - progress);
            const targetLng = center.lng * progress + currentLng * (1 - progress);
            points.push([targetLat, targetLng]);
        }
        
        this.addDebugInfo(`🎯 Ruta inteligente creada con ${points.length} puntos`);
        return points;
    }

    createCircularRoute(center, radius) {
        // Create a more street-like circular route instead of a perfect circle
        const points = [];
        const numSegments = Math.max(12, Math.floor(radius * 50)); // More segments for longer routes
        
        let currentLat = center.lat;
        let currentLng = center.lng;
        let currentAngle = 0;
        
        points.push([currentLat, currentLng]);
        
        for (let i = 0; i < numSegments; i++) {
            // Instead of perfect circle, create segments that look more like city blocks
            const segmentAngle = (2 * Math.PI) / numSegments;
            currentAngle += segmentAngle;
            
            // Add some randomness to make it less perfect
            const radiusVariation = radius * (0.8 + Math.random() * 0.4); // ±20% variation
            const angleVariation = currentAngle + (Math.random() - 0.5) * 0.3; // Small angle variation
            
            // Calculate next point
            const lat = center.lat + radiusVariation * Math.cos(angleVariation);
            const lng = center.lng + radiusVariation * Math.sin(angleVariation);
            
            // Add intermediate points to create "street segments"
            const prevLat = points[points.length - 1][0];
            const prevLng = points[points.length - 1][1];
            
            // Add 2-3 intermediate points per segment to simulate streets
            const intermediatePoints = Math.floor(Math.random() * 2) + 2;
            for (let j = 1; j <= intermediatePoints; j++) {
                const progress = j / (intermediatePoints + 1);
                const intermediateLat = prevLat + (lat - prevLat) * progress;
                const intermediateLng = prevLng + (lng - prevLng) * progress;
                
                // Add small random offset to simulate following streets
                const offset = 0.0001; // Small offset
                const offsetLat = intermediateLat + (Math.random() - 0.5) * offset;
                const offsetLng = intermediateLng + (Math.random() - 0.5) * offset;
                
                points.push([offsetLat, offsetLng]);
            }
            
            points.push([lat, lng]);
        }
        
        // Close the loop back to start
        points.push([center.lat, center.lng]);
        
        this.addDebugInfo(`🔄 Ruta circular mejorada con ${points.length} puntos generada`);
        return points;
    }

    async createExplorationZone() {
        if (!this.userLocation) return;
        
        this.addDebugInfo('🗺️ Creando zona de exploración...');
        
        // Create exploration zone boundary (5km x 5km square)
        const bounds = this.calculateZoneBounds(this.userLocation, this.zoneRadius);
        this.explorationZone = bounds;
        
        // Draw zone boundary
        const zoneBoundary = L.rectangle([
            [bounds.south, bounds.west],
            [bounds.north, bounds.east]
        ], {
            color: '#4facfe',
            weight: 3,
            fillOpacity: 0.1,
            dashArray: '10, 10'
        }).addTo(this.map);
        
        // Fetch all streets in the zone
        try {
            await this.fetchStreetsInZone(bounds);
            this.drawAllStreets();
            this.addDebugInfo(`✅ Zona creada con ${this.allStreets.length} calles`);
        } catch (error) {
            this.addDebugInfo(`⚠️ Error cargando calles: ${error.message}`);
        }
    }

    calculateZoneBounds(center, radiusKm) {
        // Convert km to degrees (rough approximation)
        const latDelta = radiusKm / 111; // 1 degree lat ≈ 111km
        const lngDelta = radiusKm / (111 * Math.cos(center.lat * Math.PI / 180));
        
        return {
            north: center.lat + latDelta,
            south: center.lat - latDelta,
            east: center.lng + lngDelta,
            west: center.lng - lngDelta
        };
    }

    async fetchStreetsInZone(bounds) {
        this.addDebugInfo('📡 Obteniendo calles de OpenStreetMap...');
        
        // Overpass API query to get all walkable ways in the bounding box
        const overpassQuery = `
            [out:json][timeout:25];
            (
              way["highway"~"^(primary|secondary|tertiary|residential|footway|path|pedestrian|living_street|unclassified)$"]
                  (${bounds.south},${bounds.west},${bounds.north},${bounds.east});
            );
            out geom;
        `;
        
        const url = 'https://overpass-api.de/api/interpreter';
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: overpassQuery,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Process the street data
            this.allStreets = data.elements
                .filter(element => element.geometry && element.geometry.length > 1)
                .map(element => ({
                    id: element.id,
                    name: element.tags?.name || 'Calle sin nombre',
                    type: element.tags?.highway || 'unknown',
                    coordinates: element.geometry.map(point => [point.lat, point.lon]),
                    explored: false
                }));
                
            this.addDebugInfo(`📍 ${this.allStreets.length} calles encontradas`);
            
        } catch (error) {
            this.addDebugInfo(`❌ Error con Overpass API: ${error.message}`);
            // Fallback: create a grid of fake streets for demonstration
            this.createFakeStreetGrid(bounds);
        }
    }

    createFakeStreetGrid(bounds) {
        this.addDebugInfo('🔄 Creando calles de demostración...');
        
        const streets = [];
        const gridSize = 0.01; // Grid spacing in degrees
        
        // Create horizontal streets
        for (let lat = bounds.south; lat <= bounds.north; lat += gridSize) {
            streets.push({
                id: `h_${lat}`,
                name: `Calle Horizontal ${Math.round(lat * 1000)}`,
                type: 'residential',
                coordinates: [
                    [lat, bounds.west],
                    [lat, bounds.east]
                ],
                explored: false
            });
        }
        
        // Create vertical streets
        for (let lng = bounds.west; lng <= bounds.east; lng += gridSize) {
            streets.push({
                id: `v_${lng}`,
                name: `Calle Vertical ${Math.round(lng * 1000)}`,
                type: 'residential',
                coordinates: [
                    [bounds.south, lng],
                    [bounds.north, lng]
                ],
                explored: false
            });
        }
        
        this.allStreets = streets;
        this.addDebugInfo(`🏗️ ${streets.length} calles de demostración creadas`);
    }

    drawAllStreets() {
        // Clear previous streets layer
        if (this.streetsLayer) {
            this.map.removeLayer(this.streetsLayer);
        }
        
        // Create layer group for all streets
        this.streetsLayer = L.layerGroup();
        
        this.allStreets.forEach(street => {
            const color = this.getStreetColor(street);
            const polyline = L.polyline(street.coordinates, {
                color: color,
                weight: 3,
                opacity: 0.7,
                streetId: street.id
            });
            
            polyline.bindPopup(`
                <strong>${street.name}</strong><br>
                Tipo: ${street.type}<br>
                Estado: ${street.explored ? '✅ Explorada' : '🔴 Sin explorar'}
            `);
            
            this.streetsLayer.addLayer(polyline);
        });
        
        this.streetsLayer.addTo(this.map);
        this.addDebugInfo('🎨 Calles dibujadas en el mapa');
    }

    getStreetColor(street) {
        if (this.currentRouteStreets.includes(street.id)) {
            return '#ffeb3b'; // Yellow for current route
        } else if (street.explored) {
            return '#4caf50'; // Green for explored
        } else {
            return '#f44336'; // Red for unexplored
        }
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
        
        // Clear any other polylines (glow effects) but keep streets
        this.map.eachLayer((layer) => {
            if (layer instanceof L.Polyline && layer !== this.routeLayer && layer.options.streetId === undefined) {
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
        
        status.textContent = '🔬 TACTICAL SIMULATION ACTIVE - RUNNING MISSION...';
        document.getElementById('progress-container').style.display = 'block';
        
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
                    this.autoCompleteRoute();
                    clearInterval(simulationInterval);
                    document.getElementById('test-mode').innerHTML = '✅ SIMULATION COMPLETE';
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
        
        button.innerHTML = '🎯 OPERATIVE DEPLOYED';
        button.disabled = true;
        status.textContent = 'MISSION ACTIVE! FOLLOW THE YELLOW TACTICAL ROUTE.';
        progressContainer.style.display = 'block';
        
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
            this.autoCompleteRoute();
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

    autoCompleteRoute() {
        const status = document.getElementById('status');
        status.textContent = 'MISSION 90% COMPLETE - AUTO-COMPLETING...';
        
        // Auto-complete after a short delay
        setTimeout(() => {
            this.completeRoute();
        }, 2000);
    }

    completeRoute() {
        if (!this.isWalking) return;
        
        this.isWalking = false;
        
        // Stop location tracking
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        // Change route color to green to indicate completion
        this.markRouteAsCompleted();
        
        // Mark current route streets as explored
        this.markStreetsAsExplored();
        
        // Calculate exploration progress
        const exploredCount = this.allStreets.filter(s => s.explored).length;
        const totalStreets = this.allStreets.length;
        const exploredPercentage = Math.round((exploredCount / totalStreets) * 100);
        
        // Calculate route distance for tracking
        const routeDistance = this.calculateRouteDistance();
        
        // Update game state
        this.gameState.xp += 100;
        this.gameState.routesCompleted += 1;
        this.gameState.streetsExplored = exploredCount;
        this.gameState.explorationPercentage = exploredPercentage;
        this.gameState.totalDistanceWalked = (this.gameState.totalDistanceWalked || 0) + routeDistance;
        this.gameState.completedRoutes.push({
            date: new Date().toISOString(),
            points: this.routePoints.filter(p => p.visited).length,
            totalPoints: this.routePoints.length,
            streetsExplored: this.currentRouteStreets.length,
            explorationPercentage: exploredPercentage
        });
        
        // Check for level up (zone completion)
        const newLevel = this.calculateLevel(this.gameState.xp);
        const oldLevel = this.gameState.level;
        let leveledUp = false;
        
        // Zone completion bonus
        if (exploredPercentage >= 80 && !this.gameState.zoneCompleted) {
            this.gameState.xp += 500; // Bonus XP for zone completion
            this.gameState.zoneCompleted = true;
            this.gameState.level = this.calculateLevel(this.gameState.xp);
            leveledUp = true;
            this.addAchievement('🏆 ¡Zona completada al 80%!');
            this.expandExplorationZone();
        } else {
            this.gameState.level = newLevel;
            if (newLevel > oldLevel) leveledUp = true;
        }
        
        // Save game state
        this.saveGameState();
        
        // Update UI
        this.updateUI();
        this.updateStreetColors();
        
        // Show completion message
        const status = document.getElementById('status');
        let message = `¡Ruta completada! +100 XP. Zona explorada: ${exploredPercentage}%`;
        
        if (leveledUp) {
            message += ` ¡Subiste al nivel ${this.gameState.level}!`;
            this.addAchievement(`¡Nivel ${this.gameState.level} alcanzado!`);
        }
        
        if (exploredPercentage >= 80) {
            message += ' ¡Zona casi completada!';
        }
        
        status.textContent = message;
        
        // Reset route-specific state
        this.currentRouteStreets = [];
        
        // Reset buttons
        document.getElementById('start-walk').innerHTML = '🎯 DEPLOY OPERATIVE';
        document.getElementById('start-walk').disabled = true;
        document.getElementById('progress-container').style.display = 'none';
        document.getElementById('generate-route').disabled = false;
        
        // Check for achievement badges
        this.checkAchievementBadges(exploredCount, totalStreets, exploredPercentage);
        
        // Add basic completion achievement
        this.addAchievement(`🎯 Mission #${this.gameState.routesCompleted} Complete (${this.currentRouteStreets.length} streets)`);
        
        this.addDebugInfo(`🎉 MISSION COMPLETE. ${exploredCount}/${totalStreets} STREETS EXPLORED`);
    }

    checkAchievementBadges(exploredCount, totalStreets, exploredPercentage) {
        const routesCompleted = this.gameState.routesCompleted;
        const currentLevel = this.gameState.level;
        
        // Mission Count Badges
        if (routesCompleted === 1) {
            this.addAchievement('🎖️ FIRST BLOOD - First mission completed');
        } else if (routesCompleted === 5) {
            this.addAchievement('🏅 SQUAD LEADER - 5 missions completed');
        } else if (routesCompleted === 10) {
            this.addAchievement('🎗️ LIEUTENANT - 10 missions completed');
        } else if (routesCompleted === 25) {
            this.addAchievement('🎖️ CAPTAIN - 25 missions completed');
        } else if (routesCompleted === 50) {
            this.addAchievement('⭐ MAJOR - 50 missions completed');
        } else if (routesCompleted === 100) {
            this.addAchievement('🌟 COLONEL - 100 missions completed');
        }
        
        // Exploration Percentage Badges
        if (exploredPercentage >= 25 && !this.gameState.badges?.explorer25) {
            this.addAchievement('🗺️ SCOUT - 25% zone explored');
            this.setBadge('explorer25');
        } else if (exploredPercentage >= 50 && !this.gameState.badges?.explorer50) {
            this.addAchievement('🧭 NAVIGATOR - 50% zone explored');
            this.setBadge('explorer50');
        } else if (exploredPercentage >= 75 && !this.gameState.badges?.explorer75) {
            this.addAchievement('🎯 PATHFINDER - 75% zone explored');
            this.setBadge('explorer75');
        } else if (exploredPercentage >= 90 && !this.gameState.badges?.explorer90) {
            this.addAchievement('👑 ZONE MASTER - 90% zone explored');
            this.setBadge('explorer90');
        }
        
        // Level Badges
        if (currentLevel === 2 && !this.gameState.badges?.level2) {
            this.addAchievement('⚡ PROMOTED - Reached Rank 2');
            this.setBadge('level2');
        } else if (currentLevel === 5 && !this.gameState.badges?.level5) {
            this.addAchievement('🔥 VETERAN - Reached Rank 5');
            this.setBadge('level5');
        } else if (currentLevel === 10 && !this.gameState.badges?.level10) {
            this.addAchievement('💎 ELITE - Reached Rank 10');
            this.setBadge('level10');
        }
        
        // Street Count Badges
        if (exploredCount >= 10 && !this.gameState.badges?.streets10) {
            this.addAchievement('🛣️ STREET WALKER - 10 streets explored');
            this.setBadge('streets10');
        } else if (exploredCount >= 50 && !this.gameState.badges?.streets50) {
            this.addAchievement('🏙️ URBAN EXPLORER - 50 streets explored');
            this.setBadge('streets50');
        } else if (exploredCount >= 100 && !this.gameState.badges?.streets100) {
            this.addAchievement('🌆 CITY CONQUEROR - 100 streets explored');
            this.setBadge('streets100');
        }
        
        // Special Achievement Badges
        if (routesCompleted % 10 === 0 && routesCompleted > 0) {
            this.addAchievement(`🎊 MILESTONE - ${routesCompleted} missions milestone reached`);
        }
        
        // Distance-based badges (if we track total distance)
        const totalDistance = this.gameState.totalDistanceWalked || 0;
        if (totalDistance >= 10 && !this.gameState.badges?.distance10) {
            this.addAchievement('🚶 WALKER - 10km total distance');
            this.setBadge('distance10');
        } else if (totalDistance >= 50 && !this.gameState.badges?.distance50) {
            this.addAchievement('🏃 RUNNER - 50km total distance');
            this.setBadge('distance50');
        } else if (totalDistance >= 100 && !this.gameState.badges?.distance100) {
            this.addAchievement('🏃‍♂️ MARATHON MAN - 100km total distance');
            this.setBadge('distance100');
        }
    }

    setBadge(badgeName) {
        if (!this.gameState.badges) {
            this.gameState.badges = {};
        }
        this.gameState.badges[badgeName] = true;
        this.saveGameState();
    }

    calculateRouteDistance() {
        if (!this.currentRoute || this.currentRoute.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < this.currentRoute.length; i++) {
            const prev = { lat: this.currentRoute[i-1][0], lng: this.currentRoute[i-1][1] };
            const curr = { lat: this.currentRoute[i][0], lng: this.currentRoute[i][1] };
            totalDistance += this.calculateDistance(prev, curr);
        }
        
        return totalDistance; // Returns distance in km
    }

    markRouteAsCompleted() {
        // Change the route color to green to indicate successful completion
        if (this.routeLayer) {
            this.routeLayer.setStyle({
                color: '#4caf50', // Green color for completed route
                weight: 6,
                opacity: 1,
                dashArray: null, // Remove dashed pattern
                lineCap: 'round',
                lineJoin: 'round'
            });
            
            // Update glow effect to green as well
            this.map.eachLayer((layer) => {
                if (layer instanceof L.Polyline && 
                    layer !== this.routeLayer && 
                    layer.options.streetId === undefined &&
                    layer.options.color === '#ffeb3b' && // Find the yellow glow layer
                    layer.options.weight === 10) {
                    layer.setStyle({
                        color: '#4caf50',
                        opacity: 0.4
                    });
                }
            });
        }
        
        this.addDebugInfo('✅ Ruta marcada como completada (verde)');
    }

    markStreetsAsExplored() {
        let newlyExplored = 0;
        
        this.currentRouteStreets.forEach(streetId => {
            const street = this.allStreets.find(s => s.id === streetId);
            if (street && !street.explored) {
                street.explored = true;
                newlyExplored++;
            }
        });
        
        this.addDebugInfo(`✅ ${newlyExplored} calles nuevas exploradas`);
    }

    expandExplorationZone() {
        // Expand the zone when current zone is mostly completed
        this.zoneRadius += 0.25; // Increase zone size by 0.5km (0.25km radius)
        this.addDebugInfo(`🔄 ZONE EXPANDED TO ${(this.zoneRadius * 2).toFixed(1)}KM SQUARE`);
        
        // Reset zone completion flag
        this.gameState.zoneCompleted = false;
        
        // Optionally reload streets for new zone
        // This could be implemented to fetch new streets in the expanded area
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
        document.getElementById('total-distance').textContent = (this.gameState.totalDistanceWalked || 0).toFixed(1);
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
        const saved = localStorage.getItem('theWalkingManGameState');
        if (saved) {
            const state = JSON.parse(saved);
            // Ensure new properties exist
            if (!state.hasOwnProperty('streetsExplored')) state.streetsExplored = 0;
            if (!state.hasOwnProperty('explorationPercentage')) state.explorationPercentage = 0;
            if (!state.hasOwnProperty('zoneCompleted')) state.zoneCompleted = false;
            if (!state.hasOwnProperty('badges')) state.badges = {};
            if (!state.hasOwnProperty('totalDistanceWalked')) state.totalDistanceWalked = 0;
            return state;
        }
        
        return {
            level: 1,
            xp: 0,
            routesCompleted: 0,
            completedRoutes: [],
            visitedStreets: [],
            streetsExplored: 0,
            explorationPercentage: 0,
            zoneCompleted: false,
            badges: {},
            totalDistanceWalked: 0
        };
    }

    saveGameState() {
        localStorage.setItem('theWalkingManGameState', JSON.stringify(this.gameState));
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