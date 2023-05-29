export class CanceledError extends Error {}

export default function throttle<Args extends any[], Value>(
  fn: (...args: Args) => Value | Promise<Value>,
  _wait?: number | null,
  options?: {
    getNextArgs?: (args0: Args, args1: Args) => Args
  }
): {
  (...args: Args): Promise<Value>
  invokeIgnoreResult: (...args: Args) => void
  cancel: () => Promise<void>
  flush: () => Promise<void>
}
