import { useEffect, useState } from "react";

export function useSettings() {
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("alwaysOnTop");
    if (saved !== null) {
      setAlwaysOnTop(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("alwaysOnTop", JSON.stringify(alwaysOnTop));
  }, [alwaysOnTop]);

  return { alwaysOnTop, setAlwaysOnTop };
}
