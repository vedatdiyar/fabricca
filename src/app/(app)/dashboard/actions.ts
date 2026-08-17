"use server";

import {
  getTasksAction as _getTasksAction,
  addTaskAction as _addTaskAction,
  updateTaskAction as _updateTaskAction,
  updateTaskStatusAction as _updateTaskStatusAction,
  deleteTaskAction as _deleteTaskAction,
} from "./task-actions";
import { refreshDashboardDataAction as _refreshDashboardDataAction } from "./dashboard-data-actions";

export async function getTasksAction(
  ...args: Parameters<typeof _getTasksAction>
) {
  return _getTasksAction(...args);
}

export async function addTaskAction(
  ...args: Parameters<typeof _addTaskAction>
) {
  return _addTaskAction(...args);
}

export async function updateTaskAction(
  ...args: Parameters<typeof _updateTaskAction>
) {
  return _updateTaskAction(...args);
}

export async function updateTaskStatusAction(
  ...args: Parameters<typeof _updateTaskStatusAction>
) {
  return _updateTaskStatusAction(...args);
}

export async function deleteTaskAction(
  ...args: Parameters<typeof _deleteTaskAction>
) {
  return _deleteTaskAction(...args);
}

export async function refreshDashboardDataAction(
  ...args: Parameters<typeof _refreshDashboardDataAction>
) {
  return _refreshDashboardDataAction(...args);
}
