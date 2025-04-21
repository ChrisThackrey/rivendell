declare module 'lodash.throttle' {
  /**
   * Creates a throttled function that only invokes func at most once per every wait milliseconds.
   *
   * @param func The function to throttle.
   * @param wait The number of milliseconds to throttle invocations to.
   * @param options The options object.
   * @param options.leading Specify invoking on the leading edge of the timeout.
   * @param options.trailing Specify invoking on the trailing edge of the timeout.
   * @return Returns the new throttled function.
   */
  function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: {
      leading?: boolean;
      trailing?: boolean;
    }
  ): T & {
    cancel(): void;
    flush(): ReturnType<T>;
  };

  export = throttle;
} 
