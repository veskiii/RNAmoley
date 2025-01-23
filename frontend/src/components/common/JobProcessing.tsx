import Loading from "./loading";

const JobProcessing: React.FC = () => {
  return (
    <div>
      <Loading page="Processing" message="Your job is processing..." />
    </div>
  );
};

export default JobProcessing;
