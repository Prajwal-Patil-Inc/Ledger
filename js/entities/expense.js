/* Expense entity. */

import { uid } from "../utils/date.js";

export const EXPENSE_TYPES = ["Fixed", "Variable"];

export function createExpense({
  id,
  category,
  type = "Fixed",
  amount = 0,
  due = "",
  paid = "No",
  recurring = "Yes",
  notes = "",
}) {
  return { id: id || uid(), category, type, amount, due, paid, recurring, notes };
}
