import { useState, createContext, ReactNode } from "react";
import "./App.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Dashboard from "./components/panels/submitPanel";
import Panel from "./components/panels/analysisPanel3";
import SummaryPanel from "./components/panels/summaryPanel";
import JobProcessing from "./components/common/JobProcessing";
import ErrorPage from "./components/common/ErrorPage";
import HelpPage from "./components/common/helpPage";

// export const API_URL = "https://rnamoley.cs.put.poznan.pl/api/v1";
// export const API_URL = "http://localhost:3001/v1";
export const API_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL
  : "http://localhost:3001/v1";

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
          <Route path="/analysisPanel/:jobId" element={<Panel />} />
          <Route path="/summary/:jobId" element={<SummaryPanel />} />
          <Route path="/jobProcessing" element={<JobProcessing />} />
          <Route path="/errorPage" element={<ErrorPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
      </Router>
    </NameContextProvider>
  );
}

export default App;
