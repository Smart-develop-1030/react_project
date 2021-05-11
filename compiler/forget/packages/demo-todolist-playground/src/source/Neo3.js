import React, { useState, useRef, useEffect } from "react";
import getUpdated from "./getUpdated";
import getFiltered from "./getFiltered";
import initialTodos from "./initialTodos";
import Todo from "./NeoTodo";
import AddTodo from "./NeoAddTodoThemable";
import ColorPicker from "../Components/ColorPicker";
import CountBadge from "../Components/CountBadge";
import Select from "../Components/Select";

/**
 * Neo3 TodoList with Filter and ColorPicker
 *
 * Motivation:
 * Add props and and demo that such computations may need `useMemo`.
 */

function TodoList({ visibility, themeColor }) {
  const [todos, setTodos] = useState(initialTodos);
  const handleChange = todo => setTodos(todos => getUpdated(todos, todo));
  const filtered = getFiltered(todos, visibility);

  return (
    <div>
      <ul>
        {filtered.map(todo => (
          <Todo key={todo.id} todo={todo} onChange={handleChange} />
        ))}
      </ul>
      <AddTodo setTodos={setTodos} themeColor={themeColor} />
    </div>
  );
}

export default function BlazingTodoList() {
  const [themeColor, setThemeColor] = useState("#045975");
  const [visibility, setVisibility] = useState("all");

  const bgGradient = `linear-gradient(
    209.21deg,
    ${primaryColor} 13.57%,
    ${themeColor} 98.38%
  )`;

  return (
    <div className="TodoListApp" style={{ background: bgGradient }}>
      <div className="FilterCountBanner">
        <code>getFiltered()</code> was called
        <CountBadge />
        times
      </div>
      <header>
        <ColorPicker
          value={themeColor}
          onChange={e => setThemeColor(e.target.value)}
        />
        <div className="VisibilityFilter">
          <Select
            value={visibility}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "completed", label: "Completed" },
            ]}
            onChange={value => setVisibility(value)}
          />
        </div>
      </header>
      <TodoList visibility={visibility} themeColor={themeColor} />
    </div>
  );
}

const primaryColor = "rgb(8, 126, 164)";
