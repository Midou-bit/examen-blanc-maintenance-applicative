import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Ajout
import api from "../api";
import TaskForm from "../components/TaskForm";

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const navigate = useNavigate(); // Ajout

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    const fetchTasks = async () => {
      const res = await api.get("/tasks", {
        headers: { "x-auth-token": token },
      });
      setTasks(res.data);
    };
    fetchTasks();
  }, [navigate]);

  const addTask = (task) => {
    // L'utilisateur doit rafraîchir la page pour voir la nouvelle tâche.
    // Pour corriger, il faudrait faire : setTasks([task, ...tasks]);
  };

  const deleteTask = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/tasks/${id}`, { headers: { "x-auth-token": token } });
      setTasks(tasks.filter((task) => task._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container">
      <h1>Mes Tâches</h1>
      <TaskForm addTask={addTask} />
      <ul className="task-list">
        {tasks.map((task) => (
          <li
            key={task._id}
            className={`task-item ${task.isCompleted ? "completed" : ""}`}
          >
            <span>{task.title}</span>
            <button onClick={() => deleteTask(task._id)}>Supprimer</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Tasks;
