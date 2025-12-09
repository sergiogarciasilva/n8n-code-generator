import React, { useState, useEffect } from 'react';
import {
  Tooltip,
  IconButton,
  Paper,
  Typography,
  Box,
  Button,
} from '@mui/material';
import {
  HelpOutline,
  Close,
  Lightbulb,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface InteractiveTooltipProps {
  id: string;
  title: string;
  content: string;
  tips?: string[];
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  showOnFirstVisit?: boolean;
}

const InteractiveTooltip: React.FC<InteractiveTooltipProps> = ({
  id,
  title,
  content,
  tips,
  children,
  placement = 'top',
  showOnFirstVisit = true,
}) => {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const tooltipDismissed = localStorage.getItem(`tooltip-dismissed-${id}`);
    if (tooltipDismissed) {
      setDismissed(true);
    } else if (showOnFirstVisit) {
      // Show tooltip automatically on first visit
      setTimeout(() => setOpen(true), 1000);
    }
  }, [id, showOnFirstVisit]);

  const handleDismiss = () => {
    setOpen(false);
    setDismissed(true);
    localStorage.setItem(`tooltip-dismissed-${id}`, 'true');
  };

  const TooltipContent = () => (
    <Paper
      sx={{
        p: 2,
        maxWidth: 300,
        bgcolor: 'background.paper',
        boxShadow: 3,
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
        <Box display="flex" alignItems="center" gap={1}>
          <Lightbulb sx={{ color: 'warning.main', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight="bold">
            {title}
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleDismiss}>
          <Close fontSize="small" />
        </IconButton>
      </Box>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        {content}
      </Typography>
      
      {tips && tips.length > 0 && (
        <Box mt={2}>
          <Typography variant="caption" fontWeight="bold" gutterBottom>
            Pro Tips:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2, mt: 1 }}>
            {tips.map((tip, index) => (
              <Typography key={index} component="li" variant="caption" sx={{ mb: 0.5 }}>
                {tip}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
      
      <Button
        size="small"
        onClick={handleDismiss}
        sx={{ mt: 2 }}
        fullWidth
      >
        Got it!
      </Button>
    </Paper>
  );

  if (dismissed) {
    return children;
  }

  return (
    <Tooltip
      title={<TooltipContent />}
      placement={placement}
      open={open}
      onClose={() => setOpen(false)}
      onOpen={() => setOpen(true)}
      arrow
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: 'transparent',
            boxShadow: 'none',
          },
        },
      }}
    >
      <Box sx={{ position: 'relative', display: 'inline-block' }}>
        {children}
        <AnimatePresence>
          {!open && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                zIndex: 10,
              }}
            >
              <IconButton
                size="small"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  width: 24,
                  height: 24,
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
              >
                <HelpOutline sx={{ fontSize: 14 }} />
              </IconButton>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Tooltip>
  );
};

export default InteractiveTooltip;