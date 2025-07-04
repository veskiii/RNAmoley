import { Colors } from "./colors";
import { useNavigate } from "react-router-dom";

const Logo = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-row text-2xl font-medium items-center self-start pl-2 cursor-pointer"
    onClick={() => navigate("/")}>
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
