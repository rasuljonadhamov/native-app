import React, { useState, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  Button,
  StyleSheet,
  Text,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";

let MapboxGL, mapboxgl;

if (Platform.OS === "web") {
  mapboxgl = require("mapbox-gl");
  require("mapbox-gl/dist/mapbox-gl.css");
} else {
  MapboxGL = require("@rnmapbox/maps").default;
}

const MAPBOX_ACCESS_TOKEN =
  "pk.eyJ1IjoicmFzdWxqb24wMSIsImEiOiJjbTBxcTh2ZDkwMHdlMmpzaHVkOHNmYXpkIn0.YXajOLQSJg76sbrvkg042g";

if (Platform.OS === "web") {
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
} else {
  MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);
}

export default function HomeScreen() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [route, setRoute] = useState(null);
  const [bounds, setBounds] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Permission to access location was denied");
          return;
        }

        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setCurrentLocation([
          location.coords.longitude,
          location.coords.latitude,
        ]);

        if (Platform.OS === "web") {
          initWebMap([location.coords.longitude, location.coords.latitude]);
        }
      } catch (err) {
        setError("Error getting current location");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const initWebMap = (center) => {
    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v11",
        center: center,
        zoom: 14,
      });

      mapRef.current.addControl(new mapboxgl.NavigationControl());

      new mapboxgl.Marker().setLngLat(center).addTo(mapRef.current);
    }
  };

  const getRoute = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!currentLocation) {
        throw new Error("Current location not available");
      }

      const geocodeResponse = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          destination
        )}.json?access_token=${MAPBOX_ACCESS_TOKEN}`
      );
      const geocodeData = await geocodeResponse.json();

      if (geocodeData.features.length === 0) {
        throw new Error("Destination not found");
      }

      const [longitudeD, latitudeD] = geocodeData.features[0].center;
      setDestinationCoords([longitudeD, latitudeD]);
      const [startLng, startLat] = currentLocation;

      const routeResponse = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${startLng},${startLat};${longitudeD},${latitudeD}?geometries=geojson&overview=full&alternatives=true&access_token=${MAPBOX_ACCESS_TOKEN}`
      );
      const routeData = await routeResponse.json();

      if (routeData.routes && routeData.routes.length > 0) {
        const bestRoute = routeData.routes[0];
        setRoute(bestRoute);

        const coords = bestRoute.geometry.coordinates;
        const minLng = Math.min(
          ...coords.map((c) => c[0]),
          startLng,
          longitudeD
        );
        const minLat = Math.min(
          ...coords.map((c) => c[1]),
          startLat,
          latitudeD
        );
        const maxLng = Math.max(
          ...coords.map((c) => c[0]),
          startLng,
          longitudeD
        );
        const maxLat = Math.max(
          ...coords.map((c) => c[1]),
          startLat,
          latitudeD
        );

        setBounds([
          [minLng, minLat],
          [maxLng, maxLat],
        ]);

        if (Platform.OS === "web") {
          updateWebMap(bestRoute.geometry, [longitudeD, latitudeD]);
        }
      } else {
        throw new Error("No route found");
      }
    } catch (error) {
      setError(error.message || "Error getting route");
      console.error("Error getting route:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateWebMap = (routeGeometry, destination) => {
    if (mapRef.current) {
      if (mapRef.current.getSource("route")) {
        mapRef.current.getSource("route").setData(routeGeometry);
      } else {
        mapRef.current.addSource("route", {
          type: "geojson",
          data: routeGeometry,
        });
        mapRef.current.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#3887be",
            "line-width": 5,
            "line-opacity": 0.75,
          },
        });
      }

      new mapboxgl.Marker({ color: "#f50" })
        .setLngLat(destination)
        .addTo(mapRef.current);

      mapRef.current.fitBounds(bounds, {
        padding: 50,
        duration: 1000,
      });
    }
  };

  const renderMap = () => {
    if (Platform.OS === "web") {
      return (
        <div ref={mapContainerRef} style={{ width: "100%", height: "400px" }} />
      );
    } else {
      return (
        <MapboxGL.MapView
          ref={mapRef}
          style={styles.map}
          logoEnabled={false}
          compassEnabled={true}
          rotateEnabled={false}
        >
          <MapboxGL.Camera
            zoomLevel={14}
            centerCoordinate={currentLocation || [0, 0]}
            animationMode="flyTo"
            animationDuration={2000}
          />
          {currentLocation && (
            <MapboxGL.PointAnnotation
              key="currentLocation"
              id="currentLocation"
              coordinate={currentLocation}
            >
              <View style={styles.annotationContainer}>
                <View style={styles.annotationFill} />
              </View>
            </MapboxGL.PointAnnotation>
          )}
          {destinationCoords && (
            <MapboxGL.PointAnnotation
              key="destination"
              id="destination"
              coordinate={destinationCoords}
            >
              <View style={styles.annotationContainer}>
                <View
                  style={[styles.annotationFill, { backgroundColor: "red" }]}
                />
              </View>
            </MapboxGL.PointAnnotation>
          )}
          {route && (
            <MapboxGL.ShapeSource id="routeSource" shape={route.geometry}>
              <MapboxGL.LineLayer
                id="routeFill"
                style={{
                  lineColor: "blue",
                  lineWidth: 3,
                  lineCap: MapboxGL.LineJoin.Round,
                  lineJoin: MapboxGL.LineJoin.Round,
                }}
              />
            </MapboxGL.ShapeSource>
          )}
        </MapboxGL.MapView>
      );
    }
  };

  return (
    <View style={styles.container}>
      {isLoading && <ActivityIndicator size="large" style={styles.loader} />}
      {error && <Text style={styles.error}>{error}</Text>}

      {renderMap()}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter your destination"
          onChangeText={(text) => setDestination(text)}
          value={destination}
        />
        <Button title="Let's go!" onPress={getRoute} disabled={isLoading} />
      </View>

      {route && (
        <View style={styles.routeInfo}>
          <Text>Distance: {(route.distance / 1000).toFixed(2)} km</Text>
          <Text>Duration: {(route.duration / 60).toFixed(0)} minutes</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  inputContainer: {
    padding: 10,
    backgroundColor: "white",
  },
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  routeInfo: {
    padding: 10,
    backgroundColor: "#f0f0f0",
  },
  annotationContainer: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderRadius: 15,
  },
  annotationFill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "blue",
    transform: [{ scale: 0.6 }],
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    zIndex: 1,
  },
  error: {
    color: "red",
    textAlign: "center",
    padding: 10,
  },
});
