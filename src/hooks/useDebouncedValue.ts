import { useEffect, useState } from "react";

const useDebouncedValue = <T>(value: T, delay = 400): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

export default useDebouncedValue;
