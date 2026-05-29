"use client";

import React, {
  useEffect,
  useReducer,
  useCallback,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  getAcademicRecommendationsAction,
  discoverNewRecommendationsAction,
  ThesisCoreData,
  LiteratureRecommendation,
} from "../actions";
import {
  getTasksAction,
  createTaskAction,
  updateTaskStatusAction,
  deleteTaskAction,
  TaskItem,
} from "../_actions/tasks";
import { type DropResult } from "@hello-pangea/dnd";

export interface DashboardState {
  // Recommendations state
  recs: LiteratureRecommendation[];
  isLoading: boolean;
  isLoadingRecs: boolean;
  error: string;
  recsError: string;
  selectedRec: LiteratureRecommendation | null;

  // Task state
  tasks: TaskItem[];
  tasksLoading: boolean;
  taskSubmitting: boolean;
  taskDescription: string;
  taskDueDate: string;
  tasksError: string;
  isTasksCollapsed: boolean;
}

const initialState: DashboardState = {
  recs: [],
  isLoading: true,
  isLoadingRecs: false,
  error: "",
  recsError: "",
  selectedRec: null,

  tasks: [],
  tasksLoading: true,
  taskSubmitting: false,
  taskDescription: "",
  taskDueDate: "",
  tasksError: "",
  isTasksCollapsed: false,
};

type DashboardAction =
  | { type: "FETCH_START" }
  | {
      type: "FETCH_SUCCESS";
      payload: {
        recs: LiteratureRecommendation[];
        recsError: string;
      };
    }
  | { type: "FETCH_FAILURE"; payload: string }
  | { type: "FETCH_RECS_START" }
  | {
      type: "FETCH_RECS_SUCCESS";
      payload: {
        recs: LiteratureRecommendation[];
        recsError: string;
      };
    }
  | { type: "SET_SELECTED_REC"; payload: LiteratureRecommendation | null }
  // Task Actions
  | { type: "TASKS_FETCH_START" }
  | { type: "TASKS_FETCH_SUCCESS"; payload: TaskItem[] }
  | { type: "TASKS_FETCH_FAILURE"; payload: string }
  | { type: "TASKS_SUBMIT_START" }
  | { type: "TASKS_SUBMIT_SUCCESS" }
  | { type: "TASKS_SUBMIT_FAILURE"; payload: string }
  | { type: "SET_TASK_DESCRIPTION"; payload: string }
  | { type: "SET_TASK_DUE_DATE"; payload: string }
  | { type: "SET_TASKS_COLLAPSED"; payload: boolean }
  | {
      type: "UPDATE_TASK_STATUS_LOCAL";
      payload: { id: number; status: "todo" | "doing" | "done" };
    }
  | { type: "DELETE_TASK_LOCAL"; payload: number };

function dashboardReducer(
  state: DashboardState,
  action: DashboardAction,
): DashboardState {
  switch (action.type) {
    case "FETCH_START":
      return {
        ...state,
        isLoading: true,
        error: "",
      };
    case "FETCH_SUCCESS":
      return {
        ...state,
        isLoading: false,
        recs: action.payload.recs,
        recsError: action.payload.recsError,
        error: "",
      };
    case "FETCH_FAILURE":
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case "FETCH_RECS_START":
      return {
        ...state,
        isLoadingRecs: true,
        recsError: "",
      };
    case "FETCH_RECS_SUCCESS":
      return {
        ...state,
        isLoadingRecs: false,
        recs: action.payload.recs,
        recsError: action.payload.recsError,
      };
    case "SET_SELECTED_REC":
      return {
        ...state,
        selectedRec: action.payload,
      };
    case "TASKS_FETCH_START":
      return {
        ...state,
        tasksLoading: true,
      };
    case "TASKS_FETCH_SUCCESS":
      return {
        ...state,
        tasksLoading: false,
        tasks: action.payload,
        tasksError: "",
      };
    case "TASKS_FETCH_FAILURE":
      return {
        ...state,
        tasksLoading: false,
        tasksError: action.payload,
      };
    case "TASKS_SUBMIT_START":
      return {
        ...state,
        taskSubmitting: true,
        tasksError: "",
      };
    case "TASKS_SUBMIT_SUCCESS":
      return {
        ...state,
        taskSubmitting: false,
        taskDescription: "",
        taskDueDate: "",
      };
    case "TASKS_SUBMIT_FAILURE":
      return {
        ...state,
        taskSubmitting: false,
        tasksError: action.payload,
      };
    case "SET_TASK_DESCRIPTION":
      return {
        ...state,
        taskDescription: action.payload,
      };
    case "SET_TASK_DUE_DATE":
      return {
        ...state,
        taskDueDate: action.payload,
      };
    case "SET_TASKS_COLLAPSED":
      return {
        ...state,
        isTasksCollapsed: action.payload,
      };
    case "UPDATE_TASK_STATUS_LOCAL":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.payload.id ? { ...t, status: action.payload.status } : t,
        ),
      };
    case "DELETE_TASK_LOCAL":
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.payload),
      };
    default:
      return state;
  }
}

export function useDashboard(initialThesisData: ThesisCoreData | null) {
  const router = useRouter();
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const loadTasks = useCallback(async () => {
    try {
      dispatch({ type: "TASKS_FETCH_START" });
      const res = await getTasksAction();
      if (res.success && res.tasks) {
        dispatch({ type: "TASKS_FETCH_SUCCESS", payload: res.tasks || [] });
      } else {
        dispatch({
          type: "TASKS_FETCH_FAILURE",
          payload: res.error || "Görevler yüklenemedi.",
        });
      }
    } catch {
      dispatch({
        type: "TASKS_FETCH_FAILURE",
        payload: "Bağlantı hatası oluştu.",
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    const handle = requestAnimationFrame(() => {
      if (active) {
        loadTasks();
      }
    });
    return () => {
      active = false;
      cancelAnimationFrame(handle);
    };
  }, [loadTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.taskDescription.trim()) return;

    try {
      dispatch({ type: "TASKS_SUBMIT_START" });
      const res = await createTaskAction(state.taskDescription, state.taskDueDate);
      if (res.success) {
        dispatch({ type: "TASKS_SUBMIT_SUCCESS" });
        await loadTasks();
      } else {
        dispatch({
          type: "TASKS_SUBMIT_FAILURE",
          payload: res.error || "Görev eklenirken bir hata oluştu.",
        });
      }
    } catch {
      dispatch({
        type: "TASKS_SUBMIT_FAILURE",
        payload: "Beklenmeyen bir hata oluştu.",
      });
    }
  };

  const handleUpdateStatus = async (
    taskId: number,
    newStatus: "todo" | "doing" | "done",
  ) => {
    try {
      const res = await updateTaskStatusAction(taskId, newStatus);
      if (res.success) {
        dispatch({
          type: "UPDATE_TASK_STATUS_LOCAL",
          payload: { id: taskId, status: newStatus },
        });
      } else {
        dispatch({
          type: "TASKS_FETCH_FAILURE",
          payload: res.error || "Görev durumu güncellenemedi.",
        });
      }
    } catch {
      dispatch({ type: "TASKS_FETCH_FAILURE", payload: "Bağlantı hatası." });
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      const res = await deleteTaskAction(taskId);
      if (res.success) {
        dispatch({ type: "DELETE_TASK_LOCAL", payload: taskId });
      } else {
        dispatch({
          type: "TASKS_FETCH_FAILURE",
          payload: res.error || "Görev silinemedi.",
        });
      }
    } catch {
      dispatch({ type: "TASKS_FETCH_FAILURE", payload: "Bağlantı hatası." });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const taskId = parseInt(draggableId);
    const newStatus = destination.droppableId as "todo" | "doing" | "done";

    dispatch({
      type: "UPDATE_TASK_STATUS_LOCAL",
      payload: { id: taskId, status: newStatus },
    });

    const res = await updateTaskStatusAction(taskId, newStatus);
    if (!res.success) {
      await loadTasks();
    }
  };

  const fetchRecommendations = async (
    core: ThesisCoreData | null,
    forceRefresh = false,
    boxId?: number,
  ) => {
    try {
      dispatch({ type: "FETCH_RECS_START" });

      if (!core) {
        dispatch({
          type: "FETCH_RECS_SUCCESS",
          payload: {
            recs: [],
            recsError:
              "Tavsiye üretilebilmesi için öncelikle Tez Anayasası'nı oluşturmalısınız.",
          },
        });
        return;
      }

      const recsRes = forceRefresh
        ? await discoverNewRecommendationsAction(
            core.title,
            core.researchQuestion,
            core.argument,
            core.methodology,
            boxId,
          )
        : await getAcademicRecommendationsAction(
            core.title,
            core.researchQuestion,
            core.argument,
            core.methodology,
          );

      if (recsRes.success && recsRes.recommendations) {
        dispatch({
          type: "FETCH_RECS_SUCCESS",
          payload: {
            recs: recsRes.recommendations,
            recsError: "",
          },
        });
      } else {
        dispatch({
          type: "FETCH_RECS_SUCCESS",
          payload: {
            recs: [],
            recsError: recsRes.error || "Tavsiyeler yüklenirken hata oluştu.",
          },
        });
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      dispatch({
        type: "FETCH_RECS_SUCCESS",
        payload: {
          recs: [],
          recsError: "API_CONNECTION_FAILURE",
        },
      });
    }
  };

  useEffect(() => {
    async function loadDashboardData() {
      try {
        dispatch({ type: "FETCH_START" });

        if (initialThesisData) {
          const recsRes = await getAcademicRecommendationsAction(
            initialThesisData.title,
            initialThesisData.researchQuestion,
            initialThesisData.argument,
            initialThesisData.methodology,
          );

          if (recsRes.success && recsRes.recommendations) {
            dispatch({
              type: "FETCH_SUCCESS",
              payload: {
                recs: recsRes.recommendations,
                recsError: "",
              },
            });
          } else {
            dispatch({
              type: "FETCH_SUCCESS",
              payload: {
                recs: [],
                recsError:
                  recsRes.error || "Tavsiyeler yüklenirken hata oluştu.",
              },
            });
          }
        } else {
          dispatch({
            type: "FETCH_SUCCESS",
            payload: {
              recs: [],
              recsError:
                "Tavsiye üretilebilmesi için öncelikle Tez Anayasası'nı oluşturmalısınız.",
            },
          });
        }
      } catch (err) {
        console.error("Dashboard error:", err);
        dispatch({
          type: "FETCH_FAILURE",
          payload: "Tez Karargahı yüklenirken kritik bir hata oluştu.",
        });
      }
    }

    loadDashboardData();
  }, [router, initialThesisData]);

  const setTaskDescription = (desc: string) => {
    dispatch({ type: "SET_TASK_DESCRIPTION", payload: desc });
  };

  const setTaskDueDate = (date: string) => {
    dispatch({ type: "SET_TASK_DUE_DATE", payload: date });
  };

  const setIsTasksCollapsed = (collapsed: boolean) => {
    dispatch({ type: "SET_TASKS_COLLAPSED", payload: collapsed });
  };

  const setSelectedRec = (rec: LiteratureRecommendation | null) => {
    dispatch({ type: "SET_SELECTED_REC", payload: rec });
  };

  const todoTasks = state.tasks.filter((t) => t.status === "todo");
  const doingTasks = state.tasks.filter((t) => t.status === "doing");
  const doneTasks = state.tasks.filter((t) => t.status === "done");

  return {
    state,
    mounted,
    todoTasks,
    doingTasks,
    doneTasks,
    loadTasks,
    handleCreateTask,
    handleUpdateStatus,
    handleDeleteTask,
    handleDragEnd,
    fetchRecommendations,
    setTaskDescription,
    setTaskDueDate,
    setIsTasksCollapsed,
    setSelectedRec,
  };
}
