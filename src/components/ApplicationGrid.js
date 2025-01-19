import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Card, Typography, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ApplicationCard from './ApplicationCard';

const ApplicationGrid = ({ applications, isRemoving, isProcessing, onRemove, onAdd }) => {
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const dragCounter = useRef(0);
    const processingFiles = useRef(new Set());

    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (dragCounter.current === 1) {
            setIsDraggingOver(true);
        }
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDraggingOver(false);
        }
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleFileDrop = async (filePath) => {
        if (!filePath || processingFiles.current.has(filePath)) {
            return false;
        }

        try {
            processingFiles.current.add(filePath);
            
            if (filePath.toLowerCase().endsWith('.lnk')) {
                const exePath = await window.electron.invoke('resolve-shortcut', filePath);
                if (exePath && exePath.toLowerCase().endsWith('.exe')) {
                    const result = await onAdd(exePath);
                    return !!result;
                }
            } else if (filePath.toLowerCase().endsWith('.exe')) {
                const result = await onAdd(filePath);
                return !!result;
            }
            return false;
        } finally {
            processingFiles.current.delete(filePath);
        }
    };

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        dragCounter.current = 0;

        // Extract all file paths
        const filePaths = [];
        
        // Handle files
        if (e.dataTransfer.files?.length > 0) {
            Array.from(e.dataTransfer.files).forEach(file => {
                if (file.path) {
                    filePaths.push(file.path);
                }
            });
        }
        
        // Handle items
        if (e.dataTransfer.items?.length > 0) {
            Array.from(e.dataTransfer.items)
                .filter(item => item.kind === 'file')
                .forEach(item => {
                    const file = item.getAsFile();
                    if (file?.path) {
                        filePaths.push(file.path);
                    }
                });
        }

        // Process all files concurrently
        await Promise.all(
            filePaths
                .filter(path => path.toLowerCase().endsWith('.exe') || path.toLowerCase().endsWith('.lnk'))
                .map(path => handleFileDrop(path))
        );
    }, [onAdd]);

    useEffect(() => {
        const dropZone = document.body;
        
        dropZone.addEventListener('dragenter', handleDragEnter);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('drop', handleDrop);

        return () => {
            dropZone.removeEventListener('dragenter', handleDragEnter);
            dropZone.removeEventListener('dragleave', handleDragLeave);
            dropZone.removeEventListener('dragover', handleDragOver);
            dropZone.removeEventListener('drop', handleDrop);
        };
    }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

    const handleAddClick = async () => {
        try {
            const filePaths = await window.electron.invoke('select-file');
            if (filePaths && Array.isArray(filePaths)) {
                await Promise.all(filePaths.map(filePath => handleFileDrop(filePath)));
            }
        } catch (error) {
            console.error('Failed to select file:', error);
        }
    };

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 3,
                p: 3,
                mt: 8,
                minHeight: 'calc(100vh - 64px)',
                position: 'relative',
                pb: 4
            }}
        >
            {isDraggingOver && (
                <Box
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none'
                    }}
                >
                    <Box
                        sx={{
                            backgroundColor: 'background.paper',
                            padding: 4,
                            borderRadius: 2,
                            border: '2px dashed',
                            borderColor: 'primary.main',
                            textAlign: 'center'
                        }}
                    >
                        <Typography variant="h5" color="primary">
                            Drop .exe files here
                        </Typography>
                    </Box>
                </Box>
            )}

            {applications.map(app => (
                <ApplicationCard
                    key={app.id}
                    application={app}
                    isRemoving={isRemoving}
                    onRemove={() => onRemove(app.id)}
                />
            ))}
            
            <Card
                sx={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    height: '300px',
                    border: '2px dashed',
                    borderColor: isDraggingOver ? 'primary.main' : 'divider',
                    backgroundColor: isDraggingOver ? 'action.hover' : 'background.paper',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: isProcessing ? 'wait' : 'pointer',
                    opacity: isProcessing ? 0.7 : 1,
                    '&:hover': {
                        borderColor: isProcessing ? 'divider' : 'primary.main',
                        backgroundColor: isProcessing ? 'background.paper' : 'action.hover'
                    },
                    transition: 'all 0.2s'
                }}
                onClick={isProcessing ? undefined : handleAddClick}
            >
                {isProcessing ? (
                    <CircularProgress size={40} />
                ) : (
                    <>
                        <Typography 
                            color="textSecondary" 
                            align="center"
                            sx={{ 
                                px: 2,
                                mb: 2
                            }}
                        >
                            Drag and Drop files to add here
                        </Typography>
                        <AddIcon
                            sx={{
                                color: 'primary.main',
                                fontSize: 40,
                                transition: 'transform 0.2s',
                                '&:hover': {
                                    transform: 'scale(1.1)'
                                }
                            }}
                        />
                    </>
                )}
            </Card>
        </Box>
    );
};

export default ApplicationGrid;