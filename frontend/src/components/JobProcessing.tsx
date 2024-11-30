import Loading from "./loading";

const JobProcessing: React.FC = () => {
  return (
    <div>
        <div className="flex min-h-screen flex-col items-center justify-between p-24 pt-0">
          <div className="flex flex-row text-3xl font-medium items-center self-start">
            <div className="flex flex-col">
              <div className="font-extrabold">
                <h1>RNA</h1>
              </div>
              <div className="font-semibold pr-5">
                <h1>MOLEY</h1>
              </div>
            </div>
            <h1>| Job summary panel</h1>
          </div>
          <Loading message="Your job is processing..." />
        </div>
    </div>
  );
};

export default JobProcessing;
