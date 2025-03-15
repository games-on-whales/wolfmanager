import { LogTester } from "./log-tester";
import { LogViewer } from "./log-viewer";

export default function TestLoggerPage() {
  return (
    <div className="container mx-auto p-4 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Logger Test Page</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-4">Log Generator</h2>
          <LogTester />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-4">Log Viewer</h2>
          <LogViewer />
        </div>
      </div>
    </div>
  );
}
