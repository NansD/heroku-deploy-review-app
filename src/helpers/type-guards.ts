export function notEmpty<TValue>(
  value: TValue | null | undefined | false
): value is TValue {
  if (value === null || value === undefined || value === false) return false
  return true
}
