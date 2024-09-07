import { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Button,
  StyleSheet,
  Text,
  Platform,
} from "react-native";
import MapboxGL from "@rnmapbox/maps";
import * as Location from "expo-location";

MapboxGL.setAccessToken(
  "pk.eyJ1IjoicmFzdWxqb24wMSIsImEiOiJjbTBxcTh2ZDkwMHdlMmpzaHVkOHNmYXpkIn0.YXajOLQSJg76sbrvkg042g"
);

export default function HomeScreen() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [route, setRoute] = useState(null);
  const [bounds, setBounds] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission to access location was denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation([location.coords.longitude, location.coords.latitude]);
    })();
  }, []);

  const getRoute = async () => {
    try {
      const geocodeResponse = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          destination
        )}.json?access_token=pk.eyJ1IjoicmFzdWxqb24wMSIsImEiOiJjbTBxcTh2ZDkwMHdlMmpzaHVkOHNmYXpkIn0.YXajOLQSJg76sbrvkg042g`
      );
      const geocodeData = await geocodeResponse.json();

      if (geocodeData.features.length === 0) {
        console.error("Destination not found:", destination);
        return;
      }

      const [longitudeD, latitudeD] = geocodeData.features[0].center;
      setDestinationCoords([longitudeD, latitudeD]);
      const [startLng, startLat] = currentLocation;

      const routeResponse = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${startLng},${startLat};${longitudeD},${latitudeD}?geometries=geojson&access_token=pk.eyJ1IjoicmFzdWxqb24wMSIsImEiOiJjbTBxcTh2ZDkwMHdlMmpzaHVkOHNmYXpkIn0.YXajOLQSJg76sbrvkg042g`
      );
      const routeData = await routeResponse.json();

      if (routeData.routes && routeData.routes.length > 0) {
        setRoute(routeData.routes[0]);

        const coords = routeData.routes[0].geometry.coordinates;
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
      } else {
        console.log("No route found");
      }
    } catch (error) {
      console.error("Error getting route:", error);
    }
  };

  return (
    <View style={styles.container}>
      {currentLocation ? (
        Platform.OS === "web" ? (
          <MapboxGL.MapView style={styles.map}>
            <MapboxGL.Camera
              zoomLevel={12}
              centerCoordinate={currentLocation}
              animationMode="flyTo"
              animationDuration={2000}
            >
              {bounds && (
                <MapboxGL.Camera
                  bounds={bounds}
                  animationMode="flyTo"
                  animationDuration={2000}
                  padding={{ top: 50, bottom: 50, left: 50, right: 50 }}
                />
              )}
            </MapboxGL.Camera>
          </MapboxGL.MapView>
        ) : (
          <Text>Map is not supported on this platform.</Text>
        )
      ) : (
        <Text>Joylashuv aniqlanmoqda...</Text>
      )}

      <TextInput
        style={styles.input}
        placeholder="Enter your destination"
        onChangeText={(text) => setDestination(text)}
      />
      <Button title="Let's go!" onPress={getRoute} />

      {route && (
        <View style={styles.routeInfo}>
          <Text>Distance: {(route.distance / 1000).toFixed(2)} km</Text>
          <Text>Duration: {(route.duration / 60).toFixed(2)} minutes</Text>
          {destinationCoords && (
            <Text>
              Destination: {destinationCoords[1].toFixed(4)},{" "}
              {destinationCoords[0].toFixed(4)}
            </Text>
          )}
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
  input: {
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    padding: 10,
    margin: 10,
  },
  routeInfo: {
    padding: 10,
    backgroundColor: "#f0f0f0",
  },
});
