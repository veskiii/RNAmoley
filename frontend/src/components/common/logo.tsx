import { Colors } from "./colors";
import { useNavigate } from "react-router-dom";

const Logo = () => {
  const navigate = useNavigate();
  return (
    <div
      className="flex flex-col items-start self-start pl-2"
    >
      <h1 className="text-3xl font-bold leading-none">
        RNA <span className="font-semibold" style={{ color: Colors.blue }}>MOLEY</span>
      </h1>
      <p className="mt-1 max-w-[360px] text-[10px] leading-tight text-slate-600">
        Analyze, detect, and refine local structural errors in RNA 3D structures
      </p>
    </div>
  );
};

export default Logo;
