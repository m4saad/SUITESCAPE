import React from 'react';
import { Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

const AddApplicationButton = ({ onAdd, variant = "contained", color = "primary", children, ...props }) => {
  const handleClick = async () => {
    try {
      const filePath = await window.electron.invoke('select-file');
      if (filePath) {
        onAdd(filePath);
      }
    } catch (error) {
      console.error('Failed to select file:', error);
    }
  };

  return (
    <Button
      variant={variant}
      color={color}
      startIcon={<AddIcon />}
      onClick={handleClick}
      fullWidth
      {...props}
    >
      {children || 'Add Application'}
    </Button>
  );
};

export default AddApplicationButton;