/* Savings goal entity. */

import { uid } from "../utils/date.js";

export function createGoal({
  id,
  name,
  target = 0,
  current = 0,
  monthly = 0,
  targetDate = "",
}) {
  return { id: id || uid(), name, target, current, monthly, targetDate };
}
