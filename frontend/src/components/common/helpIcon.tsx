import { IoIosHelpCircleOutline } from "react-icons/io";
import { useNavigate } from "react-router-dom";

const HelpIcon = () => {
      const navigate = useNavigate();
    return (
        <div className="justify-center flex flex-col items-end pl-2 z-[2000]">
            <IoIosHelpCircleOutline style={{ width: '2em', height: '2em', cursor: "pointer" }} onClick={() => navigate("/help")} />
        </div>
    );
};

export default HelpIcon;