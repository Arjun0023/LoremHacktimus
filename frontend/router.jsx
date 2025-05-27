import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import NotFound from "./pages/NotFound";
import AskResults from "./pages/AskResults"; // Import the new Ask Results component
import Dashboard from "./pages/Dashboard"; // Import the Dashboard component

const router = createBrowserRouter([
  {
    path: "/company/:company_id/",
    element: <App />,
  },
  {
    path: "/company/:company_id/application/:application_id",
    element: <App />,
  },
  {
    path: "/company/:company_id/ask",
    element: <AskResults />,
  },
  {
    path: "/company/:company_id/application/:application_id/ask",
    element: <AskResults />,
  },
  {
    path: "/*", // Fallback route for all unmatched paths
    element: <NotFound />, // Component to render for unmatched paths
  },
  {
    path: "/company/:company_id/dashboard",
    element: <Dashboard />,
  },
  {
    path: "/company/:company_id/application/:application_id/dashboard",
    element: <Dashboard />,
  },
]);

export default router;