"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskState, TasksConfig } from "@/types/task";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner"; // Assuming sonner for toast notifications

import { formatDateTimeUTC } from "@/app/clients/components/date-format";
// Helper to format dates (deterministic UTC)
const formatDate = (dateString: string | null | undefined) => {
  return formatDateTimeUTC(dateString);
};

export default function TaskListClient() {
  const [tasks, setTasks] = useState<TaskState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskState | null>(null);
  const [newSchedule, setNewSchedule] = useState("");
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/tasks");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: TasksConfig = await response.json();
      setTasks(data.tasks || []);
    } catch (e: any) {
      console.error("Failed to fetch tasks:", e);
      setError("Failed to load tasks. Please try again later.");
      toast.error("Failed to load tasks.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleToggleTask = async (task: TaskState, checked: boolean) => {
    const action = checked ? "start" : "stop";
    const originalState = task.is_enabled;
    // Optimistically update UI
    setTasks((currentTasks) =>
      currentTasks.map((t) =>
        t.id === task.id
          ? { ...t, is_enabled: checked, status: checked ? "IDLE" : "STOPPED" }
          : t
      )
    );

    try {
      const response = await fetch(`/api/tasks/${task.id}/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} task`);
      }
      toast.success(`Task ${task.name} ${action}ed successfully.`);
      // Re-fetch to confirm state, or rely on optimistic update?
      // fetchTasks(); // Option: re-fetch for consistency
    } catch (e: any) {
      console.error(`Failed to ${action} task:`, e);
      toast.error(`Failed to ${action} task: ${e.message}`);
      // Revert optimistic update on failure
      setTasks((currentTasks) =>
        currentTasks.map((t) =>
          t.id === task.id
            ? { ...t, is_enabled: originalState, status: task.status }
            : t
        )
      );
    }
  };

  const handleOpenConfigDialog = (task: TaskState) => {
    setEditingTask(task);
    setNewSchedule(task.schedule);
  };

  const handleSaveSchedule = async () => {
    if (!editingTask || !newSchedule) return;

    const originalSchedule = editingTask.schedule;
    // Optimistic update
    setTasks((currentTasks) =>
      currentTasks.map((t) =>
        t.id === editingTask.id ? { ...t, schedule: newSchedule } : t
      )
    );
    setEditingTask(null); // Close dialog optimistically

    try {
      const response = await fetch(`/api/tasks/${editingTask.id}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: newSchedule }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update schedule");
      }

      toast.success(`Schedule updated for task ${editingTask.name}.`);
      // fetchTasks(); // Option: re-fetch
    } catch (e: any) {
      console.error("Failed to update schedule:", e);
      toast.error(`Failed to update schedule: ${e.message}`);
      // Revert optimistic update
      setTasks((currentTasks) =>
        currentTasks.map((t) =>
          t.id === editingTask.id ? { ...t, schedule: originalSchedule } : t
        )
      );
      // Potentially re-open dialog or keep it open on error?
    }
  };

  const handleRunNow = async (task: TaskState) => {
    if (runningTasks.has(task.id)) {
      toast.error(`Task ${task.name} is already running.`);
      return;
    }

    // Optimistically update UI
    setRunningTasks((prev) => new Set(prev).add(task.id));
    setTasks((currentTasks) =>
      currentTasks.map((t) =>
        t.id === task.id ? { ...t, status: "RUNNING" } : t
      )
    );

    try {
      const response = await fetch(`/api/tasks/${task.id}/run`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to trigger task run");
      }

      toast.success(`Task ${task.name} triggered successfully.`);
    } catch (e: any) {
      console.error("Failed to trigger task run:", e);
      toast.error(`Failed to trigger task run: ${e.message}`);
      // Revert optimistic task status update on failure
      // We keep the original task status from before the run attempt
      setTasks((currentTasks) =>
        currentTasks.map((t) =>
          t.id === task.id ? { ...t, status: task.status } : t
        )
      );
    } finally {
      // Always remove from the local running set after the attempt
      setRunningTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
      // Always refresh the task list to get the final state from backend
      fetchTasks();
    }
  };

  if (isLoading) {
    return <div>Loading tasks...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Last Run</TableHead>
            <TableHead>Next Run</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center">
                No tasks found.
              </TableCell>
            </TableRow>
          ) : (
            tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium">{task.name}</TableCell>
                <TableCell>{task.description}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      task.status === "RUNNING"
                        ? "default"
                        : task.status === "ERROR"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {task.status}
                  </Badge>
                </TableCell>
                <TableCell>{task.schedule}</TableCell>
                <TableCell>{formatDate(task.last_run_at)}</TableCell>
                <TableCell>{formatDate(task.next_run_at)}</TableCell>
                <TableCell>
                  <Switch
                    checked={task.is_enabled}
                    onCheckedChange={(checked) =>
                      handleToggleTask(task, checked)
                    }
                    aria-label={`Toggle task ${task.name}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunNow(task)}
                      disabled={
                        task.status === "RUNNING" || runningTasks.has(task.id)
                      }
                    >
                      Run Now
                    </Button>
                    <Dialog
                      onOpenChange={(isOpen) => !isOpen && setEditingTask(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenConfigDialog(task)}
                        >
                          Configure
                        </Button>
                      </DialogTrigger>
                      {editingTask && editingTask.id === task.id && (
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>
                              Configure Schedule: {editingTask.name}
                            </DialogTitle>
                            <DialogDescription>
                              Update the cron schedule for this task. Make sure
                              it's a valid format.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="schedule" className="text-right">
                                Schedule
                              </Label>
                              <Input
                                id="schedule"
                                value={newSchedule}
                                onChange={(e) => setNewSchedule(e.target.value)}
                                className="col-span-3"
                                placeholder="* * * * *"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button type="button" variant="secondary">
                                Cancel
                              </Button>
                            </DialogClose>
                            <Button type="button" onClick={handleSaveSchedule}>
                              Save changes
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      )}
                    </Dialog>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
