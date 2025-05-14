import { Colors } from "./colors";

const Logo = () => {
  return (
    <div className="flex flex-row text-2xl font-medium items-center self-start pl-2">
      <div className="flex flex-col">
        <div className="font-bold">
          <h1>RNA</h1>
        </div>
        <div className="font-semibold" style={{ color: Colors.blue }}>
          <h1>MOLEY</h1>
        </div>
      </div>
    </div>
  );
};

export default Logo;
