import Loading from "./loading";
import { Colors } from "./colors";

const JobProcessing: React.FC = () => {
  return (
    <div>
        {/* <div className="flex flex-row text-3xl font-medium items-center self-start p-[30px]">
          <div className="flex flex-col">
            <div className="font-extrabold">
              <h1>RNA</h1>
            </div>
            <div className="font-semibold pr-5 text-{#526969}">
              <h1 style={{ color: Colors.blue }}>MOLEY</h1>
            </div>
          </div>
          <h1>| Processing</h1>
        </div> */}
        <Loading page="Processing" message="Your job is processing..." />
    </div>
  );
};

export default JobProcessing;
