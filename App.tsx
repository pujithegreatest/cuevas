import { StatusBar } from "expo-status-bar";
import { View, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import RootNavigator from "./src/navigation/RootNavigator";
import { useAppStore } from "./src/state/appStore";
import { useEffect } from "react";

/*
IMPORTANT NOTICE: DO NOT REMOVE
There are already environment keys in the project.
Before telling the user to add them, check if you already have access to the required keys through bash.
Directly access them with process.env.${key}

Correct usage:
process.env.EXPO_PUBLIC_VIBECODE_{key}
//directly access the key

Incorrect usage:
import { OPENAI_API_KEY } from '@env';
//don't use @env, its depreicated

Incorrect usage:
import Constants from 'expo-constants';
const openai_api_key = Constants.expoConfig.extra.apikey;
//don't use expo-constants, its depreicated

*/

export default function App() {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const systemColorScheme = useColorScheme();

  useEffect(() => {
    if (systemColorScheme === "dark" && !isDarkMode) {
    }
  }, [systemColorScheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View className={isDarkMode ? "dark" : ""} style={{ flex: 1 }}>
          <NavigationContainer>
            <RootNavigator />
            <StatusBar style={isDarkMode ? "light" : "dark"} />
          </NavigationContainer>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
