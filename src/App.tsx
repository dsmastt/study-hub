import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Syllabus from "./pages/Syllabus.tsx";
import ChapterPage from "./pages/Chapter.tsx";
import Questions from "./pages/Questions.tsx";
import Planner from "./pages/Planner.tsx";
import Sessions from "./pages/Sessions.tsx";
import Assistant from "./pages/Assistant.tsx";
import SettingsPage from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="syllabus" element={<Syllabus />} />
        <Route path="syllabus/:chapterId" element={<ChapterPage />} />
        <Route path="questions" element={<Questions />} />
        <Route path="planner" element={<Planner />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
