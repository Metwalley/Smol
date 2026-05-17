import { Toaster } from "sonner";
import { Titlebar } from "@/components/titlebar/Titlebar";
import { Dropzone } from "@/components/dropzone/Dropzone";
import { QueueTotalBanner } from "@/components/filelist/QueueTotalBanner";
import { useMaximized } from "@/hooks/useMaximized";

export default function App() {
  const maximized = useMaximized();

  return (
    <div
      className={`flex flex-col h-screen bg-zinc-950 text-zinc-100 ${
        maximized ? "" : "rounded-xl overflow-hidden"
      }`}
    >
      <Titlebar />

      {/* Main content — flex-col flex-1 min-h-0 ensures FileList can scroll (skill: smol-flex-scroll-fix) */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Dropzone: flex-1 min-h-0 — contains EmptyState or (add-bar + FileList) */}
        <Dropzone />
        {/* Banner: shrink-0, hidden when queue empty */}
        <QueueTotalBanner />
      </div>

      {/* Hardcode theme="dark" — never rely on system theme detection (bug #2) */}
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
