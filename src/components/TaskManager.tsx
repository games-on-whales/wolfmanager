import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { PlayArrow as PlayIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { TaskService, Task, TaskStatus } from '../services';
import { LogService } from '../services';

export const TaskManager: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [executing, setExecuting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const subscription = TaskService.subscribe(setTasks);
    return () => subscription();
  }, []);

  const getStatusColor = (status: TaskStatus): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'success';
      case TaskStatus.FAILED:
        return 'error';
      case TaskStatus.RUNNING:
        return 'primary';
      case TaskStatus.PENDING:
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const handleExecuteTask = async (task: Task) => {
    if (task.status === TaskStatus.RUNNING || executing[task.id]) {
      return;
    }

    setExecuting(prev => ({ ...prev, [task.id]: true }));
    try {
      switch (task.name) {
        case 'Refresh Games List':
          await TaskService.refreshGamesList();
          break;
        case 'Refresh Game Artwork':
          await TaskService.refreshGameArtwork();
          break;
        case 'Clear Artwork Cache':
          await TaskService.clearArtworkCache();
          break;
      }
    } catch (error) {
      LogService.error('Failed to execute task', error);
    } finally {
      setExecuting(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const getTaskIcon = (task: Task) => {
    switch (task.name) {
      case 'Clear Artwork Cache':
        return <DeleteIcon />;
      default:
        return <PlayIcon />;
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Background Tasks
      </Typography>

      {tasks.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          No active tasks
        </Typography>
      ) : (
        <List>
          {tasks.map((task: Task) => (
            <ListItem 
              key={task.id} 
              divider
              secondaryAction={
                <Tooltip title={`Run ${task.name.toLowerCase()}`}>
                  <IconButton
                    edge="end"
                    onClick={() => handleExecuteTask(task)}
                    disabled={task.status === TaskStatus.RUNNING || executing[task.id]}
                  >
                    {getTaskIcon(task)}
                  </IconButton>
                </Tooltip>
              }
            >
              <Box sx={{ width: '100%', pr: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1">
                    {task.name}
                  </Typography>
                  <Chip
                    label={task.status}
                    color={getStatusColor(task.status)}
                    size="small"
                  />
                </Box>
                
                {task.progress !== undefined && task.status === TaskStatus.RUNNING && (
                  <Box sx={{ width: '100%', mt: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={task.progress} 
                    />
                    <Typography variant="caption" color="text.secondary">
                      {task.progress}%
                    </Typography>
                  </Box>
                )}

                {task.message && (
                  <Typography variant="body2" color="text.secondary">
                    {task.message}
                  </Typography>
                )}

                {task.error && (
                  <Typography variant="body2" color="error">
                    Error: {task.error.message}
                  </Typography>
                )}

                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" color="text.secondary">
                    Started: {formatTime(task.startTime)}
                  </Typography>
                  {task.endTime && (
                    <Typography variant="caption" color="text.secondary">
                      Completed: {formatTime(task.endTime)}
                    </Typography>
                  )}
                </Box>
              </Box>
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}; 