const { useState } = require('react');

// Simulate React state
let state;
function setState(newState) { state = newState; }

// Simulate initial render
const createEmptyTask = () => ({ checklist: [] });
setState([createEmptyTask()]);

// Add task
const handleAddTask = () => {
  const newTask = createEmptyTask();
  setState([...state, newTask]);
};
handleAddTask();

// Add checklist item to task 0
const addChecklistItem = (idx, item) => {
  const newTasks = [...state];
  newTasks[idx] = { ...newTasks[idx], checklist: [...newTasks[idx].checklist, item] };
  setState(newTasks);
};
addChecklistItem(0, "Item 1");

console.log(JSON.stringify(state, null, 2));
