import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Surface,
  Text,
  AnimatedFAB,
  Chip,
  ProgressBar,
  useTheme,
} from 'react-native-paper';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useQuery } from 'react-query';
import LottieView from 'lottie-react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { api } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import MetricCard from '../components/MetricCard';
import AgentStatusCard from '../components/AgentStatusCard';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen({ navigation }: any) {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [isExtended, setIsExtended] = useState(true);

  const { data: metrics, refetch } = useQuery(
    'dashboard-metrics',
    () => api.getMetrics(),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  const { data: agents } = useQuery('agents', () => api.getAgents());

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const chartConfig = {
    backgroundColor: theme.colors.surface,
    backgroundGradientFrom: theme.colors.surface,
    backgroundGradientTo: theme.colors.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 109, 0, ${opacity})`,
    labelColor: (opacity = 1) => theme.colors.onSurface,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: theme.colors.primary,
    },
  };

  const performanceData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: metrics?.performance || [20, 45, 28, 80, 99, 43, 65],
        color: (opacity = 1) => `rgba(255, 109, 0, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const agentDistribution = [
    {
      name: 'Active',
      population: agents?.filter((a: any) => a.status === 'active').length || 0,
      color: '#4caf50',
      legendFontColor: theme.colors.onSurface,
      legendFontSize: 12,
    },
    {
      name: 'Idle',
      population: agents?.filter((a: any) => a.status === 'idle').length || 0,
      color: '#ff9800',
      legendFontColor: theme.colors.onSurface,
      legendFontSize: 12,
    },
    {
      name: 'Error',
      population: agents?.filter((a: any) => a.status === 'error').length || 0,
      color: '#f44336',
      legendFontColor: theme.colors.onSurface,
      legendFontSize: 12,
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
          />
        }
        onScroll={() => setIsExtended(false)}
        onMomentumScrollEnd={() => setIsExtended(true)}
      >
        {/* Welcome Message */}
        <Surface style={styles.welcomeCard} elevation={1}>
          <View style={styles.welcomeContent}>
            <View style={{ flex: 1 }}>
              <Title>Welcome back, {user?.username}!</Title>
              <Paragraph>Your AI agents are working hard today</Paragraph>
            </View>
            <LottieView
              source={require('../assets/animations/robot.json')}
              autoPlay
              loop
              style={styles.lottie}
            />
          </View>
        </Surface>

        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <MetricCard
            title="Total Workflows"
            value={metrics?.totalWorkflows || 0}
            change={12}
            icon="sitemap"
            color="#ff6d00"
          />
          <MetricCard
            title="Success Rate"
            value={`${metrics?.successRate || 0}%`}
            change={3}
            icon="check-circle"
            color="#4caf50"
          />
          <MetricCard
            title="Active Agents"
            value={metrics?.activeAgents || 0}
            change={0}
            icon="robot"
            color="#1976d2"
          />
          <MetricCard
            title="Optimizations"
            value={metrics?.optimizations || 0}
            change={8}
            icon="auto-fix"
            color="#9c27b0"
          />
        </View>

        {/* Performance Chart */}
        <Card style={styles.chartCard}>
          <Card.Title title="Performance Overview" subtitle="Last 7 days" />
          <Card.Content>
            <LineChart
              data={performanceData}
              width={screenWidth - 32}
              height={220}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </Card.Content>
        </Card>

        {/* Agent Status */}
        <Card style={styles.chartCard}>
          <Card.Title title="Agent Distribution" />
          <Card.Content>
            <PieChart
              data={agentDistribution}
              width={screenWidth - 32}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </Card.Content>
        </Card>

        {/* Active Agents */}
        <Title style={styles.sectionTitle}>Active Agents</Title>
        {agents?.filter((a: any) => a.status === 'active').map((agent: any) => (
          <AgentStatusCard
            key={agent.id}
            agent={agent}
            onPress={() => navigation.navigate('AgentDetails', { agentId: agent.id })}
          />
        ))}

        {/* Recent Activity */}
        <Title style={styles.sectionTitle}>Recent Activity</Title>
        <Card style={styles.activityCard}>
          <Card.Content>
            {metrics?.recentActivity?.map((activity: any, index: number) => (
              <View key={index} style={styles.activityItem}>
                <Icon
                  name={activity.icon}
                  size={24}
                  color={theme.colors.primary}
                />
                <View style={styles.activityContent}>
                  <Text variant="bodyMedium">{activity.title}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                    {activity.time}
                  </Text>
                </View>
                <Chip mode="outlined" compact>
                  {activity.type}
                </Chip>
              </View>
            ))}
          </Card.Content>
        </Card>
      </ScrollView>

      <AnimatedFAB
        icon="plus"
        label="Quick Action"
        extended={isExtended}
        onPress={() => navigation.navigate('QuickActions')}
        visible
        animateFrom="right"
        iconMode="dynamic"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    padding: 16,
  },
  welcomeCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lottie: {
    width: 80,
    height: 80,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  chartCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
  },
  activityCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});