import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Chip
} from '@mui/material';
import { TaskService, Task, TaskStatus } from '../services';
import { LogService } from '../services';

export const TaskManager: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);

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
            <ListItem key={task.id} divider>
              <Box sx={{ width: '100%' }}>
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
                    Error: {task.error}
                  </Typography>
                )}
              </Box>
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}; 