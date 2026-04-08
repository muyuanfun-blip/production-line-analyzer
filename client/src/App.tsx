import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import ProductionLines from "./pages/ProductionLines";
import WorkstationManager from "./pages/WorkstationManager";
import BalanceAnalysis from "./pages/BalanceAnalysis";
import ActionAnalysis from "./pages/ActionAnalysis";
import AISuggestions from "./pages/AISuggestions";
import SnapshotHistory from "./pages/SnapshotHistory";
import SnapshotCompare from "./pages/SnapshotCompare";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/lines"} component={ProductionLines} />
      <Route path={"/lines/:id/workstations"} component={WorkstationManager} />
      <Route path={"/lines/:id/balance"} component={BalanceAnalysis} />
      <Route path={"/lines/:id/actions"} component={ActionAnalysis} />
      <Route path={"/lines/:id/ai"} component={AISuggestions} />
      <Route path={"/lines/:id/snapshots/compare"} component={SnapshotCompare} />
      <Route path={"/lines/:id/snapshots"} component={SnapshotHistory} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
