import Loading from "./loading";
import { useEffect } from "react";

const JobProcessing: React.FC = () => {
  useEffect(() => {
    const interval = setInterval(() => {
      window.location.reload();
    }, 50000);

    return () => clearInterval(interval);
  }, []);
  return (
    <div>
      <Loading page="Processing" message="Your job is processing..." />
    </div>
  );
};

export default JobProcessing;
