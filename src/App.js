import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { 
  Box, 
  Button,
  CssBaseline, 
  ThemeProvider, 
  createTheme,
  useMediaQuery 
} from '@mui/material';
import { SnackbarProvider } from 'notistack';
import ApplicationGrid from './components/ApplicationGrid';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#1a1a1a',
      paper: '#262626',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3',
    },
  },
});

const App = () => {
  const [applications, setApplications] = useState([]);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(new Set());

  useEffect(() => {
    const loadApps = async () => {
      try {
        const savedApps = await window.electron.invoke('load-applications');
        if (savedApps && Array.isArray(savedApps)) {
          setApplications(savedApps);
        }
      } catch (error) {
        console.error('Error loading applications:', error);
      }
    };
    loadApps();
  }, []);

  const handleAddApplication = async (filePath) => {
    if (!filePath || processingQueue.has(filePath)) return null;

    try {
      setIsProcessing(true);
      setProcessingQueue(prev => new Set(prev).add(filePath));

      const appInfo = await window.electron.invoke('scan-application', filePath);
      
      // If it's a duplicate or invalid, silently ignore it
      if (!appInfo || appInfo.isDuplicate) {
        return null;
      }

      // Generate a truly unique ID
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const newApp = {
        ...appInfo,
        id: uniqueId
      };

      setApplications(prevApps => {
        // Double check for duplicates by path
        if (prevApps.some(app => app.path === newApp.path)) {
          return prevApps;
        }
        const updatedApps = [...prevApps, newApp];
        // Save the updated applications list
        window.electron.invoke('save-applications', updatedApps)
          .catch(error => console.error('Error saving applications:', error));
        return updatedApps;
      });

      return appInfo;
    } catch (error) {
      console.error('Error adding application:', error);
      return null;
    } finally {
      setProcessingQueue(prev => {
        const updated = new Set(prev);
        updated.delete(filePath);
        return updated;
      });
      if (processingQueue.size <= 1) {
        setIsProcessing(false);
      }
    }
  };

  const handleRemoveApplication = async (id) => {
    try {
      setApplications(prevApps => {
        // Find the app to be removed
        const appToRemove = prevApps.find(app => app.id === id);
        if (!appToRemove) return prevApps;

        const updatedApps = prevApps.filter(app => app.id !== id);
        // Save the updated applications list
        window.electron.invoke('save-applications', updatedApps)
          .catch(error => console.error('Error saving applications:', error));
        return updatedApps;
      });
    } catch (error) {
      console.error('Error removing application:', error);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <SnackbarProvider maxSnack={3}>
        <CssBaseline />
        <DndProvider backend={HTML5Backend}>
          <Box 
            sx={{
              minHeight: '100vh',
              background: `
                linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)
              `,
              backgroundAttachment: 'fixed',
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                background: `
                  radial-gradient(circle at 50% 50%, 
                    rgba(255, 255, 255, 0.05) 0%, 
                    rgba(255, 255, 255, 0) 50%
                  )
                `,
                backgroundSize: '15px 15px'
              }
            }}
          >
            <Box sx={{ 
              position: 'fixed',
              top: 20,
              right: 20,
              zIndex: 1000,
              backgroundColor: 'rgba(38, 38, 38, 0.95)',
              padding: 2,
              borderRadius: 2,
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <Button
                variant="contained"
                color={isRemoving ? "error" : "secondary"}
                onClick={() => setIsRemoving(!isRemoving)}
                size="small"
                disabled={isProcessing}
              >
                {isRemoving ? 'Done' : 'Remove'}
              </Button>
            </Box>
            <ApplicationGrid 
              applications={applications}
              isRemoving={isRemoving}
              isProcessing={isProcessing}
              onRemove={handleRemoveApplication}
              onAdd={handleAddApplication}
            />
          </Box>
        </DndProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
};

export default App;