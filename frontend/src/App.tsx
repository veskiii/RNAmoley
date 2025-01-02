import { useState, createContext, ReactNode } from "react";
import "./App.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Dashboard from "./components/panels/startPanel";
import Panel from "./components/panels/analysisPanel";
import SummaryPanel from "./components/panels/summaryPanel";
import JobProcessing from "./components/common/JobProcessing";
import ErrorPage from "./components/common/ErrorPage";

interface NameContextType {
  jobID: string | undefined;
  setId: React.Dispatch<React.SetStateAction<string | undefined>>;
}

interface Props {
  children: ReactNode;
}

// Create a new context and export
export const NameContext = createContext<NameContextType | undefined>(
  undefined
);

// Create a Context Provider
const NameContextProvider: React.FC<Props> = ({ children }) => {
  const [jobID, setId] = useState<string | undefined>(undefined);

  return (
    <NameContext.Provider value={{ jobID, setId }}>
      {children}
    </NameContext.Provider>
  );
};

function App() {
  return (
    <NameContextProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/panel" element={<Panel />} />
          <Route path="/summary/:jobId" element={<SummaryPanel />} />
          <Route path="/jobProcessing" element={<JobProcessing />} />
          <Route path="/errorPage" element={<ErrorPage />} />

        </Routes>
      </Router>
    </NameContextProvider>
  );
}

export default App;
