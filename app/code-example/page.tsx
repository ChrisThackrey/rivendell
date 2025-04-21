"use client";

import SolutionCard from "@/components/solution-card";
import { CodeBlockWithHeader } from "@/components/ui/code-block-demo";

export default function CodeExamplePage() {
  // Example solution with code files
  const exampleSolution = {
    id: "example-solution",
    title: "Interactive Todo List Component",
    description:
      "A complete React Todo List component with TypeScript support that allows adding, marking as complete, and deleting todos. This solution includes proper state management, type definitions, and styling with Tailwind CSS.",
    type: "accepted" as const,
    model: "GPT-4o",
    metrics: {
      executionTime: "105ms",
      complexity: "O(n)",
      memoryUsage: "32MB",
      lineCount: 124,
      codeQuality: 92,
    },
    runId: 1,
    hasReasoning: true,
    codeFiles: [
      {
        filename: "Todo.tsx",
        language: "tsx",
        code: `"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

// Define Todo type
export interface Todo {
  id: string
  text: string
  completed: boolean
}

// Props interface
interface TodoListProps {
  initialTodos?: Todo[]
  className?: string
}

export default function TodoList({ initialTodos = [], className }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos)
  const [newTodoText, setNewTodoText] = useState("")

  // Add a new todo
  const addTodo = () => {
    if (newTodoText.trim() === "") return

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: newTodoText,
      completed: false
    }

    setTodos([...todos, newTodo])
    setNewTodoText("")
  }

  // Toggle todo completion status
  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  // Delete a todo
  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id))
  }

  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <h2 className="text-xl font-bold mb-4">Todo List</h2>

      {/* Add new todo */}
      <div className="flex mb-4">
        <input
          type="text"
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          placeholder="Add a new todo..."
          className="flex-1 px-4 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
        />
        <button
          onClick={addTodo}
          className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Add
        </button>
      </div>

      {/* Todo list */}
      <ul className="space-y-2">
        {todos.map(todo => (
          <li
            key={todo.id}
            className="flex items-center justify-between p-3 border rounded-md"
          >
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="mr-3 h-4 w-4 rounded border-gray-300"
              />
              <span className={todo.completed ? "line-through text-gray-500" : ""}>
                {todo.text}
              </span>
            </div>
            <button
              onClick={() => deleteTodo(todo.id)}
              className="text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {todos.length === 0 && (
        <p className="text-center text-gray-500 mt-4">No todos yet. Add one above!</p>
      )}
    </div>
  )
}`,
      },
      {
        filename: "TodoContext.tsx",
        language: "tsx",
        code: `"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import { Todo } from "./Todo"

// Define the shape of our context
interface TodoContextType {
  todos: Todo[]
  addTodo: (text: string) => void
  toggleTodo: (id: string) => void
  deleteTodo: (id: string) => void
}

// Create the context with a default value
const TodoContext = createContext<TodoContextType | undefined>(undefined)

// Provider component that wraps parts of the app that need todo context
export function TodoProvider({ children }: { children: ReactNode }) {
  const [todos, setTodos] = useState<Todo[]>([])

  const addTodo = (text: string) => {
    if (text.trim() === "") return

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text,
      completed: false
    }

    setTodos(prev => [...prev, newTodo])
  }

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id))
  }

  // Provide the todo context value to children
  return (
    <TodoContext.Provider value={{ todos, addTodo, toggleTodo, deleteTodo }}>
      {children}
    </TodoContext.Provider>
  )
}

// Custom hook to use the todo context
export function useTodos() {
  const context = useContext(TodoContext)
  if (context === undefined) {
    throw new Error("useTodos must be used within a TodoProvider")
  }
  return context
}`,
      },
      {
        filename: "todo.module.css",
        language: "css",
        code: `/* Styling for Todo components */

.todoItem {
  transition: all 0.3s ease;
}

.todoItem.completed {
  opacity: 0.6;
}

.todoCheckbox {
  appearance: none;
  width: 18px;
  height: 18px;
  border: 2px solid #3b82f6;
  border-radius: 4px;
  margin-right: 10px;
  position: relative;
  cursor: pointer;
}

.todoCheckbox:checked {
  background-color: #3b82f6;
}

.todoCheckbox:checked::after {
  content: "✓";
  font-size: 12px;
  color: white;
  position: absolute;
  top: -2px;
  left: 3px;
}

.deleteButton {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.todoItem:hover .deleteButton {
  opacity: 1;
}

.addTodoInput {
  border: 2px solid #e5e7eb;
  transition: border-color 0.2s ease;
}

.addTodoInput:focus {
  border-color: #3b82f6;
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}`,
      },
    ],
  };

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">
        Solution Card with Code Display
      </h1>

      <div className="mb-12">
        <h2 className="text-xl font-bold mb-4">Example Solution Card</h2>
        <SolutionCard {...exampleSolution} />
      </div>

      <div className="mb-12">
        <h2 className="text-xl font-bold mb-4">Code Block Component</h2>
        <p className="text-gray-700 mb-4">
          The same code block component is used inside the solution card.
          Here&apos;s how it looks standalone:
        </p>
        <CodeBlockWithHeader />
      </div>
    </div>
  );
}
