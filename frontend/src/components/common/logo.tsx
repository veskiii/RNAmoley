import { Colors } from "./colors";
import { useNavigate } from "react-router-dom";

const Logo = () => {
  const navigate = useNavigate();
  return (
    <div
      className="flex flex-col items-start self-start pl-4"
    >
      <h1 className="text-3xl font-bold leading-none">
        RNA <span className="font-semibold" style={{ color: Colors.blue }}>MOLEY</span>
      </h1>
    </div>
  );
};

export default Logo;
