export class CanceledError extends Error {}

export type ThrottledFunction<Args extends any[], Value> = {
  (...args: Args): Promise<Value>
  invokeIgnoreResult: (...args: Args) => void
  cancel: () => Promise<void>
  flush: () => Promise<void>
}

export default function throttle<Args extends any[], Value>(
  fn: (...args: Args) => Value | Promise<Value>,
  _wait?: number | null,
  options?: {
    getNextArgs?: (args0: Args, args1: Args) => Args
  }
): ThrottledFunction<Args, Value>
