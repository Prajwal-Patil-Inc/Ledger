/* Bill entity. */

import { uid } from "../utils/date.js";

export function createBill({
  id,
  item,
  category = "",
  cost = 0,
  due = "",
  method = "",
  recurring = "Yes",
  paid = "No",
  renewal = "",
  notes = "",
}) {
  return { id: id || uid(), item, category, cost, due, method, recurring, paid, renewal, notes };
}
