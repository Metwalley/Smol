import { Toaster } from "sonner";
import { Titlebar } from "@/components/titlebar/Titlebar";
import { Dropzone } from "@/components/dropzone/Dropzone";
import { BareJobList } from "@/components/filelist/BareJobList";
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

      {/* Main content — flex-col flex-1 min-h-0 ensures BareJobList can scroll (skill: smol-flex-scroll-fix) */}
      <div className="flex flex-col flex-1 min-h-0">
        <Dropzone />
        <BareJobList />
      </div>

      {/* Hardcode theme="dark" — never rely on system theme detection (bug #2) */}
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
