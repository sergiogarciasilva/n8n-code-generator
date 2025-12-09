import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Box,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  Chip,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  Close,
  ArrowForward,
  ArrowBack,
  CheckCircle,
  RadioButtonUnchecked,
  PlayArrow,
  SmartToy,
  AccountTree,
  Timeline,
  Settings,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';

interface OnboardingStep {
  title: string;
  description: string;
  action?: () => void;
  targetPath?: string;
  icon?: React.ReactNode;
  tips?: string[];
}

const OnboardingTour: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [tourProgress, setTourProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const steps: OnboardingStep[] = [
    {
      title: 'Welcome to n8n Agent Platform!',
      description: 'Let\'s take a quick tour to help you get started with autonomous workflow optimization.',
      icon: <SmartToy sx={{ fontSize: 48 }} />,
      tips: [
        'This platform runs 24/7 to optimize your workflows',
        'AI agents analyze and improve performance automatically',
        'Real-time monitoring keeps you informed',
      ],
    },
    {
      title: 'Dashboard Overview',
      description: 'Your command center for monitoring all agent activities and system metrics.',
      targetPath: '/dashboard',
      icon: <Timeline sx={{ fontSize: 48 }} />,
      tips: [
        'View real-time agent status',
        'Monitor workflow performance metrics',
        'Track optimization suggestions',
      ],
    },
    {
      title: 'Managing Agents',
      description: 'Create and configure AI agents to optimize different types of workflows.',
      targetPath: '/agents',
      icon: <SmartToy sx={{ fontSize: 48 }} />,
      tips: [
        'MCP Agents for Model Context Protocol workflows',
        'Telegram Agents for bot automation',
        'Multi-Agent Systems for complex tasks',
      ],
    },
    {
      title: 'Workflow Monitoring',
      description: 'Track all your n8n workflows and their optimization status.',
      targetPath: '/workflows',
      icon: <AccountTree sx={{ fontSize: 48 }} />,
      tips: [
        'See optimization scores for each workflow',
        'Apply AI-suggested improvements',
        'Monitor success rates and performance',
      ],
    },
    {
      title: 'Configuration',
      description: 'Set up API keys, notifications, and performance settings.',
      targetPath: '/settings',
      icon: <Settings sx={{ fontSize: 48 }} />,
      tips: [
        'Add your OpenAI and Claude API keys',
        'Configure notification preferences',
        'Tune performance parameters',
      ],
    },
    {
      title: 'You\'re All Set!',
      description: 'Start creating agents and let AI optimize your workflows automatically.',
      icon: <CheckCircle sx={{ fontSize: 48, color: 'success.main' }} />,
      tips: [
        'Create your first agent to get started',
        'The platform will continuously monitor and optimize',
        'Check back regularly for insights and suggestions',
      ],
    },
  ];

  useEffect(() => {
    // Check if user is new (you can use localStorage or user preferences)
    const hasCompletedOnboarding = localStorage.getItem('onboardingCompleted');
    if (!hasCompletedOnboarding) {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    setTourProgress((completedSteps.length / steps.length) * 100);
  }, [completedSteps]);

  const handleNext = () => {
    const currentStep = steps[activeStep];
    
    if (currentStep.targetPath) {
      navigate(currentStep.targetPath);
    }
    
    if (currentStep.action) {
      currentStep.action();
    }
    
    if (!completedSteps.includes(activeStep)) {
      setCompletedSteps([...completedSteps, activeStep]);
    }
    
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleSkip = () => {
    setOpen(false);
  };

  const handleComplete = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    setOpen(false);
    navigate('/agents'); // Navigate to agents to create first agent
  };

  const StepIndicator = ({ index, isActive, isCompleted }: any) => (
    <motion.div
      initial={{ scale: 0.8 }}
      animate={{ scale: isActive ? 1.2 : 1 }}
      transition={{ duration: 0.3 }}
    >
      <IconButton
        size="small"
        onClick={() => setActiveStep(index)}
        sx={{
          color: isActive ? 'primary.main' : isCompleted ? 'success.main' : 'grey.400',
        }}
      >
        {isCompleted ? <CheckCircle /> : <RadioButtonUnchecked />}
      </IconButton>
    </motion.div>
  );

  return (
    <Dialog
      open={open}
      onClose={handleSkip}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'visible',
        },
      }}
    >
      <DialogTitle sx={{ m: 0, p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Getting Started</Typography>
          <IconButton
            onClick={handleSkip}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: 'grey.500',
            }}
          >
            <Close />
          </IconButton>
        </Box>
        <LinearProgress
          variant="determinate"
          value={tourProgress}
          sx={{ mt: 2, height: 6, borderRadius: 3 }}
        />
      </DialogTitle>

      <DialogContent dividers>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Box sx={{ py: 2, minHeight: 400 }}>
              <Box display="flex" flexDirection="column" alignItems="center" textAlign="center">
                {steps[activeStep].icon && (
                  <Box mb={3}>
                    {steps[activeStep].icon}
                  </Box>
                )}
                
                <Typography variant="h4" gutterBottom fontWeight="bold">
                  {steps[activeStep].title}
                </Typography>
                
                <Typography variant="body1" color="text.secondary" paragraph>
                  {steps[activeStep].description}
                </Typography>

                {steps[activeStep].tips && (
                  <Card sx={{ mt: 3, width: '100%', bgcolor: 'background.default' }}>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                        Quick Tips:
                      </Typography>
                      <Box display="flex" flexDirection="column" gap={1} mt={2}>
                        {steps[activeStep].tips.map((tip, index) => (
                          <Box key={index} display="flex" alignItems="center" gap={1}>
                            <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                            <Typography variant="body2">{tip}</Typography>
                          </Box>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                )}
              </Box>
            </Box>
          </motion.div>
        </AnimatePresence>

        <Box display="flex" justifyContent="center" gap={1} mt={3}>
          {steps.map((_, index) => (
            <StepIndicator
              key={index}
              index={index}
              isActive={index === activeStep}
              isCompleted={completedSteps.includes(index)}
            />
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleSkip} color="inherit">
          Skip Tour
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
          startIcon={<ArrowBack />}
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
          variant="contained"
          endIcon={activeStep === steps.length - 1 ? <CheckCircle /> : <ArrowForward />}
          sx={{
            background: activeStep === steps.length - 1
              ? 'linear-gradient(45deg, #4caf50 30%, #81c784 90%)'
              : 'linear-gradient(45deg, #ff6d00 30%, #ff9800 90%)',
          }}
        >
          {activeStep === steps.length - 1 ? 'Get Started' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OnboardingTour;