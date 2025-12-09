import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useColorScheme } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';

// Screens
import DashboardScreen from './src/screens/DashboardScreen';
import AgentsScreen from './src/screens/AgentsScreen';
import WorkflowsScreen from './src/screens/WorkflowsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Auth
import AuthNavigator from './src/navigation/AuthNavigator';
import { useAuthStore } from './src/stores/authStore';

// API
import { setupAxiosInterceptors } from './src/api/client';

const Tab = createBottomTabNavigator();
const queryClient = new QueryClient();

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, checkAuth, user } = useAuthStore();

  const theme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const customTheme = {
    ...theme,
    colors: {
      ...theme.colors,
      primary: '#ff6d00',
      secondary: '#1976d2',
    },
  };

  useEffect(() => {
    // Setup axios interceptors
    setupAxiosInterceptors();
    
    // Check authentication
    checkAuth();
    
    // Setup biometric authentication
    setupBiometrics();
    
    // Register for push notifications
    registerForPushNotifications();
  }, []);

  const setupBiometrics = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    
    if (hasHardware && isEnrolled) {
      // Enable biometric authentication
      await SecureStore.setItemAsync('biometricEnabled', 'true');
    }
  };

  const registerForPushNotifications = async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync();
    // Send token to backend
    console.log('Push token:', token);
  };

  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={customTheme}>
          <NavigationContainer>
            <AuthNavigator />
          </NavigationContainer>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </PaperProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={customTheme}>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                let iconName;
                switch (route.name) {
                  case 'Dashboard':
                    iconName = 'view-dashboard';
                    break;
                  case 'Agents':
                    iconName = 'robot';
                    break;
                  case 'Workflows':
                    iconName = 'sitemap';
                    break;
                  case 'Notifications':
                    iconName = 'bell';
                    break;
                  case 'Profile':
                    iconName = 'account';
                    break;
                  default:
                    iconName = 'circle';
                }
                return <Icon name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: customTheme.colors.primary,
              tabBarInactiveTintColor: 'gray',
              headerStyle: {
                backgroundColor: customTheme.colors.primary,
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            })}
          >
            <Tab.Screen 
              name="Dashboard" 
              component={DashboardScreen}
              options={{
                tabBarBadge: user?.notifications?.unread || undefined,
              }}
            />
            <Tab.Screen name="Agents" component={AgentsScreen} />
            <Tab.Screen name="Workflows" component={WorkflowsScreen} />
            <Tab.Screen 
              name="Notifications" 
              component={NotificationsScreen}
              options={{
                tabBarBadge: user?.notifications?.unread || undefined,
              }}
            />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </Tab.Navigator>
        </NavigationContainer>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </PaperProvider>
    </QueryClientProvider>
  );
}