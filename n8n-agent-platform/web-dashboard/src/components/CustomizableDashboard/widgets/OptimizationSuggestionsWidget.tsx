import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  LinearProgress,
} from '@mui/material';
import { AutoFixHigh, TrendingUp, Speed, Code, AccountTree, SmartToy } from '@mui/icons-material';
import { motion } from 'framer-motion';

const OptimizationSuggestionsWidget: React.FC = () => {
  const suggestions = [
    {
      id: '1',
      workflow: 'Customer Onboarding',
      type: 'performance',
      impact: 'high',
      improvement: 35,
      description: 'Batch API calls to reduce execution time',
      icon: <Speed />,
    },
    {
      id: '2',
      workflow: 'Data Processing Pipeline',
      type: 'reliability',
      impact: 'medium',
      improvement: 20,
      description: 'Add error handling and retry logic',
      icon: <Code />,
    },
    {
      id: '3',
      workflow: 'Telegram Bot Handler',
      type: 'optimization',
      impact: 'high',
      improvement: 45,
      description: 'Implement caching for frequently accessed data',
      icon: <TrendingUp />,
    },
  ];

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'info';
    }
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Optimization Suggestions</Typography>
        <Chip
          icon={<AutoFixHigh />}
          label={`${suggestions.length} Available`}
          color="primary"
          size="small"
        />
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {suggestions.map((suggestion, index) => (
          <motion.div
            key={suggestion.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              sx={{
                mb: 2,
                bgcolor: 'background.default',
                '&:hover': {
                  boxShadow: 2,
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box display="flex" alignItems="flex-start" gap={2}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      bgcolor: 'primary.light',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'primary.contrastText',
                    }}
                  >
                    {suggestion.icon}
                  </Box>
                  
                  <Box sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      <Typography variant="body2" fontWeight="bold">
                        {suggestion.workflow}
                      </Typography>
                      <Chip
                        label={`${suggestion.impact} impact`}
                        color={getImpactColor(suggestion.impact) as any}
                        size="small"
                        sx={{ height: 20 }}
                      />
                    </Box>
                    
                    <Typography variant="caption" color="textSecondary" display="block" mb={1}>
                      {suggestion.description}
                    </Typography>
                    
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="caption" color="textSecondary">
                        Expected improvement:
                      </Typography>
                      <Typography variant="caption" fontWeight="bold" color="success.main">
                        +{suggestion.improvement}%
                      </Typography>
                    </Box>
                    
                    <LinearProgress
                      variant="determinate"
                      value={suggestion.improvement}
                      sx={{
                        mt: 1,
                        height: 4,
                        borderRadius: 2,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: 'success.main',
                        },
                      }}
                    />
                  </Box>
                </Box>
                
                <Box display="flex" justifyContent="flex-end" mt={2}>
                  <Button size="small" startIcon={<AutoFixHigh />}>
                    Apply
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </Box>
    </Box>
  );
};

export default OptimizationSuggestionsWidget;