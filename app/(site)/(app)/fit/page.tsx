import { RequireAuth } from "@/components/app-shell";
import { FitPage } from "@/components/fit/FitPage";
export default function Page() { return <RequireAuth><FitPage /></RequireAuth>; }
