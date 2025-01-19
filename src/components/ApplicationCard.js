import React, { useState, useEffect, useCallback } from 'react';
import { 
    Card, 
    CardContent, 
    Typography, 
    IconButton, 
    Button, 
    Box,
    CircularProgress,
    Stack,
    Tooltip,
    Fade
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import AppsIcon from '@mui/icons-material/Apps';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import InfoIcon from '@mui/icons-material/Info';
import { useSnackbar } from 'notistack';

const ApplicationCard = ({ application, isRemoving, onRemove }) => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [latestVersion, setLatestVersion] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [lastChecked, setLastChecked] = useState(null);
    const [statusNote, setStatusNote] = useState('');
    const { enqueueSnackbar } = useSnackbar();

    const checkForUpdates = useCallback(async () => {
        if (isChecking || !application) return;
        
        try {
            setIsChecking(true);
            setStatusNote('');
            const result = await window.electron.invoke('check-updates', {
                name: application.name,
                version: application.version,
                publisher: application.publisher,
                path: application.path
            });
            
            if (result?.hasUpdate && result.latestVersion) {
                setUpdateAvailable(true);
                setLatestVersion(result.latestVersion);
                setStatusNote('');
            } else {
                setUpdateAvailable(false);
                setLatestVersion(null);
                setStatusNote(result?.note || '');
            }
            setLastChecked(new Date());
        } catch (error) {
            console.error('Failed to check for updates:', error);
            setStatusNote('Unable to check for updates');
        } finally {
            setIsChecking(false);
        }
    }, [application, isChecking]);

    useEffect(() => {
        // Check for updates only once when component mounts
        checkForUpdates();
    }, [checkForUpdates]);

    const handleUpdate = async () => {
        if (!latestVersion || isUpdating) return;

        try {
            setIsUpdating(true);
            const result = await window.electron.invoke('download-update', {
                name: application.name,
                version: latestVersion,
                publisher: application.publisher,
                currentPath: application.path
            });

            if (result.success) {
                await window.electron.invoke('install-update', {
                    downloadPath: result.downloadPath,
                    currentPath: application.path
                });
                
                enqueueSnackbar('Update completed successfully!', { 
                    variant: 'success',
                    autoHideDuration: 3000
                });
                
                setUpdateAvailable(false);
                setLatestVersion(null);
                setStatusNote('');
                checkForUpdates();
            }
        } catch (error) {
            console.error('Update failed:', error);
            enqueueSnackbar('Update failed. Please try again.', { 
                variant: 'error',
                autoHideDuration: 5000
            });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Box sx={{ position: 'relative', height: 'auto' }}>
            {isRemoving && (
                <IconButton
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: -10,
                        right: -10,
                        zIndex: 2,
                        backgroundColor: 'error.main',
                        width: '24px',
                        height: '24px',
                        minWidth: '24px',
                        padding: 0,
                        border: '2px solid #fff',
                        '&:hover': {
                            backgroundColor: 'error.dark',
                        },
                        '& .MuiSvgIcon-root': {
                            fontSize: '16px',
                        },
                    }}
                    onClick={() => onRemove(application.id)}
                >
                    <CloseIcon />
                </IconButton>
            )}
            
            <Card 
                sx={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    minHeight: '300px',
                    maxHeight: '300px',
                    backgroundColor: 'background.paper',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 3
                    },
                    transition: 'transform 0.2s, box-shadow 0.2s'
                }}
            >
                <Box
                    sx={{
                        padding: 2,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100px'
                    }}
                >
                    {application.icon ? (
                        <img
                            src={`data:image/png;base64,${application.icon}`}
                            alt={`${application.name} icon`}
                            style={{
                                width: '64px',
                                height: '64px',
                                objectFit: 'contain'
                            }}
                        />
                    ) : (
                        <AppsIcon
                            sx={{
                                width: 64,
                                height: 64,
                                color: 'text.secondary'
                            }}
                        />
                    )}
                </Box>
                
                <CardContent 
                    sx={{ 
                        flexGrow: 1, 
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        padding: 2,
                        '&:last-child': { 
                            paddingBottom: 2 
                        }
                    }}
                >
                    <Typography 
                        variant="h6" 
                        component="h3" 
                        align="center"
                        sx={{
                            fontSize: '1.1rem',
                            fontWeight: 500,
                            mb: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: 1.3,
                            maxHeight: '2.6em'
                        }}
                    >
                        {application.name}
                    </Typography>
                    
                    <Typography 
                        color="text.secondary" 
                        variant="body2" 
                        align="center"
                        sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: 1
                        }}
                    >
                        {application.publisher || 'Unknown Publisher'}
                    </Typography>
                    
                    <Stack spacing={1} alignItems="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                            <Typography
                                color="text.secondary"
                                variant="body2"
                                align="center"
                                sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                Current Version: {application.version}
                            </Typography>
                            {lastChecked && (
                                <Tooltip title={`Last checked: ${lastChecked.toLocaleString()}`}>
                                    <InfoIcon sx={{ fontSize: 16, color: 'text.secondary', cursor: 'help' }} />
                                </Tooltip>
                            )}
                        </Box>

                        <Box sx={{ minHeight: '48px', display: 'flex', alignItems: 'center' }}>
                            {isChecking ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CircularProgress size={14} />
                                    <Typography variant="caption" color="text.secondary">
                                        Checking for updates...
                                    </Typography>
                                </Box>
                            ) : updateAvailable && latestVersion ? (
                                <Fade in>
                                    <Box sx={{ width: '100%' }}>
                                        <Typography 
                                            color="error.main" 
                                            variant="body2" 
                                            align="center"
                                            sx={{ 
                                                fontSize: '0.8rem',
                                                mb: 1,
                                                fontStyle: 'italic'
                                            }}
                                        >
                                            New Version Available: {latestVersion}
                                        </Typography>
                                        
                                        <Button
                                            variant="contained"
                                            color="success"
                                            startIcon={isUpdating ? (
                                                <CircularProgress size={16} color="inherit" />
                                            ) : (
                                                <FileUploadIcon />
                                            )}
                                            size="small"
                                            onClick={handleUpdate}
                                            disabled={isUpdating}
                                            fullWidth
                                        >
                                            {isUpdating ? 'Updating...' : 'Update'}
                                        </Button>
                                    </Box>
                                </Fade>
                            ) : statusNote ? (
                                <Fade in>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        align="center"
                                        sx={{ fontStyle: 'italic' }}
                                    >
                                        {statusNote}
                                    </Typography>
                                </Fade>
                            ) : null}
                        </Box>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
};

export default ApplicationCard;