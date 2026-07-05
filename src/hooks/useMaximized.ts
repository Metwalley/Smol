import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

export function useMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setMaximized);
    const unlisten = win.onResized(async () => {
      setMaximized(await win.isMaximized());
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return maximized;
}
