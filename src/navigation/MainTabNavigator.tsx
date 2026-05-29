import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "../components/Ionicons";
import { useAppStore } from "../state/appStore";
import { MainTabParamList } from "../types/navigation";

// Screens
import FeedScreen from "../screens/FeedScreen";
import RewardsBalanceScreen from "../screens/RewardsBalanceScreen";
import MissionsScreen from "../screens/MissionsScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const isDarkMode = useAppStore((s) => s.isDarkMode);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDarkMode ? "#06A7A1" : "#06A7A1",
        tabBarInactiveTintColor: isDarkMode ? "#666" : "#999",
        tabBarStyle: {
          backgroundColor: isDarkMode ? "#1a1a1a" : "#ffffff",
          borderTopColor: isDarkMode ? "#333" : "#e5e5e5",
        },
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="RewardsBalance"
        component={RewardsBalanceScreen}
        options={{
          tabBarLabel: "Rewards",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Missions"
        component={MissionsScreen}
        options={{
          tabBarLabel: "Missions",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio-button-on" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
